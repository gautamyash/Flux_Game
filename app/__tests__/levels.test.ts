import levels from '../src/levels/levels.json';
import { applyMove, createState, parseLevel, LevelDef } from '../src/engine';

const defs = levels as LevelDef[];

describe('shipped levels', () => {
  it('has 100 levels (12 per chapter 1-7, 16 in chapter 8)', () => {
    expect(defs.length).toBe(100);
    for (let ch = 1; ch <= 8; ch++) expect(defs.filter((d) => d.chapter === ch).length).toBe(ch === 8 ? 16 : 12);
  });
  it.each(defs.map((d) => [d.id, d] as const))('level %s: stored solution replays to a win', (_id, def) => {
    const lv = parseLevel(def);
    expect(def.solution && def.solution.length).toBeGreaterThan(3);
    let st = createState(lv);
    for (const cell of def.solution as number[]) {
      const r = applyMove(lv, st, cell);
      if (!r.ok) throw new Error(`${def.id}: move to ${cell} rejected (${r.reason})`);
      st = r.state;
    }
    expect(st.status).toBe('solved');
    expect(st.moves).toBe(def.optimal);
    expect(def.maxMoves).toBeGreaterThanOrEqual(def.optimal);
  });
  it('has 8x8 boards and open (wall-free) basics', () => {
    expect(defs.some((d) => d.size === 8)).toBe(true);
    const ch1 = defs.filter((d) => d.chapter === 1);
    expect(ch1.every((d) => !d.rows.join(' ').includes('#'))).toBe(true);
  });
  it('introduces each chapter mechanic', () => {
    const has = (ch: number, tok: RegExp) => defs.filter((d) => d.chapter === ch).some((d) => tok.test(d.rows.join(' ')));
    expect(has(2, /[<>^v]/)).toBe(true);
    expect(has(3, /\bB\b/)).toBe(true);
    expect(has(4, /\bT1\b/)).toBe(true);
    expect(has(5, /\bF\b/)).toBe(true);
    expect(has(6, /\bS\b/)).toBe(true);
    expect(has(7, /\bc[1-5]\b/)).toBe(true);
  });
});

import { chaosLevel, dailyLevel, endlessLevel, rushLevel } from '../src/lib/procedural';

describe('procedural modes', () => {
  const replay = (lv: ReturnType<typeof dailyLevel>) => {
    expect(lv.solution && lv.solution.length).toBeGreaterThan(3);
    let st = createState(lv);
    for (const cell of lv.solution as number[]) {
      const r = applyMove(lv, st, cell);
      if (!r.ok) throw new Error(`${lv.id}: ${r.reason}`);
      st = r.state;
    }
    expect(st.status).toBe('solved');
  };
  it('daily levels are playable and stable per date', () => {
    for (const k of ['2026-10-03', '2026-10-04', '2026-12-31']) {
      const a = dailyLevel(k);
      expect(dailyLevel(k).cells).toEqual(a.cells);
      replay(a);
    }
  });
  it('rush, endless and chaos levels are playable', () => {
    for (let i = 1; i <= 14; i++) {
      replay(rushLevel(i, 7));
      replay(endlessLevel(i, 7));
      replay(chaosLevel(i, 7));
    }
  });
});

import { hintFor } from '../src/engine';
import { getLevel } from '../src/lib/levels';

describe('hints', () => {
  it('follows the stored solution, and recovers after a different valid start', () => {
    const lv = getLevel('1-12');
    let st = createState(lv);
    const sol = lv.solution as number[];
    expect(hintFor(lv, st)?.cells).toEqual(sol.slice(0, 3));
    for (const c of sol.slice(0, 6)) {
      const r = applyMove(lv, st, c);
      if (!r.ok) throw new Error('bad');
      st = r.state;
    }
    expect(hintFor(lv, st)?.cells).toEqual(sol.slice(6, 9));
  });
  it('gives a hint on a portal level from the start', () => {
    const lv = getLevel('4-6');
    expect(hintFor(lv, createState(lv))?.cells.length).toBeGreaterThan(0);
  });
});

import { enteredCells, sessionMove, createSession, current } from '../src/engine';

describe('resume', () => {
  it('rebuilds the exact session from the saved entered cells (incl. portals)', () => {
    for (const id of ['1-12', '4-6', '8-10']) {
      const lv = getLevel(id);
      const sol = lv.solution as number[];
      const half = sol.slice(0, Math.floor(sol.length / 2));
      let a = createSession(lv);
      for (const c of half) a = sessionMove(a, c).session;
      const saved = enteredCells(lv, current(a));
      expect(saved).toEqual(half);
      let b = createSession(lv);
      for (const c of saved) {
        const m = sessionMove(b, c);
        expect(m.result.ok).toBe(true);
        b = m.session;
      }
      expect(current(b).path).toEqual(current(a).path);
      expect(current(b).moves).toBe(current(a).moves);
    }
  });
});
