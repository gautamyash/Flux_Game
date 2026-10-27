import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { NavProvider, Route, useNav } from './src/nav/Nav';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { flushStore, getState, loadStore, refreshEnergy, refreshHints, saveResume, touchActive, useStore } from './src/store/store';
import { Notifications, refreshNotifications, routeFromResponse } from './src/lib/notifications';
import { setMusic } from './src/lib/sound';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { installGlobalHandlers } from './src/lib/crash';
import { LoginScreen } from './src/screens/Login';
import { startSync } from './src/cloud/sync';
import { PrivacyScreen } from './src/screens/Privacy';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/Home';
import { OnboardingScreen, SplashScreen } from './src/screens/Start';
import { ChapterIntroScreen, ChaptersScreen, LevelsScreen } from './src/screens/Progress';
import { DailyScreen, ModesScreen } from './src/screens/Modes';
import { AchievementsScreen, CellsScreen, HowToScreen, StatsScreen } from './src/screens/Info';
import { SettingsScreen, ThemesScreen } from './src/screens/Settings';
import { LeaderboardScreen } from './src/screens/Leaderboard';
import { CampaignScreen } from './src/screens/Campaign';

let lastHandled = '';
/** opens the right screen when a reminder is tapped (also when it cold-started the app) */
function NotifRouter() {
  const nav = useNav();
  useEffect(() => {
    const open = (resp: Notifications.NotificationResponse, delay: number) => {
      const id = resp.notification.request.identifier;
      if (id === lastHandled) return;
      lastHandled = id;
      const route = routeFromResponse(resp);
      setTimeout(() => {
        const rs = getState().resume;
        if (route === 'daily') nav.push({ name: 'daily' });
        else if (route === 'resume' && rs) nav.startGame(rs.source, rs.runId || undefined, rs.day);
      }, delay);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last, 1600);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r, 0));
    return () => sub.remove();
  }, [nav]);
  return null;
}

function renderRoute(r: Route): React.ReactNode {
  switch (r.name) {
    case 'splash': return <SplashScreen />;
    case 'login': return <LoginScreen />;
    case 'onboarding': return <OnboardingScreen />;
    case 'home': return <HomeScreen />;
    case 'chapters': return <ChaptersScreen />;
    case 'levels': return <LevelsScreen chapter={r.chapter} />;
    case 'intro': return <ChapterIntroScreen chapter={r.chapter} />;
    case 'game': return <GameScreen source={r.source} runId={r.runId} dailyDay={r.dailyDay} />;
    case 'daily': return <DailyScreen />;
    case 'leaderboard': return <LeaderboardScreen kind={r.kind} />;
    case 'campaign': return <CampaignScreen />;
    case 'modes': return <ModesScreen />;
    case 'howto': return <HowToScreen />;
    case 'cells': return <CellsScreen />;
    case 'stats': return <StatsScreen />;
    case 'achievements': return <AchievementsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'themes': return <ThemesScreen />;
    case 'privacy': return <PrivacyScreen />;
  }
}

function Root() {
  const { t, isDark } = useTheme();
  const loaded = useStore((s) => s.loaded);
  const music = useStore((s) => s.settings.music);
  useEffect(() => {
    if (!loaded) return;
    setMusic(music);
    const sub = AppState.addEventListener('change', (next) => setMusic(music && next === 'active'));
    return () => { sub.remove(); };
  }, [loaded, music]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {loaded ? <NavProvider initial={{ name: 'splash' }} render={(r) => (<><NotifRouter />{renderRoute(r)}</>)} /> : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Sora_600SemiBold, Sora_700Bold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    installGlobalHandlers();
    void loadStore().finally(() => {
      touchActive();
      void refreshNotifications();
      setReady(true);
      startSync();
    });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') { refreshEnergy(); refreshHints(); }
      if (next === 'background' || next === 'inactive') {
        touchActive();
        void refreshNotifications();
        void flushStore().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
  const fonts = fontsLoaded || !!fontError; // a font failure must not leave a blank screen
  if (!fonts || !ready) return <View style={{ flex: 1, backgroundColor: '#F6F3EE' }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary onRecover={() => saveResume(null)}>
          <ThemeProvider>
            <Root />
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
