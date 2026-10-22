import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../store/store';
import { boardPalette, dark, light, Palette, SkinId } from './tokens';

interface ThemeValue {
  t: Palette;
  isDark: boolean;
  board: Palette;
  skin: SkinId;
}

const Ctx = createContext<ThemeValue>({ t: light, isDark: false, board: light, skin: 'paper' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const settings = useSettings();
  const value = useMemo<ThemeValue>(() => {
    const isDark = settings.themeMode === 'system' ? system === 'dark' : settings.themeMode === 'dark';
    const t = isDark ? dark : light;
    const skin = settings.highContrast ? 'contrast' : settings.skin;
    let board = boardPalette(t, skin);
    if (settings.highContrast) board = boardPalette(t, isDark ? 'contrast' : 'contrast');
    return { t, isDark, board, skin };
  }, [settings.themeMode, settings.skin, settings.highContrast, system]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
