import React, { useState } from 'react';
import Constants from 'expo-constants';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Board } from '../components/Board';
import { Icon } from '../components/Icon';
import { Avatar, Button, Card, Overlay, Screen, Segmented, Sheet, T, Toggle, TopBar } from '../components/ui';
import { createSession, current } from '../engine';
import { useNav } from '../nav/Nav';
import { AVATAR_COLORS, chaptersDone, resetAll, setProfile, totalStars, updateSettings, useSettings, useStore } from '../store/store';
import { refreshNotifications, requestNotificationPermission } from '../lib/notifications';
import { fonts } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { SKINS, boardPalette, SkinId } from '../theme/tokens';
import { skinUnlocked } from '../lib/levels';
import { AccountCard } from './AccountCard';
import { practiceLevel } from '../lib/procedural';

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, gap: 12 }}>
      <View style={{ flex: 1 }}><T v="small" color={undefined}>{label}</T>{sub ? <T v="cap">{sub}</T> : null}</View>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const nav = useNav();
  const s = useSettings();
  const [confirm, setConfirm] = useState(false);
  const { t } = useTheme();
  const profile = useStore((x) => x.profile);
  const [name, setName] = useState(profile.name);
  const [notifyMsg, setNotifyMsg] = useState('');
  const toggleNotify = async (on: boolean) => {
    if (!on) {
      updateSettings({ notify: false });
      void refreshNotifications();
      setNotifyMsg('');
      return;
    }
    const ok = await requestNotificationPermission();
    if (!ok) {
      updateSettings({ notify: false });
      setNotifyMsg('Notifications are blocked. Turn them on for FLUX in your phone settings, then try again.');
      return;
    }
    updateSettings({ notify: true });
    setNotifyMsg('');
    void refreshNotifications();
  };
  return (
    <Screen>
      <TopBar title="Settings" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
        <AccountCard />
        <Card style={{ padding: 16, gap: 12 }}>
          <T v="cap">PLAYER</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} color={AVATAR_COLORS[profile.avatar % AVATAR_COLORS.length]} size={52} />
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={() => setProfile({ name: name.trim().slice(0, 16) })}
              onBlur={() => setProfile({ name: name.trim().slice(0, 16) })}
              placeholder="Player name"
              placeholderTextColor={t.disabled}
              maxLength={16}
              accessibilityLabel="Player name"
              style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: t.grid, backgroundColor: t.bg, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16, color: t.text }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {AVATAR_COLORS.map((c, i) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Avatar colour ${i + 1}`} accessibilityState={{ selected: profile.avatar === i }} onPress={() => setProfile({ avatar: i })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: profile.avatar === i ? 3 : 0, borderColor: t.text }} />
            ))}
          </View>
          <T v="cap">Your progress, stars, badges and unfinished puzzle are saved on this phone under this profile (ID {profile.id}).</T>
        </Card>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <T v="cap" style={{ paddingTop: 8 }}>REMINDERS</T>
          <Row label="Puzzle reminders" sub="Daily puzzle, streak alerts and a nudge if you are away"><Toggle label="Puzzle reminders" value={s.notify} onChange={(v) => void toggleNotify(v)} /></Row>
          {s.notify ? (
            <View style={{ paddingBottom: 8 }}>
              <T v="cap" style={{ paddingBottom: 6 }}>DAILY REMINDER TIME</T>
              <Segmented
                options={[{ label: '9 AM', value: 9 }, { label: '1 PM', value: 13 }, { label: '7 PM', value: 19 }, { label: '9 PM', value: 21 }]}
                value={s.notifyHour}
                onChange={(v) => { updateSettings({ notifyHour: v }); setTimeout(() => void refreshNotifications(), 0); }}
              />
            </View>
          ) : null}
          {notifyMsg ? <T v="cap" color={t.danger} style={{ paddingBottom: 8 }}>{notifyMsg}</T> : null}
        </Card>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Row label="Sound effects"><Toggle label="Sound effects" value={s.sound} onChange={(v) => updateSettings({ sound: v })} /></Row>
          <Row label="Music"><Toggle label="Music" value={s.music} onChange={(v) => updateSettings({ music: v })} /></Row>
          <Row label="Haptics"><Toggle label="Haptics" value={s.haptics} onChange={(v) => updateSettings({ haptics: v })} /></Row>
          {s.haptics ? (
            <Segmented options={[{ label: 'Light', value: 0 }, { label: 'Medium', value: 1 }, { label: 'Strong', value: 2 }]} value={s.hapticLevel} onChange={(v) => updateSettings({ hapticLevel: v as 0 | 1 | 2 })} />
          ) : null}
        </Card>
        <Card style={{ padding: 16, gap: 12 }}>
          <T v="cap">APPEARANCE</T>
          <Segmented options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} value={s.themeMode} onChange={(v) => updateSettings({ themeMode: v })} />
          <Pressable accessibilityRole="button" onPress={() => nav.push({ name: 'themes' })}>
            <Row label="Board theme" sub={SKINS.find((k) => k.id === s.skin)?.name}><Icon name="chevron" size={22} color="#888" /></Row>
          </Pressable>
        </Card>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <T v="cap" style={{ paddingTop: 8 }}>ACCESSIBILITY</T>
          <Row label="Reduce motion"><Toggle label="Reduce motion" value={s.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} /></Row>
          <Row label="High contrast"><Toggle label="High contrast" value={s.highContrast} onChange={(v) => updateSettings({ highContrast: v })} /></Row>
          <Row label="Large numbers"><Toggle label="Large numbers" value={s.largeNumbers} onChange={(v) => updateSettings({ largeNumbers: v })} /></Row>
          <Row label="Left-handed layout"><Toggle label="Left-handed layout" value={s.leftHanded} onChange={(v) => updateSettings({ leftHanded: v })} /></Row>
        </Card>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Pressable onPress={() => nav.push({ name: 'howto' })}><Row label="How to play"><Icon name="chevron" size={22} color="#888" /></Row></Pressable>
          <Pressable onPress={() => nav.push({ name: 'cells' })}><Row label="Cell guide"><Icon name="chevron" size={22} color="#888" /></Row></Pressable>
          <Pressable onPress={() => nav.push({ name: 'stats' })}><Row label="Stats"><Icon name="chevron" size={22} color="#888" /></Row></Pressable>
          <Pressable onPress={() => nav.push({ name: 'privacy' })}><Row label="Privacy and support"><Icon name="chevron" size={22} color="#888" /></Row></Pressable>
          <Row label="Version" sub={`FLUX ${Constants.expoConfig?.version ?? ''}`}><View /></Row>
        </Card>
        <Button label="Reset progress" variant="destructive" onPress={() => setConfirm(true)} />
        <T v="cap" align="center">FLUX 0.1.0 · works fully offline</T>
      </ScrollView>
      {confirm ? (
        <Overlay anchor="center" onDismiss={() => setConfirm(false)}>
          <Sheet>
            <T v="h3">Reset all progress?</T>
            <T v="body">Stars, stats and achievements will be erased. This cannot be undone.</T>
            <Button label="Reset everything" variant="destructive" onPress={() => { resetAll(); setConfirm(false); nav.reset({ name: 'home' }); }} />
            <Button label="Cancel" variant="ghost" onPress={() => setConfirm(false)} />
          </Sheet>
        </Overlay>
      ) : null}
    </Screen>
  );
}

export function ThemesScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const s = useSettings();
  const levels = useStore((x) => x.levels);
  const stars = totalStars(levels);
  const done = chaptersDone(levels);
  const lv = practiceLevel();
  const st = current(createSession(lv));
  return (
    <Screen>
      <TopBar title="Board themes" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {SKINS.map((k) => {
          const open = skinUnlocked(k.id as SkinId, stars, done);
          const sel = s.skin === k.id;
          return (
            <Pressable key={k.id} disabled={!open} accessibilityRole="button" accessibilityState={{ selected: sel, disabled: !open }} onPress={() => updateSettings({ skin: k.id })}>
              <Card style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: open ? 1 : 0.55 }} borderColor={sel ? t.accent : undefined} borderWidth={sel ? 2 : 1}>
                <Board level={lv} state={st} size={72} t={boardPalette(t, k.id as SkinId)} preview />
                <View style={{ flex: 1 }}><T v="title">{k.name}</T><T v="cap">{k.sub}</T></View>
                {!open ? <Icon name="lock" size={20} color={t.disabled} /> : sel ? <Icon name="check" size={22} color={t.accent} /> : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
