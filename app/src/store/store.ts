import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Level } from '../engine';
import { LEVEL_DEFS, Mech, mechanicsOf } from '../lib/levels';
import { SkinId } from '../theme/tokens';
import type { GameSource } from '../nav/Nav';

export interface LevelRecord {
  stars: number;
  moves: number;
  time: number;
  bonus: boolean;
  hintless: boolean;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  hapticLevel: 0 | 1 | 2;
  themeMode: 'system' | 'light' | 'dark';
  skin: SkinId;
  reduceMotion: boolean;
  highContrast: boolean;
  largeNumbers: boolean;
  patterns: boolean;
  leftHanded: boolean;
  /** local reminders (daily puzzle, streak, come-back) */
  notify: boolean;
  /** hour of day (0-23) for the daily reminder */
  notifyHour: number;
}

export interface Profile {
  id: string;
  name: string;
  /** index into AVATAR_COLORS */
  avatar: number;
  createdAt: number;
}

/** an unfinished puzzle, saved so the player can pick up exactly where they stopped */
export interface ResumeSnap {
  source: GameSource;
  levelId: string;
  /** daily puzzles only resume on the same day */
  day: string;
  entered: number[];
  seconds: number;
  hints: number;
  savedAt: number;
}

export const AVATAR_COLORS = ['#0B7F7A', '#4A56D6', '#C42E75', '#D9641A', '#7A45D6', '#1E8FC9'];

export interface Stats {
  hintsUsed: number;
  fastest: number | null;
  fastestLevel: string | null;
  perfect: number;
  noHint: number;
  speed: number;
  streak: number;
  longestStreak: number;
  lastDaily: string | null;
  rushBest: number;
  endlessBest: number;
  mech: Record<string, number>;
  solvedAny: number;
}

export interface DailyRecord {
  stars: number;
  moves: number;
  time: number;
  bonus: boolean;
}

/** how the player is using the app: a Google account (progress synced) or as a guest (this phone only) */
export type LoginMode = 'guest' | 'google';

export interface Account {
  uid: string;
  email: string;
  name: string;
  photo: string | null;
}

export interface AppState {
  loaded: boolean;
  /** null = the login screen has not been answered yet */
  mode: LoginMode | null;
  account: Account | null;
  onboarded: boolean;
  settings: Settings;
  levels: Record<string, LevelRecord>;
  daily: Record<string, DailyRecord>;
  stats: Stats;
  achievements: Record<string, number>;
  seen: Record<string, true>;
  lastLevelId: string | null;
  profile: Profile;
  resume: ResumeSnap | null;
  /** last time the app was used, for come-back reminders */
  lastActive: number;
  /** highest wall-clock time ever seen; stops the Daily puzzle being replayed by moving the phone clock back */
  clockMax: number;
  /** storage schema version */
  schema: number;
  /** time of the last 'Reset progress'; a newer reset on another phone wins over older progress */
  epoch: number;
  /** account whose cloud copy this phone's progress was last merged with */
  syncedUid: string | null;
}

export const defaultSettings: Settings = {
  sound: true,
  music: false,
  haptics: true,
  hapticLevel: 1,
  themeMode: 'system',
  skin: 'paper',
  reduceMotion: false,
  highContrast: false,
  largeNumbers: false,
  patterns: true,
  leftHanded: false,
  notify: false,
  notifyHour: 19,
};

const newProfile = (): Profile => ({
  id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
  name: '',
  avatar: 0,
  createdAt: Date.now(),
});

const initialStats = (): Stats => ({
  hintsUsed: 0,
  fastest: null,
  fastestLevel: null,
  perfect: 0,
  noHint: 0,
  speed: 0,
  streak: 0,
  longestStreak: 0,
  lastDaily: null,
  rushBest: 0,
  endlessBest: 0,
  mech: {},
  solvedAny: 0,
});

