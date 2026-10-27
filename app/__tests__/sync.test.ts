jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockCloud = { json: null as string | null };
const mockTransaction = jest.fn();
jest.mock('../src/config', () => ({ cloudConfigured: () => true }));
jest.mock('../src/cloud/auth', () => ({
  ensureFirebaseUser: jest.fn(async () => true),
  transactRemote: (...args: unknown[]) => mockTransaction(...args),
}));
jest.mock('../src/cloud/leaderboards', () => ({ syncLeaderboardDisplayName: jest.fn(async () => undefined) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncNow } from '../src/cloud/sync';
import { syncLeaderboardDisplayName } from '../src/cloud/leaderboards';
import { mergeSync, toSyncData } from '../src/cloud/merge';
import { applyCloud, ENERGY_MAX, getState, loadStore, setGoogleAccount, setGuest, saveResume, beginEnergyRun, migrate } from '../src/store/store';
import type { SyncData } from '../src/cloud/merge';

const record = (stars: number) => ({ stars, moves: 5, time: 40, bonus: false, hintless: false });
const account = { uid: 'sync-test-user', email: 'player@example.com', name: 'Player', photo: null };
const baseData = (levels: SyncData['levels']): SyncData => ({ ...toSyncData(migrate({ onboarded: true })), levels });

describe('transactional progress synchronization', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCloud.json = null;
    mockTransaction.mockImplementation(async (_uid: string, update: (current: string | null) => { json: string | null; result: unknown }) => {
      const next = update(mockCloud.json);
      mockCloud.json = next.json;
      return next.result;
    });
    await AsyncStorage.clear();
    await loadStore();
    setGuest();
    saveResume({ runId: 'active-12345678', source: {} as never, levelId: '1-1', day: '', entered: [2], seconds: 15, hints: 0, savedAt: 10 });
    beginEnergyRun('active-12345678', 1000);
  });

  test('first-time Google account receives local progress, and retry is idempotent', async () => {
    applyCloud({ levels: { '1-1': record(3), '1-2': record(2) } });
    setGoogleAccount(account);
    expect(await syncNow()).toEqual({ ok: true });
    const first = JSON.parse(mockCloud.json as string) as SyncData;
    expect(Object.keys(first.levels).sort()).toEqual(['1-1', '1-2']);
    expect(await syncNow()).toEqual({ ok: true });
    const retried = JSON.parse(mockCloud.json as string) as SyncData;
    expect(retried.levels).toEqual(first.levels);
    expect(getState().resume?.runId).toBe('active-12345678');
    expect(getState().energy).toBe(ENERGY_MAX - 1);
  });

  test('profile name changes are published by cloud sync and remain sourced from the profile', async () => {
    applyCloud({ profile: { ...getState().profile, name: 'Asha' } });
    setGoogleAccount(account);
    expect(await syncNow()).toEqual({ ok: true });
    expect(syncLeaderboardDisplayName).toHaveBeenCalledWith(account.uid, 'Asha');
  });

  test('existing account merge keeps progress ahead on either side', async () => {
    const cloud = baseData({ '1-1': record(3), '1-2': record(2), '1-3': record(1) });
    mockCloud.json = JSON.stringify(cloud);
    applyCloud({ levels: { '1-1': record(2), '1-4': record(3) } });
    setGoogleAccount(account);
    expect(await syncNow()).toEqual({ ok: true });
    const final = JSON.parse(mockCloud.json as string) as SyncData;
    expect(Object.keys(final.levels).sort()).toEqual(['1-1', '1-2', '1-3', '1-4']);
    expect(final.levels['1-1'].stars).toBe(3);
  });

  test('app reload after committed sync restores the merged progress and can sync again', async () => {
    const cloud = baseData({ '1-1': record(3), '1-3': record(2) });
    mockCloud.json = JSON.stringify(cloud);
    applyCloud({ levels: { '1-2': record(2) } });
    setGoogleAccount(account);
    expect(await syncNow()).toEqual({ ok: true });
    await loadStore();
    expect(getState().account?.uid).toBe(account.uid);
    expect(Object.keys(getState().levels).sort()).toEqual(['1-1', '1-2', '1-3']);
    expect(await syncNow()).toEqual({ ok: true });
  });

  test('transaction failure leaves guest progress and active local state unchanged', async () => {
    applyCloud({ levels: { '1-1': record(3) } });
    setGoogleAccount(account);
    const before = getState();
    mockTransaction.mockRejectedValueOnce(new Error('offline'));
    expect(await syncNow()).toMatchObject({ ok: false });
    expect(getState().levels).toEqual(before.levels);
    expect(getState().resume).toEqual(before.resume);
    expect(getState().energy).toBe(before.energy);
  });

  test('malformed cloud records are rejected before application or overwrite', async () => {
    const malformed = baseData({ '1-1': { ...record(3), stars: 9 } });
    mockCloud.json = JSON.stringify(malformed);
    applyCloud({ levels: { '1-2': record(2) } });
    setGoogleAccount(account);
    const before = getState().levels;

    const result = await syncNow();

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('malformed') });
    expect(getState().levels).toEqual(before);
    expect(JSON.parse(mockCloud.json as string).levels['1-1'].stars).toBe(9);
  });

  test('an in-flight sync for one Google UID cannot write the newly selected account progress to the old UID', async () => {
    const accountA = { uid: 'account-a', email: '', name: 'A', photo: null };
    const accountB = { uid: 'account-b', email: '', name: 'B', photo: null };
    setGoogleAccount(accountA);
    applyCloud({ levels: { '1-1': record(3) } });
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    mockTransaction.mockImplementationOnce(async (uid: string, update: (current: string | null) => { json: string | null; result: unknown }) => {
      await gate;
      const next = update(mockCloud.json);
      mockCloud.json = next.json;
      return next.result;
    });

    const firstSync = syncNow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    setGoogleAccount(accountB);
    applyCloud({ levels: { '1-2': record(2) } });
    const secondSync = syncNow();
    releaseFirst();

    expect((await firstSync).ok).toBe(false);
    expect(await secondSync).toEqual({ ok: true });
    expect(mockTransaction.mock.calls.map((call) => call[0])).toEqual(['account-a', 'account-b']);
    expect(Object.keys(JSON.parse(mockCloud.json as string).levels)).toEqual(['1-2']);
  });
});
