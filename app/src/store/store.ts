import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Level } from '../engine';
import { ALL_LEVEL_DEFS, CAMPAIGN_PROGRESSION_DEFS, CHAPTER_LEVEL_DEFS, Mech, mechanicsOf } from '../lib/levels';
import { SKINS, SkinId } from '../theme/tokens';
import type { GameSource } from '../nav/Nav';
import { REWARD_CATALOG, RewardId, RewardRarity, RewardStatus, rewardForChest, rewardDefinition } from '../lib/rewards';

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

export interface NotificationPreferences {
  daily: boolean;
  energy: boolean;
  hints: boolean;
  rewards: boolean;
  milestones: boolean;
  updates: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  daily: true,
  energy: true,
  hints: true,
  rewards: true,
  milestones: true,
  updates: true,
};

export interface Profile {
  id: string;
  name: string;
  /** index into AVATAR_COLORS */
  avatar: number;
  createdAt: number;
  badge?: string | null;
}

/** an unfinished puzzle, saved so the player can pick up exactly where they stopped */
export interface ResumeSnap {
  runId: string;
  source: GameSource;
  levelId: string;
  /** daily puzzles only resume on the same day */
  day: string;
  entered: number[];
  /** Remaining undo actions, persisted with an unfinished run. */
  undoRemaining?: number;
  /** The run's initial undo allowance (5 only when Extra Undo was consumed). */
  undoLimit?: number;
  extraUndoRewardId?: string | null;
  revealedCells?: number[];
  budgetMoves?: number;
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

/** Permanent, player-scoped record that a level's one-time completion chest was generated. */
export interface CompletionRewardRecord {
  playerId: string;
  progression: 'chapters' | 'campaign' | 'referral';
  levelId: string;
  chestId: string;
  generatedAt: number;
  rewardId: RewardId;
  rarity: RewardRarity;
  status: RewardStatus;
  expiresAt: number;
  redeemedAt?: number;
  activatedAt?: number;
  effectEndsAt?: number;
  activatedRunId?: string;
  completedAt?: number;
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
  /** Eight mechanic chapter progress, separate from the 50-world Campaign. */
  levels: Record<string, LevelRecord>;
  campaignLevels: Record<string, LevelRecord>;
  /** One immutable chest eligibility record per progression system and level. */
  completionRewards: Record<string, CompletionRewardRecord>;
  /** Refer & Earn reward chests issued to this player. */
  referralRewards: Record<string, CompletionRewardRecord>;
  /** Pending invite code entered prior to linking Google account. */
  pendingReferralCode: string | null;
  /** Referral code claimed by this user/account. */
  claimedReferralCode: string | null;
  unlockedBoardSkins: SkinId[];
  unlockedProfileBadges: string[];
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
  /** Local consumable energy. Cloud sync deliberately excludes it until concurrent spends can be made safe. */
  energy: number;
  energyRefillStartedAt: number | null;
  /** Local hint allowance; refills as a full set 24 hours after the first hint is spent. */
  hintsRemaining: number;
  hintsRefillStartedAt: number | null;
  activeRunId: string | null;
  notificationPreferences: NotificationPreferences;
}

export const ENERGY_MAX = 20;
export const ENERGY_COST_PER_RUN = 1;
export const ENERGY_REFILL_MS = 30 * 60 * 1000;
export const REWARD_PENDING_MS = 24 * 60 * 60 * 1000;
export const HINTS_MAX = 3;
export const HINTS_REFILL_MS = 24 * 60 * 60 * 1000;

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
  badge: null,
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
  campaignLevels: {},
  completionRewards: {},
  referralRewards: {},
  pendingReferralCode: null,
  claimedReferralCode: null,
  unlockedBoardSkins: [],
  unlockedProfileBadges: [],
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
  energy: ENERGY_MAX,
  energyRefillStartedAt: null,
  hintsRemaining: HINTS_MAX,
  hintsRefillStartedAt: null,
  activeRunId: null,
  notificationPreferences: { ...defaultNotificationPreferences },
});

export const SCHEMA = 5;
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
  return Promise.resolve(AsyncStorage.setItem(KEY, JSON.stringify(rest)));
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void write().catch(() => {});
  }, 250);
}

/** write any pending change right now (call when the app goes to the background) */
export async function flushStore() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await write();
}

export function getState(): AppState {
  return state;
}

let onNotificationStateChange: (() => void) | null = null;
export function registerNotificationRefreshCallback(cb: () => void): void {
  onNotificationStateChange = cb;
}

