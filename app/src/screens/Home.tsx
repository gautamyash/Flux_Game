import React from 'react';
import { ScrollView, View } from 'react-native';
import { FluxMark, Icon, IconName } from '../components/Icon';
import { Avatar, Button, Card, Screen, T } from '../components/ui';
import { useNav } from '../nav/Nav';
import { AVATAR_COLORS, currentLevelId, dateKey, ENERGY_MAX, ENERGY_REFILL_MS, refreshEnergy, totalStars, trustedNow, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from 'react-native';
import { useEffect, useState } from 'react';

function energyTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function EnergyIndicator() {
  const { t } = useTheme();
  const energy = useStore((s) => s.energy);
  const refillAt = useStore((s) => s.energyRefillStartedAt);
  const pipWidth = Math.min(8, 72 / ENERGY_MAX);
  const pipGap = ENERGY_MAX > 10 ? 1 : 2;
  const [now, setNow] = useState(trustedNow());
  useEffect(() => {
    refreshEnergy();
    const id = setInterval(() => { refreshEnergy(); setNow(trustedNow()); }, 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = refillAt === null || energy >= ENERGY_MAX ? null : Math.max(0, ENERGY_REFILL_MS - (now - refillAt));
  return (
    <View accessibilityRole="text" accessibilityLabel={`Energy ${energy} of ${ENERGY_MAX}${remaining === null ? '' : `, next full refill in ${energyTime(remaining)}`}`}
      style={{ alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: t.raised, borderWidth: 1, borderColor: t.grid }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name="bolt" size={16} color={t.accent} fill={t.accent} />
        <T v="cap" color={t.text}>{energy}/{ENERGY_MAX}</T>
        <View style={{ flexDirection: 'row', gap: pipGap, marginLeft: 2 }}>
          {Array.from({ length: ENERGY_MAX }, (_, i) => <View key={i} style={{ width: pipWidth, height: 5, borderRadius: 3, backgroundColor: i < energy ? t.accent : t.grid }} />)}
        </View>
      </View>
      {remaining !== null ? <T v="cap" color={t.text2}>Next energy in {energyTime(remaining)}</T> : <T v="cap" color={t.text2}>Full</T>}
    </View>
  );
}

function Tile({ icon, label, sub, onPress }: { icon: IconName; label: string; sub?: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ flex: 1, padding: 16, gap: 8, minHeight: 96 }}>
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
      <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}><EnergyIndicator /></View>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {resumeOk && resume ? (
          <Card style={{ padding: 20, gap: 12 }} bg={t.accentSoft} borderColor={t.accent}>
            <T v="cap" color={t.accent}>RESUME</T>
            <T v="h1">{resume.source.kind === 'daily' ? 'Daily puzzle' : `Level ${resume.levelId}`}</T>
            <T v="small">{resume.entered.length} cells filled · saved where you stopped</T>
            <Button label="Resume" icon="play" onPress={() => nav.startGame(resume.source, resume.runId || undefined, resume.day)} />
          </Card>
        ) : null}
        <Card style={{ padding: 20, gap: 12 }} bg={resumeOk ? undefined : t.accentSoft} borderColor={resumeOk ? undefined : t.accent}>
          <T v="cap" color={t.accent}>{resumeOk ? 'NEXT UP' : 'CONTINUE'}</T>
          <T v="h1">Level {cur}</T>
          <Button label="Play" icon="play" variant={resumeOk ? 'secondary' : 'primary'} onPress={() => nav.startGame({ kind: 'classic', levelId: cur })} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="calendar" label="Daily" sub={dailyDone ? `Done · ${streak} day streak` : 'New puzzle today'} onPress={() => nav.push({ name: 'daily' })} />
          <Tile icon="grid" label="Chapters" sub="8 chapters" onPress={() => nav.push({ name: 'chapters' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="bolt" label="Modes" sub="Campaign, Rush, Chaos + more" onPress={() => nav.push({ name: 'modes' })} />
          <Tile icon="trophy" label="Badges" onPress={() => nav.push({ name: 'achievements' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="trophy" label="Global leaderboard" sub="All-time stars" onPress={() => nav.push({ name: 'leaderboard', kind: 'global' })} />
          <Tile icon="calendar" label="Daily leaderboard" sub="Today’s puzzle" onPress={() => nav.push({ name: 'leaderboard', kind: 'daily' })} />
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
