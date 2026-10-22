import React from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { CellKind, Dir } from '../engine';
import { Palette, fonts } from '../theme/tokens';

export interface CellVisual {
  kind: CellKind;
  state: string;
  n: number;
  dir: Dir;
  pair: number;
  onPath: boolean;
  locked: boolean;
  err: boolean;
  hint: boolean;
  start: boolean;
  big: boolean;
}

const AG = Animated.createAnimatedComponent(G);

export function Pulse({ pulse, min = 0.3, children }: { pulse: SharedValue<number> | null; min?: number; children: React.ReactNode }) {
  const props = useAnimatedProps(() => ({ opacity: pulse ? min + (1 - min) * pulse.value : 1 }));
  return <AG animatedProps={props}>{children}</AG>;
}

const HATCH = 'M8 34 L34 8 M8 62 L62 8 M8 90 L90 8 M38 92 L92 38 M66 92 L92 66';
const HATCH_LOCK = 'M12 30 L30 12 M12 54 L54 12 M12 78 L78 12 M36 88 L88 36 M60 88 L88 60';
const STAR = 'M50 17 L59 38 L81 40 L64.5 55 L69.5 77 L50 65.5 L30.5 77 L35.5 55 L19 40 L41 38 Z';

function tintOf(kind: CellKind, t: Palette): [string, number] {
  switch (kind) {
    case 'dir':
      return [t.dir, 0.1];
    case 'burn':
      return [t.burn, 0.1];
    case 'tele':
      return [t.tele, 0.1];
    case 'freeze':
      return [t.freeze, 0.12];
    case 'switch':
      return [t.sw, 0.08];
    case 'bonus':
      return [t.bonus, 0.1];
    case 'count':
      return [t.count, 0.06];
    default:
      return [t.surface, 0];
  }
}

/** Tile background (drawn below the path). */
export const CellTile = React.memo(function CellTile({ v, t }: { v: CellVisual; t: Palette }) {
  const [tint, op] = tintOf(v.kind, t);
  if (v.kind === 'dead') {
    return (
      <G>
        <Rect x={3} y={3} width={94} height={94} rx={15} fill={t.dead} />
        <Path d={HATCH} stroke={t.deadLine} strokeWidth={3.2} strokeLinecap="round" opacity={0.8} />
      </G>
    );
  }
  return (
    <G>
      <Rect x={3} y={3} width={94} height={94} rx={15} fill={t.surface} stroke={t.grid} strokeWidth={1.4} />
      {op > 0 ? <Rect x={3} y={3} width={94} height={94} rx={15} fill={tint} opacity={op} /> : null}
    </G>
  );
});

function dirRotation(d: Dir): number {
  return { u: 0, r: 90, d: 180, l: 270 }[d];
}

