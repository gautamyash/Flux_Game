import { GenSpec, Level, LevelDef, generateUntil, mulberry32, parseLevel } from '../engine';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cache = new Map<string, LevelDef>();

function build(id: string, specs: GenSpec[], seed: number, chapter: number, title: string): LevelDef {
  const hit = cache.get(id);
  if (hit) return hit;
  for (const spec of specs) {
    const def = generateUntil(spec, seed, { id, chapter, index: 1, title }, (d) => d.optimal >= spec.nodes + 2, 120);
    if (def) {
      cache.set(id, def);
      return def;
    }
  }
  // last resort: a trivial open board
  const fallback: LevelDef = {
    id,
    chapter,
    index: 1,
    size: 3,
    rows: ['1 . .', '. . .', '. . 2'],
    maxMoves: 10,
    optimal: 8,
    title,
  };
  cache.set(id, fallback);
  return fallback;
}

const full = { walk: 1, dead: 0, bonus: 0 } as const;
const plain = (size: number, slack = 2): GenSpec => ({ ...full, size, nodes: Math.round(size * 1.3) + 1, slack });

/** Daily puzzle: same board for everyone on a given date (7x7 or 8x8). */
export function dailyLevel(dateKey: string): Level {
  const seed = hashStr('flux-daily-' + dateKey);
  const rng = mulberry32(seed);
  const size = rng() < 0.5 ? 7 : 8;
  const withPortal = rng() < 0.4;
  const specs: GenSpec[] = [
    { ...full, size, nodes: withPortal ? size - 1 : size + 3, dir: 1 + Math.floor(rng() * 2), burn: rng() < 0.5 ? 1 : 0, tele: withPortal ? 1 : 0, gates: !withPortal && rng() < 0.4 ? 1 : 0, slack: 1 },
    { ...full, size, nodes: size + 3, dir: 2, slack: 1 },
    plain(size, 1),
  ];
  return parseLevel(build('daily-' + dateKey, specs, seed, 0, 'Daily'));
}

export function rushLevel(index: number, nonce: number): Level {
  const seed = hashStr(`rush-${nonce}-${index}`);
  const size = index < 3 ? 4 : index < 8 ? 5 : 6;
  const specs: GenSpec[] = [
    { ...full, size, nodes: size + 2, dir: index > 2 ? 1 : 0, burn: index > 5 ? 1 : 0, slack: 2 },
    plain(size, 3),
    plain(4, 3),
  ];
  return parseLevel(build(`rush-${nonce}-${index}`, specs, seed, 0, 'Rush'));
}

export function endlessLevel(index: number, nonce: number): Level {
  const seed = hashStr(`endless-${nonce}-${index}`);
  const size = Math.min(8, 4 + Math.floor(index / 2));
  const portal = index >= 6 && index % 2 === 0;
  const specs: GenSpec[] = [
    {
      ...full,
      size,
      nodes: portal ? size - 1 : size + 2,
      dir: index >= 2 ? 1 + Math.floor(index / 6) : 0,
      burn: index >= 4 ? 1 : 0,
      tele: portal ? 1 : 0,
      freeze: index >= 9 && !portal ? 1 : 0,
      gates: index >= 11 && !portal ? 1 : 0,
      slack: index > 10 ? 1 : 2,
    },
    { ...full, size, nodes: size + 2, dir: 1, slack: 2 },
    plain(size),
  ];
  return parseLevel(build(`endless-${nonce}-${index}`, specs, seed, 0, 'Endless'));
}

export function chaosLevel(index: number, nonce: number): Level {
  const seed = hashStr(`chaos-${nonce}-${index}`);
  const rng = mulberry32(seed);
  const pick = () => (rng() < 0.5 ? 1 : 0);
  const size = 6 + Math.floor(rng() * 3);
  const tele = pick();
  const spec: GenSpec = {
    ...full,
    size,
    nodes: tele ? size - 1 : size + 2,
    dir: pick(),
    burn: pick(),
    tele,
    freeze: pick(),
    gates: tele ? 0 : pick(),
    countdown: rng() < 0.3 ? 1 : 0,
    slack: 2,
  };
  const specs: GenSpec[] = [spec, { ...spec, freeze: 0, countdown: 0, gates: 0 }, { ...spec, freeze: 0, countdown: 0, gates: 0, tele: 0, burn: 0, nodes: size + 2 }, plain(size)];
  return parseLevel(build(`chaos-${nonce}-${index}`, specs, seed, 0, 'Chaos'));
}

export function practiceLevel(): Level {
  return parseLevel({
    id: 'practice',
    chapter: 0,
    index: 1,
    size: 3,
    rows: ['1 . 2', '. . .', '. . 3'],
    maxMoves: 10,
    optimal: 8,
    title: 'Practice',
  });
}
