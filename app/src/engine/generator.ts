import { applyMove, createState } from './game';
import { parseLevel, rowsFromCells } from './level';
import { CellDef, Dir, LevelDef } from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenSpec {
  size: number;
  nodes: number;
  /** walk length as a fraction of size*size */
  walk: number;
  /** probability that an off-walk cell becomes a dead cell */
  dead: number;
  dir?: number;
  burn?: number;
  tele?: number;
  freeze?: number;
  gates?: number;
  countdown?: number;
  bonus?: number;
  slack: number;
  /** plain open board (no mechanics): the generator guarantees a unique solution */
  open?: boolean;
  /** upper bound on checkpoints while making an open board unique */
  maxNodes?: number;
}

export interface GenMeta {
  id: string;
  chapter: number;
  index: number;
  title?: string;
}

function cheb(size: number, a: number, b: number): number {
  return Math.max(Math.abs(Math.floor(a / size) - Math.floor(b / size)), Math.abs((a % size) - (b % size)));
}

function dirOf(size: number, a: number, b: number): Dir {
  const d = b - a;
  if (d === -size) return 'u';
  if (d === size) return 'd';
  return d === 1 ? 'r' : 'l';
}

function randomWalk(size: number, len: number, rng: () => number): number[] | null {
  const minLen = Math.max(4, Math.floor(len * 0.9));
  let best: number[] | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const used = new Array<boolean>(size * size).fill(false);
    const nbrs = (cell: number): number[] => {
      const r = Math.floor(cell / size);
      const c = cell % size;
      const out: number[] = [];
      if (r > 0 && !used[cell - size]) out.push(cell - size);
      if (c < size - 1 && !used[cell + 1]) out.push(cell + 1);
      if (r < size - 1 && !used[cell + size]) out.push(cell + size);
      if (c > 0 && !used[cell - 1]) out.push(cell - 1);
      return out;
    };
    let cur = Math.floor(rng() * size * size);
    const path = [cur];
    used[cur] = true;
    while (path.length < len) {
      const opts = nbrs(cur);
      if (!opts.length) break;
      let pick = opts[Math.floor(rng() * opts.length)];
      if (rng() < 0.7) {
        // prefer cells that keep the walk alive (fewest onward options)
        let bestDeg = 9;
        for (const o of opts) {
          const d = nbrs(o).length;
          if (d < bestDeg || (d === bestDeg && rng() < 0.5)) {
            bestDeg = d;
            pick = o;
          }
        }
      }
      cur = pick;
      used[cur] = true;
      path.push(cur);
    }
    if (path.length >= len) return path;
    if (path.length >= minLen && (!best || path.length > best.length)) best = path;
  }
  return best;
}

/** random Hamiltonian path of the full grid: boustrophedon start, then many backbite moves */
export function hamiltonianPath(size: number, rng: () => number): number[] {
  const N = size * size;
  let P: number[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) P.push(r * size + (r % 2 === 0 ? c : size - 1 - c));
  const idx = new Array<number>(N);
  const reindex = () => P.forEach((cell, i) => (idx[cell] = i));
  reindex();
  const steps = N * 40;
  for (let s = 0; s < steps; s++) {
    const atTail = rng() < 0.5;
    if (!atTail) {
      P.reverse();
      reindex();
    }
    const e = P[N - 1];
    const r = Math.floor(e / size);
    const c = e % size;
    const nbs: number[] = [];
    if (r > 0) nbs.push(e - size);
    if (r < size - 1) nbs.push(e + size);
    if (c > 0) nbs.push(e - 1);
    if (c < size - 1) nbs.push(e + 1);
    const nb = nbs[Math.floor(rng() * nbs.length)];
    const j = idx[nb];
    if (j < N - 2) {
      const tail = P.slice(j + 1).reverse();
      P = P.slice(0, j + 1).concat(tail);
      reindex();
    }
    if (!atTail) {
      P.reverse();
      reindex();
    }
  }
  return P;
}

