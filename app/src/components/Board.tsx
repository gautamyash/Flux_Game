import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { GameState, Level, countdownValue, frozenFor, gateOpen } from '../engine';
import { Palette } from '../theme/tokens';
import { stableCellAt } from './boardInput';
import { CellGlyph, CellTile, CellVisual } from './Glyphs';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface BoardGeom {
  size: number;
  pad: number;
  cell: number;
  n: number;
}

export function boardGeom(size: number, n: number): BoardGeom {
  const pad = size * 0.022;
  const cell = (size - 2 * pad) / n;
  return { size, pad, cell, n };
}

/** Largest board side that fits, per the responsive spec: cell = floor(min(w, h, 760) / n) */
export function fitBoard(availW: number, availH: number, n: number): { side: number; cell: number } {
  const cell = Math.floor(Math.min(availW, availH, 760) / n);
  const c = Math.max(cell, 40);
  return { side: c * n, cell: c };
}

export function cellAt(geom: BoardGeom, x: number, y: number): number {
  const c = Math.floor((x - geom.pad) / geom.cell);
  const r = Math.floor((y - geom.pad) / geom.cell);
  if (c < 0 || r < 0 || c >= geom.n || r >= geom.n) return -1;
  return r * geom.n + c;
}

export function cellCenter(geom: BoardGeom, i: number): { x: number; y: number } {
  const r = Math.floor(i / geom.n);
  const c = i % geom.n;
  return { x: geom.pad + (c + 0.5) * geom.cell, y: geom.pad + (r + 0.5) * geom.cell };
}

function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const f = (n: number) => n.toFixed(2);

function segPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 1) return `M${f(pts[0].x)} ${f(pts[0].y)} L${f(pts[0].x + 0.01)} ${f(pts[0].y)}`;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = mid(pts[i - 1], pts[i]);
    const b = mid(pts[i], pts[i + 1]);
    d += ` L${f(a.x)} ${f(a.y)} Q${f(pts[i].x)} ${f(pts[i].y)} ${f(b.x)} ${f(b.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${f(last.x)} ${f(last.y)}`;
  return d;
}

export function buildPath(geom: BoardGeom, path: number[]) {
  const segs: number[][] = [];
  let cur: number[] = [];
  for (let k = 0; k < path.length; k++) {
    if (cur.length) {
      const a = cur[cur.length - 1];
      const dr = Math.abs(Math.floor(a / geom.n) - Math.floor(path[k] / geom.n));
      const dc = Math.abs((a % geom.n) - (path[k] % geom.n));
      if (dr + dc !== 1) {
        segs.push(cur);
        cur = [];
      }
    }
    cur.push(path[k]);
  }
  if (cur.length) segs.push(cur);
  const d = segs.map((s) => segPath(s.map((i) => cellCenter(geom, i)))).join(' ');
  const bridges: string[] = [];
  for (let s = 0; s + 1 < segs.length; s++) {
    const a = cellCenter(geom, segs[s][segs[s].length - 1]);
    const b = cellCenter(geom, segs[s + 1][0]);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const cx = mx + (-dy / len) * len * 0.3;
    const cy = my + (dx / len) * len * 0.3;
    bridges.push(`M${f(a.x)} ${f(a.y)} Q${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`);
  }
  let length = 0;
  for (const s of segs) length += Math.max(0, s.length - 1) * geom.cell;
  return { d, bridges, length };
}

