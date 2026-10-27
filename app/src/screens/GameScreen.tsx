import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Board, fitBoard } from '../components/Board';
import { Icon } from '../components/Icon';
import { Button, Screen, T, TopBar, IconButton, fmtTime } from '../components/ui';
import { GameSource, useNav } from '../nav/Nav';
import { useTheme } from '../theme/ThemeProvider';
import { ENERGY_MAX, ENERGY_REFILL_MS, refreshEnergy, trustedNow, useSettings, useStore } from '../store/store';
import { CAMPAIGN_WORLDS, CHAPTERS } from '../lib/levels';
import { describeCell } from '../lib/a11y';
import { RUSH_SECONDS, useGame } from './game/useGame';
import { AchToast, ConfirmRestart, FailedView, HintLimit, MechIntro, PauseSheet, ResultView, RunOver } from './game/Overlays';

/** ticks on its own so the whole screen does not re-render every second */
function useTick(read: () => number): number {
  const [v, setV] = useState(read());
  useEffect(() => {
    const id = setInterval(() => setV((old) => { const n = read(); return n === old ? old : n; }), 500);
    return () => clearInterval(id);
  }, [read]);
  return v;
}

function Clock({ read, timed }: { read: () => number; timed: boolean }) {
  const { t } = useTheme();
  const v = useTick(read);
  return <Pill icon={timed ? 'clock' : undefined} text={fmtTime(v)} color={timed ? (v < 20 ? t.danger : t.accent) : t.text2} />;
}

function RushBar({ read }: { read: () => number }) {
  const { t } = useTheme();
  const v = useTick(read);
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: t.grid, overflow: 'hidden' }}>
      <View style={{ height: 4, width: `${(v / RUSH_SECONDS) * 100}%`, backgroundColor: t.accent }} />
    </View>
  );
}

function Pill({ icon, text, color }: { icon?: 'clock' | 'star'; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color + '22' }}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <T v="cap" color={color}>{text}</T>
    </View>
  );
}

function ActionButton({ icon, label, onPress, badge, disabled, accessibilityLabel }: { icon: 'undo' | 'bulb' | 'restart'; label: string; onPress: () => void; badge?: string; disabled?: boolean; accessibilityLabel?: string }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress}
      style={{ flex: 1, height: 56, borderRadius: 18, backgroundColor: t.raised, borderWidth: 1, borderColor: t.grid, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.45 : 1 }}>
      <Icon name={icon} size={22} color={t.text} />
      <T v="small" color={t.text}>{label}</T>
      {badge ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}><T v="cap" color={t.onAccent}>{badge}</T></View> : null}
    </Pressable>
  );
}

function titleFor(source: GameSource, levelId: string, chapter: number, index: number, dailyDay?: string) {
  switch (source.kind) {
    case 'classic': return { title: `Level ${levelId}`, sub: CHAPTERS[chapter - 1]?.name ?? '' };
    case 'master': return { title: 'Master', sub: `Puzzle ${index}` };
    case 'campaign': return { title: `Campaign ${index}`, sub: CAMPAIGN_WORLDS.find((world) => index >= world.firstLevel && index <= world.lastLevel)?.name ?? 'FLUX Campaign' };
    case 'daily': return { title: 'Daily Puzzle', sub: `UTC ${dailyDay ?? ''}` };
    case 'rush': return { title: 'Rush', sub: 'Solve as many as you can' };
    case 'endless': return { title: 'Endless', sub: 'One mistake ends the run' };
    case 'chaos': return { title: 'Chaos', sub: 'Random mix' };
    default: return { title: 'Practice', sub: 'Draw 1 → 2 → 3' };
  }
}

function EnergyDepleted({ onHome }: { onHome: () => void }) {
  const { t } = useTheme();
  const refillAt = useStore((s) => s.energyRefillStartedAt);
  const [now, setNow] = useState(trustedNow());
  useEffect(() => {
    const id = setInterval(() => { refreshEnergy(); setNow(trustedNow()); }, 1000);
    return () => clearInterval(id);
  }, []);
  const ms = refillAt === null ? ENERGY_REFILL_MS : Math.max(0, ENERGY_REFILL_MS - (now - refillAt));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const countdown = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Icon name="bolt" size={56} color={t.accent} />
        <T v="h1" align="center">Out of energy</T>
        <T v="body" align="center">You’ve used all {ENERGY_MAX} energy. It refills automatically every 30 minutes.</T>
        <T v="title" color={t.accent}>Next full refill in {countdown}</T>
        <Button label="Return to Home" onPress={onHome} />
      </View>
    </Screen>
  );
}

