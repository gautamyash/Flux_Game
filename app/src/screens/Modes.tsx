import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, IconName, StarShape } from '../components/Icon';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav, GameSource } from '../nav/Nav';
import { dateKey, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { dailyLevel } from '../lib/procedural';

export function ModesScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const stats = useStore((s) => s.stats);
  const levels = useStore((s) => s.levels);
  const masterOpen = !!levels['7-12'];
  const items: { icon: IconName; name: string; sub: string; src: GameSource; locked?: boolean }[] = [
    { icon: 'bolt', name: 'Rush', sub: `3 minutes, solve as many as you can · best ${stats.rushBest}`, src: { kind: 'rush' } },
    { icon: 'shuffle', name: 'Chaos', sub: 'Random mixes of every mechanic', src: { kind: 'chaos' } },
    { icon: 'endless', name: 'Endless', sub: `One failure ends the run · best ${stats.endlessBest}`, src: { kind: 'endless' } },
    { icon: 'flame', name: 'Master', sub: masterOpen ? 'Hardest puzzles' : 'Finish chapter 7 to unlock', src: { kind: 'master' }, locked: !masterOpen },
  ];
  return (
    <Screen>
      <TopBar title="Modes" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {items.map((m) => (
          <Pressable key={m.name} disabled={m.locked} accessibilityRole="button" onPress={() => nav.push({ name: 'game', source: m.src })}>
            <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: m.locked ? 0.5 : 1 }}>
              <Icon name={m.icon} size={30} color={t.accent} />
              <View style={{ flex: 1 }}>
                <T v="title">{m.name}</T>
                <T v="cap">{m.sub}</T>
              </View>
              <Icon name={m.locked ? 'lock' : 'chevron'} size={22} color={t.text2} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function DailyScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const daily = useStore((s) => s.daily);
  const stats = useStore((s) => s.stats);
  const key = dateKey();
  const rec = daily[key];
  const lv = dailyLevel(key);
  return (
    <Screen>
      <TopBar title="Daily Puzzle" sub={new Date().toDateString()} onBack={nav.pop} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Icon name="calendar" size={64} color={t.accent} />
        <T v="h1">{rec ? 'Done for today' : `${lv.size}×${lv.size} puzzle`}</T>
        {rec ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>{[1, 2, 3].map((s) => <StarShape key={s} size={28} filled={s <= rec.stars} color={t.bonus} empty={t.grid} />)}</View>
        ) : <T v="body" align="center">Same puzzle for everyone, new every day.</T>}
        <T v="small">Streak {stats.streak} · best {stats.longestStreak}</T>
      </View>
      <Button label={rec ? 'Play again' : 'Play today’s puzzle'} onPress={() => nav.push({ name: 'game', source: { kind: 'daily' } })} />
    </Screen>
  );
}
