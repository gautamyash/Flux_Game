/* Generates src/levels/levels.json. Usage: npx tsx scripts/generate-levels.ts [chapter ...] */
import * as fs from 'fs';
import * as path from 'path';
import { GenSpec, LevelDef, generateUntil } from '../src/engine';

const OUT = path.join(__dirname, '..', 'src', 'levels', 'levels.json');
const COUNTS = [12, 12, 12, 12, 12, 12, 12, 16]; // 100 levels
let PER_CHAPTER = 12;

const lerp = (a: number, b: number, i: number) => Math.round(a + ((b - a) * i) / (PER_CHAPTER - 1));

const sz = (lo: number, hi: number, i: number) => Math.round(lo + ((hi - lo) * i) / (PER_CHAPTER - 1));
const nodesFor = (size: number, i: number) => Math.round(size * 1.15 + 1 + (i % 3));

function specFor(ch: number, i: number): GenSpec {
  const hard = i === PER_CHAPTER - 1; // special challenge
  const base = { walk: 1, dead: 0, bonus: 0 };
  switch (ch) {
    case 1: {
      const size = [4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 8][i];
      return { ...base, size, nodes: { 4: 5, 5: 7, 6: 9, 7: 11, 8: 14 }[size] as number, slack: 2, open: true };
    }
    case 2: {
      const size = sz(5, 7, i);
      return { ...base, size, nodes: nodesFor(size, i), dir: Math.min(5, 1 + Math.floor(i / 2)), slack: 2 };
    }
    case 3: {
      const size = sz(5, 7, i);
      return { ...base, size, nodes: nodesFor(size, i), burn: Math.min(3, 1 + Math.floor(i / 4)), dir: i >= 6 ? 1 : 0, slack: 2 };
    }
    case 4: {
      const size = sz(5, 8, i);
      return { ...base, size, nodes: size - 1, tele: i >= 8 ? 2 : 1, slack: hard ? 1 : 2 };
    }
    case 5: {
      const size = sz(6, 8, i);
      return { ...base, size, nodes: nodesFor(size, i), freeze: i >= 6 ? 2 : 1, slack: hard ? 1 : 2 };
    }
    case 6: {
      const size = sz(6, 8, i);
      return { ...base, size, nodes: nodesFor(size, i), gates: Math.min(3, 1 + Math.floor(i / 4)), slack: hard ? 1 : 2 };
    }
    case 7: {
      const size = sz(6, 8, i);
      return { ...base, size, nodes: nodesFor(size, i), countdown: i >= 6 ? 2 : 1, burn: i >= 9 ? 1 : 0, slack: hard ? 1 : 2 };
    }
    default: {
      const size = sz(7, 8, i);
      return {
        ...base,
        size,
        nodes: size - 1,
        dir: 1 + (i % 2),
        burn: i % 3 === 0 ? 1 : 0,
        tele: i >= 3 ? 1 : 0,
        freeze: i >= 5 ? 1 : 0,
        gates: i % 2 === 1 ? 1 : 0,
        countdown: i >= 8 ? 1 : 0,
        slack: 1,
      };
    }
  }
}

const TITLES = ['Basics', 'Direction', 'Hazards', 'Warp', 'Freeze', 'Switch', 'Pressure', 'Master'];

function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  let all: LevelDef[] = [];
  if (fs.existsSync(OUT)) all = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const chapters = only.length ? only : [1, 2, 3, 4, 5, 6, 7, 8];
  for (const ch of chapters) {
    all = all.filter((l) => l.chapter !== ch);
    const seen = new Set<string>();
    PER_CHAPTER = COUNTS[ch - 1];
    for (let i = 0; i < PER_CHAPTER; i++) {
      const spec = specFor(ch, i);
      const id = `${ch}-${i + 1}`;
      const seed = ch * 100003 + i * 1013 + 17;
      const def = generateUntil(
        spec,
        seed,
        { id, chapter: ch, index: i + 1, title: TITLES[ch - 1] },
        (d) => !seen.has(d.rows.join('/')) && d.optimal >= spec.nodes + 2,
        600,
      );
      if (!def) throw new Error(`Could not generate level ${id}`);
      seen.add(def.rows.join('/'));
      all.push(def);
      console.log(`level ${id}: size ${def.size} optimal ${def.optimal} max ${def.maxMoves}`);
    }
  }
  all.sort((a, b) => a.chapter - b.chapter || a.index - b.index);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1) + '\n');
  console.log(`wrote ${all.length} levels`);
}

main();