const initial = (): AppState => ({
  loaded: false,
  mode: null,
  account: null,
  onboarded: false,
  settings: { ...defaultSettings },
  levels: {},
  daily: {},
  stats: initialStats(),
  achievements: {},
  seen: {},
  lastLevelId: null,
  profile: newProfile(),
  resume: null,
  lastActive: Date.now(),
  clockMax: Date.now(),
  schema: SCHEMA,
  epoch: 0,
  syncedUid: null,
});

export const SCHEMA = 3;
const KEY = 'flux.v1';
const BACKUP_KEY = 'flux.v1.corrupt';
let state: AppState = initial();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function write() {
  const { loaded, ...rest } = state;
  void loaded;
  return AsyncStorage.setItem(KEY, JSON.stringify(rest)).catch(() => {});
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void write();
  }, 250);
}

/** write any pending change right now (call when the app goes to the background) */
export async function flushStore() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  await write();
}

export function getState(): AppState {
  return state;
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch, clockMax: Math.max(state.clockMax, Date.now()) };
  emit();
  persist();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

export const useSettings = () => useStore((s) => s.settings);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/**
 * Turns whatever was stored (any older schema, partly damaged) into a valid AppState.
 * Exported for tests. Never throws.
 */
export function migrate(raw: unknown): AppState {
  const base = initial();
  if (!isObj(raw)) return { ...base, loaded: true };
  const p = raw as Partial<AppState> & Record<string, unknown>;
  const settings: Settings = { ...defaultSettings };
  if (isObj(p.settings)) {
    for (const k of Object.keys(defaultSettings) as (keyof Settings)[]) {
      const v = (p.settings as Record<string, unknown>)[k];
      if (typeof v === typeof defaultSettings[k]) (settings as unknown as Record<string, unknown>)[k] = v;
    }
  }
  settings.notifyHour = Math.min(23, Math.max(0, Math.round(num(settings.notifyHour, 19))));
  if (![0, 1, 2].includes(settings.hapticLevel)) settings.hapticLevel = 1;
  if (!['system', 'light', 'dark'].includes(settings.themeMode)) settings.themeMode = 'system';

  const stats: Stats = { ...initialStats() };
  if (isObj(p.stats)) {
    const ps = p.stats as Record<string, unknown>;
    for (const k of Object.keys(stats) as (keyof Stats)[]) {
      const d = stats[k];
      if (k === 'mech') { if (isObj(ps.mech)) stats.mech = ps.mech as Record<string, number>; }
      else if (d === null) { const v = ps[k]; (stats as unknown as Record<string, unknown>)[k] = typeof v === 'number' || typeof v === 'string' ? v : null; }
      else if (typeof d === 'number') (stats as unknown as Record<string, unknown>)[k] = Math.max(0, num(ps[k], d));
      else if (typeof ps[k] === typeof d) (stats as unknown as Record<string, unknown>)[k] = ps[k];
    }
  }
  const knownIds = new Set(LEVEL_DEFS.map((d) => d.id));
  const levels: Record<string, LevelRecord> = {};
  if (isObj(p.levels)) {
    for (const [id, r] of Object.entries(p.levels)) {
      if (!knownIds.has(id) || !isObj(r)) continue;
      levels[id] = {
        stars: Math.min(3, Math.max(1, Math.round(num(r.stars, 1)))),
        moves: num(r.moves, 0), time: num(r.time, 0), bonus: bool(r.bonus, false), hintless: bool(r.hintless, false),
      };
    }
  }
  const daily: Record<string, DailyRecord> = {};
  if (isObj(p.daily)) {
    for (const [k, r] of Object.entries(p.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(r)) continue;
      daily[k] = { stars: Math.min(3, Math.max(1, Math.round(num(r.stars, 1)))), moves: num(r.moves, 0), time: num(r.time, 0), bonus: bool(r.bonus, false) };
    }
  }
  const achievements: Record<string, number> = {};
  if (isObj(p.achievements)) for (const [k, v] of Object.entries(p.achievements)) if (typeof v === 'number') achievements[k] = v;
  const seen: Record<string, true> = {};
  if (isObj(p.seen)) for (const k of Object.keys(p.seen)) seen[k] = true;

  const profile: Profile = { ...base.profile };
  if (isObj(p.profile)) {
    if (typeof p.profile.id === 'string' && p.profile.id) profile.id = p.profile.id;
    if (typeof p.profile.name === 'string') profile.name = p.profile.name.slice(0, 24);
    profile.avatar = Math.min(AVATAR_COLORS.length - 1, Math.max(0, Math.round(num(p.profile.avatar, 0))));
    profile.createdAt = num(p.profile.createdAt, profile.createdAt);
  }
  let resume: ResumeSnap | null = null;
  const rs = p.resume as unknown;
  if (isObj(rs) && isObj(rs.source) && typeof rs.levelId === 'string' && Array.isArray(rs.entered) && rs.entered.every((n) => Number.isInteger(n) && n >= 0)) {
    resume = {
      source: rs.source as unknown as GameSource, levelId: rs.levelId, day: typeof rs.day === 'string' ? rs.day : '',
      entered: rs.entered as number[], seconds: Math.max(0, num(rs.seconds, 0)), hints: Math.max(0, num(rs.hints, 0)), savedAt: num(rs.savedAt, 0),
    };
  }
  const now = Date.now();
  let account: Account | null = null;
  const pa = p.account as unknown;
  if (isObj(pa) && typeof pa.uid === 'string' && pa.uid) {
    account = { uid: pa.uid, email: typeof pa.email === 'string' ? pa.email : '', name: typeof pa.name === 'string' ? pa.name : '', photo: typeof pa.photo === 'string' ? pa.photo : null };
  }
  // saves from before login existed (schema < 3) belong to a guest who already played
  let mode: LoginMode | null = p.mode === 'google' && account ? 'google' : p.mode === 'guest' ? 'guest' : null;
  if (mode === null && (bool(p.onboarded, false) || Object.keys(levels).length > 0)) mode = 'guest';
  return {
    loaded: true,
    mode,
    account,
    onboarded: bool(p.onboarded, false),
    settings, levels, daily, stats, achievements, seen, profile, resume,
    lastLevelId: typeof p.lastLevelId === 'string' && knownIds.has(p.lastLevelId) ? p.lastLevelId : null,
    lastActive: num(p.lastActive, now),
    // a clock set back by up to a week is ignored (stops Daily replays); further back is assumed to be an earlier mistake
    clockMax: ((c) => (c > now + 7 * 864e5 ? now : Math.max(c, now)))(Math.max(num(p.clockMax, 0), num(p.lastActive, 0))),
    schema: SCHEMA,
    epoch: Math.max(0, num(p.epoch, 0)),
    syncedUid: typeof p.syncedUid === 'string' ? p.syncedUid : null,
  };
}

