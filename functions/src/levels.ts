import { Dir, LevelDef } from './types';

// Load static chapter levels (1-1 to 8-16) from levels.json
let chapterLevelsMap: Map<string, LevelDef> | null = null;
function getStaticChapterLevel(levelId: string): LevelDef | null {
  if (!chapterLevelsMap) {
    chapterLevelsMap = new Map();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const defs: LevelDef[] = require('./levels.json');
      for (const def of defs) {
        chapterLevelsMap.set(def.id, def);
      }
    } catch {
      /* ignore */
    }
  }
  return chapterLevelsMap.get(levelId) || null;
}

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

export function hamiltonianPath(size: number, rng: () => number): number[] {
  const N = size * size;
  let P: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      P.push(r * size + (r % 2 === 0 ? c : size - 1 - c));
    }
  }
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

function chebDist(size: number, a: number, b: number): number {
  return Math.max(Math.abs(Math.floor(a / size) - Math.floor(b / size)), Math.abs((a % size) - (b % size)));
}

function dirOfCells(size: number, a: number, b: number): Dir {
  const d = b - a;
  if (d === -size) return 'u';
  if (d === size) return 'd';
  return d === 1 ? 'r' : 'l';
}

function dirTokenFrom(dir: Dir): string {
  return { u: '^', r: '>', d: 'v', l: '<' }[dir];
}

const snake = (size: number) =>
  Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size);
    const col = i % size;
    return row * size + (row % 2 === 0 ? col : size - 1 - col);
  });

const BOSS_CELL_OVERRIDES: Record<number, Record<number, string>> = {
  1: {},
  2: { 1: 'dir', 4: 'dir', 8: 'dir' },
  3: { 1: 'B', 2: 'dir', 5: 'B', 8: 'dir' },
  4: { 1: 'dir', 4: 'T1', 5: 'T1', 8: 'B' },
  5: { 1: 'F', 5: 'B', 6: 'F' },
  6: { 1: 'S', 2: 'G', 4: 'dir', 10: 'G' },
  7: { 1: 'c5', 2: 'c7', 5: 'B', 8: 'F' },
  8: { 1: 'dir', 2: 'c5', 4: 'T1', 5: 'T1', 7: 'S', 8: 'F', 10: 'G', 12: 'B' },
};

export function makeBossLevel(chapter: number): LevelDef {
  const size = chapter <= 3 ? 4 : chapter <= 5 ? 5 : chapter <= 7 ? 6 : 7;
  const path = snake(size);
  const overrides = BOSS_CELL_OVERRIDES[chapter] || {};
  const specialIndices = new Set(Object.keys(overrides).map(Number));
  const checkpointPathIndices = [0];
  for (let checkpoint = 1; checkpoint < 5; checkpoint++) {
    let index = Math.round(((path.length - 1) * checkpoint) / 5);
    while (specialIndices.has(index) || checkpointPathIndices.includes(index)) index++;
    checkpointPathIndices.push(index);
  }
  checkpointPathIndices.push(path.length - 1);
  const tokenAtPathIndex = new Map<number, string>();
  for (const [indexText, configured] of Object.entries(overrides)) {
    const index = Number(indexText);
    if (configured === 'dir') {
      const delta = path[index + 1] - path[index];
      tokenAtPathIndex.set(index, delta === -size ? '^' : delta === size ? 'v' : delta === 1 ? '>' : '<');
    } else tokenAtPathIndex.set(index, configured);
  }
  const rows = Array.from({ length: size }, (_, row) => {
    const tokens = Array.from({ length: size }, (_, col) => {
      const cell = row * size + col;
      const pathIndex = path.indexOf(cell);
      const nodeIndex = checkpointPathIndices.indexOf(pathIndex);
      return nodeIndex >= 0 ? String(nodeIndex + 1) : tokenAtPathIndex.get(pathIndex) ?? '.';
    });
    return tokens.join(' ');
  });
  const enteredPath: number[] = [];
  let movesForSolution = 0;
  for (let i = 1; i < path.length; i++) {
    const token = tokenAtPathIndex.get(i);
    if (tokenAtPathIndex.get(i - 1)?.startsWith('T') && token?.startsWith('T')) continue;
    enteredPath.push(path[i]);
    movesForSolution += token === 'B' ? 2 : 1;
  }
  const moveLimit = movesForSolution + 2;

  return {
    id: `boss-${String(chapter).padStart(2, '0')}`,
    size,
    rows,
    maxMoves: moveLimit,
    optimal: movesForSolution,
  };
}

export function campaignLevelId(number: number): string {
  return `campaign-${String(number).padStart(number < 100 ? 2 : 3, '0')}`;
}

