export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  raised: string;
  plate: string;
  grid: string;
  text: string;
  text2: string;
  disabled: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  pathA: string;
  pathB: string;
  done: string;
  success: string;
  warning: string;
  danger: string;
  dead: string;
  deadLine: string;
  dir: string;
  burn: string;
  tele: string;
  freeze: string;
  sw: string;
  gate: string;
  bonus: string;
  count: string;
  char: string;
  scrim: string;
}

export const light: Palette = {
  dark: false,
  bg: '#F6F3EE',
  surface: '#FDFBF7',
  raised: '#FFFFFF',
  plate: '#E9E3D8',
  grid: '#DDD6CA',
  text: '#16161A',
  text2: '#5C5A57',
  disabled: '#A7A29A',
  accent: '#0B7F7A',
  accentSoft: '#D6EFEC',
  onAccent: '#FFFFFF',
  pathA: '#1BA39A',
  pathB: '#0B5C86',
  done: '#0E5E73',
  success: '#1B7F44',
  warning: '#B7791F',
  danger: '#C8372D',
  dead: '#D3CCBF',
  deadLine: '#8F897D',
  dir: '#4A56D6',
  burn: '#D9641A',
  tele: '#7A45D6',
  freeze: '#1E8FC9',
  sw: '#C42E75',
  gate: '#5B5750',
  bonus: '#B37A00',
  count: '#C8372D',
  char: '#3A3733',
  scrim: 'rgba(22,22,26,0.45)',
};

export const dark: Palette = {
  dark: true,
  bg: '#131210',
  surface: '#1D1C19',
  raised: '#282621',
  plate: '#0E0D0C',
  grid: '#34312B',
  text: '#F2EEE6',
  text2: '#A9A397',
  disabled: '#6A665D',
  accent: '#3FD1C4',
  accentSoft: '#123A37',
  onAccent: '#0A1F1E',
  pathA: '#3FD1C4',
  pathB: '#6FA8F5',
  done: '#5FB4D8',
  success: '#4CC38A',
  warning: '#E0A73A',
  danger: '#FF7468',
  dead: '#2A2823',
  deadLine: '#6E6A60',
  dir: '#8E98FF',
  burn: '#FF9A52',
  tele: '#B592FF',
  freeze: '#6CC7F5',
  sw: '#FF7DB0',
  gate: '#8B857A',
  bonus: '#FFC93D',
  count: '#FF7468',
  char: '#0B0A09',
  scrim: 'rgba(0,0,0,0.62)',
};

export type SkinId = 'paper' | 'graphite' | 'aurora' | 'ink' | 'sand' | 'contrast';

export const SKINS: { id: SkinId; name: string; sub: string; unlockStars: number; unlockChapter: number }[] = [
  { id: 'paper', name: 'Paper', sub: 'Light and dark pair', unlockStars: 0, unlockChapter: 0 },
  { id: 'graphite', name: 'Graphite', sub: 'Cool dark', unlockStars: 0, unlockChapter: 0 },
  { id: 'aurora', name: 'Aurora', sub: 'Deep teal dark', unlockStars: 0, unlockChapter: 0 },
  { id: 'ink', name: 'Ink', sub: 'Unlock at 30 stars', unlockStars: 30, unlockChapter: 0 },
  { id: 'sand', name: 'Sand', sub: 'Finish Chapter 6', unlockStars: 0, unlockChapter: 6 },
  { id: 'contrast', name: 'High contrast', sub: 'Maximum clarity', unlockStars: 0, unlockChapter: 0 },
];

const skinOverrides: Record<Exclude<SkinId, 'paper'>, Partial<Palette>> = {
  graphite: { dark: true, surface: '#2B2D31', raised: '#363A40', grid: '#3E4249', text: '#EEF0F2', text2: '#A8ADB5', accent: '#8FB0FF', accentSoft: '#26304A', onAccent: '#0E1526', pathA: '#8FB0FF', pathB: '#A6B9FF', done: '#A6B9FF', plate: '#1E2024', dead: '#222428', deadLine: '#6B7078', dir: '#9AA6FF', burn: '#FF9A52', tele: '#B592FF', freeze: '#6CC7F5', sw: '#FF7DB0', gate: '#8E939B', bonus: '#FFC93D', count: '#FF7468', char: '#0F1012', danger: '#FF7468' },
  aurora: { dark: true, surface: '#0F2A2E', raised: '#163A3F', grid: '#1F4A50', text: '#E6FBF7', text2: '#8FC9C4', accent: '#5EF0C2', accentSoft: '#12403F', onAccent: '#04201A', pathA: '#5EF0C2', pathB: '#7FE3D6', done: '#7FE3D6', plate: '#071A1D', dead: '#0A2023', deadLine: '#3E7A7C', dir: '#9AA6FF', burn: '#FF9A52', tele: '#B592FF', freeze: '#6CC7F5', sw: '#FF7DB0', gate: '#7FA7A8', bonus: '#FFC93D', count: '#FF7468', char: '#041012', danger: '#FF7468' },
  ink: { dark: false, surface: '#FAFAFA', raised: '#FFFFFF', grid: '#CFCFCF', text: '#111111', text2: '#555555', accent: '#111111', accentSoft: '#E4E4E4', onAccent: '#FFFFFF', pathA: '#444444', pathB: '#111111', done: '#111111', plate: '#E4E4E4', dead: '#D2D2D2', deadLine: '#777777', dir: '#3A44B8', burn: '#C4540F', tele: '#6A38C0', freeze: '#1573A8', sw: '#B02566', gate: '#444444', bonus: '#A87300', count: '#B3261E', char: '#222222', danger: '#B3261E' },
  sand: { dark: false, surface: '#FBF3E4', raised: '#FFF9EE', grid: '#D5C09A', text: '#2B2118', text2: '#6B5A45', accent: '#B4531F', accentSoft: '#F3D9C3', onAccent: '#FFFFFF', pathA: '#D67A3A', pathB: '#8A3A16', done: '#8A3A16', plate: '#E8D8B8', dead: '#E0CFAE', deadLine: '#A38C62', dir: '#4A56D6', burn: '#B4531F', tele: '#7A45D6', freeze: '#1E8FC9', sw: '#C42E75', gate: '#6B5A45', bonus: '#B07A00', count: '#B3261E', char: '#4A3B2B', danger: '#B3261E' },
  contrast: { dark: false, surface: '#FFFFFF', raised: '#FFFFFF', grid: '#111111', text: '#000000', text2: '#333333', accent: '#00574F', accentSoft: '#D8F2EF', onAccent: '#FFFFFF', pathA: '#00574F', pathB: '#0A3D62', done: '#0A3D62', plate: '#C9C9C9', dead: '#C9C9C9', deadLine: '#000000', dir: '#1F2BB0', burn: '#A63F00', tele: '#5A22B8', freeze: '#005F8F', sw: '#9E1456', gate: '#222222', bonus: '#855400', count: '#A3170E', char: '#111111', danger: '#A3170E' },
};

/** palette for the board. Skins override the app palette only for board drawing. */
export function boardPalette(base: Palette, skin: SkinId): Palette {
  if (skin === 'paper') return base;
  return { ...base, ...skinOverrides[skin] };
}

export const fonts = {
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 40, s9: 48, s10: 64 } as const;
export const radius = { chip: 12, btn: 16, card: 20, modal: 28 } as const;
