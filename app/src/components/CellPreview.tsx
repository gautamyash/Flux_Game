import React from 'react';
import Svg from 'react-native-svg';
import { Dir } from '../engine';
import { Palette } from '../theme/tokens';
import { CellGlyph, CellTile, CellVisual } from './Glyphs';

export function CellPreview({ kind, state = 'idle', n = 0, dir = 'r', pair = 1, size = 48, t, start = false }: { kind: CellVisual['kind']; state?: string; n?: number; dir?: Dir; pair?: number; size?: number; t: Palette; start?: boolean }) {
  const v: CellVisual = { kind, state, n, dir, pair, onPath: false, locked: false, err: false, hint: false, start, big: false };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <CellTile v={v} t={t} />
      <CellGlyph v={v} t={t} pulse={null} />
    </Svg>
  );
}