/** counts solutions (up to `limit`) of an open board with ordered checkpoints; returns -1 when the budget ran out */
export function searchSolutions(size: number, nodeCells: number[], limit = 2, budget = 400000, prefix?: number[]): { count: number; aborted: boolean; found: number[][] } {
  const N = size * size;
  const K = nodeCells.length;
  const nodeOf = new Array<number>(N).fill(0);
  nodeCells.forEach((c, i) => (nodeOf[c] = i + 1));
  const man = (a: number, b: number) => Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));
  const chain: number[] = new Array(K + 1).fill(0); // chain[k] = sum of man(node_i, node_i+1) for i>=k (1-based nodes)
  for (let k = K - 1; k >= 1; k--) chain[k] = chain[k + 1] + man(nodeCells[k - 1], nodeCells[k]);
  const visited = new Array<boolean>(N).fill(false);
  const nbr: number[][] = [];
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const l: number[] = [];
    if (r > 0) l.push(i - size);
    if (c < size - 1) l.push(i + 1);
    if (r < size - 1) l.push(i + size);
    if (c > 0) l.push(i - 1);
    nbr.push(l);
  }
  const final = nodeCells[K - 1];
  let count = 0;
  const found: number[][] = [];
  const trail: number[] = [];
  let spent = 0;
  let aborted = false;
  const stamp = new Array<number>(N).fill(0);
  let stampId = 0;
  const stack: number[] = [];

  const feasible = (head: number, cnt: number, next: number): boolean => {
    const remaining = N - cnt;
    if (remaining === 0) return true;
    // parity + length bound along the checkpoint chain
    const need = man(head, nodeCells[next - 1]) + chain[next];
    if (need > remaining || (need - remaining) % 2 !== 0) return false;
    // connectivity
    stampId++;
    stack.length = 0;
    stack.push(head);
    stamp[head] = stampId;
    let seen = 0;
    while (stack.length) {
      const c = stack.pop() as number;
      for (const n of nbr[c]) {
        if (visited[n] || stamp[n] === stampId) continue;
        stamp[n] = stampId;
        seen++;
        stack.push(n);
      }
    }
    if (seen !== remaining) return false;
    // dead ends
    for (let c = 0; c < N; c++) {
      if (visited[c]) continue;
      let deg = 0;
      for (const n of nbr[c]) if (!visited[n] || n === head) deg++;
      if (c === final) {
        if (deg === 0) return false;
      } else if (deg <= 1) return false;
    }
    return true;
  };

  const dfs = (head: number, cnt: number, next: number) => {
    if (aborted || count >= limit) return;
    if (++spent > budget) {
      aborted = true;
      return;
    }
    for (const n of nbr[head]) {
      if (visited[n]) continue;
      const k = nodeOf[n];
      let nn = next;
      if (k) {
        if (k !== next) continue;
        if (k === K && cnt !== N - 1) continue;
        nn = next + 1;
      }
      visited[n] = true;
      trail.push(n);
      if (cnt + 1 === N) {
        if (k === K) {
          count++;
          found.push(trail.slice());
        }
      } else if (feasible(n, cnt + 1, Math.min(nn, K))) dfs(n, cnt + 1, nn);
      trail.pop();
      visited[n] = false;
      if (aborted || count >= limit) return;
    }
  };

  const s0 = nodeCells[0];
  if (prefix && prefix.length) {
    prefix.forEach((c) => (visited[c] = true));
    const head = prefix[prefix.length - 1];
    let reached = 0;
    for (const c of prefix) if (nodeOf[c]) reached = Math.max(reached, nodeOf[c]);
    const nxt = Math.min(K, reached + 1);
    if (feasible(head, prefix.length, nxt)) dfs(head, prefix.length, reached + 1);
  } else {
    visited[s0] = true;
    if (feasible(s0, 1, 2)) dfs(s0, 1, 2);
  }
  return { count, aborted, found };
}

export function countSolutions(size: number, nodeCells: number[], limit = 2, budget = 400000): number {
  const r = searchSolutions(size, nodeCells, limit, budget);
  return r.aborted ? -1 : r.count;
}