function notifyStateChangeForNotifications(patch: Partial<AppState>) {
  if (
    onNotificationStateChange &&
    (patch.completionRewards !== undefined ||
      patch.referralRewards !== undefined ||
      patch.referralRewards !== undefined ||
      patch.daily !== undefined ||
      patch.energy !== undefined ||
      patch.energyRefillStartedAt !== undefined ||
      patch.hintsRemaining !== undefined ||
      patch.hintsRefillStartedAt !== undefined ||
      patch.notificationPreferences !== undefined ||
      patch.settings !== undefined ||
      patch.levels !== undefined ||
      patch.campaignLevels !== undefined)
  ) {
    onNotificationStateChange();
  }
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch, clockMax: Math.max(state.clockMax, Date.now()) };
  emit();
  persist();
  notifyStateChangeForNotifications(patch);
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
export const useNotificationPreferences = () => useStore((s) => s.notificationPreferences);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const SKIN_IDS = new Set(SKINS.map((skin) => skin.id));
const REWARD_CATALOG_IDS = new Set(REWARD_CATALOG.map((reward) => reward.id));
const trustedTimeForMigration = (p: Record<string, unknown>, now: number) => Math.max(now, num(p.clockMax, 0), num(p.lastActive, 0));

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
  const knownIds = new Set(ALL_LEVEL_DEFS.map((d) => d.id));
  const campaignIds = new Set(CAMPAIGN_PROGRESSION_DEFS.map((d) => d.id));
  const levels: Record<string, LevelRecord> = {};
  const campaignLevels: Record<string, LevelRecord> = {};
  const addLevelRecord = (target: Record<string, LevelRecord>, id: string, r: Record<string, unknown>) => {
    const next = {
      stars: Math.min(3, Math.max(1, Math.round(num(r.stars, 1)))),
      moves: num(r.moves, 0), time: num(r.time, 0), bonus: bool(r.bonus, false), hintless: bool(r.hintless, false),
    };
    const prev = target[id];
    target[id] = prev ? {
      stars: Math.max(prev.stars, next.stars),
      moves: prev.moves > 0 && next.moves > 0 ? Math.min(prev.moves, next.moves) : prev.moves || next.moves,
      time: prev.time > 0 && next.time > 0 ? Math.min(prev.time, next.time) : prev.time || next.time,
      bonus: prev.bonus || next.bonus, hintless: prev.hintless || next.hintless,
    } : next;
  };
  if (isObj(p.campaignLevels)) {
    for (const [id, r] of Object.entries(p.campaignLevels)) {
      if (campaignIds.has(id) && isObj(r)) addLevelRecord(campaignLevels, id, r);
    }
  }
  if (isObj(p.levels)) {
    for (const [id, r] of Object.entries(p.levels)) {
      if (!knownIds.has(id) || !isObj(r)) continue;
      addLevelRecord(campaignIds.has(id) ? campaignLevels : levels, id, r);
    }
  }
  const daily: Record<string, DailyRecord> = {};
  if (isObj(p.daily)) {
    for (const [k, r] of Object.entries(p.daily)) {
      if (!isValidDateKey(k) || !isObj(r)) continue;
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
    if (typeof p.profile.badge === 'string') profile.badge = p.profile.badge.slice(0, 40);
    else if (p.profile.badge === null) profile.badge = null;
  }
  let resume: ResumeSnap | null = null;
  const rs = p.resume as unknown;
  if (isObj(rs) && isObj(rs.source) && typeof rs.levelId === 'string' && Array.isArray(rs.entered) && rs.entered.every((n) => Number.isInteger(n) && n >= 0)) {
    resume = {
      runId: typeof rs.runId === 'string' ? rs.runId : '',
      source: rs.source as unknown as GameSource, levelId: rs.levelId, day: typeof rs.day === 'string' ? rs.day : '',
      entered: rs.entered as number[], undoRemaining: Math.max(0, Math.min(5, Math.round(num(rs.undoRemaining, 3)))),
      undoLimit: Math.max(0, Math.min(5, Math.round(num(rs.undoLimit, 3)))),
      extraUndoRewardId: typeof rs.extraUndoRewardId === 'string' ? rs.extraUndoRewardId : null,
      revealedCells: Array.isArray(rs.revealedCells) ? rs.revealedCells.filter((n): n is number => Number.isInteger(n) && n >= 0) : [],
      budgetMoves: Math.max(0, Math.min(10000, Math.round(num(rs.budgetMoves, 0)))),
      seconds: Math.max(0, num(rs.seconds, 0)), hints: Math.max(0, num(rs.hints, 0)), savedAt: num(rs.savedAt, 0),
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
  if (mode === null && (bool(p.onboarded, false) || Object.keys(levels).length > 0 || Object.keys(campaignLevels).length > 0)) mode = 'guest';
  return {
    loaded: true,
    mode,
    account,
    onboarded: bool(p.onboarded, false),
    settings, levels, campaignLevels, daily, stats, achievements, seen, profile, resume,
    unlockedBoardSkins: Array.isArray(p.unlockedBoardSkins)
      ? [...new Set(p.unlockedBoardSkins.filter((skin): skin is SkinId => SKIN_IDS.has(skin as SkinId)))]
      : [],
    unlockedProfileBadges: Array.isArray(p.unlockedProfileBadges)
      ? [...new Set(p.unlockedProfileBadges.filter((badge): badge is string => typeof badge === 'string' && badge.length <= 80))]
      : [],
    completionRewards: (() => {
      const records: Record<string, CompletionRewardRecord> = {};
      if (!isObj(p.completionRewards)) return records;
      for (const [key, rawReward] of Object.entries(p.completionRewards)) {
        if (!isObj(rawReward) || typeof rawReward.playerId !== 'string' || !rawReward.playerId
          || (rawReward.progression !== 'chapters' && rawReward.progression !== 'campaign')
          || typeof rawReward.levelId !== 'string' || !knownIds.has(rawReward.levelId)
          || (rawReward.progression === 'campaign' ? !campaignIds.has(rawReward.levelId) : campaignIds.has(rawReward.levelId))
          || typeof rawReward.chestId !== 'string' || !rawReward.chestId
          || !Number.isFinite(rawReward.generatedAt) || typeof rawReward.generatedAt !== 'number') continue;
        const expectedKey = `${rawReward.progression}:${rawReward.levelId}`;
        if (key !== expectedKey) continue;
        const assigned = typeof rawReward.rewardId === 'string' && REWARD_CATALOG_IDS.has(rawReward.rewardId as RewardId)
          ? rewardDefinition(rawReward.rewardId as RewardId)
          : rewardForChest(rawReward.chestId);
        const generatedAt = Math.max(0, rawReward.generatedAt);
        const validStatus = ['pending', 'redeemed', 'active', 'completed', 'expired'].includes(String(rawReward.status));
        const status = validStatus ? rawReward.status as RewardStatus : (trustedTimeForMigration(p, now) >= generatedAt + REWARD_PENDING_MS ? 'expired' : 'pending');
        records[key] = {
          playerId: rawReward.playerId, progression: rawReward.progression,
          levelId: rawReward.levelId, chestId: rawReward.chestId, generatedAt,
          rewardId: assigned.id, rarity: assigned.rarity, status,
          expiresAt: num(rawReward.expiresAt, generatedAt + REWARD_PENDING_MS),
          ...(Number.isFinite(rawReward.redeemedAt) ? { redeemedAt: rawReward.redeemedAt as number } : {}),
          ...(Number.isFinite(rawReward.activatedAt) ? { activatedAt: rawReward.activatedAt as number } : {}),
          ...(Number.isFinite(rawReward.effectEndsAt) ? { effectEndsAt: rawReward.effectEndsAt as number } : {}),
          ...(typeof rawReward.activatedRunId === 'string' ? { activatedRunId: rawReward.activatedRunId } : {}),
          ...(Number.isFinite(rawReward.completedAt) ? { completedAt: rawReward.completedAt as number } : {}),
        };
      }
      return records;
    })(),
    referralRewards: (() => {
      const records: Record<string, CompletionRewardRecord> = {};
      if (!isObj(p.referralRewards)) return records;
      for (const [key, rawReward] of Object.entries(p.referralRewards)) {
        if (!isObj(rawReward) || typeof rawReward.playerId !== 'string' || !rawReward.playerId
          || rawReward.progression !== 'referral'
          || typeof rawReward.chestId !== 'string' || !rawReward.chestId
          || !Number.isFinite(rawReward.generatedAt) || typeof rawReward.generatedAt !== 'number') continue;
        const assigned = typeof rawReward.rewardId === 'string' && REWARD_CATALOG_IDS.has(rawReward.rewardId as RewardId)
          ? rewardDefinition(rawReward.rewardId as RewardId)
          : rewardForChest(rawReward.chestId);
        const generatedAt = Math.max(0, rawReward.generatedAt);
        const validStatus = ['pending', 'redeemed', 'active', 'completed', 'expired'].includes(String(rawReward.status));
        const status = validStatus ? rawReward.status as RewardStatus : (trustedTimeForMigration(p, now) >= generatedAt + REWARD_PENDING_MS ? 'expired' : 'pending');
        records[key] = {
          playerId: rawReward.playerId, progression: 'referral',
          levelId: typeof rawReward.levelId === 'string' ? rawReward.levelId : 'referral',
          chestId: rawReward.chestId, generatedAt,
          rewardId: assigned.id, rarity: assigned.rarity, status,
          expiresAt: num(rawReward.expiresAt, generatedAt + REWARD_PENDING_MS),
          ...(Number.isFinite(rawReward.redeemedAt) ? { redeemedAt: rawReward.redeemedAt as number } : {}),
          ...(Number.isFinite(rawReward.activatedAt) ? { activatedAt: rawReward.activatedAt as number } : {}),
          ...(Number.isFinite(rawReward.effectEndsAt) ? { effectEndsAt: rawReward.effectEndsAt as number } : {}),
          ...(typeof rawReward.activatedRunId === 'string' ? { activatedRunId: rawReward.activatedRunId } : {}),
          ...(Number.isFinite(rawReward.completedAt) ? { completedAt: rawReward.completedAt as number } : {}),
        };
      }
      return records;
    })(),
    pendingReferralCode: typeof p.pendingReferralCode === 'string' ? p.pendingReferralCode : null,
    claimedReferralCode: typeof p.claimedReferralCode === 'string' ? p.claimedReferralCode : null,
    lastLevelId: typeof p.lastLevelId === 'string' && knownIds.has(p.lastLevelId) ? p.lastLevelId : null,
    lastActive: num(p.lastActive, now),
    // a clock set back by up to a week is ignored (stops Daily replays); further back is assumed to be an earlier mistake
    clockMax: ((c) => (c > now + 7 * 864e5 ? now : Math.max(c, now)))(Math.max(num(p.clockMax, 0), num(p.lastActive, 0))),
    schema: SCHEMA,
    epoch: Math.max(0, num(p.epoch, 0)),
    syncedUid: typeof p.syncedUid === 'string' ? p.syncedUid : null,
    energy: Math.min(ENERGY_MAX, Math.max(0, Math.round(num(p.energy, ENERGY_MAX)))),
    energyRefillStartedAt: Math.min(ENERGY_MAX, Math.max(0, Math.round(num(p.energy, ENERGY_MAX)))) >= ENERGY_MAX
      ? null
      : num(p.energyRefillStartedAt, now) || now,
    hintsRemaining: Math.min(HINTS_MAX, Math.max(0, Math.round(num(p.hintsRemaining, HINTS_MAX)))),
    hintsRefillStartedAt: Math.min(HINTS_MAX, Math.max(0, Math.round(num(p.hintsRemaining, HINTS_MAX)))) >= HINTS_MAX
      ? null
      : Math.max(0, num(p.hintsRefillStartedAt, now)) || now,
    activeRunId: typeof p.activeRunId === 'string' ? p.activeRunId : null,
    notificationPreferences: (() => {
      const prefs: NotificationPreferences = { ...defaultNotificationPreferences };
      if (isObj(p.notificationPreferences)) {
        for (const k of Object.keys(defaultNotificationPreferences) as (keyof NotificationPreferences)[]) {
          const v = (p.notificationPreferences as Record<string, unknown>)[k];
          if (typeof v === 'boolean') prefs[k] = v;
        }
      }
      return prefs;
    })(),
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
  refreshRewardState();
  refreshHints();
  emit();
}

interface AccountProgressSnapshot {
  version: 1;
  uid: string;
  progress: Pick<AppState, 'onboarded' | 'levels' | 'campaignLevels' | 'completionRewards' | 'unlockedBoardSkins' | 'unlockedProfileBadges' | 'daily' | 'stats' | 'achievements' | 'seen' | 'lastLevelId' | 'profile' | 'epoch' | 'syncedUid'>;
}

const accountStorageKey = (uid: string) => `flux.v1.account.${encodeURIComponent(uid)}`;

/** Preserve account-owned local changes separately before switching Firebase identities. */
export async function saveAccountProgressSnapshot(uid: string): Promise<void> {
  if (state.mode !== 'google' || state.account?.uid !== uid) {
    throw new Error('The current progress could not be safely associated with a Google account. Sign in to its original account before switching.');
  }
  const snapshot: AccountProgressSnapshot = {
    version: 1,
    uid,
    progress: {
      onboarded: state.onboarded,
      levels: state.levels,
      campaignLevels: state.campaignLevels,
      completionRewards: state.completionRewards,
      unlockedBoardSkins: state.unlockedBoardSkins,
      unlockedProfileBadges: state.unlockedProfileBadges,
      daily: state.daily,
      stats: state.stats,
      achievements: state.achievements,
      seen: state.seen,
      lastLevelId: state.lastLevelId,
      profile: state.profile,
      epoch: state.epoch,
      syncedUid: state.syncedUid,
    },
  };
  await AsyncStorage.setItem(accountStorageKey(uid), JSON.stringify(snapshot));
}

/** Select another Google account without carrying the previous account's progress into it. */
export async function selectGoogleAccount(account: Account): Promise<void> {
  if (state.mode === 'google' && state.account?.uid === account.uid) {
    setGoogleAccount(account);
    return;
  }

  let progress: Partial<AccountProgressSnapshot['progress']> | null = null;
  const raw = await AsyncStorage.getItem(accountStorageKey(account.uid));
  if (raw !== null) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('Saved progress for this Google account could not be read safely. The previous account data is preserved on this device.'); }
    if (!isObj(parsed) || parsed.version !== 1 || parsed.uid !== account.uid || !isObj(parsed.progress)
      || typeof parsed.progress.onboarded !== 'boolean' || !isObj(parsed.progress.levels) || !isObj(parsed.progress.daily)
      || (parsed.progress.campaignLevels !== undefined && !isObj(parsed.progress.campaignLevels))
      || (parsed.progress.completionRewards !== undefined && !isObj(parsed.progress.completionRewards))
      || (parsed.progress.unlockedBoardSkins !== undefined && !Array.isArray(parsed.progress.unlockedBoardSkins))
      || (parsed.progress.unlockedProfileBadges !== undefined && !Array.isArray(parsed.progress.unlockedProfileBadges))
      || !isObj(parsed.progress.stats) || !isObj(parsed.progress.achievements) || !isObj(parsed.progress.seen)
      || !(parsed.progress.lastLevelId === null || typeof parsed.progress.lastLevelId === 'string')
      || !isObj(parsed.progress.profile) || typeof parsed.progress.epoch !== 'number'
      || !(parsed.progress.syncedUid === null || parsed.progress.syncedUid === account.uid)) {
      throw new Error('Saved progress for this Google account is incompatible. The previous account data is preserved on this device.');
    }
    // Reuse the existing migration/sanitization path before applying stored account data.
    const safe = migrate({ ...parsed.progress, mode: 'google', account });
    progress = {
      onboarded: safe.onboarded,
      levels: safe.levels,
      campaignLevels: safe.campaignLevels,
      completionRewards: safe.completionRewards,
      unlockedBoardSkins: safe.unlockedBoardSkins,
      unlockedProfileBadges: safe.unlockedProfileBadges,
      daily: safe.daily,
      stats: safe.stats,
      achievements: safe.achievements,
      seen: safe.seen,
      lastLevelId: safe.lastLevelId,
      profile: safe.profile,
      epoch: safe.epoch,
      syncedUid: safe.syncedUid,
    };
  }

  const next: AppState = {
    ...state,
    mode: 'google',
    account,
    onboarded: progress?.onboarded ?? state.onboarded,
    levels: progress?.levels ?? {},
    campaignLevels: progress?.campaignLevels ?? {},
    completionRewards: progress?.completionRewards ?? {},
    unlockedBoardSkins: progress?.unlockedBoardSkins ?? [],
    unlockedProfileBadges: progress?.unlockedProfileBadges ?? [],
    daily: progress?.daily ?? {},
    stats: progress?.stats ?? initialStats(),
    achievements: progress?.achievements ?? {},
    seen: progress?.seen ?? {},
    lastLevelId: progress?.lastLevelId ?? null,
    profile: progress?.profile ?? newProfile(),
    epoch: progress?.epoch ?? 0,
    syncedUid: progress?.syncedUid === account.uid ? account.uid : null,
  };
  // Persist the identity and its matching progress before changing in-memory state.
  // A storage failure therefore leaves the previous account selected and recoverable.
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const { loaded, ...rest } = next;
  void loaded;
  await AsyncStorage.setItem(KEY, JSON.stringify(rest));
  state = next;
  emit();
}

export async function removeAccountProgressSnapshot(uid: string): Promise<void> {
  await AsyncStorage.removeItem(accountStorageKey(uid));
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
  notifyStateChangeForNotifications(next);
}

export function setSyncedUid(uid: string | null) {
  if (state.syncedUid !== uid) set({ syncedUid: uid });
}

/** Sign out: the account's data stays in the cloud, the phone goes back to a clean state so the next person starts fresh. */
export function signOutLocal() {
  const settings = state.settings;
  state = { ...initial(), loaded: true, settings, mode: null, onboarded: true, energy: state.energy, energyRefillStartedAt: state.energyRefillStartedAt, hintsRemaining: state.hintsRemaining, hintsRefillStartedAt: state.hintsRefillStartedAt, activeRunId: null };
  emit();
  persist();
  void flushStore();
}

/* ---------- actions ---------- */

export function updateSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
}

