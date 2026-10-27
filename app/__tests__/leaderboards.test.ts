jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { compareDailyResult, isBetterGlobalResult, mapLeaderboardNames } from '../src/cloud/leaderboards';

describe('daily leaderboard ordering', () => {
  it('ranks more stars first, then fewer moves, then faster time', () => {
    expect(compareDailyResult({ stars: 3, moves: 20, time: 40 }, { stars: 2, moves: 1, time: 1 })).toBeLessThan(0);
    expect(compareDailyResult({ stars: 3, moves: 19, time: 90 }, { stars: 3, moves: 20, time: 30 })).toBeLessThan(0);
    expect(compareDailyResult({ stars: 3, moves: 20, time: 29 }, { stars: 3, moves: 20, time: 30 })).toBeLessThan(0);
  });

  it('treats an exact result as a tie', () => {
    const result = { stars: 3, moves: 20, time: 30 };
    expect(compareDailyResult(result, result)).toBe(0);
  });
});

describe('global leaderboard ordering', () => {
  it('uses total stars first and solved levels as the tie-break', () => {
    expect(isBetterGlobalResult({ score: 10, solved: 1 }, { score: 9, solved: 100 })).toBe(true);
    expect(isBetterGlobalResult({ score: 10, solved: 11 }, { score: 10, solved: 10 })).toBe(true);
    expect(isBetterGlobalResult({ score: 10, solved: 9 }, { score: 10, solved: 10 })).toBe(false);
  });
});

describe('leaderboard display names', () => {
  const rows = [
    { key: 'random-key-a', score: 8, solved: 3, lastRunId: 'run-12345678' },
    { key: 'random-key-b', score: 6, solved: 2, lastRunId: 'run-abcdefgh' },
  ];

  it('resolves each entry by its own random key, including the current user', () => {
    const displayed = mapLeaderboardNames(rows, { 'random-key-a': 'Asha', 'random-key-b': 'Dev' });
    expect(displayed.map(({ displayName }) => displayName)).toEqual(['Asha', 'Dev']);
  });

  it('uses a privacy-safe fallback for missing or email-like names and allows duplicates', () => {
    const displayed = mapLeaderboardNames(rows, { 'random-key-a': 'Same', 'random-key-b': 'Same' });
    expect(displayed.map(({ displayName }) => displayName)).toEqual(['Same', 'Same']);
    expect(mapLeaderboardNames(rows, { 'random-key-a': 'private@example.com' }).map(({ displayName }) => displayName))
      .toEqual(['Player', 'Player']);
  });
});
