import React from 'react';
import { ScrollView, View } from 'react-native';
import { FluxMark, Icon, IconName } from '../components/Icon';
import { Avatar, Button, Card, Screen, T } from '../components/ui';
import { useNav } from '../nav/Nav';
import { AVATAR_COLORS, currentLevelId, dateKey, totalStars, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from 'react-native';

function Tile({ icon, label, sub, onPress }: { icon: IconName; label: string; sub?: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ padding: 16, gap: 8, minHeight: 96 }}>
        <Icon name={icon} size={26} color={t.accent} />
        <T v="title">{label}</T>
        {sub ? <T v="cap">{sub}</T> : null}
      </Card>
    </Pressable>
  );
}

export function HomeScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const levels = useStore((s) => s.levels);
  const daily = useStore((s) => s.daily);
  const streak = useStore((s) => s.stats.streak);
  const cur = currentLevelId(levels);
  const profile = useStore((s) => s.profile);
  const resume = useStore((s) => s.resume);
  const mode = useStore((s) => s.mode);
  const resumeOk = !!resume && (resume.source.kind !== 'daily' || resume.day === dateKey());
  const dailyDone = !!daily[dateKey()];
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile and settings" onPress={() => nav.push({ name: 'settings' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={profile.name} color={AVATAR_COLORS[profile.avatar % AVATAR_COLORS.length]} size={40} />
          <View>
            <T v="cap">{mode === 'guest' ? 'GUEST · THIS PHONE ONLY' : 'WELCOME BACK'}</T>
            <T v="title">{profile.name || 'Player'}</T>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="star" size={18} color={t.bonus} fill={t.bonus} />
          <T v="num">{totalStars(levels)}</T>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {resumeOk && resume ? (
          <Card style={{ padding: 20, gap: 12 }} bg={t.accentSoft} borderColor={t.accent}>
            <T v="cap" color={t.accent}>RESUME</T>
            <T v="h1">{resume.source.kind === 'daily' ? 'Daily puzzle' : `Level ${resume.levelId}`}</T>
            <T v="small">{resume.entered.length} cells filled · saved where you stopped</T>
            <Button label="Resume" icon="play" onPress={() => nav.push({ name: 'game', source: resume.source })} />
          </Card>
        ) : null}
        <Card style={{ padding: 20, gap: 12 }} bg={resumeOk ? undefined : t.accentSoft} borderColor={resumeOk ? undefined : t.accent}>
          <T v="cap" color={t.accent}>{resumeOk ? 'NEXT UP' : 'CONTINUE'}</T>
          <T v="h1">Level {cur}</T>
          <Button label="Play" icon="play" variant={resumeOk ? 'secondary' : 'primary'} onPress={() => nav.push({ name: 'game', source: { kind: 'classic', levelId: cur } })} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="calendar" label="Daily" sub={dailyDone ? `Done · ${streak} day streak` : 'New puzzle today'} onPress={() => nav.push({ name: 'daily' })} />
          <Tile icon="grid" label="Chapters" sub="8 chapters" onPress={() => nav.push({ name: 'chapters' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="bolt" label="Modes" sub="Rush, Chaos, Endless" onPress={() => nav.push({ name: 'modes' })} />
          <Tile icon="trophy" label="Badges" onPress={() => nav.push({ name: 'achievements' })} />
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }}>
        <Button label="How to play" variant="ghost" height={44} onPress={() => nav.push({ name: 'howto' })} />
        <Button label="Stats" variant="ghost" height={44} onPress={() => nav.push({ name: 'stats' })} />
        <Button label="Settings" variant="ghost" height={44} onPress={() => nav.push({ name: 'settings' })} />
      </View>
    </Screen>
  );
}
