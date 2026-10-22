import React from 'react';
import { ScrollView, View } from 'react-native';
import { CellPreview } from '../components/CellPreview';
import { Icon } from '../components/Icon';
import { Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { ACHIEVEMENTS } from '../lib/achievements';
import { Badge } from '../components/Badge';
import { useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { fmtTime } from '../components/ui';

const STEPS = [
  ['Draw one path', 'Drag from the start cell. The path moves one cell at a time, up, down, left or right.'],
  ['Visit numbers in order', 'Reach 1, then 2, then 3 and so on. The last number ends the puzzle.'],
  ['Never cross yourself', 'Each cell can be used once. Drag back along your path to undo.'],
  ['Watch your moves', 'You have a limited number of moves. Fewer moves earn more stars.'],
];

export function HowToScreen() {
  const nav = useNav();
  const { t } = useTheme();
  return (
    <Screen>
      <TopBar title="How to play" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {STEPS.map(([h, b], i) => (
          <Card key={h} style={{ padding: 16, flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><T v="title" color={t.accent}>{i + 1}</T></View>
            <View style={{ flex: 1 }}><T v="title">{h}</T><T v="small">{b}</T></View>
          </Card>
        ))}
        <T v="small" align="center" style={{ paddingTop: 8 }} color={t.accent} >Special cells are explained as you meet them.</T>
      </ScrollView>
    </Screen>
  );
}

const CELL_TEXT: { kind: string; name: string; body: string }[] = [
  { kind: 'node', name: 'Number', body: 'Visit in order, starting at 1.' },
  { kind: 'dead', name: 'Wall', body: 'Cannot be entered.' },
  { kind: 'dir', name: 'Direction', body: 'You must leave in the arrow’s direction.' },
  { kind: 'burn', name: 'Burn', body: 'Costs 2 moves and burns out afterwards.' },
  { kind: 'tele', name: 'Portal', body: 'Enter one, continue from its partner.' },
  { kind: 'freeze', name: 'Freeze', body: 'Locks its 8 neighbours for 3 moves.' },
  { kind: 'switch', name: 'Switch', body: 'Flips every gate.' },
  { kind: 'gate', name: 'Gate', body: 'Blocks you while closed.' },
  { kind: 'bonus', name: 'Bonus star', body: 'Optional extra. Collect it on the way.' },
  { kind: 'count', name: 'Countdown', body: 'Reach it before it hits zero.' },
];

export function CellsScreen() {
  const nav = useNav();
  const { t } = useTheme();
  return (
    <Screen>
      <TopBar title="Cell guide" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {CELL_TEXT.map((c) => (
          <Card key={c.kind} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <CellPreview kind={c.kind as never} n={3} size={56} t={t} dir="r" />
            <View style={{ flex: 1 }}><T v="title">{c.name}</T><T v="small">{c.body}</T></View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ padding: 16, flex: 1, minWidth: '45%' }}>
      <T v="cap">{label}</T>
      <T v="h2">{value}</T>
    </Card>
  );
}

export function StatsScreen() {
  const nav = useNav();
  const s = useStore((x) => x.stats);
  const levels = useStore((x) => x.levels);
  const stars = Object.values(levels).reduce((a, r) => a + r.stars, 0);
  return (
    <Screen>
      <TopBar title="Stats" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8 }}>
        <Stat label="Levels solved" value={String(Object.keys(levels).length)} />
        <Stat label="Stars" value={String(stars)} />
        <Stat label="Perfect solves" value={String(s.perfect)} />
        <Stat label="No-hint solves" value={String(s.noHint)} />
        <Stat label="Fastest" value={s.fastest === null ? '—' : fmtTime(s.fastest)} />
        <Stat label="Hints used" value={String(s.hintsUsed)} />
        <Stat label="Daily streak" value={String(s.streak)} />
        <Stat label="Longest streak" value={String(s.longestStreak)} />
        <Stat label="Rush best" value={String(s.rushBest)} />
        <Stat label="Endless best" value={String(s.endlessBest)} />
      </ScrollView>
    </Screen>
  );
}

export function AchievementsScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const st = useStore((x) => x);
  const got = ACHIEVEMENTS.filter((a) => !!st.achievements[a.id]);
  const rest = ACHIEVEMENTS.filter((a) => !st.achievements[a.id]);
  const row = (a: (typeof ACHIEVEMENTS)[number]) => {
    const earned = !!st.achievements[a.id];
    const p = Math.min(a.target, a.progress(st));
    return (
      <Card key={a.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }} borderColor={earned ? t.accent : undefined}>
        <Badge a={a} earned={earned} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title">{a.name}</T>
          <T v="small">{a.desc}</T>
          {earned ? <T v="cap" color={t.success}>Unlocked</T> : (
            <View style={{ gap: 4 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.grid, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${(p / a.target) * 100}%`, backgroundColor: t.accent }} />
              </View>
              <T v="cap">{p} / {a.target}</T>
            </View>
          )}
        </View>
      </Card>
    );
  };
  return (
    <Screen>
      <TopBar title="Badges" sub={`${got.length} of ${ACHIEVEMENTS.length} unlocked`} onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {got.map(row)}
        {rest.map(row)}
      </ScrollView>
    </Screen>
  );
}