export function updateNotificationPreferences(patch: Partial<NotificationPreferences>) {
  set({ notificationPreferences: { ...state.notificationPreferences, ...patch } });
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

export function setProfile(patch: Partial<Pick<Profile, 'name' | 'avatar' | 'badge'>>) {
  set({ profile: { ...state.profile, ...patch } });
}

export function saveResume(snap: ResumeSnap | null) {
  set({ resume: snap });
}

/** Resolve elapsed refill time using trustedNow, which never moves backwards within this install. */
export function refreshEnergy(now = trustedNow()): number {
  if (state.energy < ENERGY_MAX && state.energyRefillStartedAt !== null && now - state.energyRefillStartedAt >= ENERGY_REFILL_MS) {
    set({ energy: ENERGY_MAX, energyRefillStartedAt: null });
  }
  return state.energy;
}

/** Refill the full local hint allowance 24 hours after its first spend. */
export function refreshHints(now = trustedNow()): number {
  if (state.hintsRemaining < HINTS_MAX && state.hintsRefillStartedAt !== null && now - state.hintsRefillStartedAt >= HINTS_REFILL_MS) {
    set({ hintsRemaining: HINTS_MAX, hintsRefillStartedAt: null });
  }
  return state.hintsRemaining;
}

/** Expire pending inventory after 24h and timed powers from their separate activation deadline. */
export function refreshRewardState(now = trustedNow()): void {
  let changed = false;
  const completionRewards = { ...state.completionRewards };
  for (const [key, reward] of Object.entries(completionRewards)) {
    if (reward.status === 'pending' && now >= reward.expiresAt) {
      completionRewards[key] = { ...reward, status: 'expired' };
      changed = true;
    } else if (reward.status === 'active' && reward.effectEndsAt !== undefined && now >= reward.effectEndsAt) {
      completionRewards[key] = { ...reward, status: 'completed', completedAt: now };
      changed = true;
    }
  }
  let referralChanged = false;
  const referralRewards = { ...state.referralRewards };
  for (const [key, reward] of Object.entries(referralRewards)) {
    if (reward.status === 'pending' && now >= reward.expiresAt) {
      referralRewards[key] = { ...reward, status: 'expired' };
      referralChanged = true;
    } else if (reward.status === 'active' && reward.effectEndsAt !== undefined && now >= reward.effectEndsAt) {
      referralRewards[key] = { ...reward, status: 'completed', completedAt: now };
      referralChanged = true;
    }
  }
  const patch: Partial<AppState> = {};
  if (changed) patch.completionRewards = completionRewards;
  if (referralChanged) patch.referralRewards = referralRewards;
  if (changed || referralChanged) set(patch);
}

export type RewardActionResult = { ok: true } | { ok: false; reason: string };

export function setPendingReferralCode(code: string | null): void {
  set({ pendingReferralCode: code });
}

export function setClaimedReferralCode(code: string | null): void {
  set({ claimedReferralCode: code });
}

export function setReferralRewards(referralRewards: Record<string, CompletionRewardRecord>): void {
  set({ referralRewards });
}

function rewardRecord(chestId: string): { key: string; reward: CompletionRewardRecord; source: 'completion' | 'referral' } | null {
  const cEntry = Object.entries(state.completionRewards).find(([, reward]) => reward.chestId === chestId);
  if (cEntry) return { key: cEntry[0], reward: cEntry[1], source: 'completion' };
  const rEntry = Object.entries(state.referralRewards).find(([, reward]) => reward.chestId === chestId);
  if (rEntry) return { key: rEntry[0], reward: rEntry[1], source: 'referral' };
  return null;
}

export function redeemReward(chestId: string, now = trustedNow()): RewardActionResult {
  refreshRewardState(now);
  const found = rewardRecord(chestId);
  if (!found) return { ok: false, reason: 'This reward is not in the active player inventory.' };
  const { key, reward, source } = found;
  if (reward.status !== 'pending' || now >= reward.expiresAt) return { ok: false, reason: 'This reward is no longer available to redeem.' };
  const rewards = [...Object.values(state.completionRewards), ...Object.values(state.referralRewards)];
  if ((reward.rewardId === 'unlimited-hints' || reward.rewardId === 'unlimited-energy')
    && rewards.some((item) => item.rewardId === reward.rewardId && item.status === 'active' && (item.effectEndsAt ?? 0) > now)) {
    return { ok: false, reason: 'That effect is already active. This reward remains available until it expires.' };
  }
  if ((reward.rewardId === 'extra-undo' || reward.rewardId === 'time-freeze' || reward.rewardId === 'energy-shield')
    && rewards.some((item) => item.chestId !== chestId && item.rewardId === reward.rewardId && (item.status === 'redeemed' || item.status === 'active'))) {
    return { ok: false, reason: 'A charge of this power-up is already ready or active. This reward remains available until it expires.' };
  }
  const next: CompletionRewardRecord = { ...reward, redeemedAt: now };
  let energyPatch: Partial<AppState> = {};
  let unlockedBoardSkins = state.unlockedBoardSkins;
  let unlockedProfileBadges = state.unlockedProfileBadges;
  if (reward.rewardId === 'unlimited-hints' || reward.rewardId === 'unlimited-energy') {
    next.status = 'active';
    next.activatedAt = now;
    next.effectEndsAt = now + (rewardDefinition(reward.rewardId).durationMs ?? 0);
  } else if (reward.rewardId === 'instant-energy') {
    next.status = 'completed'; next.activatedAt = now; next.completedAt = now;
    energyPatch = { energy: ENERGY_MAX, energyRefillStartedAt: null };
  } else if (reward.rewardId === 'board-skin-treasure') {
    next.status = 'completed'; next.activatedAt = now; next.completedAt = now;
    if (!unlockedBoardSkins.includes('treasure')) unlockedBoardSkins = [...unlockedBoardSkins, 'treasure'];
  } else if (reward.rewardId === 'profile-badge-prism') {
    next.status = 'completed'; next.activatedAt = now; next.completedAt = now;
    if (!unlockedProfileBadges.includes('prism')) unlockedProfileBadges = [...unlockedProfileBadges, 'prism'];
  } else {
    // Extra Undo, Time Freeze, and Energy Shield become one non-stacking charge.
    next.status = 'redeemed';
  }
  if (source === 'completion') {
    set({ completionRewards: { ...state.completionRewards, [key]: next }, unlockedBoardSkins, unlockedProfileBadges, ...energyPatch });
  } else {
    set({ referralRewards: { ...state.referralRewards, [key]: next }, unlockedBoardSkins, unlockedProfileBadges, ...energyPatch });
    if (state.account?.uid) {
      void (async () => {
        try {
          const { updateRemoteReferralChest } = await import('../cloud/referral');
          await updateRemoteReferralChest(state.account!.uid, next);
        } catch { /* offline safe */ }
      })();
    }
  }
  return { ok: true };
}

export function isRewardActive(id: RewardId, now = trustedNow()): boolean {
  refreshRewardState(now);
  const rewards = [...Object.values(state.completionRewards), ...Object.values(state.referralRewards)];
  return rewards.some((reward) => reward.rewardId === id && reward.status === 'active'
    && (reward.effectEndsAt === undefined || reward.effectEndsAt > now));
}

export function timeFreezeChargeAvailable(): boolean {
  refreshRewardState();
  const rewards = [...Object.values(state.completionRewards), ...Object.values(state.referralRewards)];
  return rewards.some((reward) => reward.rewardId === 'time-freeze' && reward.status === 'redeemed');
}

export function activateTimeFreeze(now = trustedNow()): RewardActionResult {
  refreshRewardState(now);
  const rewards = [...Object.values(state.completionRewards), ...Object.values(state.referralRewards)];
  if (rewards.some((reward) => reward.rewardId === 'time-freeze' && reward.status === 'active')) {
    return { ok: false, reason: 'Time Freeze is already active.' };
  }
  const cEntry = Object.entries(state.completionRewards).find(([, reward]) => reward.rewardId === 'time-freeze' && reward.status === 'redeemed');
  if (cEntry) {
    const [key, reward] = cEntry;
    set({ completionRewards: { ...state.completionRewards, [key]: { ...reward, status: 'active', activatedAt: now, effectEndsAt: now + 30_000 } } });
    return { ok: true };
  }
  const rEntry = Object.entries(state.referralRewards).find(([, reward]) => reward.rewardId === 'time-freeze' && reward.status === 'redeemed');
  if (rEntry) {
    const [key, reward] = rEntry;
    const updated: CompletionRewardRecord = { ...reward, status: 'active', activatedAt: now, effectEndsAt: now + 30_000 };
    set({ referralRewards: { ...state.referralRewards, [key]: updated } });
    if (state.account?.uid) {
      void (async () => {
        try {
          const { updateRemoteReferralChest } = await import('../cloud/referral');
          await updateRemoteReferralChest(state.account!.uid, updated);
        } catch { /* offline safe */ }
      })();
    }
    return { ok: true };
  }
  return { ok: false, reason: 'Redeem a Time Freeze in Rewards first.' };
}

export function timeFreezeRemainingMs(now = trustedNow()): number {
  refreshRewardState(now);
  const rewards = [...Object.values(state.completionRewards), ...Object.values(state.referralRewards)];
  const reward = rewards.find((item) => item.rewardId === 'time-freeze' && item.status === 'active');
  return reward?.effectEndsAt ? Math.max(0, reward.effectEndsAt - now) : 0;
}

/** Extra Undo is consumed at initialization of the next eligible chapter/Campaign run, including Boss levels. */
export function claimExtraUndoForRun(runId: string, source: GameSource, level: Level, allowClaim = true): { undoLimit: number; rewardId: string | null } {
  const base = level.boss?.undoAllowance ?? 3;
  refreshRewardState();
  const all = [
    ...Object.entries(state.completionRewards).map(([k, r]) => ({ key: k, reward: r, src: 'completion' as const })),
    ...Object.entries(state.referralRewards).map(([k, r]) => ({ key: k, reward: r, src: 'referral' as const })),
  ];
  const current = all.find(({ reward }) => reward.rewardId === 'extra-undo'
    && reward.status === 'active' && reward.activatedRunId === runId);
  if (current) return { undoLimit: Math.min(5, base + 2), rewardId: current.reward.chestId };
  let completionRewards = state.completionRewards;
  let referralRewards = state.referralRewards;
  let changed = false;

  const previous = all.find(({ reward }) => reward.rewardId === 'extra-undo' && reward.status === 'active');
  if (previous) {
    if (previous.src === 'completion') {
      completionRewards = { ...completionRewards, [previous.key]: { ...previous.reward, status: 'completed', completedAt: trustedNow() } };
    } else {
      referralRewards = { ...referralRewards, [previous.key]: { ...previous.reward, status: 'completed', completedAt: trustedNow() } };
    }
    changed = true;
  }
  const eligible = source.kind === 'classic' || source.kind === 'campaign';
  if (!eligible || !allowClaim) {
    if (changed) set({ completionRewards, referralRewards });
    return { undoLimit: base, rewardId: null };
  }
  const pending = all.find(({ reward }) => reward.rewardId === 'extra-undo' && reward.status === 'redeemed');
  if (!pending) {
    if (changed) set({ completionRewards, referralRewards });
    return { undoLimit: base, rewardId: null };
  }
  if (pending.src === 'completion') {
    completionRewards = { ...completionRewards, [pending.key]: { ...pending.reward, status: 'active', activatedAt: trustedNow(), activatedRunId: runId } };
  } else {
    referralRewards = { ...referralRewards, [pending.key]: { ...pending.reward, status: 'active', activatedAt: trustedNow(), activatedRunId: runId } };
  }
  set({ completionRewards, referralRewards });
  return { undoLimit: Math.min(5, base + 2), rewardId: pending.reward.chestId };
}

export function finishExtraUndoRun(runId: string): void {
  const cFound = Object.entries(state.completionRewards).find(([, reward]) => reward.rewardId === 'extra-undo'
    && reward.status === 'active' && reward.activatedRunId === runId);
  if (cFound) {
    const [key, reward] = cFound;
    set({ completionRewards: { ...state.completionRewards, [key]: { ...reward, status: 'completed', completedAt: trustedNow() } } });
    return;
  }
  const rFound = Object.entries(state.referralRewards).find(([, reward]) => reward.rewardId === 'extra-undo'
    && reward.status === 'active' && reward.activatedRunId === runId);
  if (rFound) {
    const [key, reward] = rFound;
    set({ referralRewards: { ...state.referralRewards, [key]: { ...reward, status: 'completed', completedAt: trustedNow() } } });
  }
}

/** Restarting the same run closes the one-shot bonus; it cannot be replenished by restart. */
export function finishExtraUndoForRestart(runId: string): void {
  finishExtraUndoRun(runId);
}

export function hintsCountdownMs(now = trustedNow()): number | null {
  refreshHints(now);
  return state.hintsRemaining >= HINTS_MAX || state.hintsRefillStartedAt === null
    ? null
    : Math.max(0, HINTS_REFILL_MS - (now - state.hintsRefillStartedAt));
}

/** Spend one hint charge. The 24-hour refill clock starts with the first charge spent. */
export function spendHint(now = trustedNow(), allowUnlimited = true): boolean {
  refreshRewardState(now);
  refreshHints(now);
  if (allowUnlimited && Object.values(state.completionRewards).some((reward) => reward.rewardId === 'unlimited-hints'
    && reward.status === 'active' && (reward.effectEndsAt ?? 0) > now)) return true;
  if (state.hintsRemaining <= 0) return false;
  set({
    hintsRemaining: state.hintsRemaining - 1,
    hintsRefillStartedAt: state.hintsRefillStartedAt ?? now,
  });
  return true;
}

export function energyCountdownMs(now = trustedNow()): number | null {
  refreshEnergy(now);
  return state.energy >= ENERGY_MAX || state.energyRefillStartedAt === null
    ? null
    : Math.max(0, ENERGY_REFILL_MS - (now - state.energyRefillStartedAt));
}

/**
 * A new run is one successfully initialized game session represented by a unique navigation runId.
 * Remounts/resumes carrying that ID are the same run; explicit Play Again and next-level actions use a new ID.
 */
export function beginEnergyRun(runId: string, now = trustedNow()): boolean {
  refreshRewardState(now);
  refreshEnergy(now);
  if (state.activeRunId === runId) return true;
  const unlimited = Object.values(state.completionRewards).some((reward) => reward.rewardId === 'unlimited-energy'
    && reward.status === 'active' && (reward.effectEndsAt ?? 0) > now);
  const shieldEntry = Object.entries(state.completionRewards).find(([, reward]) => reward.rewardId === 'energy-shield' && reward.status === 'redeemed');
  if (!unlimited && !shieldEntry && state.energy < ENERGY_COST_PER_RUN) return false;
  const energy = unlimited || shieldEntry ? state.energy : state.energy - ENERGY_COST_PER_RUN;
  const patch: Partial<AppState> = { activeRunId: runId };
  if (!unlimited && !shieldEntry) {
    patch.energy = energy;
    patch.energyRefillStartedAt = energy === ENERGY_MAX ? null : state.energyRefillStartedAt ?? now;
  }
  if (shieldEntry) {
    const [key, reward] = shieldEntry;
    patch.completionRewards = { ...state.completionRewards, [key]: { ...reward, status: 'completed', activatedAt: now, completedAt: now } };
  }
  set(patch);
  return true;
}

export function isRunActive(runId: string): boolean {
  return state.activeRunId === runId;
}

/** Adopt a legacy saved puzzle created before run IDs existed, without charging it again. */
export function adoptSavedRun(runId: string): void {
  set({ activeRunId: runId });
}

export function touchActive() {
  set({ lastActive: Date.now() });
}

export function resetAll() {
  const keep = state.settings;
  const profile = state.profile;
  state = { ...initial(), settings: keep, profile, completionRewards: state.completionRewards, loaded: true, mode: state.mode, account: state.account, syncedUid: state.syncedUid, epoch: Date.now() };
  emit();
  persist();
}

/** current time that cannot go backwards, even if the phone clock is set back */
export function trustedNow(): number {
  return Math.max(Date.now(), state.clockMax);
}

export function dateKey(d: Date = new Date(trustedNow())): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

function yesterdayKey(): string {
  const d = new Date(trustedNow());
  d.setUTCDate(d.getUTCDate() - 1);
  return dateKey(d);
}

export interface SolveInfo {
  moves: number;
  time: number;
  hints: number;
  bonus: boolean;
  stars: number;
  path?: number[];
}

export interface SolveOutcome {
  newBest: boolean;
  firstSolve: boolean;
  newAchievements: string[];
  chapterCompleted: number | null;
  /** True only when this first completion created the level's permanent chest record. */
  completionRewarded: boolean;
  completionReward: CompletionRewardRecord | null;
}

function completionRewardRecord(progression: CompletionRewardRecord['progression'], level: Level): CompletionRewardRecord {
  const playerId = state.mode === 'google' && state.account ? state.account.uid : state.profile.id;
  const chestId = `${encodeURIComponent(playerId)}:${progression}:${encodeURIComponent(level.id)}`;
  const generatedAt = trustedNow();
  const assigned = rewardForChest(chestId);
  return { playerId, progression, levelId: level.id, chestId, generatedAt, rewardId: assigned.id,
    rarity: assigned.rarity, status: 'pending', expiresAt: generatedAt + REWARD_PENDING_MS };
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
    const defs = CHAPTER_LEVEL_DEFS.filter((d) => d.chapter === ch);
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
  const rewardKey = `chapters:${level.id}`;
  const completionRewarded = !prev && !state.completionRewards[rewardKey];
  const completionRewards = completionRewarded
    ? { ...state.completionRewards, [rewardKey]: completionRewardRecord('chapters', level) }
    : state.completionRewards;
  set({ levels, stats, achievements, lastLevelId: level.id, completionRewards });
  if (!prev && info.path) {
    const proof = { levelId: level.id, enteredPath: info.path };
    void (async () => {
      try {
        const { queuePendingSolveProof, triggerReferralCompletionCheck } = await import('../cloud/referral');
        await queuePendingSolveProof(proof);
        if (state.mode === 'google' && state.account?.uid) {
          await triggerReferralCompletionCheck(state.account.uid, proof);
        }
      } catch { /* offline safe */ }
    })();
  }
  return {
    newBest: !prev || info.moves < prev.moves,
    firstSolve: !prev,
    newAchievements: earned,
    chapterCompleted: completed,
    completionRewarded,
    completionReward: completionRewarded ? completionRewards[rewardKey] : null,
  };
}

/** Record Campaign progress independently from the mechanic chapter records. */
export function recordCampaignSolve(level: Level, info: SolveInfo, evalAch: (s: AppState) => string[]): SolveOutcome {
  const prev = state.campaignLevels[level.id];
  const rec: LevelRecord = {
    stars: Math.max(prev?.stars ?? 0, info.stars),
    moves: prev ? Math.min(prev.moves, info.moves) : info.moves,
    time: prev ? Math.min(prev.time, info.time) : info.time,
    bonus: (prev?.bonus ?? false) || info.bonus,
    hintless: (prev?.hintless ?? false) || info.hints === 0,
  };
  const campaignLevels = { ...state.campaignLevels, [level.id]: rec };
  const stats = commonStats(state.stats, level, info);
  stats.hintsUsed += info.hints;
  const draft: AppState = { ...state, campaignLevels, stats };
  const earned = evalAch(draft).filter((a) => !state.achievements[a]);
  const achievements = { ...state.achievements };
  const now = Date.now();
  earned.forEach((a) => (achievements[a] = now));
  const rewardKey = `campaign:${level.id}`;
  const completionRewarded = !prev && !state.completionRewards[rewardKey];
  const completionRewards = completionRewarded
    ? { ...state.completionRewards, [rewardKey]: completionRewardRecord('campaign', level) }
    : state.completionRewards;
  set({ campaignLevels, stats, achievements, completionRewards });
  if (!prev && info.path) {
    const proof = { levelId: level.id, enteredPath: info.path };
    void (async () => {
      try {
        const { queuePendingSolveProof, triggerReferralCompletionCheck } = await import('../cloud/referral');
        await queuePendingSolveProof(proof);
        if (state.mode === 'google' && state.account?.uid) {
          await triggerReferralCompletionCheck(state.account.uid, proof);
        }
      } catch { /* offline safe */ }
    })();
  }
  return {
    newBest: !prev || info.moves < prev.moves,
    firstSolve: !prev,
    newAchievements: earned,
    chapterCompleted: null,
    completionRewarded,
    completionReward: completionRewarded ? completionRewards[rewardKey] : null,
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
  const isBetter = !prev || info.stars > prev.stars
    || (info.stars === prev.stars && info.moves < prev.moves)
    || (info.stars === prev.stars && info.moves === prev.moves && info.time < prev.time);
  const daily = isBetter
    ? { ...state.daily, [key]: { stars: info.stars, moves: info.moves, time: info.time, bonus: info.bonus } }
    : state.daily;
  const draft: AppState = { ...state, daily, stats };
  const earned = evalAch(draft).filter((a) => !state.achievements[a]);
  const achievements = { ...state.achievements };
  const now = Date.now();
  earned.forEach((a) => (achievements[a] = now));
  set({ daily, stats, achievements });
  return { newBest: isBetter, firstSolve: !prev, newAchievements: earned, chapterCompleted: null, completionRewarded: false, completionReward: null };
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
  const i = CHAPTER_LEVEL_DEFS.findIndex((d) => d.id === id);
  if (i <= 0) return i === 0;
  return !!levels[CHAPTER_LEVEL_DEFS[i - 1].id];
}

/** first unsolved level (the "current" one), or the last level when all done */
export function currentLevelId(levels: Record<string, LevelRecord>): string {
  const next = CHAPTER_LEVEL_DEFS.find((d) => !levels[d.id]);
  return (next ?? CHAPTER_LEVEL_DEFS[CHAPTER_LEVEL_DEFS.length - 1]).id;
}

export type { Mech };