export async function loadStore() {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      state = migrate(JSON.parse(raw));
    } catch {
      // damaged file: keep a copy for support instead of silently wiping it, then start fresh
      try { await AsyncStorage.setItem(BACKUP_KEY, raw); } catch { /* ignore */ }
      state = { ...initial(), loaded: true };
    }
  } else {
    state = { ...state, loaded: true };
  }
  emit();
}

/* ---------- login / cloud ---------- */

export function setGuest() {
  set({ mode: 'guest', account: null });
}

export function setGoogleAccount(account: Account) {
  const profile = state.profile.name ? state.profile : { ...state.profile, name: account.name.split(' ')[0].slice(0, 16) };
  set({ mode: 'google', account, profile });
}

/** Replace progress with merged cloud data. Keeps device-only things (resume, clock) intact. */
export function applyCloud(next: Partial<AppState>) {
  state = { ...state, ...next, loaded: true, mode: state.mode, account: state.account, resume: state.resume };
  emit();
  persist();
}

export function setSyncedUid(uid: string | null) {
  if (state.syncedUid !== uid) set({ syncedUid: uid });
}

/** Sign out: the account's data stays in the cloud, the phone goes back to a clean state so the next person starts fresh. */
export function signOutLocal() {
  const settings = state.settings;
  state = { ...initial(), loaded: true, settings, mode: null, onboarded: true };
  emit();
  persist();
  void flushStore();
}