export function makeCampaignLevel(number: number): LevelDef {
  const worldId = Math.ceil(number / 5);
  const levelInWorld = ((number - 1) % 5) + 1;
  const size = 4 + Math.floor((worldId - 1) / 10);
  const N = size * size;

  const seed = (number * 2654435761) ^ (worldId * 1013904223) ^ 0x85ebca6b;
  const rng = mulberry32(seed);

  const path = hamiltonianPath(size, rng);

  const kCount = Math.min(Math.floor(N / 3), 4 + Math.floor((size - 4) * 1.5) + (levelInWorld % 2));

  const checkpointIndices = [0];
  for (let k = 1; k < kCount - 1; k++) {
    const ideal = Math.round(((N - 1) * k) / (kCount - 1));
    const jitter = Math.floor(rng() * 3) - 1;
    const candidate = Math.max(
      checkpointIndices[k - 1] + 2,
      Math.min(N - 2 - (kCount - 1 - k) * 2, ideal + jitter)
    );
    checkpointIndices.push(candidate);
  }
  checkpointIndices.push(N - 1);

  const checkpointIndexSet = new Set(checkpointIndices);
  const availableIndices = Array.from({ length: N }, (_, i) => i).filter((i) => !checkpointIndexSet.has(i));

  const tokenAtPathIndex = new Map<number, string>();

  const tier = Math.ceil(worldId / 10);
  const cycle = ((worldId - 1) % 5) + 1;
  const isMystery = levelInWorld === 5;

  const canHaveDir = worldId >= 2;
  const canHaveBurn = (worldId >= 3 && cycle % 2 === 1) || tier >= 3;
  const canHaveFreeze = (worldId >= 4 && (cycle === 3 || cycle === 4)) || tier >= 4;
  const canHaveSwitchGate = (worldId >= 5 && (cycle === 5 || cycle === 1 || cycle === 2)) || tier >= 3;
  const canHaveCountdown = (worldId >= 7 && (cycle === 2 || cycle === 4 || isMystery)) || tier >= 4;

  if (canHaveSwitchGate && levelInWorld >= 2 && availableIndices.length >= 4) {
    const validPairs: [number, number][] = [];
    for (let a = 0; a < availableIndices.length; a++) {
      for (let b = a + 1; b < availableIndices.length; b++) {
        const j = availableIndices[a];
        const k = availableIndices[b];
        if (k - j >= 3 && k < N - 1) {
          validPairs.push([j, k]);
        }
      }
    }
    if (validPairs.length > 0) {
      const pair = validPairs[Math.floor(rng() * validPairs.length)];
      tokenAtPathIndex.set(pair[0], 'S');
      tokenAtPathIndex.set(pair[1], 'G');
      const idxA = availableIndices.indexOf(pair[0]);
      if (idxA >= 0) availableIndices.splice(idxA, 1);
      const idxB = availableIndices.indexOf(pair[1]);
      if (idxB >= 0) availableIndices.splice(idxB, 1);
    }
  }

  if (canHaveCountdown && levelInWorld >= 2 && availableIndices.length > 0) {
    const earlyCandidates = availableIndices.filter((idx) => idx >= 1 && idx <= 4);
    if (earlyCandidates.length > 0) {
      const idx = earlyCandidates[Math.floor(rng() * earlyCandidates.length)];
      const countVal = Math.min(5, Math.max(2, idx + 1));
      tokenAtPathIndex.set(idx, `c${countVal}`);
      const pos = availableIndices.indexOf(idx);
      if (pos >= 0) availableIndices.splice(pos, 1);
    }
  }

  if (canHaveFreeze && levelInWorld >= 3 && availableIndices.length > 0) {
    const freezeCandidates = availableIndices.filter((idx) => {
      if (idx + 4 >= N) return false;
      return (
        chebDist(size, path[idx], path[idx + 2]) >= 2 &&
        chebDist(size, path[idx], path[idx + 3]) >= 2 &&
        chebDist(size, path[idx], path[idx + 4]) >= 2
      );
    });
    if (freezeCandidates.length > 0) {
      const idx = freezeCandidates[Math.floor(rng() * freezeCandidates.length)];
      tokenAtPathIndex.set(idx, 'F');
      const pos = availableIndices.indexOf(idx);
      if (pos >= 0) availableIndices.splice(pos, 1);
    }
  }

  if (canHaveBurn && levelInWorld >= 2 && availableIndices.length > 0) {
    const maxBurn = size >= 7 ? 2 : 1;
    const burnCount = Math.min(maxBurn, availableIndices.length);
    for (let b = 0; b < burnCount; b++) {
      if (!availableIndices.length) break;
      const pickIdx = Math.floor(rng() * availableIndices.length);
      const idx = availableIndices[pickIdx];
      tokenAtPathIndex.set(idx, 'B');
      availableIndices.splice(pickIdx, 1);
    }
  }

  if (canHaveDir && availableIndices.length > 0) {
    const dirCount = Math.min(size >= 6 ? 3 : 2, availableIndices.length);
    for (let d = 0; d < dirCount; d++) {
      if (!availableIndices.length) break;
      const pickIdx = Math.floor(rng() * availableIndices.length);
      const idx = availableIndices[pickIdx];
      if (idx < N - 1) {
        const dir = dirOfCells(size, path[idx], path[idx + 1]);
        tokenAtPathIndex.set(idx, dirTokenFrom(dir));
      }
      availableIndices.splice(pickIdx, 1);
    }
  }

  const checkpointMap = new Map<number, number>();
  checkpointIndices.forEach((cellIdx, i) => checkpointMap.set(path[cellIdx], i + 1));

  const cells = new Array<string>(N).fill('.');
  for (let cell = 0; cell < N; cell++) {
    const nodeNum = checkpointMap.get(cell);
    if (nodeNum !== undefined) {
      cells[cell] = String(nodeNum);
    } else {
      const pathIdx = path.indexOf(cell);
      const tok = tokenAtPathIndex.get(pathIdx);
      cells[cell] = tok ?? '.';
    }
  }

  const rows = Array.from({ length: size }, (_, row) =>
    cells.slice(row * size, (row + 1) * size).join(' ')
  );

  let solutionMoves = 0;
  for (let i = 1; i < path.length; i++) {
    const tok = tokenAtPathIndex.get(i);
    solutionMoves += tok === 'B' ? 2 : 1;
  }
  const slack = size >= 7 ? 4 : size >= 5 ? 3 : 2;
  const maxMoves = solutionMoves + slack;

  return {
    id: campaignLevelId(number),
    size,
    rows,
    maxMoves,
    optimal: solutionMoves,
  };
}

