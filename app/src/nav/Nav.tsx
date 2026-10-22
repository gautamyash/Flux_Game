import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSettings } from '../store/store';

export type GameSource =
  | { kind: 'classic'; levelId: string }
  | { kind: 'daily' }
  | { kind: 'rush' }
  | { kind: 'chaos' }
  | { kind: 'master'; levelId?: string }
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
  | { name: 'game'; source: GameSource }
  | { name: 'daily' }
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
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  reset: (r: Route) => void;
  canGoBack: boolean;
}

const Ctx = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside NavProvider');
  return v;
}

export function NavProvider({ initial, render }: { initial: Route; render: (r: Route) => React.ReactNode }) {
  const [stack, setStack] = useState<{ r: Route; k: number }[]>([{ r: initial, k: 0 }]);
  const [counter, setCounter] = useState(1);
  const [dir, setDir] = useState<'push' | 'fade'>('fade');
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
  const api = useMemo<NavApi>(() => ({ route: top.r, push, pop, replace, reset, canGoBack: stack.length > 1 }), [top, push, pop, replace, reset, stack.length]);
  const entering = settings.reduceMotion ? undefined : dir === 'push' ? SlideInRight.duration(240) : FadeIn.duration(180);

  return (
    <Ctx.Provider value={api}>
      <Animated.View key={top.k} entering={entering} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{render(top.r)}</View>
      </Animated.View>
    </Ctx.Provider>
  );
}