export function visualOf(level: Level, st: GameState, i: number, opts: { err?: number | null; hints?: Set<number>; large?: boolean }): CellVisual {
  const c = level.cells[i];
  const onPath = st.used[i];
  const v: CellVisual = {
    kind: c.kind,
    state: 'idle',
    n: 0,
    dir: c.dir ?? 'r',
    pair: c.pair ?? 1,
    onPath,
    locked: !onPath && frozenFor(st, i, level) > 0,
    err: opts.err === i,
    hint: !!opts.hints?.has(i),
    start: false,
    big: !!opts.large,
  };
  switch (c.kind) {
    case 'node': {
      const n = c.n as number;
      v.n = n;
      v.start = n === 1;
      if (n < st.nextNode) v.state = n === level.nodeCount && st.status === 'solved' ? 'final' : 'reached';
      else if (n === st.nextNode) v.state = 'next';
      else v.state = 'default';
      if (opts.err === i) v.state = 'error';
      break;
    }
    case 'burn':
      v.state = onPath ? (st.head === i ? 'crossed' : 'burned') : 'idle';
      break;
    case 'tele':
      v.state = onPath ? (st.head === i ? 'burst' : 'entered') : 'idle';
      break;
    case 'freeze': {
      const rec = st.freezes.find((r) => r.center === i);
      v.state = rec ? (st.moves < rec.until ? 'active' : 'thaw') : 'idle';
      break;
    }
    case 'switch':
      v.state = st.flips % 2 === 1 ? 'on' : 'off';
      break;
    case 'gate':
      v.state = gateOpen(level, st, i) ? 'open' : 'closed';
      break;
    case 'bonus':
      v.state = st.bonuses.includes(i) ? 'collected' : 'idle';
      break;
    case 'count':
      if (onPath) v.state = 'done';
      v.n = countdownValue(level, st, i);
      break;
    default:
      break;
  }
  return v;
}

function sameVisual(a: CellVisual, b: CellVisual) {
  return (
    a.kind === b.kind && a.state === b.state && a.n === b.n && a.dir === b.dir && a.pair === b.pair &&
    a.onPath === b.onPath && a.locked === b.locked && a.err === b.err && a.hint === b.hint && a.start === b.start && a.big === b.big
  );
}

interface CellProps {
  v: CellVisual;
  t: Palette;
  pulse: SharedValue<number> | null;
  x: number;
  y: number;
  scale: number;
  layer: 'tile' | 'glyph';
}

const CellItem = React.memo(
  function CellItem({ v, t, pulse, x, y, scale, layer }: CellProps) {
    return (
      <G transform={`translate(${f(x)} ${f(y)}) scale(${f(scale)})`}>
        {layer === 'tile' ? <CellTile v={v} t={t} /> : <CellGlyph v={v} t={t} pulse={pulse} />}
      </G>
    );
  },
  (a, b) => a.t === b.t && a.pulse === b.pulse && a.x === b.x && a.y === b.y && a.scale === b.scale && a.layer === b.layer && sameVisual(a.v, b.v),
);

export interface BoardProps {
  level: Level;
  state: GameState;
  size: number;
  t: Palette;
  pulse?: SharedValue<number> | null;
  sweep?: SharedValue<number> | null;
  err?: number | null;
  hints?: number[];
  large?: boolean;
  /** hide path-end cursor (previews) */
  preview?: boolean;
  /** disable drawing input and its visual preview while an overlay is open */
  drawingEnabled?: boolean;
  onBegin?: (x: number, y: number) => void;
  onMove?: (x: number, y: number) => void;
  onEnd?: () => void;
  /** screen-reader mode: one focusable, tappable element per cell */
  a11y?: { label: (i: number) => string; onPress: (i: number) => void };
}

/** The empty board (plate + tiles). Never changes while playing, so it is drawn once and cached. */
const StaticTiles = React.memo(function StaticTiles({ level, size, t }: { level: Level; size: number; t: Palette }) {
  const geom = useMemo(() => boardGeom(size, level.size), [size, level.size]);
  const scale = geom.cell / 100;
  const tiles = useMemo(
    () =>
      level.cells.map((c): CellVisual => ({
        kind: c.kind, state: 'idle', n: 0, dir: c.dir ?? 'r', pair: c.pair ?? 1, onPath: false, locked: false,
        err: false, hint: false, start: false, big: false,
      })),
    [level],
  );
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Rect x={0} y={0} width={size} height={size} rx={geom.cell * 0.3} fill={t.plate} />
      {tiles.map((v, i) => {
        const r = Math.floor(i / level.size);
        const c = i % level.size;
        return <CellItem key={`t${i}`} layer="tile" v={v} t={t} pulse={null} x={geom.pad + c * geom.cell} y={geom.pad + r * geom.cell} scale={scale} />;
      })}
    </Svg>
  );
});