/* ---------- actions ---------- */

export function updateSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
}

export function setOnboarded() {
  set({ onboarded: true });
}

export function markSeen(key: string) {
  if (state.seen[key]) return;
  set({ seen: { ...state.seen, [key]: true } });
}

export function setLastLevel(id: string) {
  set({ lastLevelId: id });
}

export function setProfile(patch: Partial<Pick<Profile, 'name' | 'avatar'>>) {
  set({ profile: { ...state.profile, ...patch } });
}

export function saveResume(snap: ResumeSnap | null) {
  set({ resume: snap });
}

export function touchActive() {
  set({ lastActive: Date.now() });
}

export function resetAll() {
  const keep = state.settings;
  const profile = state.profile;
  state = { ...initial(), settings: keep, profile, loaded: true, mode: state.mode, account: state.account, syncedUid: state.syncedUid, epoch: Date.now() };
  emit();
  persist();
}

/** current time that cannot go backwards, even if the phone clock is set back */
export function trustedNow(): number {
  return Math.max(Date.now(), state.clockMax);
}

export function dateKey(d: Date = new Date(trustedNow())): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date(trustedNow());
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export interface SolveInfo {
  moves: number;
  time: number;
  hints: number;
  bonus: boolean;
  stars: number;
}

export interface SolveOutcome {
  newBest: boolean;
  firstSolve: boolean;
  newAchievements: string[];
  chapterCompleted: number | null;
}

function bumpMech(stats: Stats, level: Level): Record<string, number> {
  const mech = { ...stats.mech };
  for (const m of mechanicsOf(level)) mech[m] = (mech[m] || 0) + 1;
  return mech;
}

function commonStats(stats: Stats, level: Level, info: SolveInfo): Stats {
  const fastest = stats.fastest === null || info.time < stats.fastest ? info.time : stats.fastest;
  return {
    ...stats,
    solvedAny: stats.solvedAny + 1,
    perfect: stats.perfect + (info.stars === 3 ? 1 : 0),
    noHint: stats.noHint + (info.hints === 0 ? 1 : 0),
    speed: stats.speed + (info.time < 30 ? 1 : 0),
    fastest,
    fastestLevel: fastest === info.time ? level.id : stats.fastestLevel,
    mech: bumpMech(stats, level),
  };
}

export function chaptersDone(levels: Record<string, LevelRecord>): number[] {
  const out: number[] = [];
  for (let ch = 1; ch <= 8; ch++) {
    const defs = LEVEL_DEFS.filter((d) => d.chapter === ch);
    if (defs.length && defs.every((d) => levels[d.id])) out.push(ch);
  }
  return out;
}

export function recordClassicSolve(level: Level, info: SolveInfo, evalAch: (s: AppState) => string[]): SolveOutcome {
  const prev = state.levels[level.id];
  const before = chaptersDone(state.levels);
  const rec: LevelRecord = {
    stars: Math.max(prev?.stars ?? 0, info.stars),
    moves: prev ? Math.min(prev.moves, info.moves) : info.moves,
    time: prev ? Math.min(prev.time, info.time) : info.time,
    bonus: (prev?.bonus ?? false) || info.bonus,
    hintless: (prev?.hintless ?? false) || info.hints === 0,
  };
  const levels = { ...state.levels, [level.id]: rec };
  const stats = commonStats(state.stats, level, info);
  stats.hintsUsed += info.hints;
  const draft: AppState = { ...state, levels, stats, lastLevelId: level.id };
  const earned = evalAch(draft).filter((a) => !state.achievements[a]);
  const achievements = { ...state.achievements };
  const now = Date.now();
  earned.forEach((a) => (achievements[a] = now));
  const after = chaptersDone(levels);
  const completed = after.find((c) => !before.includes(c)) ?? null;
  set({ levels, stats, achievements, lastLevelId: level.id });
  return {
    newBest: !prev || info.moves < prev.moves,
    firstSolve: !prev,
    newAchievements: earned,
    chapterCompleted: completed,
  };
}