export function GameScreen({ source, runId, dailyDay }: { source: GameSource; runId: string; dailyDay?: string }) {
  const nav = useNav();
  const { t, board } = useTheme();
  const settings = useSettings();
  const g = useGame(source, runId, dailyDay);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const { level, st } = g;
  const best = useStore((s) => s.stats);

  const fit = area.w > 0 ? fitBoard(area.w, area.h, level.size) : { side: 0, cell: 0 };
  useEffect(() => { if (fit.side) g.setBoardSize(fit.side); }, [fit.side, level.size]);
  useEffect(() => {
    if (!g.badgeToast.length) return;
    const id = setTimeout(g.clearToast, 4200);
    return () => clearTimeout(id);
  }, [g.badgeToast]);

  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => { if (alive) setReader(v); });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; sub.remove(); };
  }, []);
  const a11y = React.useMemo(
    () => (reader ? { label: (i: number) => describeCell(level, st, i), onPress: g.tapCell } : undefined),
    [reader, level, st, g.tapCell],
  );
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: g.shake.value * 6 }] }));
  const onLayout = (e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const { title, sub } = titleFor(source, level.id, level.chapter, level.index, g.runDay);
  const practice = source.kind === 'practice';
  const left = settings.leftHanded;
  const actions = [
    <ActionButton key="u" icon="undo" label="Undo" onPress={g.undo} disabled={g.session.history.length <= 1 || st.status !== 'playing'} />,
    <ActionButton key="h" icon="bulb" label="Hint" accessibilityLabel={`Hint, ${g.hintsRemaining} remaining`} onPress={g.hint} badge={String(g.hintsRemaining)} disabled={st.status !== 'playing'} />,
    <ActionButton key="r" icon="restart" label="Restart" onPress={() => g.setConfirmRestart(true)} />,
  ];
  const left_ = level.required.filter((i) => !st.used[i]).length;
  const fbColor = g.feedback?.tone === 'bad' ? t.danger : g.feedback?.tone === 'good' ? t.success : t.text2;

  const coach = !g.started && st.path.length <= 1
    ? 'Press on the 1, then drag your finger along the cells.'
    : left_ === 0 ? 'Now drag onto the last number to finish.'
    : st.nextNode >= level.nodeCount ? 'Fill every other cell first. The last number opens last.'
    : 'Keep going: visit the numbers in order and fill every open cell.';
  const quit = () => nav.pop();
  const again = () => { nav.replaceGame({ ...source } as GameSource); };

  if (g.energyDenied) return <EnergyDepleted onHome={() => nav.reset({ name: 'home' })} />;

  return (
    <Screen>
      <TopBar title={title} sub={sub} onBack={() => g.setPaused(true)} right={<IconButton icon="sliders" label="Settings" onPress={() => nav.push({ name: 'settings' })} />} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
        <T v="num">{st.moves}<T v="small"> / {level.maxMoves} moves</T></T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {level.cells.some((c) => c.kind === 'bonus') ? <Pill icon="star" text={st.bonuses.length ? 'Bonus' : 'Bonus ?'} color={t.bonus} /> : null}
          <Clock read={g.timed ? g.getRushLeft : g.getSeconds} timed={g.timed} />
          {g.timed ? <Pill text={`${g.score} solved`} color={t.accent} /> : null}
        </View>
      </View>
      {g.timed ? (
        <RushBar read={g.getRushLeft} />
      ) : null}
      <View onLayout={onLayout} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {fit.side > 0 ? (
          <Animated.View style={shakeStyle}>
            <Board level={level} state={st} size={fit.side} t={board} pulse={g.pulse} sweep={g.sweep} err={g.errCell}
              hints={g.hintCells} large={settings.largeNumbers} a11y={a11y}
              onBegin={g.onBegin} onMove={g.onMove} onEnd={g.onEnd} />
          </Animated.View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
        {level.nodes.map((cell, i) => {
          const done = st.nextNode > i + 1 || (i === 0);
          const isNext = st.nextNode === i + 1;
          return <View key={cell} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: done ? t.accent : t.grid, borderWidth: isNext ? 2 : 0, borderColor: t.accent }} />;
        })}
      </View>
      <View style={{ minHeight: 40, justifyContent: 'center' }}>
        <T v="small" align="center" color={fbColor}>
          {g.feedback?.text ?? (practice ? coach :  `${left_} cell${left_ === 1 ? '' : 's'} left · next: ${Math.min(st.nextNode, level.nodeCount)}`)}
        </T>
      </View>
      <View style={{ flexDirection: left ? 'row-reverse' : 'row', gap: 10, paddingTop: 6 }}>{actions}</View>

      {g.intro ? <MechIntro info={g.intro} onClose={g.closeIntro} /> : null}
      {g.hintLimit ? <HintLimit refillMs={g.hintRefillMs} onClose={() => g.setHintLimit(false)} /> : null}
      {g.confirmRestart ? <ConfirmRestart onYes={g.doRestart} onNo={() => g.setConfirmRestart(false)} /> : null}
      {g.paused ? (
        <PauseSheet onResume={() => g.setPaused(false)} onRestart={() => { g.setPaused(false); g.setConfirmRestart(true); }}
          onHowTo={() => { g.setPaused(false); nav.push({ name: 'howto' }); }}
          onSettings={() => { g.setPaused(false); nav.push({ name: 'settings' }); }} onQuit={quit} />
      ) : null}
      {g.failView && st.status === 'failed' ? (
        <FailedView level={level} state={st} canUndo={g.session.history.length > 1} onUndo={g.undo} onRetry={g.doRestart} />
      ) : null}
      {g.result ? (
        <ResultView level={level} state={st} data={g.result} kind={source.kind} leaderboardSubmission={g.leaderboardSubmission} onRetryLeaderboard={g.retryLeaderboardSubmission} onNext={g.goNext} onRetry={again} onHome={() => nav.reset({ name: 'home' })} />
      ) : null}
      {g.runOver && (source.kind === 'rush' || source.kind === 'endless') ? (
        <RunOver kind={source.kind} score={g.runOver.score} best={Math.max(g.runOver.best, source.kind === 'rush' ? best.rushBest : best.endlessBest)}
          onAgain={again} onHome={() => nav.reset({ name: 'home' })} />
      ) : null}
      {g.badgeToast.length ? <AchToast ids={g.badgeToast} /> : null}
    </Screen>
  );
}
