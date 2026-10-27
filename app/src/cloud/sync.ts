import { AppState as RNAppState } from 'react-native';
import { AVATAR_COLORS, applyCloud, defaultSettings, flushStore, getState, isValidDateKey, setSyncedUid, subscribe } from '../store/store';
import type { AppState } from '../store/store';
import { ALL_LEVEL_DEFS } from '../lib/levels';
import { SKINS } from '../theme/tokens';
import type { SkinId } from '../theme/tokens';
import { cloudConfigured } from '../config';
import { ensureFirebaseUser, transactRemote } from './auth';
import { SyncData, mergeSync, sameSync, toSyncData } from './merge';

export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'needs-login';
interface Status { state: SyncState; lastAt: number | null; error: string | null }
export type SyncResult = { ok: true } | { ok: false; error: string };

let status: Status = { state: 'off', lastAt: null, error: null };
const listeners = new Set<() => void>();
export const getSyncStatus = () => status;
export const subscribeSync = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function setStatus(s: Partial<Status>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
}

let lastPushed: SyncData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: { uid: string; promise: Promise<SyncResult> } | null = null;

function parse(json: string | null): SyncData | null {
  if (!json) return null;
  let d: SyncData;
  try {
    d = JSON.parse(json) as SyncData;
  } catch {
    throw new Error('Cloud progress could not be read safely. Your local progress is safe; contact support before retrying.');
  }
  if (!validCloudData(d)) throw new Error('Cloud progress is malformed or uses an unsupported format. Your local progress is safe; sign in again later or contact support before resetting it.');
  return d;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const whole = (v: unknown): v is number => nonNegative(v) && Number.isInteger(v);
const levelIds = new Set(ALL_LEVEL_DEFS.map((level) => level.id));
const settingKeys = new Set(Object.keys(defaultSettings));
const skinIds = new Set(SKINS.map((skin) => skin.id));

function validCloudData(value: unknown): value is SyncData {
  if (!isRecord(value) || value.v !== 1 || typeof value.onboarded !== 'boolean'
    || !whole(value.epoch) || !whole(value.clockMax) || !whole(value.updatedAt)) return false;
  if (!isRecord(value.settings)) return false;
  const settings = value.settings;
  if (Object.keys(settings).some((key) => !settingKeys.has(key))
    || Object.keys(defaultSettings).some((key) => !(key in settings))) return false;
  for (const key of Object.keys(defaultSettings) as (keyof typeof defaultSettings)[]) {
    const expected = defaultSettings[key];
    const actual = settings[key];
    if (typeof actual !== typeof expected) return false;
  }
  if (!whole(settings.hapticLevel) || settings.hapticLevel > 2
    || !['system', 'light', 'dark'].includes(String(settings.themeMode)) || !skinIds.has(settings.skin as SkinId)
    || !whole(settings.notifyHour) || settings.notifyHour > 23) return false;

  if (!isRecord(value.levels) || !isRecord(value.daily) || !isRecord(value.achievements) || !isRecord(value.seen)) return false;
  for (const [id, raw] of Object.entries(value.levels)) {
    if (!levelIds.has(id) || !isRecord(raw) || !whole(raw.stars) || raw.stars < 1 || raw.stars > 3
      || !nonNegative(raw.moves) || !nonNegative(raw.time) || typeof raw.bonus !== 'boolean' || typeof raw.hintless !== 'boolean') return false;
  }
  for (const [day, raw] of Object.entries(value.daily)) {
    if (!isValidDateKey(day) || !isRecord(raw) || !whole(raw.stars) || raw.stars < 1 || raw.stars > 3
      || !nonNegative(raw.moves) || !nonNegative(raw.time) || typeof raw.bonus !== 'boolean') return false;
  }
  for (const time of Object.values(value.achievements)) if (!nonNegative(time)) return false;
  for (const seen of Object.values(value.seen)) if (seen !== true) return false;

  if (!isRecord(value.stats)) return false;
  for (const field of ['hintsUsed', 'perfect', 'noHint', 'speed', 'streak', 'longestStreak', 'rushBest', 'endlessBest', 'solvedAny']) {
    if (!whole(value.stats[field])) return false;
  }
  if (!(value.stats.fastest === null || nonNegative(value.stats.fastest))
    || !(value.stats.fastestLevel === null || (typeof value.stats.fastestLevel === 'string' && levelIds.has(value.stats.fastestLevel)))
    || !(value.stats.lastDaily === null || (typeof value.stats.lastDaily === 'string' && isValidDateKey(value.stats.lastDaily)))
    || !isRecord(value.stats.mech)) return false;
  for (const amount of Object.values(value.stats.mech)) if (!whole(amount)) return false;

  if (value.lastLevelId !== null && (typeof value.lastLevelId !== 'string' || !levelIds.has(value.lastLevelId))) return false;
  if (!isRecord(value.profile) || typeof value.profile.id !== 'string' || !value.profile.id
    || typeof value.profile.name !== 'string' || !whole(value.profile.avatar) || value.profile.avatar >= AVATAR_COLORS.length
    || !nonNegative(value.profile.createdAt)) return false;
  return true;
}

/** Merge with the latest cloud copy in a Firestore transaction, then persist the confirmed result here. */
export function syncNow(): Promise<SyncResult> {
  const s = getState();
  if (s.mode !== 'google' || !s.account || !cloudConfigured()) { setStatus({ state: 'off', error: null }); return Promise.resolve({ ok: false, error: 'Sign in with Google to sync progress.' }); }
  const uid = s.account.uid;
  if (running) {
    if (running.uid === uid) return running.promise;
    // Finish the previous identity's transaction before starting one for the newly selected UID.
    return running.promise.then(() => syncNow());
  }
  const task = (async (): Promise<SyncResult> => {
    setStatus({ state: 'syncing', error: null });
    try {
      if (!(await ensureFirebaseUser(uid))) {
        const error = 'This Google account is no longer signed in. Sign in again to sync; your local progress is safe.';
        setStatus({ state: 'needs-login', error });
        return { ok: false, error };
      }
      const merged = await transactRemote<SyncData>(uid, (json) => {
        const cur = getState();
        if (cur.mode !== 'google' || cur.account?.uid !== uid) throw new Error('The active account changed during sync. Sign in again to sync the correct account; local progress is safe.');
        const local = toSyncData(cur);
        const remote = parse(json);
        const result = remote ? mergeSync(local, remote, cur.syncedUid === uid) : local;
        return { json: JSON.stringify(result), result };
      });
      const cur = getState();
      if (cur.mode !== 'google' || cur.account?.uid !== uid) return { ok: false, error: 'The active account changed during sync. Sign in again to sync the correct account; local progress is safe.' };
      // Merge once more with any play recorded while the network transaction was in flight.
      // Device-only resume/session fields are omitted from applyCloud and remain untouched.
      const localNow = toSyncData(cur);
      const safeLocal = sameSync(localNow, merged) ? merged : mergeSync(localNow, merged, cur.syncedUid === uid);
      if (!sameSync(safeLocal, localNow)) {
        applyCloud({
          onboarded: safeLocal.onboarded, settings: safeLocal.settings, levels: safeLocal.levels, daily: safeLocal.daily, stats: safeLocal.stats,
          achievements: safeLocal.achievements, seen: safeLocal.seen, lastLevelId: safeLocal.lastLevelId, profile: safeLocal.profile,
          epoch: safeLocal.epoch, clockMax: Math.max(cur.clockMax, safeLocal.clockMax),
        } as Partial<AppState>);
      }
      lastPushed = merged;
      setSyncedUid(uid);
      await flushStore();
      setStatus({ state: 'idle', lastAt: Date.now(), error: null });
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not sync progress. Your local progress is safe; try again when online.';
      if (getState().mode === 'google' && getState().account?.uid === uid) setStatus({ state: 'offline', error: message });
      return { ok: false, error: message };
    }
  })();
  const promise = task.finally(() => { if (running?.promise === promise) running = null; });
  running = { uid, promise };
  return promise;
}

/** Import an anonymous UID's private cloud snapshot locally before Firebase switches to an existing Google UID. */
export async function mergeLocalProgress(json: string | null): Promise<void> {
  const imported = parse(json);
  if (!imported) return;
  const cur = getState();
  const merged = mergeSync(toSyncData(cur), imported, false);
  applyCloud({
    onboarded: merged.onboarded, settings: merged.settings, levels: merged.levels, daily: merged.daily, stats: merged.stats,
    achievements: merged.achievements, seen: merged.seen, lastLevelId: merged.lastLevelId, profile: merged.profile,
    epoch: merged.epoch, clockMax: Math.max(cur.clockMax, merged.clockMax),
  } as Partial<AppState>);
  await flushStore();
}

function schedulePush() {
  const s = getState();
  if (s.mode !== 'google' || !s.account || !cloudConfigured()) return;
  if (lastPushed && sameSync(toSyncData(s), lastPushed)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, 4000);
}

let started = false;
/** Call once at app start. Syncs on launch, on every progress change (debounced), and when the app comes back. */
export function startSync() {
  if (started) return;
  started = true;
  subscribe(schedulePush);
  RNAppState.addEventListener('change', (next) => {
    if (next === 'active') void syncNow();
    else if (timer) { clearTimeout(timer); timer = null; void syncNow(); }
  });
  void syncNow();
}

export function resetSyncMemory() {
  lastPushed = null;
  if (timer) { clearTimeout(timer); timer = null; }
  setStatus({ state: 'off', lastAt: null, error: null });
}
