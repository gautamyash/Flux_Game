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

export function cellToken(c: CellDef): string {
  switch (c.kind) {
    case 'empty':
      return '.';
    case 'dead':
      return '#';
    case 'dir':
      return { u: '^', r: '>', d: 'v', l: '<' }[c.dir as Dir];
    case 'burn':
      return 'B';
    case 'freeze':
      return 'F';
    case 'switch':
      return 'S';
    case 'gate':
      return c.open ? 'g' : 'G';
    case 'bonus':
      return '*';
    case 'tele':
      return `T${c.pair}`;
    case 'count':
      return `c${c.n}`;
    case 'node':
      return String(c.n);
  }
}

export function rowsFromCells(cells: CellDef[], size: number): string[] {
  const rows: string[] = [];
  for (let r = 0; r < size; r++) {
    rows.push(cells.slice(r * size, r * size + size).map(cellToken).join(' '));
  }
  return rows;
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
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
      }
    }
    around.push(list);
  }
  return {
    id: def.id,
    chapter: def.chapter,
    index: def.index,
    size,
    cells,
    maxMoves: def.maxMoves,
    optimal: def.optimal,
    nodes,
    nodeCount,
    start: nodes[0],
    goal: nodes[nodeCount - 1],
    partner,
    around,
    gates,
    solution: def.solution,
    required: cells.map((c, i) => (c.kind === 'dead' || c.kind === 'bonus' ? -1 : i)).filter((i) => i >= 0),
  };
}

export function rcOf(level: Level, i: number): { r: number; c: number } {
  return { r: Math.floor(i / level.size), c: i % level.size };
}

/** direction of a single orthogonal step from a to b, or null */
export function stepDir(size: number, a: number, b: number): Dir | null {
  const d = b - a;
  if (d === -size) return 'u';
  if (d === size) return 'd';
  if (d === 1 && Math.floor(a / size) === Math.floor(b / size)) return 'r';
  if (d === -1 && Math.floor(a / size) === Math.floor(b / size)) return 'l';
  return null;
}

export function neighbors4(level: Level, i: number): number[] {
  const { size } = level;
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  if (r > 0) out.push(i - size);
  if (c < size - 1) out.push(i + 1);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  return out;
}
