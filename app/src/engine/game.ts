import {
  FailReason,
  GameState,
  InvalidMove,
  InvalidReason,
  Level,
  MoveEvent,
  MoveResult,
} from './types';
import { neighbors4, stepDir } from './level';

export function createState(level: Level): GameState {
  const used = new Array<boolean>(level.cells.length).fill(false);
  used[level.start] = true;
  return {
    path: [level.start],
    used,
    head: level.start,
    nextNode: 2,
    moves: 0,
    flips: 0,
    freezes: [],
    bonuses: [],
    status: 'playing',
  };
}

/** current value of a countdown cell, never below 0 */
export function countdownValue(level: Level, st: GameState, cell: number): number {
  const n = level.cells[cell].n as number;
  return Math.max(0, n - st.moves);
}

export function gateOpen(level: Level, st: GameState, cell: number): boolean {
  const initial = !!level.cells[cell].open;
  return st.flips % 2 === 0 ? initial : !initial;
}

/** remaining frozen moves for a cell (0 if not locked) */
export function frozenFor(st: GameState, cell: number, level: Level): number {
  let best = 0;
  for (const f of st.freezes) {
    if (st.moves >= f.from && st.moves < f.until && level.around[f.center].includes(cell)) {
      best = Math.max(best, f.until - st.moves);
    }
  }
  return best;
}

function bad(reason: InvalidReason, cell: number, extra: Partial<InvalidMove> = {}): InvalidMove {
  return { ok: false, reason, cell, ...extra };
}

export function validateMove(level: Level, st: GameState, to: number): InvalidMove | null {
  if (st.status !== 'playing') return bad('finished', to);
  const { size } = level;
  if (to < 0 || to >= level.cells.length) return bad('not-adjacent', to);
  const dir = stepDir(size, st.head, to);
  if (!dir) return bad('not-adjacent', to);
  const from = level.cells[st.head];
  if (from.kind === 'dir' && from.dir !== dir) return bad('direction', to, { dir: from.dir });
  const c = level.cells[to];
  if (c.kind === 'dead') return bad('dead', to);
  if (st.used[to]) return bad(c.kind === 'burn' ? 'burned' : 'used', to);
  if (c.kind === 'gate' && !gateOpen(level, st, to)) return bad('gate', to);
  const fr = frozenFor(st, to, level);
  if (fr > 0) return bad('frozen', to, { remaining: fr });
  if (c.kind === 'count' && countdownValue(level, st, to) <= 0) return bad('expired', to);
  if (c.kind === 'node' && (c.n as number) > st.nextNode) return bad('order', to, { need: st.nextNode });
  if (c.kind === 'node' && (c.n as number) === level.nodeCount) {
    for (const r of level.required) if (r !== to && !st.used[r]) return bad('finish', to);
  }
  if (c.kind === 'tele') {
    const p = level.partner[to];
    if (st.used[p]) return bad('portal', to);
  }
  const cost = c.kind === 'burn' ? 2 : 1;
  if (st.moves + cost > level.maxMoves) return bad('no-moves', to);
  return null;
}

export function legalMoves(level: Level, st: GameState): number[] {
  if (st.status !== 'playing') return [];
  return neighbors4(level, st.head).filter((n) => validateMove(level, st, n) === null);
}

function failState(st: GameState, reason: FailReason, cell?: number): GameState {
  return { ...st, status: 'failed', fail: reason, failCell: cell };
}

/**
 * Apply a move. `checkTrapped` can be turned off by the solver for speed.
 */
