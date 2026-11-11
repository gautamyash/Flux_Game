import React, { useEffect, useId, useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { T } from './ui';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface RewardChestProps {
  /** Future reward UI can be passed here without coupling the chest to reward types. */
  rewardContent?: React.ReactNode;
  /** Called whenever the chest transitions from closed to open. */
  onOpen?: () => void;
  initiallyOpen?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Gold and violet reward chest presentation. It owns no reward or progression data. */
export function RewardChest({ rewardContent, onOpen, initiallyOpen = false, style }: RewardChestProps) {
  const { t } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const progress = useSharedValue(initiallyOpen ? 1 : 0);
  const shimmer = useSharedValue(0);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    progress.value = withSpring(open ? 1 : 0, { damping: 14, stiffness: 125, mass: 0.8 });
    shimmer.value = open ? withRepeat(withTiming(1, { duration: 1500 }), -1, true) : withTiming(0, { duration: 180 });
  }, [open, progress, shimmer]);

  const closedLidProps = useAnimatedProps(() => ({ opacity: 1 - progress.value }));
  const openLidProps = useAnimatedProps(() => ({ opacity: progress.value }));
  const innerGlowProps = useAnimatedProps(() => ({ opacity: progress.value * (0.78 + shimmer.value * 0.22) }));
  const sparklesProps = useAnimatedProps(() => ({ opacity: progress.value * (0.7 + shimmer.value * 0.3) }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 0.82], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0.35, 1], [12, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0.35, 1], [0.96, 1], Extrapolation.CLAMP) },
    ],
  }));

  const toggleChest = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    <View style={[{ width: '100%', maxWidth: 400, alignSelf: 'center', alignItems: 'center', gap: 8 }, style]}>
      <Pressable
        onPress={toggleChest}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close reward chest' : 'Open reward chest'}
        accessibilityHint={open ? 'Closes the chest presentation' : 'Reveals the reward area'}
        style={({ pressed }) => ({ width: '100%', aspectRatio: 1.23, transform: [{ scale: pressed ? 0.985 : 1 }] })}
      >
        <Svg width="100%" height="100%" viewBox="0 0 320 260">
          <Defs>
            <LinearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.85" y2="1">
              <Stop offset="0" stopColor="#FFF0A6" />
              <Stop offset="0.28" stopColor="#FFD76A" />
              <Stop offset="0.62" stopColor="#D88B24" />
              <Stop offset="1" stopColor="#FFF0A6" />
            </LinearGradient>
            <LinearGradient id={`${id}-goldFace`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFE99A" />
              <Stop offset="0.42" stopColor="#DFA02F" />
              <Stop offset="1" stopColor="#A85B1F" />
            </LinearGradient>
            <LinearGradient id={`${id}-purple`} x1="0" y1="0" x2="0.9" y2="1">
              <Stop offset="0" stopColor="#A956E5" />
              <Stop offset="0.42" stopColor="#6424A8" />
              <Stop offset="1" stopColor="#2D124F" />
            </LinearGradient>
            <LinearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF4BE" />
              <Stop offset="0.32" stopColor="#F3A8FF" />
              <Stop offset="1" stopColor="#8425D9" />
            </LinearGradient>
            <LinearGradient id={`${id}-lid`} x1="0" y1="0" x2="0.9" y2="1">
              <Stop offset="0" stopColor="#C374F4" />
              <Stop offset="0.4" stopColor="#7C32C5" />
              <Stop offset="1" stopColor="#341454" />
            </LinearGradient>
          </Defs>

          <Ellipse cx="160" cy="223" rx="118" ry="18" fill="#090513" opacity="0.42" />
          <Ellipse cx="160" cy="218" rx="123" ry="20" fill="none" stroke="#F2B95B" strokeWidth="2" opacity="0.68" />
          <Ellipse cx="160" cy="216" rx="96" ry="10" fill="#E7A4FF" opacity="0.12" />

          <AnimatedG animatedProps={innerGlowProps}>
            <Ellipse cx="160" cy="105" rx="101" ry="48" fill="#BE4CFF" opacity="0.25" />
            <Path d="M68 105 L102 40 L135 104 L160 28 L184 104 L220 43 L252 108 Z" fill={`url(#${id}-inner)`} opacity="0.84" />
            <Ellipse cx="160" cy="107" rx="91" ry="31" fill={`url(#${id}-inner)`} opacity="0.92" />
          </AnimatedG>

          <AnimatedG animatedProps={openLidProps}>
            <Path d="M43 108 L48 61 Q54 24 91 22 L229 22 Q266 24 272 61 L277 108 L247 98 L73 98 Z" fill={`url(#${id}-lid)`} stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinejoin="round" />
            <Path d="M59 91 L64 62 Q69 37 94 36 L226 36 Q251 37 256 62 L261 91 L238 84 L82 84 Z" fill="#33134F" stroke="#F4C663" strokeWidth="3" strokeLinejoin="round" />
            <Path d="M77 79 Q160 68 243 79" fill="none" stroke="#E8B7FF" strokeWidth="3" opacity="0.8" />
            <Path d="M115 72 Q160 47 205 72" fill="none" stroke="#A850E5" strokeWidth="5" opacity="0.8" />
            <Path d="M151 86 L160 72 L169 86 L160 96 Z" fill="#FFEBA1" />
          </AnimatedG>

          <AnimatedG animatedProps={sparklesProps}>
            <Path d="M58 70 L62 82 L74 86 L62 90 L58 102 L54 90 L42 86 L54 82 Z" fill="#FFF0A3" />
            <Path d="M263 65 L266 74 L275 77 L266 80 L263 89 L260 80 L251 77 L260 74 Z" fill="#FFD979" />
            <Circle cx="86" cy="49" r="2.6" fill="#FFF7D0" />
            <Circle cx="231" cy="43" r="2.2" fill="#F5CEFF" />
            <Circle cx="39" cy="126" r="2" fill="#FFEBA1" />
            <Circle cx="282" cy="119" r="2.5" fill="#E7A4FF" />
          </AnimatedG>

          {/* Body and front panels */}
          <Path d="M44 104 L276 104 L265 203 Q160 226 55 203 Z" fill={`url(#${id}-purple)`} stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinejoin="round" />
          <Path d="M62 127 L97 132 L91 194 L63 188 Z" fill="#321355" stroke="#9D5BCB" strokeWidth="2" />
          <Path d="M258 127 L223 132 L229 194 L257 188 Z" fill="#321355" stroke="#9D5BCB" strokeWidth="2" />
          <Path d="M103 132 L217 132 L210 194 Q160 203 110 194 Z" fill="#471A74" stroke="#B16CE0" strokeWidth="2" />
          <Path d="M111 145 Q160 132 209 145" fill="none" stroke="#D99AFF" strokeWidth="2.5" opacity="0.62" />
          <Path d="M112 183 Q160 191 208 183" fill="none" stroke="#23103B" strokeWidth="3" opacity="0.7" />

          {/* Gold rim, feet and front clasp */}
          <Path d="M40 103 Q160 91 280 103 L275 121 Q160 134 45 121 Z" fill={`url(#${id}-goldFace)`} stroke="#FFF0A6" strokeWidth="2.5" />
          <Path d="M51 119 Q160 131 269 119" fill="none" stroke="#A8601E" strokeWidth="3" />
          <Path d="M54 190 L82 196 L76 215 L51 210 Z" fill={`url(#${id}-goldFace)`} stroke="#FFE8A0" strokeWidth="2" />
          <Path d="M266 190 L238 196 L244 215 L269 210 Z" fill={`url(#${id}-goldFace)`} stroke="#FFE8A0" strokeWidth="2" />
          <Path d="M78 202 Q160 216 242 202 L238 214 Q160 228 82 214 Z" fill={`url(#${id}-gold)`} stroke="#FFE9A0" strokeWidth="2" />

          {/* Closed lid fades away as the raised lid appears behind the chest. */}
          <AnimatedG animatedProps={closedLidProps}>
            <Path d="M39 105 L44 68 Q49 34 83 31 L237 31 Q271 34 276 68 L281 105 Q160 119 39 105 Z" fill={`url(#${id}-lid)`} stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinejoin="round" />
            <Path d="M52 90 L57 66 Q61 46 84 44 L236 44 Q259 46 263 66 L268 90 Q160 101 52 90 Z" fill="none" stroke="#E9B6FF" strokeWidth="2.5" opacity="0.74" />
            <Path d="M64 79 Q160 88 256 79" fill="none" stroke="#421565" strokeWidth="4" />
            <Path d="M43 101 Q160 115 277 101 L274 116 Q160 131 46 116 Z" fill={`url(#${id}-goldFace)`} stroke="#FFF0A6" strokeWidth="2" />
            <Path d="M138 101 L160 115 L182 101 L183 132 L160 144 L137 132 Z" fill={`url(#${id}-gold)`} stroke="#FFF1B3" strokeWidth="2.5" strokeLinejoin="round" />
            <Path d="M160 112 L163 121 L172 123 L163 126 L160 135 L157 126 L148 123 L157 121 Z" fill="#FFF9D9" />
          </AnimatedG>
        </Svg>
      </Pressable>

      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={[{
          width: '100%', borderRadius: 18, borderWidth: 1.5, padding: 14,
          backgroundColor: t.raised, borderColor: open ? '#C989FF' : t.grid,
          shadowColor: '#A34BE6', shadowOpacity: open ? 0.24 : 0, shadowRadius: 16, elevation: open ? 5 : 0,
        }, revealStyle]}
      >
        <T v="cap" color="#B87CE8">REWARD REVEAL</T>
        {rewardContent ?? (
          <View style={{ minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: t.grid, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
            <T v="small" align="center" color={t.text2}>Reward contents will appear here</T>
          </View>
        )}
      </Animated.View>

      <T v="cap" color={open ? '#D5A6F4' : t.text2}>{open ? 'TAP THE CHEST TO CLOSE' : 'TAP THE CHEST TO OPEN'}</T>
    </View>
  );
}
