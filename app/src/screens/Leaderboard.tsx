import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { cloudConfigured } from '../config';
import { ensureGoogleFirebaseUser } from '../cloud/auth';
import { DailyEntry, GlobalEntry, LeaderboardKind, LeaderboardEntry, loadLeaderboard } from '../cloud/leaderboards';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { dateKey, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';

function offlineError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';
  const msg = String((error as { message?: string })?.message ?? '').toLowerCase();
  return ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code) || msg.includes('network') || msg.includes('offline');
}

function dailyTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function EntryRow({ entry, kind, rank }: { entry: LeaderboardEntry; kind: LeaderboardKind; rank: number }) {
  const { t } = useTheme();
  const score = kind === 'global'
    ? `${(entry as GlobalEntry).score} stars · ${(entry as GlobalEntry).solved} levels`
    : `${(entry as DailyEntry).stars} stars · ${(entry as DailyEntry).moves} moves · ${dailyTime((entry as DailyEntry).time)}`;
  return (
    <Card style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <T v="num" color={rank <= 3 ? t.accent : t.text2}>{rank}</T>
      <View style={{ flex: 1 }}>
        <T v="title">Player {entry.key.slice(0, 5).toUpperCase()}</T>
        <T v="cap">{score}</T>
      </View>
    </Card>
  );
}

export function LeaderboardScreen({ kind }: { kind: LeaderboardKind }) {
  const nav = useNav();
  const { t } = useTheme();
  const mode = useStore((s) => s.mode);
  const account = useStore((s) => s.account);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error' | 'offline' | 'unauthenticated'>('loading');
  const [retry, setRetry] = useState(0);
  const [day] = useState(() => dateKey());
  const title = kind === 'global' ? 'Global Leaderboard' : 'Daily Leaderboard';
  const load = useCallback(async () => {
    if (mode !== 'google' || !account) { setEntries([]); setState('unauthenticated'); return; }
    if (!cloudConfigured()) { setEntries([]); setState('error'); return; }
    setState('loading');
    try {
      if (!(await ensureGoogleFirebaseUser(account.uid))) { setEntries([]); setState('unauthenticated'); return; }
      const result = await loadLeaderboard(kind, day);
      setEntries(result);
      setState(result.length ? 'ready' : 'empty');
    } catch (error) {
      setEntries([]);
      setState(offlineError(error) ? 'offline' : (error as { message?: string })?.message === 'unauthenticated' ? 'unauthenticated' : 'error');
    }
  }, [account, day, kind, mode, retry]);
  useEffect(() => { void load(); }, [load]);

  let message = '';
  if (state === 'unauthenticated') message = 'Sign in with Google to view and join leaderboards. Guest play stays available offline.';
  else if (state === 'error' && !cloudConfigured()) message = 'Leaderboards are not configured in this build yet.';
  else if (state === 'error') message = 'Could not load this leaderboard. Try again in a moment.';
  else if (state === 'offline') message = 'A network connection is needed to load leaderboards. Your local progress is safe.';
  else if (state === 'empty') message = kind === 'daily' ? 'No scores submitted for today yet. Complete today’s puzzle while signed in to appear here.' : 'No scores yet. Complete a Classic or Master puzzle while signed in to appear here.';

  return (
    <Screen>
      <TopBar title={title} sub={kind === 'daily' ? `UTC ${day}` : 'Top 100'} onBack={nav.pop} />
      {state === 'loading' ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading leaderboard" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={t.accent} />
          <T v="small">Loading scores…</T>
        </View>
      ) : state === 'ready' ? (
        <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
          {entries.map((entry, index) => <EntryRow key={entry.key} entry={entry} kind={kind} rank={index + 1} />)}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Card style={{ padding: 20, gap: 10, alignItems: 'center' }}>
            <T v="h2" align="center">{state === 'empty' ? 'No scores yet' : state === 'offline' ? 'You’re offline' : state === 'unauthenticated' ? 'Google sign-in required' : 'Leaderboard unavailable'}</T>
            <T v="body" align="center">{message}</T>
          </Card>
          {state === 'unauthenticated' ? <Button label="Sign in with Google" icon="check" onPress={() => nav.push({ name: 'settings' })} /> : null}
          {state === 'error' || state === 'offline' ? <Button label="Try again" variant="secondary" onPress={() => setRetry((v) => v + 1)} /> : null}
        </View>
      )}
    </Screen>
  );
}
