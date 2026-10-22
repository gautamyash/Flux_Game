import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { AchievementDef, Tier } from '../lib/achievements';
import { useTheme } from '../theme/ThemeProvider';
import { CellPreview } from './CellPreview';
import { Icon } from './Icon';
import { T } from './ui';

const TIER: Record<Tier, [string, string]> = {
  bronze: ['#E2A06A', '#A9622B'],
  silver: ['#E3E8EF', '#8E99AB'],
  gold: ['#FFD966', '#C98A0A'],
};

export function Badge({ a, earned, size = 64 }: { a: AchievementDef; earned: boolean; size?: number }) {
  const { t } = useTheme();
  const [c1, c2] = TIER[a.tier];
  const inner = size * 0.6;
  const v = a.visual;
  const col = earned ? t.text : t.disabled;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: earned ? 1 : 0.55 }} accessible accessibilityLabel={`${a.name} badge, ${a.tier}, ${earned ? 'unlocked' : 'locked'}`}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`g${a.id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={earned ? c1 : t.grid} />
            <Stop offset="1" stopColor={earned ? c2 : t.deadLine} />
          </LinearGradient>
        </Defs>
        <Path d="M50 3 L58 11 L69 7 L74 18 L86 19 L87 31 L97 38 L92 49 L97 60 L87 66 L85 78 L73 80 L67 91 L56 88 L50 97 L44 88 L33 91 L27 80 L15 78 L13 66 L3 60 L8 49 L3 38 L13 31 L14 19 L26 18 L31 7 L42 11 Z" fill={`url(#g${a.id})`} />
        <Circle cx={50} cy={50} r={36} fill={t.raised} />
        <Circle cx={50} cy={50} r={36} fill="none" stroke={earned ? c2 : t.grid} strokeWidth={2.5} />
      </Svg>
      <View style={{ width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
        {v.type === 'icon' ? <Icon name={v.name as never} size={inner * 0.8} color={earned ? c2 : col} fill={v.name === 'star' && earned ? c1 : 'none'} />
          : v.type === 'text' ? <T v="title" color={earned ? c2 : col} style={{ fontSize: inner * (v.text.length > 2 ? 0.4 : 0.55) }}>{v.text}</T>
          : <CellPreview kind={v.kind as never} state={v.state} n={1} size={inner} t={t} />}
      </View>
    </View>
  );
}