export function recordDailySolve(level: Level, key: string, info: SolveInfo, evalAch: (s: AppState) => string[]): SolveOutcome {
  const prev = state.daily[key];
  const stats = commonStats(state.stats, level, info);
  stats.hintsUsed += info.hints;
  if (!prev) {
    if (stats.lastDaily === key) {
      // already counted
    } else if (stats.lastDaily === yesterdayKey()) {
      stats.streak += 1;
    } else {
      stats.streak = 1;
    }
    stats.lastDaily = key;
    stats.longestStreak = Math.max(stats.longestStreak, stats.streak);
  }
  const daily = {
    ...state.daily,
    [key]: prev ?? { stars: info.stars, moves: info.moves, time: info.time, bonus: info.bonus },
  };
  const draft: AppState = { ...state, daily, stats };
  const earned = evalAch(draft).filter((a) => !state.achievements[a]);
  const achievements = { ...state.achievements };
  const now = Date.now();
  earned.forEach((a) => (achievements[a] = now));
  set({ daily, stats, achievements });
  return { newBest: !prev, firstSolve: !prev, newAchievements: earned, chapterCompleted: null };
}

export function recordOtherSolve(level: Level, info: SolveInfo, evalAch: (s: AppState) => string[]): string[] {
  const stats = commonStats(state.stats, level, info);
  stats.hintsUsed += info.hints;
  const draft: AppState = { ...state, stats };
  const earned = evalAch(draft).filter((a) => !state.achievements[a]);
  const achievements = { ...state.achievements };
  const now = Date.now();
  earned.forEach((a) => (achievements[a] = now));
  set({ stats, achievements });
  return earned;
}

export function recordHint() {
  set({ stats: { ...state.stats, hintsUsed: state.stats.hintsUsed + 1 } });
}

export function recordRunBest(kind: 'rush' | 'endless', score: number, evalAch?: (s: AppState) => string[]): string[] {
  const key = kind === 'rush' ? 'rushBest' : 'endlessBest';
  if (score > state.stats[key]) set({ stats: { ...state.stats, [key]: score } });
  if (!evalAch) return [];
  const earned = evalAch(state).filter((a) => !state.achievements[a]);
  if (earned.length) {
    const achievements = { ...state.achievements };
    const now = Date.now();
    earned.forEach((a) => (achievements[a] = now));
    set({ achievements });
  }
  return earned;
}

/* ---------- derived ---------- */

export function totalStars(levels: Record<string, LevelRecord>): number {
  return Object.values(levels).reduce((a, r) => a + r.stars, 0);
}

export function solvedCount(levels: Record<string, LevelRecord>): number {
  return Object.keys(levels).length;
}

export function isLevelUnlocked(levels: Record<string, LevelRecord>, id: string): boolean {
  const i = LEVEL_DEFS.findIndex((d) => d.id === id);
  if (i <= 0) return i === 0;
  return !!levels[LEVEL_DEFS[i - 1].id];
}

/** first unsolved level (the "current" one), or the last level when all done */
export function currentLevelId(levels: Record<string, LevelRecord>): string {
  const next = LEVEL_DEFS.find((d) => !levels[d.id]);
  return (next ?? LEVEL_DEFS[LEVEL_DEFS.length - 1]).id;
}

export type { Mech };
