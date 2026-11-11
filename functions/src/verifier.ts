import { CellDef, Dir, Level, LevelDef } from './types';

export function parseToken(tok: string): CellDef {
  if (tok === '.') return { kind: 'empty' };
  if (tok === '#') return { kind: 'dead' };
  if (tok === '^') return { kind: 'dir', dir: 'u' };
  if (tok === '>') return { kind: 'dir', dir: 'r' };
  if (tok === 'v') return { kind: 'dir', dir: 'd' };
  if (tok === '<') return { kind: 'dir', dir: 'l' };
  if (tok === 'B') return { kind: 'burn' };
  if (tok === 'F') return { kind: 'freeze' };
  if (tok === 'S') return { kind: 'switch' };
  if (tok === 'G') return { kind: 'gate', open: false };
  if (tok === 'g') return { kind: 'gate', open: true };
  if (tok === '*') return { kind: 'bonus' };
  if (/^T[1-3]$/.test(tok)) return { kind: 'tele', pair: Number(tok[1]) };
  if (/^c[1-5]$/.test(tok)) return { kind: 'count', n: Number(tok[1]) };
  if (/^[0-9]{1,2}$/.test(tok)) return { kind: 'node', n: Number(tok) };
  throw new Error(`Unknown token "${tok}"`);
}

export function parseLevel(def: LevelDef): Level {
  const size = def.size;
  if (def.rows.length !== size) throw new Error(`${def.id}: expected ${size} rows`);
  const cells: CellDef[] = [];
  for (const row of def.rows) {
    const toks = row.trim().split(/\s+/);
    if (toks.length !== size) throw new Error(`${def.id}: row "${row}" has ${toks.length} cells, expected ${size}`);
    for (const t of toks) cells.push(parseToken(t));
  }
  const nodeIdx: Record<number, number> = {};
  let nodeCount = 0;
  const partner = new Array<number>(cells.length).fill(-1);
  const pairs: Record<number, number[]> = {};
  const gates: number[] = [];
  cells.forEach((c, i) => {
    if (c.kind === 'node') {
      const n = c.n as number;
      if (nodeIdx[n] !== undefined) throw new Error(`${def.id}: duplicate node ${n}`);
      nodeIdx[n] = i;
      nodeCount = Math.max(nodeCount, n);
    } else if (c.kind === 'tele') {
      (pairs[c.pair as number] ||= []).push(i);
    } else if (c.kind === 'gate') {
      gates.push(i);
    }
  });
  if (nodeCount < 2) throw new Error(`${def.id}: need at least 2 nodes`);
  const nodes: number[] = [];
  for (let k = 1; k <= nodeCount; k++) {
    if (nodeIdx[k] === undefined) throw new Error(`${def.id}: missing node ${k}`);
    nodes.push(nodeIdx[k]);
  }
  for (const [p, list] of Object.entries(pairs)) {
    if (list.length !== 2) throw new Error(`${def.id}: teleport pair ${p} needs exactly 2 cells`);
    partner[list[0]] = list[1];
    partner[list[1]] = list[0];
  }
  const around: number[][] = [];
  for (let i = 0; i < cells.length; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const list: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) list.push(nr * size + nc);
      }
    }
    around.push(list);
  }
  const required: number[] = [];
  cells.forEach((c, i) => {
    if (c.kind !== 'dead') required.push(i);
  });
  return { id: def.id, size, cells, start: nodes[0], nodeCount, required, partner, around, gates, maxMoves: def.maxMoves };
}

export function stepDir(size: number, from: number, to: number): Dir | null {
  const fr = Math.floor(from / size);
  const fc = from % size;
  const tr = Math.floor(to / size);
  const tc = to % size;
  if (fr === tr && tc === fc + 1) return 'r';
  if (fr === tr && tc === fc - 1) return 'l';
  if (fc === tc && tr === fr + 1) return 'd';
  if (fc === tc && tr === fr - 1) return 'u';
  return null;
}

/**
 * Authoritatively verifies a player's complete solve path against the game rules.
 * Pure deterministic server-side game-engine verification.
 */