/** Glyph + overlays (drawn above the path). */
export const CellGlyph = React.memo(function CellGlyph({ v, t, pulse }: { v: CellVisual; t: Palette; pulse: SharedValue<number> | null }) {
  const plate =
    v.onPath && v.kind !== 'node' && v.kind !== 'dead' && v.kind !== 'gate' && v.kind !== 'empty' ? (
      <Circle cx={50} cy={50} r={34} fill={t.raised} stroke={t.grid} strokeWidth={1.5} />
    ) : null;

  let body: React.ReactNode = null;
  switch (v.kind) {
    case 'dir':
      body = (
        <G transform={`rotate(${dirRotation(v.dir)} 50 50)`}>
          <Path d="M12 3 H88 A9 9 0 0 1 97 12 V20 H3 V12 A9 9 0 0 1 12 3 Z" fill={v.err ? t.danger : t.dir} opacity={0.28} />
          <Path d="M50 78 V30 M30 48 L50 28 L70 48" fill="none" stroke={t.dir} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
      break;
    case 'burn': {
      const burned = v.state === 'burned';
      const crossed = v.state === 'crossed';
      body = (
        <G>
          {burned ? (
            <G>
              <Rect x={3} y={3} width={94} height={94} rx={15} fill={t.char} />
              <Path d={HATCH} stroke={t.deadLine} strokeWidth={3} strokeLinecap="round" />
            </G>
          ) : null}
          {!burned ? <Circle cx={50} cy={56} r={38} fill={t.burn} opacity={crossed ? 0.35 : 0.14} /> : null}
          <Path
            d="M50 14 C56 28 72 38 72 58 C72 74 62 85 50 85 C38 85 28 74 28 58 C28 49 33 42 39 36 C39 45 43 49 47 50 C44 38 44 26 50 14 Z"
            fill={crossed ? t.burn : 'none'}
            stroke={burned ? t.deadLine : t.burn}
            strokeWidth={6}
            strokeLinejoin="round"
            strokeDasharray={burned ? '2 9' : undefined}
          />
          {crossed ? (
            <G>
              <Path d="M50 48 C54 56 61 60 61 69 C61 76 56 80 50 80 C44 80 39 76 39 69 C39 62 46 58 50 48 Z" fill="#FFE3B8" />
              <Circle cx={24} cy={30} r={3} fill={t.burn} />
              <Circle cx={78} cy={24} r={2.5} fill={t.burn} />
              <Circle cx={82} cy={46} r={2} fill={t.burn} />
              <Circle cx={20} cy={56} r={2} fill={t.burn} />
            </G>
          ) : null}
        </G>
      );
      break;
    }
    case 'tele': {
      const burst = v.state === 'burst';
      const entered = v.state === 'entered';
      body = (
        <G>
          {burst ? (
            <G>
              <Circle cx={50} cy={50} r={46} fill="none" stroke={t.tele} strokeWidth={2.4} opacity={0.7} />
              <Circle cx={50} cy={50} r={38} fill="none" stroke={t.tele} strokeWidth={3} opacity={0.7} />
            </G>
          ) : null}
          <Circle cx={50} cy={50} r={40} fill="none" stroke={t.tele} strokeWidth={2.5} strokeDasharray="3 6" strokeLinecap="round" opacity={0.5} />
          <Circle cx={50} cy={50} r={27} fill={t.tele} fillOpacity={entered ? 0.35 : burst ? 0.18 : 0.06} stroke={t.tele} strokeWidth={6.5} />
          {v.pair === 1 ? <Circle cx={50} cy={50} r={8} fill={t.tele} /> : null}
          {v.pair === 2 ? <Path d="M50 40 L59 58 H41 Z" fill={t.tele} stroke={t.tele} strokeWidth={3} strokeLinejoin="round" /> : null}
          {v.pair === 3 ? <Rect x={42} y={42} width={16} height={16} rx={2.5} fill={t.tele} /> : null}
        </G>
      );
      break;
    }
    case 'freeze': {
      const active = v.state === 'active';
      const thaw = v.state === 'thaw';
      const arm = 'M50 19 V81';
      const tips = 'M43 27 L50 20 L57 27 M43 73 L50 80 L57 73';
      body = (
        <G>
          {active || thaw ? (
            <Circle cx={50} cy={50} r={47} fill="none" stroke={t.freeze} strokeWidth={2.4} strokeDasharray="4 5" strokeLinecap="round" opacity={active ? 0.9 : 0.4} />
          ) : null}
          <Circle cx={50} cy={50} r={36} fill={t.freeze} opacity={active ? 0.22 : 0.08} />
          <G fill="none" stroke={t.freeze} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
            <Path d={arm} />
            <G transform="rotate(60 50 50)"><Path d={arm} /></G>
            <G transform="rotate(120 50 50)"><Path d={arm} /></G>
            <G strokeWidth={4}>
              <Path d={tips} />
              <G transform="rotate(60 50 50)"><Path d={tips} /></G>
              <G transform="rotate(120 50 50)"><Path d={tips} /></G>
            </G>
          </G>
        </G>
      );
      break;
    }
    case 'switch': {
      const on = v.state === 'on';
      body = (
        <G>
          <Rect x={20} y={36} width={60} height={28} rx={14} fill={on ? t.sw : 'none'} stroke={t.sw} strokeWidth={5} />
          <Circle cx={on ? 66 : 34} cy={50} r={9} fill={on ? '#FFFFFF' : t.raised} stroke={t.sw} strokeWidth={4} />
          <SvgText x={50} y={86} textAnchor="middle" fontFamily={fonts.display} fontWeight="700" fontSize={12} letterSpacing={1} fill={t.sw}>
            {on ? 'ON' : 'OFF'}
          </SvgText>
        </G>
      );
      break;
    }
    case 'gate': {
      const open = v.state === 'open';
      body = open ? (
        <G>
          <Rect x={13} y={13} width={74} height={74} rx={10} fill="none" stroke={t.gate} strokeWidth={3} strokeDasharray="6 6" />
          <Path d="M13 36 V64 M87 36 V64" stroke={t.gate} strokeWidth={6} strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Rect x={13} y={13} width={74} height={74} rx={10} fill={t.gate} />
          <Path d="M34 24 V76 M50 24 V76 M66 24 V76" stroke={t.surface} strokeWidth={5} strokeLinecap="round" />
        </G>
      );
      break;
    }
    case 'bonus': {
      const got = v.state === 'collected';
      body = (
        <G>
          {got ? (
            <Circle cx={50} cy={52} r={38} fill={t.bonus} opacity={0.16} />
          ) : (
            <Pulse pulse={pulse} min={0.4}>
              <Circle cx={50} cy={52} r={38} fill={t.bonus} opacity={0.16} />
            </Pulse>
          )}
          <Path d={STAR} fill={got ? t.bonus : 'none'} stroke={t.bonus} strokeWidth={5.5} strokeLinejoin="round" />
          {got ? (
            <Path d="M18 20 V30 M13 25 H23 M82 14 V22 M78 18 H86 M84 74 V82 M80 78 H88" stroke={t.bonus} strokeWidth={3.5} strokeLinecap="round" />
          ) : null}
        </G>
      );
      break;
    }
    case 'count': {
      const done = v.state === 'done';
      const c = Math.max(0, Math.min(5, v.n));
      const C = 194.8;
      body = (
        <G>
          {c === 1 && !done ? (
            <Pulse pulse={pulse} min={0.2}>
              <Circle cx={50} cy={50} r={43} fill="none" stroke={t.count} strokeWidth={3} />
            </Pulse>
          ) : null}
          <Circle cx={50} cy={50} r={31} fill={t.raised} stroke={t.grid} strokeWidth={7} strokeDasharray={c === 0 && !done ? '4 7' : undefined} />
          {c > 0 || done ? (
            <Circle
              cx={50}
              cy={50}
              r={31}
              fill="none"
              stroke={done ? t.accent : t.count}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={`${done ? C : (C * c) / 5} ${C}`}
              transform="rotate(-90 50 50)"
            />
          ) : null}
          {c === 0 && !done ? (
            <Path d="M60 22 L53 38 L62 46 L49 60 L57 80" fill="none" stroke={t.text2} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {done ? (
            <Path d="M36 51 L46 61 L65 40" fill="none" stroke={t.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <SvgText x={50} y={61} textAnchor="middle" fontFamily={fonts.display} fontWeight="700" fontSize={30} fill={c === 0 ? t.disabled : c === 1 ? t.count : t.text}>
              {String(c)}
            </SvgText>
          )}
        </G>
      );
      break;
    }
    case 'node': {
      const st = v.state;
      let fill = t.raised;
      let stroke = t.text;
      let text = t.text;
      let sw = 3.2;
      let ringC = t.text;
      let ringOp = 0;
      if (st === 'next') {
        fill = t.accentSoft;
        stroke = t.accent;
        sw = 3.6;
      }
      if (st === 'reached') {
        fill = t.accent;
        stroke = t.accent;
        text = t.onAccent;
      }
      if (st === 'final') {
        fill = t.done;
        stroke = t.done;
        text = t.onAccent;
        ringC = t.done;
        ringOp = 1;
      }
      if (st === 'error') {
        stroke = t.danger;
        text = t.danger;
        sw = 4;
      }
      if (v.start) {
        ringOp = 1;
        ringC = st === 'reached' || st === 'final' ? t.accent : t.text;
      }
      const fs = (v.n >= 10 ? 27 : 34) * (v.big ? 1.18 : 1);
      body = (
        <G>
          {st === 'next' ? (
            <Pulse pulse={pulse} min={0.25}>
              <Circle cx={50} cy={50} r={44} fill="none" stroke={t.accent} strokeWidth={3.5} />
            </Pulse>
          ) : null}
          <Circle cx={50} cy={50} r={42} fill="none" stroke={ringC} strokeWidth={2.6} opacity={ringOp} />
          <Circle cx={50} cy={50} r={33} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={v.locked ? '5 4' : undefined} />
          <SvgText x={50} y={50 + fs * 0.36} textAnchor="middle" fontFamily={fonts.display} fontWeight="700" fontSize={fs} fill={text}>
            {String(v.n)}
          </SvgText>
        </G>
      );
      break;
    }
    default:
      body = null;
  }

  return (
    <G>
      {plate}
      {body}
      {v.locked ? (
        <G>
          <Rect x={3} y={3} width={94} height={94} rx={15} fill={t.freeze} opacity={0.3} />
          <Path d={HATCH_LOCK} stroke={t.freeze} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
          <Rect x={68} y={10} width={22} height={17} rx={4} fill={t.freeze} />
          <Path d="M73 11 V8 A6 6 0 0 1 85 8 V11" fill="none" stroke={t.freeze} strokeWidth={3.2} strokeLinecap="round" />
          <Circle cx={79} cy={18.5} r={2.4} fill={t.surface} />
        </G>
      ) : null}
      {v.err ? <Rect x={3} y={3} width={94} height={94} rx={15} fill={t.danger} opacity={0.2} stroke={t.danger} strokeWidth={3} /> : null}
      {v.hint ? (
        <Pulse pulse={pulse} min={0.35}>
          <Rect x={6} y={6} width={88} height={88} rx={14} fill={t.accent} fillOpacity={0.14} stroke={t.accent} strokeWidth={3.5} strokeDasharray="7 6" strokeLinecap="round" />
        </Pulse>
      ) : null}
    </G>
  );
});
