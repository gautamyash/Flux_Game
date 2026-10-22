import { AppState as RNAppState } from 'react-native';
import { applyCloud, getState, setSyncedUid, subscribe } from '../store/store';
import type { AppState } from '../store/store';
import { cloudConfigured } from '../config';
import { ensureFirebaseUser, readRemote, writeRemote } from './auth';
import { SyncData, mergeSync, sameSync, toSyncData } from './merge';

export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'needs-login';
interface Status { state: SyncState; lastAt: number | null }

let status: Status = { state: 'off', lastAt: null };
const listeners = new Set<() => void>();
export const getSyncStatus = () => status;
export const subscribeSync = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function setStatus(s: Partial<Status>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
}

let lastPushed: SyncData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;

function parse(json: string | null): SyncData | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as SyncData;
    return d && d.v === 1 && d.levels && d.stats && d.profile ? d : null;
  } catch {
    return null;
  }
}

/** Pull the cloud copy, merge with this phone, store the result here and upload it if it changed. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const s = getState();
    if (s.mode !== 'google' || !s.account || !cloudConfigured()) { setStatus({ state: 'off' }); return; }
    const uid = s.account.uid;
    setStatus({ state: 'syncing' });
    try {
      if (!(await ensureFirebaseUser(uid))) { setStatus({ state: 'needs-login' }); return; }
      const remote = parse(await readRemote(uid));
      const cur = getState();
      const local = toSyncData(cur);
      const merged = remote ? mergeSync(local, remote, cur.syncedUid === uid) : local;
      if (!sameSync(merged, local)) {
        applyCloud({
          onboarded: merged.onboarded, settings: merged.settings, levels: merged.levels, daily: merged.daily, stats: merged.stats,
          achievements: merged.achievements, seen: merged.seen, lastLevelId: merged.lastLevelId, profile: merged.profile,
          epoch: merged.epoch, clockMax: Math.max(cur.clockMax, merged.clockMax),
        } as Partial<AppState>);
      }
      if (!remote || !sameSync(merged, remote)) await writeRemote(uid, JSON.stringify(merged));
      lastPushed = merged;
      setSyncedUid(uid);
      setStatus({ state: 'idle', lastAt: Date.now() });
    } catch {
      setStatus({ state: 'offline' });
    }
  })().finally(() => { running = null; });
  return running;
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
  setStatus({ state: 'off', lastAt: null });
}
