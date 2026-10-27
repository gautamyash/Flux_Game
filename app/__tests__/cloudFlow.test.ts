jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockSignIn = jest.fn();
const mockSyncNow = jest.fn();
jest.mock('../src/cloud/auth', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignIn(...args),
  signOutCloud: jest.fn(), deleteCloudAccount: jest.fn(),
}));
jest.mock('../src/cloud/sync', () => ({ syncNow: (...args: unknown[]) => mockSyncNow(...args), resetSyncMemory: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithGoogle, logout } from '../src/cloud/flow';
import { applyCloud, beginEnergyRun, getState, loadStore, saveAccountProgressSnapshot, saveResume, setGoogleAccount, setGuest, setLastLevel } from '../src/store/store';

const account = { uid: 'google-user', email: 'player@example.com', name: 'Player', photo: null };

describe('guest to Google progress sync orchestration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await loadStore();
    setGuest();
    setLastLevel('1-1');
    saveResume({ runId: 'run-12345678', source: {} as never, levelId: '1-1', day: '', entered: [1], seconds: 30, hints: 1, savedAt: 100 });
    beginEnergyRun('run-12345678', 1000);
    mockSignIn.mockResolvedValue({ ok: true, account });
    mockSyncNow.mockResolvedValue({ ok: true });
  });

  test('first Google sign-in reports success only after the cloud merge confirms', async () => {
    const result = await loginWithGoogle();
    expect(result).toEqual({ ok: true });
    expect(mockSyncNow).toHaveBeenCalledTimes(1);
    expect(getState().mode).toBe('google');
    expect(getState().account?.uid).toBe(account.uid);
    expect(getState().resume?.runId).toBe('run-12345678');
  });

  test('cancellation leaves guest progress and active local state unchanged', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: false, cancelled: true, error: 'Sign-in cancelled.' });
    const before = getState();
    expect(await loginWithGoogle()).toMatchObject({ ok: false, cancelled: true });
    expect(getState().mode).toBe('guest');
    expect(getState().lastLevelId).toBe(before.lastLevelId);
    expect(getState().resume).toEqual(before.resume);
    expect(getState().energy).toBe(before.energy);
    expect(mockSyncNow).not.toHaveBeenCalled();
  });

  test('network failure during sign-in retains guest state', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: false, error: 'No internet connection. Your local progress is safe.' });
    const before = getState();
    const result = await loginWithGoogle();
    expect(result.ok).toBe(false);
    expect(getState().mode).toBe('guest');
    expect(getState().resume).toEqual(before.resume);
    expect(getState().energy).toBe(before.energy);
  });

  test('sync failure is recoverable and the guest snapshot remains available after app reload', async () => {
    mockSyncNow.mockResolvedValueOnce({ ok: false, error: 'Offline; local progress is safe.' });
    expect(await loginWithGoogle()).toEqual({ ok: false, error: 'Offline; local progress is safe.' });
    await loadStore();
    expect(getState().mode).toBe('google');
    expect(getState().lastLevelId).toBe('1-1');
    expect(getState().resume?.runId).toBe('run-12345678');
    expect(getState().energy).toBe(4);
    mockSyncNow.mockResolvedValueOnce({ ok: true });
    expect(await loginWithGoogle()).toEqual({ ok: true });
  });

  test('switching Google accounts keeps the old account progress in its UID-scoped snapshot and never merges it into the new account', async () => {
    const oldAccount = { uid: 'google-a', email: 'a@example.com', name: 'A', photo: null };
    const newAccount = { uid: 'google-b', email: 'b@example.com', name: 'B', photo: null };
    setGoogleAccount(oldAccount);
    applyCloud({ levels: { '1-1': { stars: 3, moves: 4, time: 20, bonus: true, hintless: true } } });
    mockSignIn.mockResolvedValueOnce({ ok: true, account: newAccount });

    const result = await loginWithGoogle();

    expect(result).toMatchObject({ ok: true, warning: expect.stringContaining('previous account') });
    expect(getState().account?.uid).toBe('google-b');
    expect(getState().levels).toEqual({});
    expect(getState().resume?.runId).toBe('run-12345678');
    expect(getState().energy).toBe(4);
    const savedA = JSON.parse((await AsyncStorage.getItem('flux.v1.account.google-a')) as string);
    expect(savedA.uid).toBe('google-a');
    expect(savedA.progress.levels['1-1'].stars).toBe(3);
  });

  test('switching back restores that account snapshot while keeping device energy and active puzzle', async () => {
    const accountA = { uid: 'google-a', email: 'a@example.com', name: 'A', photo: null };
    const accountB = { uid: 'google-b', email: 'b@example.com', name: 'B', photo: null };
    setGoogleAccount(accountA);
    applyCloud({ levels: { '1-2': { stars: 2, moves: 7, time: 40, bonus: false, hintless: false } } });
    await saveAccountProgressSnapshot('google-a');
    setGoogleAccount(accountB);
    applyCloud({ levels: { '1-3': { stars: 1, moves: 9, time: 60, bonus: false, hintless: false } } });
    await saveAccountProgressSnapshot('google-b');
    mockSignIn.mockResolvedValueOnce({ ok: true, account: accountA });

    await loginWithGoogle();

    expect(getState().account?.uid).toBe('google-a');
    expect(getState().levels).toEqual({ '1-2': { stars: 2, moves: 7, time: 40, bonus: false, hintless: false } });
    expect(getState().resume?.runId).toBe('run-12345678');
    expect(getState().energy).toBe(4);
  });

  test('failed cloud sync blocks logout from clearing unsynced local progress', async () => {
    setGoogleAccount(account);
    mockSyncNow.mockResolvedValueOnce({ ok: false, error: 'Offline; local progress is safe.' });
    const before = getState();
    expect(await logout()).toEqual({ ok: false, error: 'Offline; local progress is safe.' });
    expect(getState().mode).toBe('google');
    expect(getState().resume).toEqual(before.resume);
    expect(getState().energy).toBe(before.energy);
  });
});