function pick<T>(arr: T[], rng: () => number): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Build one candidate level from a seed. Returns null if it is unsolvable or the solver gave up. */
export function generateLevel(spec: GenSpec, seed: number, meta: GenMeta): LevelDef | null {
  const rng = mulberry32(seed);
  const { size } = spec;
  const w = spec.walk >= 1 ? hamiltonianPath(size, rng) : randomWalk(size, Math.max(spec.nodes + 2, Math.round(size * size * spec.walk)), rng);
  if (!w || w.length < spec.nodes + 2) return null;
  const L = w.length;

  // nodes along the walk
  const nodeAt = new Array<number>(L).fill(0);
  const nodeIdx: number[] = [0];
  for (let k = 1; k < spec.nodes - 1; k++) {
    const base = Math.round((k * (L - 1)) / (spec.nodes - 1));
    const jitter = Math.floor(rng() * 3) - 1;
    let idx = Math.max(nodeIdx[nodeIdx.length - 1] + 2, base + jitter);
    idx = Math.min(idx, L - 1 - 2 * (spec.nodes - 1 - k));
    nodeIdx.push(idx);
  }
  nodeIdx.push(L - 1);
  for (let i = 1; i < nodeIdx.length; i++) if (nodeIdx[i] <= nodeIdx[i - 1]) return null;
  nodeIdx.forEach((idx, k) => (nodeAt[idx] = k + 1));

  const cells: CellDef[] = Array.from({ length: size * size }, () => ({ kind: 'empty' }) as CellDef);
  const onWalk = new Set(w);
  const assigned = new Array<boolean>(size * size).fill(false);
  const reserved = new Array<boolean>(L).fill(false);
  const set = (cell: number, def: CellDef) => {
    cells[cell] = def;
    assigned[cell] = true;
  };
  nodeIdx.forEach((idx, k) => set(w[idx], { kind: 'node', n: k + 1 }));
  const free = (i: number) => i >= 1 && i <= L - 2 && !nodeAt[i] && !reserved[i] && !assigned[w[i]];

  // teleports (they reshape the walk, so first): A = w[i], B = w[j-1], the cells between become walls
  for (let p = 1; p <= (spec.tele ?? 0); p++) {
    const cands: [number, number][] = [];
    for (let i = 1; i <= L - 6; i++) {
      if (!free(i)) continue;
      const nn = nodeIdx.find((x) => x > i);
      if (nn === undefined) continue;
      for (let j = i + 4; j <= Math.min(nn, i + 9); j++) {
        let ok = true;
        for (let m = i; m < j; m++) if (!free(m)) { ok = false; break; }
        if (!ok) break;
        cands.push([i, j]);
      }
    }
    const c = pick(cands, rng);
    if (!c) return null;
    const [i, j] = c;
    set(w[i], { kind: 'tele', pair: p });
    set(w[j - 1], { kind: 'tele', pair: p });
    for (let m = i; m < j; m++) reserved[m] = true;
    for (let m = i + 1; m < j - 1; m++) set(w[m], { kind: 'dead' });
  }

  const place = (count: number, fn: (i: number) => boolean) => {
    let placed = 0;
    for (let t = 0; t < 80 && placed < count; t++) {
      const i = 1 + Math.floor(rng() * (L - 2));
      if (free(i) && fn(i)) placed++;
    }
    return placed === count;
  };

  if (!place(spec.dir ?? 0, (i) => {
    set(w[i], { kind: 'dir', dir: dirOf(size, w[i], w[i + 1]) });
    return true;
  })) return null;

  if (!place(spec.burn ?? 0, (i) => {
    set(w[i], { kind: 'burn' });
    return true;
  })) return null;

  if ((spec.gates ?? 0) > 0) {
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const s = 1 + Math.floor(rng() * Math.max(1, L - 5));
      if (!free(s)) continue;
      const cand: number[] = [];
      for (let g = s + 2; g <= L - 2; g++) if (free(g)) cand.push(g);
      if (cand.length < (spec.gates as number)) continue;
      const chosen: number[] = [];
      while (chosen.length < (spec.gates as number)) {
        const g = cand.splice(Math.floor(rng() * cand.length), 1)[0];
        chosen.push(g);
      }
      set(w[s], { kind: 'switch' });
      chosen.forEach((g) => set(w[g], { kind: 'gate', open: false }));
      ok = true;
    }
    if (!ok) return null;
  }

  if (!place(spec.freeze ?? 0, (i) => {
    for (let m = 1; m <= 4; m++) {
      const idx = i + m;
      if (idx > L - 1) break;
      if (reserved[idx]) return false;
      if (m >= 2 && cheb(size, w[idx], w[i]) < 2) return false;
      if (m <= 4 && assigned[w[idx]] && !nodeAt[idx]) return false;
    }
    set(w[i], { kind: 'freeze' });
    return true;
  })) return null;

  if (spec.countdown) {
    let placed = 0;
    for (let t = 0; t < 40 && placed < spec.countdown; t++) {
      const k = 1 + Math.floor(rng() * 4);
      if (!free(k)) continue;
      let extras = 0;
      for (let m = 0; m < k; m++) if (cells[w[m]].kind === 'burn') extras++;
      if (k + extras + 1 > 5) continue;
      const n0 = Math.min(5, k + extras + 1 + (rng() < 0.4 ? 1 : 0));
      set(w[k], { kind: 'count', n: n0 });
      placed++;
    }
    if (placed < spec.countdown) return null;
  }

  // bonus cells beside the walk
  for (let b = 0; b < (spec.bonus ?? 0); b++) {
    const options: number[] = [];
    for (let m = 1; m < L - 1; m++) {
      const r = Math.floor(w[m] / size);
      const c = w[m] % size;
      for (const x of [r > 0 ? w[m] - size : -1, c < size - 1 ? w[m] + 1 : -1, r < size - 1 ? w[m] + size : -1, c > 0 ? w[m] - 1 : -1]) {
        if (x >= 0 && !onWalk.has(x) && !assigned[x]) options.push(x);
      }
    }
    const x = pick(options, rng);
    if (x !== undefined) set(x, { kind: 'bonus' });
  }

  // every cell off the walk becomes a wall: the player must fill all remaining open cells
  for (let i = 0; i < cells.length; i++) {
    if (!onWalk.has(i) && !assigned[i]) cells[i] = { kind: 'dead' };
  }

  const rows = rowsFromCells(cells, size);
  const probe: LevelDef = {
    id: meta.id,
    chapter: meta.chapter,
    index: meta.index,
    size,
    rows,
    maxMoves: size * size * 2,
    optimal: 0,
    title: meta.title,
  };
  let level;
  try {
    level = parseLevel(probe);
  } catch {
    return null;
  }
  // replay the generating walk: it is the proof that the level is solvable
  let st = createState(level);
  const solution: number[] = [];
  for (let m = 1; m < L; m++) {
    const cell = w[m];
    if (cells[cell].kind === 'dead' || st.used[cell]) continue; // walls, and portal exits already visited
    const r = applyMove(level, st, cell);
    if (!r.ok) return null;
    st = r.state;
    solution.push(cell);
  }
  if (st.status !== 'solved') return null;
  return { ...probe, optimal: st.moves, maxMoves: st.moves + spec.slack, solution };
}

