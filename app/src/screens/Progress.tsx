import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, StarShape } from '../components/Icon';
import { CellPreview } from '../components/CellPreview';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { CHAPTERS, MECH_INTRO, levelsOfChapter } from '../lib/levels';
import { chaptersDone, isLevelUnlocked, markSeen, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';

export function ChaptersScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const levels = useStore((s) => s.levels);
  const seen = useStore((s) => s.seen);
  const done = chaptersDone(levels);
  return (
    <Screen>
      <TopBar title="Chapters" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {CHAPTERS.map((c) => {
          const defs = levelsOfChapter(c.n);
          const unlocked = isLevelUnlocked(levels, defs[0].id);
          const solved = defs.filter((d) => levels[d.id]).length;
          const stars = defs.reduce((a, d) => a + (levels[d.id]?.stars ?? 0), 0);
          return (
            <Pressable key={c.n} disabled={!unlocked} accessibilityRole="button" accessibilityLabel={`Chapter ${c.n} ${c.name}`}
              onPress={() => nav.push(seen['ch:' + c.n] || c.n === 1 ? { name: 'levels', chapter: c.n } : { name: 'intro', chapter: c.n })}>
              <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: unlocked ? 1 : 0.5 }}>
                <CellPreview kind={c.cells as never} n={1} size={52} t={t} />
                <View style={{ flex: 1 }}>
                  <T v="title">{c.n}. {c.name}</T>
                  <T v="cap">{c.mech}</T>
                  <T v="cap" color={t.accent}>{solved}/{defs.length} solved · {stars}/{defs.length * 3} stars</T>
                </View>
                {!unlocked ? <Icon name="lock" size={22} color={t.disabled} /> : done.includes(c.n) ? <Icon name="check" size={22} color={t.success} /> : <Icon name="chevron" size={22} color={t.text2} />}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

export function ChapterIntroScreen({ chapter }: { chapter: number }) {
  const nav = useNav();
  const { t } = useTheme();
  const c = CHAPTERS[chapter - 1];
  const info = (MECH_INTRO as Record<string, { body: string }>)[c.cells === 'node' ? 'dir' : c.cells];
  return (
    <Screen>
      <TopBar onBack={nav.pop} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <T v="cap" color={t.accent}>CHAPTER {chapter}</T>
        <CellPreview kind={c.cells as never} n={1} size={120} t={t} />
        <T v="h1">{c.name}</T>
        <T v="body" align="center">{c.n === 8 ? 'Every mechanic together. No more hints from the board.' : info?.body ?? c.mech}</T>
      </View>
      <Button label="Start chapter" onPress={() => { markSeen('ch:' + chapter); nav.replace({ name: 'levels', chapter }); }} />
    </Screen>
  );
}

export function LevelsScreen({ chapter }: { chapter: number }) {
  const nav = useNav();
  const { t } = useTheme();
  const levels = useStore((s) => s.levels);
  const c = CHAPTERS[chapter - 1];
  const defs = levelsOfChapter(chapter);
  return (
    <Screen>
      <TopBar title={`${chapter}. ${c.name}`} sub={c.mech} onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 18 }}>
        {defs.map((d, i) => {
          const rec = levels[d.id];
          const unlocked = isLevelUnlocked(levels, d.id);
          const offset = [0, 60, 90, 60, 0, -60, -90, -60][i % 8];
          return (
            <View key={d.id} style={{ alignItems: 'center', transform: [{ translateX: offset }] }}>
              <Pressable disabled={!unlocked} accessibilityRole="button" accessibilityLabel={`Level ${d.id}${rec ? `, ${rec.stars} stars` : unlocked ? '' : ', locked'}`}
                onPress={() => nav.push({ name: 'game', source: { kind: 'classic', levelId: d.id } })}
                style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: rec ? t.accent : unlocked ? t.raised : t.plate, borderWidth: 2, borderColor: unlocked ? t.accent : t.grid }}>
                {unlocked ? <T v="h3" color={rec ? t.onAccent : t.text}>{i + 1}</T> : <Icon name="lock" size={22} color={t.disabled} />}
              </Pressable>
              {rec ? (
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                  {[1, 2, 3].map((s) => <StarShape key={s} size={14} filled={s <= rec.stars} color={t.bonus} empty={t.grid} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
