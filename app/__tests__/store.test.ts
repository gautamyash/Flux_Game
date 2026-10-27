jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HINTS_MAX, HINTS_REFILL_MS, SCHEMA, beginEnergyRun, dateKey, energyCountdownMs, ENERGY_MAX, ENERGY_REFILL_MS, flushStore, getState, hintsCountdownMs, isValidDateKey, loadStore, migrate, recordClassicSolve, recordDailySolve, refreshEnergy, refreshHints, resetAll, saveAccountProgressSnapshot, selectGoogleAccount, setGoogleAccount, setGuest, setProfile, signOutLocal, spendHint, trustedNow, touchActive,
} from '../src/store/store';
import { evaluateAchievements } from '../src/lib/achievements';
import { getLevel } from '../src/lib/levels';
import { describeCell } from '../src/lib/a11y';
import { createSession, current } from '../src/engine';
import { logCrash, readCrashLog, reportText } from '../src/lib/crash';

const info = { moves: 5, time: 20, hints: 0, bonus: false, stars: 3 };

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAll();
  await flushStore();
});

describe('migrate', () => {
  test('garbage becomes a valid default state', () => {
    for (const bad of [null, undefined, 42, 'x', [], {}]) {
      const s = migrate(bad);
      expect(s.schema).toBe(SCHEMA);
      expect(s.levels).toEqual({});
      expect(s.settings.sound).toBe(true);
    }
  });

  test('keeps valid data, drops damaged bits', () => {
    const s = migrate({
      onboarded: true,
      settings: { sound: false, notifyHour: 99, themeMode: 'purple', hapticLevel: 7 },
      levels: { '1-1': { stars: 9, moves: 4, time: 10, bonus: true, hintless: true }, 'nope-1': { stars: 3 }, '1-2': 'bad' },
      daily: { '2026-01-02': { stars: 2, moves: 3, time: 4, bonus: false }, 'bad-key': {} },
      stats: { streak: -3, rushBest: 'x', mech: { burn: 2 } },
      profile: { id: 'abc', name: 'A'.repeat(50), avatar: 99 },
      resume: { source: { kind: 'classic', levelId: '1-1' }, levelId: '1-1', entered: [1, -2], seconds: 5 },
      lastLevelId: 'zzz',
    });
    expect(s.onboarded).toBe(true);
    expect(s.settings.sound).toBe(false);
    expect(s.settings.notifyHour).toBe(23);
    expect(s.settings.themeMode).toBe('system');
    expect(s.settings.hapticLevel).toBe(1);
    expect(Object.keys(s.levels)).toEqual(['1-1']);
    expect(s.levels['1-1'].stars).toBe(3);
    expect(Object.keys(s.daily)).toEqual(['2026-01-02']);
    expect(s.stats.streak).toBe(0);
    expect(s.stats.rushBest).toBe(0);
    expect(s.stats.mech).toEqual({ burn: 2 });
    expect(s.profile.id).toBe('abc');
    expect(s.profile.name.length).toBe(24);
    expect(s.profile.avatar).toBe(5);
    expect(s.resume).toBeNull(); // negative cell index = damaged snapshot
    expect(s.lastLevelId).toBeNull();
  });
});

describe('load / save', () => {
  test('progress survives a restart and flushStore writes immediately', async () => {
    await loadStore();
    setProfile({ name: 'Asha' });
    await flushStore();
    resetAll();
    setProfile({ name: 'Temp' });
    await AsyncStorage.clear();
    setProfile({ name: 'Asha' });
    await flushStore();
    await loadStore();
    expect(getState().profile.name).toBe('Asha');
    expect(getState().loaded).toBe(true);
  });

  test('a damaged save is backed up, not silently wiped, and the app still starts', async () => {
    await AsyncStorage.setItem('flux.v1', '{not json');
    await loadStore();
    expect(getState().loaded).toBe(true);
    expect(await AsyncStorage.getItem('flux.v1.corrupt')).toBe('{not json');
  });

  test('account snapshots require a matching signed-in owner and incompatible snapshots do not switch the current account', async () => {
    await loadStore();
    setGuest();
    await expect(saveAccountProgressSnapshot('google-a')).rejects.toThrow('could not be safely associated');
    setGoogleAccount({ uid: 'google-a', email: '', name: 'A', photo: null });
    const before = getState();
    await AsyncStorage.setItem('flux.v1.account.google-b', JSON.stringify({ version: 99, uid: 'google-b', progress: {} }));
    expect(await AsyncStorage.getItem('flux.v1.account.google-b')).not.toBeNull();
    await expect(selectGoogleAccount({ uid: 'google-b', email: '', name: 'B', photo: null })).rejects.toThrow('incompatible');
    expect(getState().account?.uid).toBe('google-a');
    expect(getState().levels).toEqual(before.levels);
  });
});

