import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const ICONS = {
  back: 'M15 5 L8 12 L15 19',
  close: 'M6 6 L18 18 M18 6 L6 18',
  chevron: 'M9 5 L16 12 L9 19',
  play: 'M8 5 L19 12 L8 19 Z',
  pause: 'M8 5 V19 M16 5 V19',
  sliders: 'M4 7 H14 M18 7 H20 M4 17 H6 M10 17 H20 M14 7 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M6 17 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
  grid: 'M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z',
  calendar: 'M5 6 H19 a1 1 0 0 1 1 1 V19 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V7 a1 1 0 0 1 1 -1 Z M4 10 H20 M8 3 V7 M16 3 V7',
  bolt: 'M13 3 L5 13 H11 L10 21 L19 10 H13 Z',
  flame: 'M12 3 C13.5 6.5 17.5 8.5 17.5 13.5 C17.5 17 15 20 12 20 C9 20 6.5 17 6.5 13.5 C6.5 11.5 7.5 10 9 8.5 C9 10.5 10 11.5 11 11.5 C10.3 8.5 10.3 5.5 12 3 Z',
  lock: 'M7 11 V8 a5 5 0 0 1 10 0 V11 M6 11 H18 a1 1 0 0 1 1 1 V19 a1 1 0 0 1 -1 1 H6 a1 1 0 0 1 -1 -1 V12 a1 1 0 0 1 1 -1 Z',
  check: 'M5 12.5 L10 17.5 L19 7',
  star: 'M12 3 L14.8 9 L21 9.7 L16.4 14 L17.7 20.5 L12 17.3 L6.3 20.5 L7.6 14 L3 9.7 L9.2 9 Z',
  undo: 'M9 5 L4 10 L9 15 M4 10 H14 A6 6 0 0 1 14 22 H10',
  bulb: 'M9 18 H15 M10 21 H14 M12 3 A6 6 0 0 0 8 13.5 C8.7 14.2 9 15 9 16 H15 C15 15 15.3 14.2 16 13.5 A6 6 0 0 0 12 3 Z',
  restart: 'M20 12 A8 8 0 1 0 17.7 17.7 M20 5 V12 H13',
  share: 'M12 4 V15 M7.5 8.5 L12 4 L16.5 8.5 M5 13 V19 a1 1 0 0 0 1 1 H18 a1 1 0 0 0 1 -1 V13',
  clock: 'M4 13 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M12 9 V13 L14.5 14.5 M9 2.5 H15',
  trophy: 'M8 4 H16 V10 a4 4 0 0 1 -8 0 Z M8 6 H5 a2 2 0 0 0 2 4 M16 6 H19 a2 2 0 0 1 -2 4 M12 14 V18 M8 20 H16',
  chart: 'M5 20 V10 M12 20 V4 M19 20 V14',
  moon: 'M20 14 A8 8 0 1 1 10 4 A6 6 0 0 0 20 14 Z',
  sound: 'M4 10 V14 H8 L13 18 V6 L8 10 Z M16 9 a4 4 0 0 1 0 6',
  music: 'M9 18 V6 L19 4 V16 M9 18 a3 3 0 1 1 -6 0 a3 3 0 0 1 6 0 M19 16 a3 3 0 1 1 -6 0 a3 3 0 0 1 6 0',
  vibrate: 'M8 4 H16 a1 1 0 0 1 1 1 V19 a1 1 0 0 1 -1 1 H8 a1 1 0 0 1 -1 -1 V5 a1 1 0 0 1 1 -1 Z M3 9 V15 M21 9 V15',
  info: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 11 V16 M12 8 H12.01',
  endless: 'M12 12 C12 8 9 6 6.5 6 a3 3 0 0 0 0 6 C9 12 12 16 12 12 C12 16 15 18 17.5 18 a3 3 0 0 0 0 -6 C15 12 12 8 12 12',
  shuffle: 'M4 7 H8 L16 17 H20 M4 17 H8 L16 7 H20 M17 4 L20 7 L17 10 M17 14 L20 17 L17 20',
  loop: 'M17 2 L21 6 L17 10 M3 11 V9 a3 3 0 0 1 3 -3 H21 M7 22 L3 18 L7 14 M21 13 V15 a3 3 0 0 1 -3 3 H3',
  wifioff: 'M2 8.8 C5 6 8.4 4.6 12 4.6 M22 8.8 C21 7.9 20 7.2 19 6.7 M5.5 12.5 C7 11.2 8.7 10.5 10.5 10.3 M9 16 C10.7 14.7 13.3 14.7 15 16 M12 19.5 H12.01 M3 3 L21 21',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = '#000', stroke = 1.9, fill = 'none' }: { name: IconName; size?: number; color?: string; stroke?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={ICONS[name]} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
    </Svg>
  );
}

export function StarShape({ size = 16, filled, color, empty }: { size?: number; filled: boolean; color: string; empty: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICONS.star} fill={filled ? color : 'none'} stroke={filled ? color : empty} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function FluxMark({ size = 28, color, hole }: { size?: number; color: string; hole: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M50 16 H26 Q18 16 18 24 V50 M34 34 H47" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M50 16 L50.01 16" stroke={hole} strokeWidth={6.4} strokeLinecap="round" />
    </Svg>
  );
}
