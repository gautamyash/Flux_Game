import React from 'react';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { haptic } from '../lib/haptics';
import { Icon, IconName } from './Icon';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'cap' | 'num';

const VAR: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  title: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  cap: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  num: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
};

export function T({ v = 'body', color, style, children, numberOfLines, align }: { v?: Variant; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number; align?: TextStyle['textAlign'] }) {
  const { t } = useTheme();
  const defaultColor = v === 'cap' || v === 'body' ? t.text2 : t.text;
  return (
    <Text numberOfLines={numberOfLines} style={[VAR[v], { color: color ?? defaultColor, textAlign: align }, v === 'num' ? { fontVariant: ['tabular-nums'] } : null, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, pad = true, style }: { children: React.ReactNode; pad?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: pad ? 20 : 0 }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  height = 56,
  disabled,
  icon,
  style,
  flex,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  height?: number;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}) {
  const { t } = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'destructive' ? t.danger : variant === 'secondary' ? t.raised : 'transparent';
  const fg = variant === 'primary' ? t.onAccent : variant === 'destructive' ? '#FFFFFF' : variant === 'ghost' ? t.accent : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic('select');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          minWidth: 48,
          borderRadius: 16,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 20,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: t.grid,
          flex,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, size = 48, color, bg, border, disabled }: { icon: IconName; onPress?: () => void; label: string; size?: number; color?: string; bg?: string; border?: boolean; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic('select');
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg ?? 'transparent',
        borderWidth: border ? 1 : 0,
        borderColor: t.grid,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Icon name={icon} size={24} color={color ?? t.text} />
    </Pressable>
  );
}

export function Card({ children, style, bg, borderColor, borderWidth = 1 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; bg?: string; borderColor?: string; borderWidth?: number }) {
  const { t } = useTheme();
  return <View style={[{ backgroundColor: bg ?? t.raised, borderRadius: 20, borderWidth, borderColor: borderColor ?? t.grid }, style]}>{children}</View>;
}

export function TopBar({ title, sub, onBack, right }: { title?: string; sub?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -8 }}>
      <View style={{ width: 56 }}>{onBack ? <IconButton icon="back" label="Back" onPress={onBack} /> : null}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? <T v="title" numberOfLines={1}>{title}</T> : null}
        {sub ? <T v="cap">{sub}</T> : null}
      </View>
      <View style={{ width: 56, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Chip({ children, tint }: { children: React.ReactNode; tint?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: tint ? tint + '2E' : t.accentSoft }}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, color: t.text }}>{children}</Text>
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        haptic('select');
        onChange(!value);
      }}
      hitSlop={10}
      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? t.accent : t.grid, justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 22, height: 22, borderRadius: 11, backgroundColor: value ? t.onAccent : t.raised }} />
    </Pressable>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: t.bg }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => {
              haptic('select');
              onChange(o.value);
            }}
            style={{ flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.raised : 'transparent', borderWidth: sel ? 1 : 0, borderColor: t.grid }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: sel ? t.text : t.text2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Dim overlay with centered or bottom-anchored content. */
export function Overlay({ children, onDismiss, anchor = 'bottom' }: { children: React.ReactNode; onDismiss?: () => void; anchor?: 'bottom' | 'center' }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: t.scrim, justifyContent: anchor === 'bottom' ? 'flex-end' : 'center', padding: 16, paddingBottom: 16 + insets.bottom }}>
      <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} onPress={onDismiss} accessibilityLabel="Dismiss" />
      {children}
    </View>
  );
}

export function Sheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ backgroundColor: t.raised, borderRadius: 28, padding: 20, gap: 12, borderWidth: 1, borderColor: t.grid }, style]}>{children}</View>
  );
}

export function Ring({ value, size = 34, stroke = 3.5, color, track, children }: { value: number; size?: number; stroke?: number; color: string; track: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${C * Math.max(0, Math.min(1, value))} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const letter = (name.trim()[0] || '?').toUpperCase();
  return (
    <View accessible accessibilityLabel={`Player avatar ${letter}`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.45, color: '#FFFFFF' }}>{letter}</Text>
    </View>
  );
}