export const Board = React.memo(function Board({ level, state, size, t, pulse = null, sweep = null, err = null, hints, large, preview, drawingEnabled = true, onBegin, onMove, onEnd, a11y }: BoardProps) {
  const geom = useMemo(() => boardGeom(size, level.size), [size, level.size]);
  const latestHandlers = useRef({ onBegin, onMove, onEnd });
  latestHandlers.current = { onBegin, onMove, onEnd };
  const dispatchBegin = useCallback((x: number, y: number) => latestHandlers.current.onBegin?.(x, y), []);
  const dispatchMove = useCallback((x: number, y: number) => latestHandlers.current.onMove?.(x, y), []);
  const dispatchEnd = useCallback(() => latestHandlers.current.onEnd?.(), []);
  const fingerCell = useSharedValue(-1);
  const wasOutside = useSharedValue(false);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const previewActive = useSharedValue(false);
  const hintSet = useMemo(() => new Set(hints ?? []), [hints]);
  const visuals = useMemo(
    () => level.cells.map((_, i) => visualOf(level, state, i, { err, hints: hintSet, large })),
    [level, state, err, hintSet, large],
  );
  const built = useMemo(() => buildPath(geom, state.path), [geom, state.path]);
  const first = cellCenter(geom, state.path[0]);
  const head = cellCenter(geom, state.head);
  const solved = state.status === 'solved';
  const scale = geom.cell / 100;
  const pathW = geom.cell * 0.34;

  const sweepProps = useAnimatedProps(() => {
    const p = sweep ? sweep.value : 2;
    const L = Math.max(built.length, 1);
    const seg = L * 0.28;
    return { strokeDashoffset: seg - p * (L + seg) };
  });

  const teleEntrance = state.path.length > 1 ? state.path[state.path.length - 2] : -1;
  const justTeleported = teleEntrance >= 0 && level.cells[teleEntrance].kind === 'tele' && level.partner[teleEntrance] === state.head;
  const previewVisible = (x: number, y: number) => {
    'worklet';
    const col = Math.floor((x - geom.pad) / geom.cell);
    const row = Math.floor((y - geom.pad) / geom.cell);
    if (col < 0 || row < 0 || col >= geom.n || row >= geom.n) return false;
    const target = row * geom.n + col;
    if (justTeleported && target === teleEntrance) return false;
    const headRow = Math.floor(state.head / geom.n);
    const headCol = state.head % geom.n;
    return Math.abs(row - headRow) + Math.abs(col - headCol) <= 1;
  };
  const previewLineProps = useAnimatedProps(() => {
    const visible = previewActive.value && drawingEnabled && state.status === 'playing' && previewVisible(fingerX.value, fingerY.value);
    return { x2: fingerX.value, y2: fingerY.value, opacity: visible ? 0.78 : 0 };
  });
  const previewDotProps = useAnimatedProps(() => {
    const visible = previewActive.value && drawingEnabled && state.status === 'playing' && previewVisible(fingerX.value, fingerY.value);
    return { cx: fingerX.value, cy: fingerY.value, opacity: visible ? 1 : 0 };
  });

  const hasBegin = !!onBegin;
  const gesture = useMemo(() => {
    if (!hasBegin) return null;
    const { pad, cell, n } = geom;
    return Gesture.Pan()
      .enabled(drawingEnabled && state.status === 'playing')
      .minDistance(0)
      .onBegin((e) => {
        fingerX.value = e.x;
        fingerY.value = e.y;
        previewActive.value = e.x >= pad && e.y >= pad && e.x < pad + n * cell && e.y < pad + n * cell;
        fingerCell.value = stableCellAt(e.x, e.y, pad, cell, n, -1);
        wasOutside.value = e.x < pad || e.y < pad || e.x >= pad + n * cell || e.y >= pad + n * cell;
        scheduleOnRN(dispatchBegin, e.x, e.y);
      })
      .onUpdate((e) => {
        fingerX.value = e.x;
        fingerY.value = e.y;
        previewActive.value = true;
        const outside = e.x < pad || e.y < pad || e.x >= pad + n * cell || e.y >= pad + n * cell;
        if (outside) {
          if (!wasOutside.value) scheduleOnRN(dispatchMove, e.x, e.y);
          wasOutside.value = true;
          return;
        }
        const next = stableCellAt(e.x, e.y, pad, cell, n, fingerCell.value);
        const reentered = wasOutside.value;
        wasOutside.value = false;
        if (next === fingerCell.value && !reentered) return;
        fingerCell.value = next;
        scheduleOnRN(dispatchMove, e.x, e.y);
      })
      .onFinalize(() => {
        previewActive.value = false;
        scheduleOnRN(dispatchEnd);
      });
  }, [hasBegin, drawingEnabled, state.status, geom, fingerCell, wasOutside, fingerX, fingerY, previewActive, dispatchBegin, dispatchMove, dispatchEnd]);

  const svg = (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="ramp" gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={head.x + 0.01} y2={head.y + 0.01}>
          <Stop offset="0" stopColor={t.pathA} />
          <Stop offset="1" stopColor={t.pathB} />
        </LinearGradient>
      </Defs>
      {built.bridges.map((b, i) => (
        <Path key={`b${i}`} d={b} fill="none" stroke={t.tele} strokeWidth={geom.cell * 0.09} strokeDasharray={`${f(geom.cell * 0.12)} ${f(geom.cell * 0.14)}`} strokeLinecap="round" opacity={0.85} />
      ))}
      <Path d={built.d} fill="none" stroke={solved ? t.done : 'url(#ramp)'} strokeWidth={pathW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={built.d} fill="none" stroke="#FFFFFF" strokeOpacity={0.26} strokeWidth={geom.cell * 0.1} strokeLinecap="round" strokeLinejoin="round" />
      {sweep ? (
        <AnimatedPath
          d={built.d}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.9}
          strokeWidth={pathW * 0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${f(Math.max(built.length, 1) * 0.28)} ${f(Math.max(built.length, 1) * 3)}`}
          animatedProps={sweepProps}
        />
      ) : null}
      {drawingEnabled && state.status === 'playing' ? (
        <AnimatedLine
          x1={head.x}
          y1={head.y}
          stroke={t.pathB}
          strokeWidth={pathW * 0.62}
          strokeDasharray={`${f(geom.cell * 0.12)} ${f(geom.cell * 0.14)}`}
          strokeLinecap="round"
          animatedProps={previewLineProps}
        />
      ) : null}
      {visuals.map((v, i) => {
        if (v.kind === 'empty' && !v.locked && !v.err && !v.hint) return null;
        if (v.kind === 'dead' && !v.err) return null;
        const r = Math.floor(i / level.size);
        const c = i % level.size;
        return <CellItem key={`g${i}`} layer="glyph" v={v} t={t} pulse={pulse} x={geom.pad + c * geom.cell} y={geom.pad + r * geom.cell} scale={scale} />;
      })}
      {!preview && state.status === 'playing' ? (
        <G>
          <Circle cx={head.x} cy={head.y} r={geom.cell * 0.38} fill="none" stroke={t.raised} strokeWidth={geom.cell * 0.11} />
          <Circle cx={head.x} cy={head.y} r={geom.cell * 0.38} fill="none" stroke={t.pathB} strokeWidth={geom.cell * 0.06} />
        </G>
      ) : null}
      {drawingEnabled && state.status === 'playing' ? (
        <AnimatedCircle
          r={geom.cell * 0.055}
          fill={t.pathB}
          stroke="#FFFFFF"
          strokeWidth={geom.cell * 0.025}
          animatedProps={previewDotProps}
        />
      ) : null}
    </Svg>
  );

  const frame = (
    <>
      <StaticTiles level={level} size={size} t={t} />
      {svg}
      {a11y ? level.cells.map((_, i) => (
        <View
          key={`a${i}`}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11y.label(i)}
          onAccessibilityTap={() => a11y.onPress(i)}
          style={{ position: 'absolute', left: geom.pad + (i % level.size) * geom.cell, top: geom.pad + Math.floor(i / level.size) * geom.cell, width: geom.cell, height: geom.cell }}
        />
      )) : null}
    </>
  );
  const label = `Puzzle board, ${level.size} by ${level.size}. Next target ${Math.min(state.nextNode, level.nodeCount)}.`;
  if (!gesture) return <View accessibilityLabel={label} style={{ width: size, height: size }}>{frame}</View>;
  return (
    <GestureDetector gesture={gesture}>
      <View accessible={!a11y} accessibilityLabel={label} style={{ width: size, height: size }}>
        {frame}
      </View>
    </GestureDetector>
  );
});