describe('energy', () => {
  const start = 1_800_000_000_000;

  test('new players begin with thirty energy and existing balances are preserved', () => {
    expect(ENERGY_MAX).toBe(30);
    expect(ENERGY_REFILL_MS).toBe(2_700_000);
    expect(migrate({}).energy).toBe(30);
    const oldSave = migrate({ energy: 4, energyRefillStartedAt: start });
    expect(oldSave.energy).toBe(4);
    expect(oldSave.energyRefillStartedAt).toBe(start);
  });

  test('charges one energy once per initialized run ID', () => {
    expect(beginEnergyRun('run-a', start)).toBe(true);
    expect(beginEnergyRun('run-a', start + 1000)).toBe(true);
    expect(getState().energy).toBe(ENERGY_MAX - 1);
  });

  test('energy never goes below zero and empty players cannot start', () => {
    for (let i = 0; i < ENERGY_MAX; i++) expect(beginEnergyRun(`run-${i}`, start)).toBe(true);
    expect(getState().energy).toBe(0);
    expect(beginEnergyRun('run-empty', start)).toBe(false);
    expect(getState().energy).toBe(0);
  });

  test('a remounted run and resumed run ID are not charged twice', () => {
    beginEnergyRun('saved-run', start);
    expect(beginEnergyRun('saved-run', start + 60_000)).toBe(true);
    expect(getState().energy).toBe(ENERGY_MAX - 1);
  });

  test('energy and its refill timestamp persist across reload', async () => {
    await loadStore();
    beginEnergyRun('persisted-run', start);
    await flushStore();
    await loadStore();
    expect(getState().energy).toBe(ENERGY_MAX - 1);
    expect(getState().energyRefillStartedAt).toBe(start);
  });

  test('countdown uses elapsed time and refills fully after 45 minutes', () => {
    beginEnergyRun('timed-run', start);
    expect(energyCountdownMs(start + 60_000)).toBe(ENERGY_REFILL_MS - 60_000);
    expect(energyCountdownMs(start + ENERGY_REFILL_MS - 1)).toBe(1);
    expect(refreshEnergy(start + ENERGY_REFILL_MS)).toBe(ENERGY_MAX);
    expect(getState().energyRefillStartedAt).toBeNull();
  });

  test('full energy has no countdown and migration clamps excess energy', () => {
    expect(energyCountdownMs(start)).toBeNull();
    expect(migrate({ energy: 99 }).energy).toBe(ENERGY_MAX);
  });

  test('guest and Google transitions preserve the local energy balance', () => {
    beginEnergyRun('transition-run', start);
    setGuest();
    setGoogleAccount({ uid: 'u1', email: '', name: 'Player', photo: null });
    signOutLocal();
    expect(getState().energy).toBe(ENERGY_MAX - 1);
    expect(getState().energyRefillStartedAt).toBe(start);
  });
});