export function campaignBossLevelId(world: number): string {
  return `campaign-boss-${String(world).padStart(2, '0')}`;
}

export function makeCampaignBoss(worldId: number): LevelDef {
  const size = 4 + Math.floor((worldId - 1) / 10);
  const N = size * size;

  const seed = (worldId * 73856093) ^ 0x5bd1e995;
  const rng = mulberry32(seed);

  const path = hamiltonianPath(size, rng);

  const kCount = Math.min(Math.floor(N / 3), size >= 7 ? 6 : 5);
  const checkpointIndices = [0];
  for (let k = 1; k < kCount - 1; k++) {
    const ideal = Math.round(((N - 1) * k) / (kCount - 1));
    const jitter = Math.floor(rng() * 3) - 1;
    const candidate = Math.max(
      checkpointIndices[k - 1] + 2,
      Math.min(N - 2 - (kCount - 1 - k) * 2, ideal + jitter)
    );
    checkpointIndices.push(candidate);
  }
  checkpointIndices.push(N - 1);

  const checkpointIndexSet = new Set(checkpointIndices);
  const availableIndices = Array.from({ length: N }, (_, i) => i).filter((i) => !checkpointIndexSet.has(i));

  const tokenAtPathIndex = new Map<number, string>();

  if (worldId >= 5 && availableIndices.length >= 4) {
    const validPairs: [number, number][] = [];
    for (let a = 0; a < availableIndices.length; a++) {
      for (let b = a + 1; b < availableIndices.length; b++) {
        const j = availableIndices[a];
        const k = availableIndices[b];
        if (k - j >= 3 && k < N - 1) {
          validPairs.push([j, k]);
        }
      }
    }
    if (validPairs.length > 0) {
      const pair = validPairs[Math.floor(rng() * validPairs.length)];
      tokenAtPathIndex.set(pair[0], 'S');
      tokenAtPathIndex.set(pair[1], 'G');
      const idxA = availableIndices.indexOf(pair[0]);
      if (idxA >= 0) availableIndices.splice(idxA, 1);
      const idxB = availableIndices.indexOf(pair[1]);
      if (idxB >= 0) availableIndices.splice(idxB, 1);
    }
  }

  if (worldId >= 10 && availableIndices.length > 0) {
    const earlyCandidates = availableIndices.filter((idx) => idx >= 1 && idx <= 4);
    if (earlyCandidates.length > 0) {
      const idx = earlyCandidates[Math.floor(rng() * earlyCandidates.length)];
      const countVal = Math.min(5, Math.max(2, idx + 1));
      tokenAtPathIndex.set(idx, `c${countVal}`);
      const pos = availableIndices.indexOf(idx);
      if (pos >= 0) availableIndices.splice(pos, 1);
    }
  }

  if (worldId >= 15 && availableIndices.length > 0) {
    const freezeCandidates = availableIndices.filter((idx) => {
      if (idx + 4 >= N) return false;
      return (
        chebDist(size, path[idx], path[idx + 2]) >= 2 &&
        chebDist(size, path[idx], path[idx + 3]) >= 2 &&
        chebDist(size, path[idx], path[idx + 4]) >= 2
      );
    });
    if (freezeCandidates.length > 0) {
      const idx = freezeCandidates[Math.floor(rng() * freezeCandidates.length)];
      tokenAtPathIndex.set(idx, 'F');
      const pos = availableIndices.indexOf(idx);
      if (pos >= 0) availableIndices.splice(pos, 1);
    }
  }

  if (worldId >= 8 && availableIndices.length > 0) {
    const burnCount = Math.min(size >= 7 ? 2 : 1, availableIndices.length);
    for (let b = 0; b < burnCount; b++) {
      if (!availableIndices.length) break;
      const pickIdx = Math.floor(rng() * availableIndices.length);
      const idx = availableIndices[pickIdx];
      tokenAtPathIndex.set(idx, 'B');
      availableIndices.splice(pickIdx, 1);
    }
  }

  if (worldId >= 3 && availableIndices.length > 0) {
    const dirCount = Math.min(size >= 6 ? 3 : 2, availableIndices.length);
    for (let d = 0; d < dirCount; d++) {
      if (!availableIndices.length) break;
      const pickIdx = Math.floor(rng() * availableIndices.length);
      const idx = availableIndices[pickIdx];
      if (idx < N - 1) {
        const dir = dirOfCells(size, path[idx], path[idx + 1]);
        tokenAtPathIndex.set(idx, dirTokenFrom(dir));
      }
      availableIndices.splice(pickIdx, 1);
    }
  }

  const checkpointMap = new Map<number, number>();
  checkpointIndices.forEach((cellIdx, i) => checkpointMap.set(path[cellIdx], i + 1));

  const cells = new Array<string>(N).fill('.');
  for (let cell = 0; cell < N; cell++) {
    const nodeNum = checkpointMap.get(cell);
    if (nodeNum !== undefined) {
      cells[cell] = String(nodeNum);
    } else {
      const pathIdx = path.indexOf(cell);
      const tok = tokenAtPathIndex.get(pathIdx);
      cells[cell] = tok ?? '.';
    }
  }

  const rows = Array.from({ length: size }, (_, row) =>
    cells.slice(row * size, (row + 1) * size).join(' ')
  );

  let solutionMoves = 0;
  for (let i = 1; i < path.length; i++) {
    const tok = tokenAtPathIndex.get(i);
    solutionMoves += tok === 'B' ? 2 : 1;
  }
  const moveLimit = solutionMoves + (size >= 7 ? 3 : 2);

  return {
    id: campaignBossLevelId(worldId),
    size,
    rows,
    maxMoves: moveLimit,
    optimal: solutionMoves,
  };
}

