jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-notifications', () => ({}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SCHEMA, dateKey, flushStore, getState, loadStore, migrate, recordClassicSolve, recordDailySolve, resetAll, setProfile, trustedNow, touchActive,
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
});

describe('clock tampering', () => {
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
