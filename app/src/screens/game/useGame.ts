import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import {
  GameState, Level, MoveEvent, Session, createSession, current, enteredCells, eventMessage, invalidMessage, restart,
  hintFor, retractTarget, sessionMove, sessionUndo, starsFor, validateMove,
} from '../../engine';
import { boardGeom, cellAt, cellCenter } from '../../components/Board';
import { GameSource, useNav } from '../../nav/Nav';
import { dailyLevel, chaosLevel, endlessLevel, practiceLevel, rushLevel } from '../../lib/procedural';
import { campaignComplete, campaignLevelNumber, getLevel, mechanicsOf, newlyUnlockedCampaignWorld, nextCampaignLevelId, nextLevelId, MECH_INTRO, Mech } from '../../lib/levels';
import { evaluateAchievements } from '../../lib/achievements';
import { haptic } from '../../lib/haptics';
import { sfx } from '../../lib/sound';
import { submitDailyRun, submitGlobalRun } from '../../cloud/leaderboards';
import type { SubmissionResult } from '../../cloud/leaderboards';
import {
  HINTS_MAX, HINTS_REFILL_MS, SolveOutcome, adoptSavedRun, beginEnergyRun, dateKey, getState, isRunActive, markSeen, refreshHints, saveResume, recordClassicSolve, recordDailySolve, recordHint,
  recordOtherSolve, recordRunBest, setLastLevel, setOnboarded, spendHint, trustedNow, useSettings, useStore,
} from '../../store/store';

export const RUSH_SECONDS = 180;
export const MAX_HINTS = HINTS_MAX;

function resolveLevel(source: GameSource, index: number, nonce: number, dailyDay?: string): Level {
  switch (source.kind) {
    case 'classic': return getLevel(source.levelId);
    case 'master': return getLevel(source.levelId ?? '8-1');
    case 'campaign': return getLevel(source.levelId);
    case 'daily': return dailyLevel(dailyDay ?? dateKey());
    case 'rush': return rushLevel(index, nonce);
    case 'endless': return endlessLevel(index, nonce);
    case 'chaos': return chaosLevel(index, nonce);
    default: return practiceLevel();
  }
}

export interface ResultData {
  hints: number;
  stars: number;
  badges: string[];
  moves: number;
  time: number;
  bonus: boolean;
  outcome: SolveOutcome | null;
  streak: number | null;
  campaignWorldUnlocked?: string | null;
  campaignComplete?: boolean;
}

