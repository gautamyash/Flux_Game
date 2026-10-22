import { GameState, Level } from './types';
import { searchSolutions } from './generator';
import { solve } from './solver';

/** cells the player actually entered (portal exits are implicit) */
export function enteredCells(level: Level, st: GameState): number[] {
  const out: number[] = [];
  for (let i = 1; i < st.path.length; i++) {
    const prev = st.path[i - 1];
    const c = st.path[i];
    if (level.cells[prev].kind === 'tele' && level.partner[prev] === c && out[out.length - 1] === prev) continue;
    out.push(c);
  }
  return out;
}

export interface Hint {
  /** next cells to enter */
  cells: number[];
  /** the current path cannot be finished: undo back to where it left the known route */
  undo: boolean;
}

/** Up to three upcoming cells of a route that still wins from the current state. */
export function hintFor(level: Level, st: GameState): Hint | null {
  const entered = enteredCells(level, st);
  const sol = level.solution;
  if (sol && entered.length <= sol.length && entered.every((c, i) => c === sol[i])) {
    return { cells: sol.slice(entered.length, entered.length + 3), undo: false };
  }
  const plain = level.cells.every((c) => c.kind === 'empty' || c.kind === 'node');
  if (plain) {
    const r = searchSolutions(level.size, level.nodes, 1, 200000, st.path);
    if (!r.aborted && r.found.length) return { cells: r.found[0].slice(0, 3), undo: false };
  } else {
    const r = solve(level, st, { maxNodes: 150000 });
    if (r.status === 'solved') return { cells: r.moves.slice(0, 3), undo: false };
  }
  if (sol) {
    let k = 0;
    while (k < entered.length && k < sol.length && entered[k] === sol[k]) k++;
    return { cells: sol.slice(k, k + 3), undo: true };
  }
  return null;
}
