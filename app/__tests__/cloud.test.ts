jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({}));

import { mergeSync, sameSync, toSyncData, SyncData } from '../src/cloud/merge';
import { applyCloud, beginEnergyRun, getState, loadStore, migrate, saveResume } from '../src/store/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const base = (): SyncData => toSyncData(migrate({ onboarded: true }));
const withLevels = (levels: SyncData['levels'], extra: Partial<SyncData> = {}): SyncData => ({ ...base(), levels, ...extra });
const rec = (stars: number, moves = 5, time = 30) => ({ stars, moves, time, bonus: false, hintless: false });

describe('mergeSync', () => {
  test('guest progress and account progress are both kept (best of each)', () => {
    const guest = withLevels({ '1-1': rec(2, 6, 40), '1-2': rec(3) });
    const cloud = withLevels({ '1-1': rec(3, 5, 50), '1-3': rec(1) });
    const m = mergeSync(guest, cloud, false);
    expect(Object.keys(m.levels).sort()).toEqual(['1-1', '1-2', '1-3']);
    expect(m.levels['1-1']).toMatchObject({ stars: 3, moves: 5, time: 40 });
  });

  test('guest-ahead and cloud-ahead progress both survive the merge', () => {
    const guestAhead = withLevels({ '1-1': rec(3), '1-2': rec(2), '1-3': rec(1) });
    const oldCloud = withLevels({ '1-1': rec(1) });
    const cloudAhead = withLevels({ '1-1': rec(3), '1-2': rec(2), '1-3': rec(1), '1-4': rec(3) });
    const newerPhone = withLevels({ '1-1': rec(2) });
    expect(Object.keys(mergeSync(guestAhead, oldCloud, false).levels)).toHaveLength(3);
    expect(Object.keys(mergeSync(newerPhone, cloudAhead, false).levels)).toHaveLength(4);
  });

  test('is symmetric for progress (order does not matter)', () => {
    const a = withLevels({ '1-1': rec(2) }, { achievements: { first: 100 } });
    const b = withLevels({ '1-1': rec(3), '1-2': rec(1) }, { achievements: { first: 50, other: 70 } });
    const ab = mergeSync(a, b, false);
    const ba = mergeSync(b, a, false);
    expect(ab.levels).toEqual(ba.levels);
    expect(ab.achievements).toEqual({ first: 50, other: 70 });
  });

  test('daily records are unioned and streak follows the more recent day', () => {
    const a = base(); a.daily = { '2026-10-01': { stars: 3, moves: 1, time: 1, bonus: false } }; a.stats = { ...a.stats, streak: 2, lastDaily: '2026-10-01', longestStreak: 2 };
    const b = base(); b.daily = { '2026-10-03': { stars: 2, moves: 1, time: 1, bonus: false } }; b.stats = { ...b.stats, streak: 5, lastDaily: '2026-10-03', longestStreak: 5 };
    const m = mergeSync(a, b, false);
    expect(Object.keys(m.daily).sort()).toEqual(['2026-10-01', '2026-10-03']);
    expect(m.stats.streak).toBe(5);
    expect(m.stats.lastDaily).toBe('2026-10-03');
  });

  test('a newer reset on the same account wins; for a different account progress is merged instead', () => {
    const local = withLevels({ '1-1': rec(3) }, { epoch: 0 });
    const remote = withLevels({}, { epoch: 999 });
    expect(mergeSync(local, remote, true).levels).toEqual({});
    expect(Object.keys(mergeSync(local, remote, false).levels)).toEqual(['1-1']);
    const localReset = withLevels({}, { epoch: 2000 });
    const remoteOld = withLevels({ '1-1': rec(3) }, { epoch: 1000 });
    expect(mergeSync(localReset, remoteOld, true).levels).toEqual({});
  });

  test('a fresh phone adopts the cloud settings, a used phone keeps its own', () => {
    const cloud = base(); cloud.settings = { ...cloud.settings, sound: false, skin: 'ink' };
    const fresh = base();
    expect(mergeSync(fresh, cloud, false).settings.skin).toBe('ink');
    const used = withLevels({ '1-1': rec(3) });
    expect(mergeSync(used, cloud, false).settings.skin).toBe(used.settings.skin);
  });

  test('profile: keeps the local name, takes the account id', () => {
    const local = base(); local.profile = { ...local.profile, name: 'Asha', id: 'local' };
    const cloud = base(); cloud.profile = { ...cloud.profile, name: 'Old', id: 'acct' };
    const m = mergeSync(local, cloud, false);
    expect(m.profile.name).toBe('Asha');
    expect(m.profile.id).toBe('acct');
  });

  test('sameSync ignores timestamps only', () => {
    const a = base();
    expect(sameSync(a, { ...a, updatedAt: a.updatedAt + 5, clockMax: 1 })).toBe(true);
    expect(sameSync(a, withLevels({ '1-1': rec(1) }))).toBe(false);
  });

  test('merge is idempotent across a retried sync', () => {
    const guest = withLevels({ '1-1': rec(3), '1-2': rec(1) }, { achievements: { first: 123 } });
    const cloud = withLevels({ '1-1': rec(2), '1-3': rec(2) }, { achievements: { first: 200, cloud: 150 } });
    const first = mergeSync(guest, cloud, false);
    const retry = mergeSync(first, first, true);
    expect(sameSync(first, retry)).toBe(true);
    expect(retry.levels).toHaveProperty('1-3');
    expect(retry.achievements).toHaveProperty('cloud');
  });
});

test('applying a cloud merge leaves the active puzzle, run identity, and local energy untouched', async () => {
  await AsyncStorage.clear();
  await loadStore();
  saveResume({ runId: 'active-run-123', source: { mode: 'classic' } as never, levelId: '1-1', day: '', entered: [1, 2], seconds: 20, hints: 1, savedAt: 20 });
  beginEnergyRun('active-run-123', 1000);
  const before = getState();
  applyCloud({ levels: { '1-1': rec(3) }, stats: { ...before.stats, solvedAny: 1 } });
  const after = getState();
  expect(after.resume).toEqual(before.resume);
  expect(after.activeRunId).toBe(before.activeRunId);
  expect(after.energy).toBe(before.energy);
  expect(after.energyRefillStartedAt).toBe(before.energyRefillStartedAt);
  expect(after.levels['1-1'].stars).toBe(3);
});

describe('login mode in saved data', () => {
  test('old saves that already played become guests, brand new installs have no mode yet', () => {
    expect(migrate({ onboarded: true }).mode).toBe('guest');
    expect(migrate({}).mode).toBeNull();
    expect(migrate({ mode: 'google' }).mode).toBeNull(); // google without an account is not valid
    const g = migrate({ mode: 'google', account: { uid: 'u1', email: 'a@b.c', name: 'A' } });
    expect(g.mode).toBe('google');
    expect(g.account?.uid).toBe('u1');
  });
});

test('energy and daily hint charges remain device-local and are excluded from cloud sync', () => {
  const data = toSyncData(migrate({ energy: 2, energyRefillStartedAt: 1234, hintsRemaining: 1, hintsRefillStartedAt: 5678 }));
  expect(data).not.toHaveProperty('energy');
  expect(data).not.toHaveProperty('energyRefillStartedAt');
  expect(data).not.toHaveProperty('hintsRemaining');
  expect(data).not.toHaveProperty('hintsRefillStartedAt');
});