// In-memory cache for procedurally generated levels
const levelCache = new Map<string, LevelDef>();

/**
 * Authoritatively retrieves or deterministically computes any legitimate FLUX level definition.
 * Returns null if the level ID is unknown, preventing fabricated level exploits.
 */
export function getAuthoritativeLevelDef(levelId: string): LevelDef | null {
  if (!levelId || typeof levelId !== 'string') return null;

  // 1. Static Chapter levels (1-1 to 8-16)
  const staticDef = getStaticChapterLevel(levelId);
  if (staticDef) return staticDef;

  // 2. Check procedural level cache
  const cached = levelCache.get(levelId);
  if (cached) return cached;

  // 3. Chapter Boss levels: boss-01 to boss-08 (or boss-1 to boss-8)
  const bossMatch = /^boss-0?([1-8])$/.exec(levelId);
  if (bossMatch) {
    const chapter = Number(bossMatch[1]);
    const def = makeBossLevel(chapter);
    def.id = levelId;
    levelCache.set(levelId, def);
    return def;
  }

  // 4. Campaign Boss levels: campaign-boss-01 to campaign-boss-50 (or campaign-boss-1 to campaign-boss-50)
  const campBossMatch = /^campaign-boss-0?([1-9]|[1-4][0-9]|50)$/.exec(levelId);
  if (campBossMatch) {
    const worldId = Number(campBossMatch[1]);
    const def = makeCampaignBoss(worldId);
    def.id = levelId;
    levelCache.set(levelId, def);
    return def;
  }

  // 5. Campaign Progression levels: campaign-01 to campaign-250 (or campaign-1 to campaign-250)
  const campMatch = /^campaign-0*([1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|250)$/.exec(levelId);
  if (campMatch) {
    const num = Number(campMatch[1]);
    const def = makeCampaignLevel(num);
    def.id = levelId;
    levelCache.set(levelId, def);
    return def;
  }

  return null;
}

