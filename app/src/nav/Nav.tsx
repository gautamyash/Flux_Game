import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { dateKey, useSettings } from '../store/store';
import { stackHasActiveGame } from './routeSafety';

export type GameSource =
  | { kind: 'classic'; levelId: string }
  | { kind: 'daily' }
  | { kind: 'rush' }
  | { kind: 'chaos' }
  | { kind: 'master'; levelId?: string }
  | { kind: 'campaign'; levelId: string }
  | { kind: 'endless' }
  | { kind: 'practice' };

export type Route =
  | { name: 'splash' }
  | { name: 'login' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'chapters' }
  | { name: 'levels'; chapter: number }
  | { name: 'intro'; chapter: number }
  | { name: 'game'; source: GameSource; runId: string; dailyDay?: string }
  | { name: 'daily' }
  | { name: 'leaderboard'; kind: 'global' | 'daily' }
  | { name: 'campaign' }
  | { name: 'modes' }
  | { name: 'howto' }
  | { name: 'cells' }
  | { name: 'stats' }
  | { name: 'achievements' }
  | { name: 'settings' }
  | { name: 'themes' }
  | { name: 'privacy' };

interface NavApi {
  route: Route;
  hasActiveGame: boolean;
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  reset: (r: Route) => void;
  startGame: (source: GameSource, runId?: string, dailyDay?: string) => void;
  replaceGame: (source: GameSource) => void;
  canGoBack: boolean;
}

const Ctx = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside NavProvider');
  return v;
}

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function NavProvider({ initial, render }: { initial: Route; render: (r: Route) => React.ReactNode }) {
  const [stack, setStack] = useState<{ r: Route; k: number }[]>([{ r: initial, k: 0 }]);
  const [counter, setCounter] = useState(1);
  const [dir, setDir] = useState<'push' | 'fade'>('fade');
  const lastGameStart = useRef(0);
  const settings = useSettings();

  const push = useCallback((r: Route) => {
    setDir('push');
    setStack((s) => [...s, { r, k: counter }]);
    setCounter((c) => c + 1);
  }, [counter]);
  const pop = useCallback(() => {
    setDir('fade');
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const replace = useCallback((r: Route) => {
    setDir('fade');
    setStack((s) => [...s.slice(0, -1), { r, k: counter }]);
    setCounter((c) => c + 1);
  }, [counter]);
  const reset = useCallback((r: Route) => {
    setDir('fade');
    setStack([{ r, k: counter }]);
    setCounter((c) => c + 1);
  }, [counter]);
  const startGame = useCallback((source: GameSource, runId = newRunId(), dailyDay?: string) => {
    const now = Date.now();
    if (now - lastGameStart.current < 500) return;
    lastGameStart.current = now;
    push({ name: 'game', source, runId, ...(source.kind === 'daily' ? { dailyDay: dailyDay ?? dateKey() } : {}) });
  }, [push]);
  const replaceGame = useCallback((source: GameSource) => {
    const now = Date.now();
    if (now - lastGameStart.current < 500) return;
    lastGameStart.current = now;
    replace({ name: 'game', source, runId: newRunId(), ...(source.kind === 'daily' ? { dailyDay: dateKey() } : {}) });
  }, [replace]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  const top = stack[stack.length - 1];
  const hasActiveGame = stackHasActiveGame(stack);
  const api = useMemo<NavApi>(() => ({ route: top.r, hasActiveGame, push, pop, replace, reset, startGame, replaceGame, canGoBack: stack.length > 1 }), [top, hasActiveGame, push, pop, replace, reset, startGame, replaceGame, stack.length]);
  const entering = settings.reduceMotion ? undefined : dir === 'push' ? SlideInRight.duration(240) : FadeIn.duration(180);

  return (
    <Ctx.Provider value={api}>
      <Animated.View key={top.k} entering={entering} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{render(top.r)}</View>
      </Animated.View>
    </Ctx.Provider>
  );
}