describe('daily hint allowance', () => {
  test('starts full, spends across levels, and refills the full set 24 hours after first use', () => {
    const start = trustedNow();
    expect(getState().hintsRemaining).toBe(HINTS_MAX);
    expect(spendHint(start)).toBe(true);
    expect(spendHint(start + 60_000)).toBe(true);
    expect(spendHint(start + 120_000)).toBe(true);
    expect(getState().hintsRemaining).toBe(0);
    expect(getState().hintsRefillStartedAt).toBe(start);
    expect(spendHint(start + 123_000)).toBe(false);
    expect(hintsCountdownMs(start + HINTS_REFILL_MS - 1)).toBe(1);
    expect(refreshHints(start + HINTS_REFILL_MS)).toBe(HINTS_MAX);
    expect(getState().hintsRefillStartedAt).toBeNull();
    expect(spendHint(start + HINTS_REFILL_MS)).toBe(true);
    expect(getState().hintsRefillStartedAt).toBe(start + HINTS_REFILL_MS);
  });

  test('refills unused allowance too when its 24-hour window expires', () => {
    const start = trustedNow();
    expect(spendHint(start)).toBe(true);
    expect(getState().hintsRemaining).toBe(HINTS_MAX - 1);
    expect(refreshHints(start + HINTS_REFILL_MS)).toBe(HINTS_MAX);
  });

  test('preserves balance and refill time across reload and account sign-out', async () => {
    await loadStore();
    const start = trustedNow();
    expect(spendHint(start)).toBe(true);
    await flushStore();
    await loadStore();
    expect(getState().hintsRemaining).toBe(HINTS_MAX - 1);
    expect(getState().hintsRefillStartedAt).toBe(start);
    signOutLocal();
    expect(getState().hintsRemaining).toBe(HINTS_MAX - 1);
    expect(getState().hintsRefillStartedAt).toBe(start);
  });

  test('migration sanitizes malformed allowance values', () => {
    expect(migrate({ hintsRemaining: 99 }).hintsRemaining).toBe(HINTS_MAX);
    expect(migrate({ hintsRemaining: -2 }).hintsRemaining).toBe(0);
    expect(migrate({ hintsRemaining: 0, hintsRefillStartedAt: 1234 }).hintsRefillStartedAt).toBe(1234);
  });
});

describe('clock tampering', () => {
  test('daily board IDs accept only real UTC calendar dates, including Gregorian leap years', () => {
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2000-02-29')).toBe(true);
    expect(isValidDateKey('1900-02-29')).toBe(false);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
  });

  test('Daily date keys use the UTC calendar day', () => {
    expect(dateKey(new Date('2026-10-22T00:30:00+05:30'))).toBe('2026-10-21');
    expect(dateKey(new Date('2026-10-22T23:30:00Z'))).toBe('2026-10-22');
  });

  test('moving the phone clock back does not give an older Daily date', () => {
    const real = Date.now;
    const day = 864e5;
    const t0 = real();
    touchActive(); // records "now"
    const key0 = dateKey();
    Date.now = () => t0 - 3 * day;
    try {
      expect(trustedNow()).toBeGreaterThanOrEqual(t0);
      expect(dateKey()).toBe(key0);
    } finally {
      Date.now = real;
    }
  });

  test('a clock more than a week ahead in storage is treated as a mistake and reset', () => {
    const s = migrate({ clockMax: Date.now() + 30 * 864e5, lastActive: Date.now() });
    expect(s.clockMax).toBeLessThan(Date.now() + 1000);
  });
});

describe('daily streak', () => {
  test('counts once per day', () => {
    const lv = getLevel('1-1');
    const k = dateKey();
    recordDailySolve(lv, k, info, evaluateAchievements);
    recordDailySolve(lv, k, info, evaluateAchievements);
    expect(getState().stats.streak).toBe(1);
  });
});

describe('classic records', () => {
  test('keeps best stars and does not regress', () => {
    const lv = getLevel('1-1');
    recordClassicSolve(lv, { ...info, stars: 3 }, evaluateAchievements);
    recordClassicSolve(lv, { ...info, stars: 1, moves: 9, time: 90 }, evaluateAchievements);
    expect(getState().levels['1-1'].stars).toBe(3);
    expect(getState().levels['1-1'].moves).toBe(5);
  });
});

describe('screen-reader labels', () => {
  test('every cell has a readable label and the head is announced', () => {
    const lv = getLevel('1-1');
    const st = current(createSession(lv));
    const labels = lv.cells.map((_, i) => describeCell(lv, st, i));
    expect(labels.every((l) => /^Row \d+, column \d+/.test(l))).toBe(true);
    expect(labels.some((l) => l.includes('you are here'))).toBe(true);
    expect(labels.some((l) => l.includes('number'))).toBe(true);
  });
});

describe('crash log', () => {
  test('stores the latest errors and formats a report', async () => {
    await logCrash('test', new Error('boom'));
    const list = await readCrashLog();
    expect(list.length).toBe(1);
    expect(reportText(list)).toContain('boom');
  });
});
