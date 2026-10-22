export type Dir = 'u' | 'r' | 'd' | 'l';

export type CellKind =
  | 'empty'
  | 'dead'
  | 'node'
  | 'dir'
  | 'burn'
  | 'tele'
  | 'freeze'
  | 'switch'
  | 'gate'
  | 'bonus'
  | 'count';

export interface CellDef {
  kind: CellKind;
  /** node number (kind=node) or countdown start value (kind=count) */
  n?: number;
  /** arrow direction (kind=dir) */
  dir?: Dir;
  /** teleport pair 1..3 (kind=tele) */
  pair?: number;
  /** gate starts open (kind=gate) */
  open?: boolean;
}

export interface LevelDef {
  id: string;
  chapter: number;
  index: number;
  size: number;
  rows: string[];
  maxMoves: number;
  optimal: number;
  title?: string;
  /** cells to enter in order (teleport exits implicit); used for hints */
  solution?: number[];
}

export interface Level {
  id: string;
  chapter: number;
  index: number;
  size: number;
  cells: CellDef[];
  maxMoves: number;
  optimal: number;
  /** nodes[k-1] = cell index of node k */
  nodes: number[];
  nodeCount: number;
  start: number;
  goal: number;
  /** partner[i] = other end of the portal at i, or -1 */
  partner: number[];
  /** all 8 neighbours of each cell (in-bounds) */
  around: number[][];
  gates: number[];
  /** cells that must all be visited before the last node (everything except walls and bonus stars) */
  required: number[];
  solution?: number[];
}

export type Status = 'playing' | 'solved' | 'failed';
export type FailReason = 'moves' | 'countdown' | 'trapped';

export interface FreezeRecord {
  center: number;
  /** locked while from <= moves < until */
  from: number;
  until: number;
}

export interface GameState {
  path: number[];
  used: boolean[];
  head: number;
  /** number of the next node to reach (2 at start) */
  nextNode: number;
  moves: number;
  flips: number;
  freezes: FreezeRecord[];
  bonuses: number[];
  status: Status;
  fail?: FailReason;
  /** cell index of a countdown cell that expired (for fail reason countdown) */
  failCell?: number;
}

export type InvalidReason =
  | 'not-adjacent'
  | 'finished'
  | 'dead'
  | 'used'
  | 'burned'
  | 'gate'
  | 'frozen'
  | 'expired'
  | 'order'
  | 'direction'
  | 'portal'
  | 'no-moves'
  | 'finish';

export interface InvalidMove {
  ok: false;
  reason: InvalidReason;
  cell: number;
  /** extra info: required direction, node number to reach first, remaining frozen moves */
  dir?: Dir;
  need?: number;
  remaining?: number;
}

export type MoveEvent =
  | { type: 'node'; n: number; cell: number }
  | { type: 'burn'; cell: number }
  | { type: 'teleport'; from: number; to: number; pair: number }
  | { type: 'freeze'; cell: number; around: number[] }
  | { type: 'switch'; cell: number; on: boolean; gates: number[] }
  | { type: 'bonus'; cell: number }
  | { type: 'countdown-warning'; cell: number; value: number };

export interface ValidMove {
  ok: true;
  state: GameState;
  events: MoveEvent[];
}

export type MoveResult = ValidMove | InvalidMove;