/**
 * Open board (no walls, no special cells), like a Zip puzzle: a random Hamiltonian path with evenly spread
 * checkpoints. Several candidate paths are tried and the least ambiguous one wins; small boards are
 * additionally tightened until the solution is unique.
 */
export function generateOpenLevel(spec: GenSpec, seed: number, meta: GenMeta): LevelDef | null {
  const rng = mulberry32(seed);
  const { size } = spec;
  const N = size * size;
  const K = Math.max(3, Math.min(spec.nodes, N - 2));
  const place = (w: number[]): Set<number> => {
    const chosen = new Set<number>([0, N - 1]);
    for (let k = 1; k < K - 1; k++) {
      const base = Math.round((k * (N - 1)) / (K - 1));
      chosen.add(Math.max(1, Math.min(N - 2, base + Math.floor(rng() * 3) - 1)));
    }
    void w;
    return chosen;
  };
  let best: { w: number[]; chosen: Set<number>; score: number } | null = null;
  const tries = size >= 7 ? 10 : 6;
  for (let t = 0; t < tries; t++) {
    const w = hamiltonianPath(size, rng);
    const chosen = place(w);
    const r = searchSolutions(size, [...chosen].sort((x, y) => x - y).map((i) => w[i]), 40, 25000);
    const score = r.aborted ? 1e6 : r.count;
    if (!best || score < best.score) best = { w, chosen, score };
    if (score <= 1) break;
  }
  if (!best) return null;
  const { w, chosen } = best;
  const sorted = () => [...chosen].sort((x, y) => x - y);
  if (size <= 6 && best.score > 1) {
    const cap = spec.maxNodes ?? Math.ceil(N * 0.4);
    for (let guard = 0; guard < N && chosen.size < cap; guard++) {
      const r = searchSolutions(size, sorted().map((i) => w[i]), 2, 60000);
      if (r.aborted || r.count <= 1) break;
      const f = r.found.find((q) => q.some((c, i) => c !== w[i + 1])) as number[] | undefined;
      let d = 1;
      if (f) {
        const alt = [w[0], ...f];
        while (d < N && alt[d] === w[d]) d++;
      }
      let added = false;
      for (let off = 0; off < 6 && !added; off++) {
        const i = Math.min(N - 2, d + off);
        if (!chosen.has(i)) {
          chosen.add(i);
          added = true;
        }
      }
      if (!added) break;
    }
  }
  const idxs = sorted();
  const cells: CellDef[] = Array.from({ length: N }, () => ({ kind: 'empty' }) as CellDef);
  idxs.forEach((i, k) => (cells[w[i]] = { kind: 'node', n: k + 1 }));
  const optimal = N - 1;
  return { id: meta.id, chapter: meta.chapter, index: meta.index, size, rows: rowsFromCells(cells, size), maxMoves: optimal + spec.slack, optimal, title: meta.title, solution: w.slice(1) };
}

/** Try consecutive seeds until a solvable level comes out. */
export function generateUntil(
  spec: GenSpec,
  seed: number,
  meta: GenMeta,
  accept: (def: LevelDef) => boolean = () => true,
  tries = 400,
): LevelDef | null {
  for (let t = 0; t < tries; t++) {
    const def = spec.open ? generateOpenLevel(spec, seed + t * 7919, meta) : generateLevel(spec, seed + t * 7919, meta);
    if (def && accept(def)) return def;
  }
  return null;
}