export function useGame(source: GameSource, runId: string, dailyDay?: string) {
  const nav = useNav();
  const settings = useSettings();
  const nonce = useRef(Date.now() % 100000).current;
  const savedRun = getState().resume;
  const initialRunDay = source.kind === 'daily'
    ? dailyDay || (savedRun?.runId === runId ? savedRun.day : '') || dateKey()
    : undefined;
  const runDay = useRef(initialRunDay).current;
  const [index, setIndex] = useState(1);
  const level = useMemo(() => resolveLevel(source, index, nonce, runDay), [source, index, nonce, runDay]);

  const [session, setSession] = useState<Session>(() => createSession(level));
  const sessRef = useRef(session);
  const apply = useCallback((s: Session) => { sessRef.current = s; setSession(s); }, []);

  const [feedback, setFeedback] = useState<{ text: string; tone: 'info' | 'bad' | 'good' } | null>(null);
  const [errCell, setErrCell] = useState<number | null>(null);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const hintsRemaining = useStore((s) => s.hintsRemaining);
  const hintsRefillStartedAt = useStore((s) => s.hintsRefillStartedAt);
  const [hintsNow, setHintsNow] = useState(trustedNow());
  const secRef = useRef(0);
  const leftRef = useRef(RUSH_SECONDS);
  const [rushOver, setRushOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [hintLimit, setHintLimit] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [failView, setFailView] = useState(false);
  const [intro, setIntro] = useState<Exclude<Mech, 'bonus'> | null>(null);
  const [badgeToast, setBadgeToast] = useState<string[]>([]);
  const [runOver, setRunOver] = useState<{ score: number; best: number } | null>(null);
  const [score, setScore] = useState(0);
  const [energyDenied, setEnergyDenied] = useState(false);
  const [leaderboardSubmission, setLeaderboardSubmission] = useState<SubmissionResult | 'pending' | null>(null);
  const leaderboardTask = useRef<(() => Promise<SubmissionResult>) | null>(null);
  const completedPuzzle = useRef<string | null>(null);

  const sendLeaderboardSubmission = useCallback((task: () => Promise<SubmissionResult>) => {
    leaderboardTask.current = task;
    setLeaderboardSubmission('pending');
    void task().then(setLeaderboardSubmission).catch(() => setLeaderboardSubmission('error'));
  }, []);
  const retryLeaderboardSubmission = useCallback(() => {
    if (leaderboardTask.current) sendLeaderboardSubmission(leaderboardTask.current);
  }, [sendLeaderboardSubmission]);

  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const sweep = useSharedValue(2);
  const dragging = useRef(false);
  const lastInvalid = useRef('');
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settings.reduceMotion) { pulse.value = 0; return; }
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [settings.reduceMotion, pulse]);

  const st: GameState = current(session);
  const timed = source.kind === 'rush';
  const overlayOpen = paused || confirmRestart || hintLimit || !!result || failView || !!intro || !!runOver;

  const clearHints = useCallback(() => setHintCells((h) => (h.length ? [] : h)), []);

  useEffect(() => {
    if (hintsRefillStartedAt === null) return;
    const tick = () => {
      refreshHints();
      if (hintsRemaining === 0) setHintsNow(trustedNow());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hintsRefillStartedAt, hintsRemaining]);

  const hintRefillMs = hintsRemaining > 0 || hintsRefillStartedAt === null
    ? null
    : Math.max(0, HINTS_REFILL_MS - (hintsNow - hintsRefillStartedAt));

  const say = useCallback((text: string, tone: 'info' | 'bad' | 'good' = 'info') => {
    setFeedback({ text, tone });
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 2600);
  }, []);

  // new level -> reset
  useEffect(() => {
    let sess = createSession(level);
    let restored = false;
    const rs = getState().resume;
    const canResume = source.kind === 'classic' || source.kind === 'master' || source.kind === 'daily' || source.kind === 'campaign';
    if (canResume && rs && (!rs.runId || rs.runId === runId) && rs.levelId === level.id && (source.kind !== 'daily' || rs.day === runDay)) {
      for (const c of rs.entered) {
        const m = sessionMove(sess, c);
        if (!m.result.ok) break;
        sess = m.session;
      }
      restored = sess.history.length > 1 && current(sess).status === 'playing';
      if (!restored) sess = createSession(level);
    }
    apply(sess);
    if (restored && rs?.runId === '') { adoptSavedRun(runId); setEnergyDenied(false); }
    else setEnergyDenied(!beginEnergyRun(runId));
    clearHints(); setHintsUsed(restored ? (rs?.hints ?? 0) : 0); secRef.current = restored ? (rs?.seconds ?? 0) : 0; setStarted(restored); setFailView(false);
    setLeaderboardSubmission(null); leaderboardTask.current = null;
    if (restored) say('Welcome back. Your puzzle was saved right where you left it.', 'good');
    setResult(null); setFeedback(null); setErrCell(null);
    sweep.value = 2;
    if (source.kind === 'classic' || source.kind === 'master') setLastLevel(level.id);
    const seen = getState().seen;
    for (const m of mechanicsOf(level)) {
      if (m === 'bonus' || source.kind === 'practice') continue;
      if (!seen['mech:' + m]) { setIntro(m); markSeen('mech:' + m); break; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, runId, runDay]);

  // timers
  useEffect(() => {
    if (!started || paused || overlayOpen || st.status !== 'playing') return;
    const id = setInterval(() => {
      secRef.current += 1;
      if (timed) {
        leftRef.current = Math.max(0, leftRef.current - 1);
        if (leftRef.current === 0) setRushOver(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [started, paused, overlayOpen, st.status, timed]);

  useEffect(() => {
    if (timed && rushOver && !runOver) {
      const b = recordRunBest('rush', score, evaluateAchievements);
      if (b.length) setBadgeToast(b);
      setRunOver({ score, best: Math.max(score, getState().stats.rushBest) });
    }
  }, [timed, rushOver, runOver, score]);

  // keep an unfinished puzzle on disk so the player can resume it later (also after the app is closed)
  const resumable = source.kind === 'classic' || source.kind === 'master' || source.kind === 'daily' || source.kind === 'campaign';
  const hintsRef = useRef(0);
  hintsRef.current = hintsUsed;
  const persistResume = useCallback(() => {
    if (!resumable || !isRunActive(runId)) return;
    const cur = current(sessRef.current);
    const entered = enteredCells(level, cur);
    if (cur.status !== 'playing' || entered.length === 0) {
      if (getState().resume?.levelId === level.id) saveResume(null);
      return;
    }
    saveResume({ runId, source, levelId: level.id, day: runDay ?? dateKey(), entered, seconds: secRef.current, hints: hintsRef.current, savedAt: Date.now() });
  }, [resumable, level, source, runId, runDay]);
  useEffect(() => { persistResume(); }, [session, persistResume]);
  useEffect(() => () => persistResume(), [persistResume]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { persistResume(); if (current(sessRef.current).status === 'playing') setPaused(true); }
    });
    return () => sub.remove();
  }, [persistResume]);

  const runShake = useCallback(() => {
    if (settings.reduceMotion) return;
    shake.value = withTiming(1, { duration: 40 }, () => { shake.value = withTiming(0, { duration: 160 }); });
  }, [settings.reduceMotion, shake]);

  const onSolved = useCallback((fin: GameState) => {
    const completionKey = `${runId}:${level.id}:${index}`;
    if (completedPuzzle.current === completionKey) return;
    completedPuzzle.current = completionKey;
    if (getState().resume?.levelId === level.id) saveResume(null);
    haptic('success'); sfx('solve');
    sweep.value = 2;
    if (!settings.reduceMotion) sweep.value = withTiming(1, { duration: 900 });
    else sweep.value = 1;
    const stars = starsFor(level, fin.moves, secRef.current, hintsUsed);
    const info = { moves: fin.moves, time: secRef.current, hints: hintsUsed, bonus: fin.bonuses.length > 0, stars };
    let outcome: SolveOutcome | null = null;
    let streak: number | null = null;
    let campaignWorldUnlocked: string | null = null;
    let campaignFinished = false;
    let ach: string[] = [];
    if (source.kind === 'practice') {
      setOnboarded();
      setTimeout(() => nav.reset({ name: 'home' }), 900);
      return;
    }
    if (source.kind === 'classic' || source.kind === 'master') {
      outcome = recordClassicSolve(level, info, evaluateAchievements);
      sendLeaderboardSubmission(() => submitGlobalRun(runId));
    } else if (source.kind === 'campaign') {
      const before = getState().levels;
      outcome = recordClassicSolve(level, info, evaluateAchievements);
      campaignWorldUnlocked = newlyUnlockedCampaignWorld(before, getState().levels)?.name ?? null;
      campaignFinished = outcome.firstSolve && campaignComplete(getState().levels);
      sendLeaderboardSubmission(() => submitGlobalRun(runId));
    }
    else if (source.kind === 'daily') {
      const day = runDay ?? dateKey();
      outcome = recordDailySolve(level, day, info, evaluateAchievements);
      streak = getState().stats.streak;
      sendLeaderboardSubmission(() => submitDailyRun(day, runId, { stars: info.stars, moves: info.moves, time: info.time }));
    }
    else ach = recordOtherSolve(level, info, evaluateAchievements);
    if (outcome) ach = outcome.newAchievements;
    if (ach.length) { setBadgeToast(ach); setTimeout(() => sfx('badge'), 1200); }
    if (source.kind === 'rush' || source.kind === 'endless') {
      setScore((s) => s + 1);
      setTimeout(() => setIndex((i) => i + 1), 700);
      return;
    }
    setTimeout(() => setResult({ hints: hintsUsed, stars, badges: ach, moves: fin.moves, time: secRef.current, bonus: info.bonus, outcome, streak, campaignWorldUnlocked, campaignComplete: campaignFinished }), 900);
  }, [level, hintsUsed, source, settings.reduceMotion, nav, sweep, runId, index, runDay, sendLeaderboardSubmission]);

  const onFailed = useCallback((fin: GameState) => {
    haptic('error'); sfx('fail');
    if (source.kind === 'endless') {
      const b = recordRunBest('endless', score, evaluateAchievements);
      if (b.length) setBadgeToast(b);
      setRunOver({ score, best: Math.max(score, getState().stats.endlessBest) });
      return;
    }
    setTimeout(() => setFailView(true), 450);
  }, [source, score]);

  const handleEvents = useCallback((events: MoveEvent[]) => {
    for (const e of events) {
      if (e.type === 'node') { haptic('medium'); sfx('node'); }
      else if (e.type === 'bonus' || e.type === 'switch') { haptic('light'); sfx('bonus'); }
      else if (e.type === 'teleport') { haptic('light'); sfx('teleport'); }
      else if (e.type === 'burn' || e.type === 'freeze') haptic('medium');
      const msg = eventMessage(e, level.size);
      if (msg) say(msg, e.type === 'countdown-warning' ? 'bad' : 'good');
    }
  }, [level.size, say]);

  /** session changes made while dragging are committed to React state once per touch event */
  const dirty = useRef(false);
  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    setSession(sessRef.current);
    setStarted(true);
    clearHints();
    haptic('select'); sfx('step');
  }, [clearHints]);

  const tryStep = useCallback((to: number): boolean => {
    const s = sessRef.current;
    if (to === retractTarget(s)) {
      sessRef.current = sessionUndo(s);
      dirty.current = true;
      return true;
    }
    const { session: ns, result: r } = sessionMove(s, to);
    if (!r.ok) {
      const key = `${r.reason}:${r.cell}`;
      if (lastInvalid.current !== key) {
        lastInvalid.current = key;
        say(invalidMessage(r), 'bad');
        setErrCell(r.cell);
        setTimeout(() => setErrCell((c) => (c === r.cell ? null : c)), 500);
        runShake(); haptic('error'); sfx('error');
      }
      return false;
    }
    lastInvalid.current = '';
    sessRef.current = ns;
    dirty.current = true;
    handleEvents(r.events);
    const fin = r.state;
    if (fin.status === 'solved') onSolved(fin);
    else if (fin.status === 'failed') onFailed(fin);
    return true;
  }, [say, runShake, handleEvents, onSolved, onFailed]);

  const geomRef = useRef(boardGeom(100, level.size));
  const setBoardSize = useCallback((side: number) => { geomRef.current = boardGeom(side, level.size); }, [level.size]);

  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const fingerCell = useRef(-1);

  /** cell under a point, with a dead zone near cell borders so the finger cannot flicker between cells */
  const cellWithHysteresis = (x: number, y: number): number => {
    const g = geomRef.current;
    const c = cellAt(g, x, y);
    if (c < 0) return fingerCell.current;
    if (c === fingerCell.current || fingerCell.current < 0) return c;
    const cx = cellCenter(g, c);
    const m = 0.5 - 0.12; // must be inside the inner 76% of the new cell
    if (Math.abs(x - cx.x) <= g.cell * m && Math.abs(y - cx.y) <= g.cell * m) return c;
    return fingerCell.current;
  };

  /** walk the head toward the cell under the finger, one legal step at a time */
  const stepToward = (target: number, px: number, py: number) => {
    const n = level.size;
    for (let guard = 0; guard < 6; guard++) {
      const s = sessRef.current;
      const cur = current(s);
      if (cur.status !== 'playing' || target === cur.head) return;
      // dragging back over the own line: retract until the head sits on the finger cell
      if (cur.used[target] && s.history.some((h) => h.head === target)) {
        if (!tryStep(retractTarget(s) as number)) return;
        continue;
      }
      const hr = Math.floor(cur.head / n), hc = cur.head % n;
      const tr = Math.floor(target / n), tc = target % n;
      const dr = tr - hr, dc = tc - hc;
      let next: number;
      if (Math.abs(dr) + Math.abs(dc) === 1) next = target;
      else if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
        // diagonal: go through whichever corner cell is legal, preferring the one nearer the finger
        const a = hr * n + tc, b = tr * n + hc;
        const g = geomRef.current;
        const da = Math.hypot(cellCenter(g, a).x - px, cellCenter(g, a).y - py);
        const db = Math.hypot(cellCenter(g, b).x - px, cellCenter(g, b).y - py);
        const [first, second] = da <= db ? [a, b] : [b, a];
        next = validateMove(s.level, cur, first) === null ? first : second;
      } else if (Math.abs(dc) >= Math.abs(dr)) next = hr * n + hc + (dc > 0 ? 1 : -1);
      else next = (hr + (dr > 0 ? 1 : -1)) * n + hc;
      if (!tryStep(next)) return;
    }
  };

  const onBegin = useCallback((x: number, y: number) => {
    if (overlayOpen) return;
    const s = sessRef.current;
    if (current(s).status !== 'playing') return;
    lastInvalid.current = '';
    dragging.current = true;
    lastPt.current = { x, y };
    const i = cellAt(geomRef.current, x, y);
    fingerCell.current = i;
    if (i < 0) return;
    // touching the own line cuts it back to that cell
    const k = s.history.findIndex((h, idx) => idx < s.history.length - 1 && h.head === i);
    if (k >= 0) {
      sessRef.current = { level: s.level, history: s.history.slice(0, k + 1) };
      dirty.current = true;
      flush();
      return;
    }
    stepToward(i, x, y);
    flush();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen, tryStep, flush, level.size]);

  const onMove = useCallback((x: number, y: number) => {
    if (!dragging.current) return;
    const g = geomRef.current;
    const from = lastPt.current ?? { x, y };
    const dist = Math.hypot(x - from.x, y - from.y);
    const steps = Math.max(1, Math.ceil(dist / (g.cell * 0.25)));
    for (let k = 1; k <= steps; k++) {
      const px = from.x + ((x - from.x) * k) / steps;
      const py = from.y + ((y - from.y) * k) / steps;
      const c = cellWithHysteresis(px, py);
      if (c === fingerCell.current) continue;
      fingerCell.current = c;
      if (c >= 0) stepToward(c, px, py);
      if (current(sessRef.current).status !== 'playing') break;
    }
    lastPt.current = { x, y };
    flush();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryStep, flush, level.size]);

  /** screen-reader / switch-access: move toward a cell with a single tap */
  const tapCell = useCallback((i: number) => {
    if (overlayOpen || current(sessRef.current).status !== 'playing') return;
    const c = cellCenter(geomRef.current, i);
    lastInvalid.current = '';
    stepToward(i, c.x, c.y);
    flush();
    const cur = current(sessRef.current);
    const left = level.required.filter((k) => !cur.used[k]).length;
    AccessibilityInfo.announceForAccessibility(`${left} cell${left === 1 ? '' : 's'} left`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen, flush, level]);

  const onEnd = useCallback(() => { dragging.current = false; lastInvalid.current = ''; lastPt.current = null; fingerCell.current = -1; flush(); }, [flush]);

  const undo = useCallback(() => {
    const s = sessRef.current;
    if (s.history.length <= 1) return;
    apply(sessionUndo(s)); clearHints(); setFailView(false); haptic('light'); sfx('undo');
  }, [apply]);

  const doRestart = useCallback(() => {
    apply(restart(sessRef.current)); clearHints(); setConfirmRestart(false); setFailView(false);
    secRef.current = 0; setStarted(false); sweep.value = 2; saveResume(null); setResult(null);
  }, [apply, sweep]);

  const hint = useCallback(() => {
    if (st.status !== 'playing') return;
    const h = hintFor(level, st);
    if (!h || !h.cells.length) { say('No hint available here. Try undoing a few steps.', 'info'); return; }
    if (!spendHint()) { setHintLimit(true); return; }
    if (h.undo) say('This path cannot finish. Undo to the highlighted cells and go that way.', 'info');
    setHintCells(h.cells); sfx('hint');
    setHintsUsed((n) => n + 1);
    recordHint();
  }, [st, level, say]);

  const goNext = useCallback(() => {
    if (source.kind === 'classic' || source.kind === 'master') {
      const nx = nextLevelId(level.id);
      if (nx) nav.replaceGame({ kind: 'classic', levelId: nx });
      else nav.reset({ name: 'home' });
    } else if (source.kind === 'campaign') {
      const nx = nextCampaignLevelId(level.id);
      if (nx && campaignLevelNumber(nx) > 0) nav.replaceGame({ kind: 'campaign', levelId: nx });
      else nav.reset({ name: 'campaign' });
    } else if (source.kind === 'chaos') {
      setResult(null); setIndex((i) => i + 1);
    } else nav.reset({ name: 'home' });
  }, [source, level.id, nav]);

  const intros = intro ? MECH_INTRO[intro] : null;

  return {
    level, runDay, session, st, feedback, errCell, hintCells, hintsUsed, paused, setPaused,
    confirmRestart, setConfirmRestart, hintLimit, setHintLimit, hintRefillMs, hintsRemaining, result, failView, setFailView,
    intro: intros, closeIntro: () => setIntro(null), badgeToast, clearToast: () => setBadgeToast([]),
    leaderboardSubmission, retryLeaderboardSubmission,
    runOver, score, timed, getSeconds: () => secRef.current, getRushLeft: () => leftRef.current, shake, pulse, sweep, started, energyDenied,
    setBoardSize, onBegin, onMove, onEnd, tapCell, undo, doRestart, hint, goNext, overlayOpen, source,
  };
}