export function verifyLevelSolve(
  def: LevelDef,
  enteredPath: number[]
): { ok: boolean; reason?: string } {
  if (!Array.isArray(enteredPath) || enteredPath.length < 2) {
    return { ok: false, reason: 'Invalid path format.' };
  }

  let level: Level;
  try {
    level = parseLevel(def);
  } catch (e: any) {
    return { ok: false, reason: `Invalid level definition: ${e?.message ?? ''}` };
  }

  if (enteredPath[0] !== level.start) {
    return { ok: false, reason: 'Path does not start at node 1.' };
  }

  const { size } = level;
  const used = new Array<boolean>(level.cells.length).fill(false);
  used[level.start] = true;

  let head = level.start;
  let nextNode = 2;
  let moves = 0;
  let flips = 0;
  const freezes: { center: number; from: number; until: number }[] = [];

  for (let stepIdx = 1; stepIdx < enteredPath.length; stepIdx++) {
    const to = enteredPath[stepIdx];
    if (to < 0 || to >= level.cells.length) {
      return { ok: false, reason: `Cell ${to} out of bounds.` };
    }

    const dir = stepDir(size, head, to);
    if (!dir) {
      return { ok: false, reason: `Move from ${head} to ${to} is not orthogonally adjacent.` };
    }

    const fromCell = level.cells[head];
    if (fromCell.kind === 'dir' && fromCell.dir !== dir) {
      return { ok: false, reason: `Violated direction restriction at ${head}.` };
    }

    const toCell = level.cells[to];
    if (toCell.kind === 'dead') {
      return { ok: false, reason: `Stepped on dead cell at ${to}.` };
    }
    if (used[to]) {
      return { ok: false, reason: `Revisited cell at ${to}.` };
    }

    // Gate check
    if (toCell.kind === 'gate') {
      const open = flips % 2 === 0 ? !!toCell.open : !toCell.open;
      if (!open) {
        return { ok: false, reason: `Gate at ${to} was closed.` };
      }
    }

    // Freeze check
    for (const f of freezes) {
      if (moves >= f.from && moves < f.until && level.around[f.center].includes(to)) {
        return { ok: false, reason: `Cell at ${to} was frozen.` };
      }
    }

    // Countdown check when stepping onto countdown cell
    if (toCell.kind === 'count') {
      const remaining = toCell.n - moves;
      if (remaining <= 0) {
        return { ok: false, reason: `Countdown cell at ${to} expired before entry (moves: ${moves}, limit: ${toCell.n}).` };
      }
    }

    // Teleporter check
    if (toCell.kind === 'tele') {
      const partnerCell = level.partner[to];
      if (partnerCell < 0 || partnerCell >= level.cells.length) {
        return { ok: false, reason: `Invalid teleport partner for cell ${to}.` };
      }
      if (used[partnerCell]) {
        return { ok: false, reason: `Teleport partner ${partnerCell} was already used.` };
      }
    }

    // Node sequential order check
    if (toCell.kind === 'node') {
      const n = toCell.n;
      if (n > nextNode) {
        return { ok: false, reason: `Visited node ${n} before node ${nextNode}.` };
      }
      if (n === level.nodeCount) {
        // Last node: all required cells must be covered
        for (const req of level.required) {
          if (req !== to && !used[req]) {
            return { ok: false, reason: `Reached finish without covering required cell ${req}.` };
          }
        }
      }
      if (n === nextNode) {
        nextNode++;
      }
    }

    const moveCost = toCell.kind === 'burn' ? 2 : 1;
    moves += moveCost;
    if (moves > level.maxMoves) {
      return { ok: false, reason: 'Exceeded level max moves limit.' };
    }

    used[to] = true;
    head = to;

    // Apply special cell triggers
    if (toCell.kind === 'freeze') {
      freezes.push({ center: to, from: moves + 1, until: moves + 4 });
    } else if (toCell.kind === 'switch') {
      flips++;
    } else if (toCell.kind === 'tele') {
      const partnerCell = level.partner[to];
      used[partnerCell] = true;
      head = partnerCell;
      // If client path explicitly recorded the destination portal cell, consume it
      if (stepIdx + 1 < enteredPath.length && enteredPath[stepIdx + 1] === partnerCell) {
        stepIdx++;
      }
    }

    // Countdown check for all remaining unvisited countdown cells
    for (let cIdx = 0; cIdx < level.cells.length; cIdx++) {
      const cell = level.cells[cIdx];
      if (cell.kind === 'count' && !used[cIdx]) {
        if (moves >= cell.n) {
          return {
            ok: false,
            reason: `Countdown cell at ${cIdx} expired (moves: ${moves}, limit: ${cell.n}).`,
          };
        }
      }
    }
  }

  if (nextNode <= level.nodeCount) {
    return { ok: false, reason: `Did not reach all numbered nodes (reached up to ${nextNode - 1} of ${level.nodeCount}).` };
  }

  return { ok: true };
}