export function applyMove(level: Level, st: GameState, to: number, checkTrapped = true): MoveResult {
  const err = validateMove(level, st, to);
  if (err) return err;
  const c = level.cells[to];
  const events: MoveEvent[] = [];
  const used = st.used.slice();
  const path = st.path.slice();
  let freezes = st.freezes;
  let bonuses = st.bonuses;
  let flips = st.flips;
  let nextNode = st.nextNode;
  let head = to;
  let moves = st.moves + (c.kind === 'burn' ? 2 : 1);
  used[to] = true;
  path.push(to);

  switch (c.kind) {
    case 'node':
      if ((c.n as number) === nextNode) {
        nextNode += 1;
        events.push({ type: 'node', n: c.n as number, cell: to });
      }
      break;
    case 'burn':
      events.push({ type: 'burn', cell: to });
      break;
    case 'tele': {
      const p = level.partner[to];
      used[p] = true;
      path.push(p);
      head = p;
      events.push({ type: 'teleport', from: to, to: p, pair: c.pair as number });
      break;
    }
    case 'freeze':
      freezes = [...freezes, { center: to, from: moves + 1, until: moves + 4 }];
      events.push({ type: 'freeze', cell: to, around: level.around[to] });
      break;
    case 'switch':
      flips += 1;
      events.push({ type: 'switch', cell: to, on: flips % 2 === 1, gates: level.gates });
      break;
    case 'bonus':
      bonuses = [...bonuses, to];
      events.push({ type: 'bonus', cell: to });
      break;
    default:
      break;
  }

  let next: GameState = {
    path,
    used,
    head,
    nextNode,
    moves,
    flips,
    freezes,
    bonuses,
    status: 'playing',
  };

  if (nextNode > level.nodeCount) {
    next.status = 'solved';
    return { ok: true, state: next, events };
  }

  // countdown cells that ran out before being entered
  for (let i = 0; i < level.cells.length; i++) {
    const cell = level.cells[i];
    if (cell.kind === 'count' && !used[i]) {
      const v = countdownValue(level, next, i);
      if (v <= 0) return { ok: true, state: failState(next, 'countdown', i), events };
      if (v === 1) events.push({ type: 'countdown-warning', cell: i, value: v });
    }
  }
  if (moves >= level.maxMoves) return { ok: true, state: failState(next, 'moves'), events };
  if (checkTrapped && legalMoves(level, next).length === 0) {
    next = failState(next, 'trapped');
  }
  return { ok: true, state: next, events };
}

/* ---------- session with undo ---------- */

export interface Session {
  level: Level;
  history: GameState[];
}

export function createSession(level: Level): Session {
  return { level, history: [createState(level)] };
}

export function current(s: Session): GameState {
  return s.history[s.history.length - 1];
}

export function sessionMove(s: Session, to: number): { session: Session; result: MoveResult } {
  const result = applyMove(s.level, current(s), to);
  if (!result.ok) return { session: s, result };
  return { session: { level: s.level, history: [...s.history, result.state] }, result };
}

export function sessionUndo(s: Session): Session {
  if (s.history.length <= 1) return s;
  return { level: s.level, history: s.history.slice(0, -1) };
}

/** head cell of the previous snapshot: dragging onto it retracts one step */
export function retractTarget(s: Session): number | null {
  if (s.history.length <= 1) return null;
  return s.history[s.history.length - 2].head;
}

export function restart(s: Session): Session {
  return createSession(s.level);
}

/* ---------- scoring ---------- */

/** Target time (seconds) for a 3-star clear: scales with how many cells must be filled. */
export function parSeconds(level: Level): number {
  return Math.round(10 + 2.2 * level.required.length);
}

/**
 * Stars come from three things and the worst one wins:
 *  - moves:  <= optimal = 3, <= optimal+2 = 2, else 1
 *  - time:   <= par = 3, <= 2.2 x par = 2, else 1   (skipped when time is 0 / unknown)
 *  - hints:  0 = 3, 1-2 = 2, 3+ = 1
 */
export function starsFor(level: Level, moves: number, seconds = 0, hints = 0): 1 | 2 | 3 {
  const m = moves <= level.optimal ? 3 : moves <= level.optimal + 2 ? 2 : 1;
  const par = parSeconds(level);
  const t = seconds <= 0 || seconds <= par ? 3 : seconds <= par * 2.2 ? 2 : 1;
  const h = hints === 0 ? 3 : hints <= 2 ? 2 : 1;
  return Math.min(m, t, h) as 1 | 2 | 3;
}
