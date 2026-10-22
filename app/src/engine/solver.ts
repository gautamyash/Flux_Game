import { applyMove, createState } from './game';
import { neighbors4 } from './level';
import { GameState, Level } from './types';

export interface SolveResult {
  status: 'solved' | 'unsolvable' | 'unknown';
  /** cells to enter, in order (teleport exits are implicit) */
  moves: number[];
  /** total move cost of the solution */
  cost: number;
  visited: number;
}

export interface SolveOptions {
  maxNodes?: number;
  /** upper bound for the total move cost (defaults to level.maxMoves) */
  cap?: number;
}

function man(size: number, a: number, b: number): number {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));
}

/** admissible lower bound on moves from cell a to cell b, aware of portals */
function lbPair(level: Level, a: number, b: number): number {
  const { size, partner } = level;
  let best = man(size, a, b);
  for (let i = 0; i < partner.length; i++) {
    const j = partner[i];
    if (j < 0) continue;
    // enter portal i (cost man(a,i)), exit at j free, then walk to b
    const v = man(size, a, i) + man(size, j, b);
    if (v < best) best = v;
  }
  return best;
}

export function solve(level: Level, from?: GameState, opts: SolveOptions = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 300000;
  const cap = Math.min(opts.cap ?? level.maxMoves, level.maxMoves);
  const start = from ?? createState(level);
  if (start.status === 'solved') return { status: 'solved', moves: [], cost: 0, visited: 0 };
  if (start.status === 'failed') return { status: 'unsolvable', moves: [], cost: 0, visited: 0 };

  // suffix[k] = lower bound from node k (1-based) to the goal through all later nodes
  const suffix = new Array<number>(level.nodeCount + 2).fill(0);
  for (let k = level.nodeCount - 1; k >= 1; k--) {
    suffix[k] = suffix[k + 1] + lbPair(level, level.nodes[k - 1], level.nodes[k]);
  }
  const lb = (st: GameState): number => {
    const target = level.nodes[st.nextNode - 1];
    return lbPair(level, st.head, target) + suffix[st.nextNode];
  };

  const freePairs = (st: GameState): number => {
    let n = 0;
    for (let i = 0; i < level.partner.length; i++) {
      const j = level.partner[i];
      if (j > i && !st.used[i] && !st.used[j]) n++;
    }
    return n;
  };
  /** every unvisited required cell must still be reachable, and enough moves must remain to fill them */
  const coverBound = (st: GameState): number => {
    const { size } = level;
    const seen = new Array<boolean>(level.cells.length).fill(false);
    const stack = [st.head];
    seen[st.head] = true;
    while (stack.length) {
      const c = stack.pop() as number;
      const nbs = neighbors4(level, c).slice();
      if (level.partner[c] >= 0) nbs.push(level.partner[c]);
      for (const n of nbs) {
        if (seen[n] || st.used[n] || level.cells[n].kind === 'dead') continue;
        seen[n] = true;
        stack.push(n);
      }
    }
    void size;
    let rem = 0;
    let burn = 0;
    for (const r of level.required) {
      if (st.used[r]) continue;
      if (!seen[r]) return Infinity;
      rem++;
      if (level.cells[r].kind === 'burn') burn++;
    }
    return rem - freePairs(st) + burn;
  };

  let visited = 0;
  let aborted = false;

  const keyOf = (st: GameState): string => {
    let k = '';
    for (let i = 0; i < st.used.length; i++) k += st.used[i] ? '1' : '0';
    k += `|${st.head}|${st.moves}|${st.flips % 2}`;
    for (const f of st.freezes) if (f.until > st.moves) k += `|f${f.center}:${f.from}:${f.until}`;
    return k;
  };

  let failed = new Set<string>();

  const dfs = (st: GameState, limit: number): number[] | null => {
    if (st.status === 'solved') return [];
    if (st.status === 'failed') return null;
    if (aborted) return null;
    if (st.moves + Math.max(lb(st), coverBound(st)) > limit) return null;
    const key = keyOf(st);
    if (failed.has(key)) return null;
    if (++visited > maxNodes) {
      aborted = true;
      return null;
    }
    const target = level.nodes[st.nextNode - 1];
    const cands: { to: number; next: GameState; score: number }[] = [];
    for (const n of neighbors4(level, st.head)) {
      const r = applyMove(level, st, n, false);
      if (!r.ok) continue;
      cands.push({ to: n, next: r.state, score: lbPair(level, r.state.head, target) + r.state.moves });
    }
    cands.sort((a, b) => a.score - b.score);
    for (const c of cands) {
      const sub = dfs(c.next, limit);
      if (sub) return [c.to, ...sub];
      if (aborted) return null;
    }
    failed.add(key);
    return null;
  };

  for (let limit = start.moves + Math.max(lb(start), coverBound(start)); limit <= cap; limit++) {
    failed = new Set<string>();
    const sol = dfs(start, limit);
    if (sol) {
      // compute true cost
      let s = start;
      for (const m of sol) {
        const r = applyMove(level, s, m, false);
        if (!r.ok) break;
        s = r.state;
      }
      return { status: 'solved', moves: sol, cost: s.moves, visited };
    }
    if (aborted) return { status: 'unknown', moves: [], cost: 0, visited };
  }
  return { status: 'unsolvable', moves: [], cost: 0, visited };
}
