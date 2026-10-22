import raw from '../levels/levels.json';
import { Level, LevelDef, parseLevel } from '../engine';
import { SkinId } from '../theme/tokens';

export const LEVEL_DEFS = raw as LevelDef[];
export const CHAPTERS = [
  { n: 1, name: 'Basics', mech: 'Numbers and a single path', cells: 'node' },
  { n: 2, name: 'Direction', mech: 'Direction cells', cells: 'dir' },
  { n: 3, name: 'Hazards', mech: 'Burn cells and walls', cells: 'burn' },
  { n: 4, name: 'Warp', mech: 'Teleport', cells: 'tele' },
  { n: 5, name: 'Freeze', mech: 'Freeze cells', cells: 'freeze' },
  { n: 6, name: 'Switch', mech: 'Switches and gates', cells: 'switch' },
  { n: 7, name: 'Pressure', mech: 'Countdown cells', cells: 'count' },
  { n: 8, name: 'Master', mech: 'Everything together', cells: 'tele' },
] as const;

const cache = new Map<string, Level>();
export function getLevel(id: string): Level {
  let lv = cache.get(id);
  if (!lv) {
    const def = LEVEL_DEFS.find((d) => d.id === id);
    if (!def) throw new Error(`Unknown level ${id}`);
    lv = parseLevel(def);
    cache.set(id, lv);
  }
  return lv;
}

export function levelsOfChapter(ch: number): LevelDef[] {
  return LEVEL_DEFS.filter((d) => d.chapter === ch);
}

export function nextLevelId(id: string): string | null {
  const i = LEVEL_DEFS.findIndex((d) => d.id === id);
  return i >= 0 && i + 1 < LEVEL_DEFS.length ? LEVEL_DEFS[i + 1].id : null;
}

export function levelNumber(id: string): number {
  return LEVEL_DEFS.findIndex((d) => d.id === id) + 1;
}

export type Mech = 'dir' | 'burn' | 'tele' | 'freeze' | 'switch' | 'count' | 'bonus';
export const MECH_LABEL: Record<Mech, string> = {
  dir: 'Direction',
  burn: 'Burn',
  tele: 'Teleport',
  freeze: 'Freeze',
  switch: 'Switch',
  count: 'Countdown',
  bonus: 'Bonus',
};

export function mechanicsOf(level: Level): Mech[] {
  const set = new Set<Mech>();
  for (const c of level.cells) {
    if (c.kind === 'dir' || c.kind === 'burn' || c.kind === 'tele' || c.kind === 'freeze' || c.kind === 'switch' || c.kind === 'count' || c.kind === 'bonus') {
      set.add(c.kind);
    }
  }
  return [...set];
}

export const MECH_INTRO: Record<Exclude<Mech, 'bonus'>, { title: string; body: string; kind: string }> = {
  dir: { title: 'Direction', body: 'The path must leave this cell in the arrow’s direction.', kind: 'dir' },
  burn: { title: 'Burn', body: 'Burn cells cost an extra move and burn out after you leave them.', kind: 'burn' },
  tele: { title: 'Teleport', body: 'Portals come in linked pairs. Step into one and your path continues from the other.', kind: 'tele' },
  freeze: { title: 'Freeze', body: 'Crossing a freeze cell locks its 8 neighbours for 3 moves, starting after your next step.', kind: 'freeze' },
  switch: { title: 'Switch', body: 'Crossing a switch flips every gate. Closed gates block you until the switch is on.', kind: 'switch' },
  count: { title: 'Countdown', body: 'Reach it before its number hits zero. Every move ticks it down.', kind: 'count' },
};

export function skinUnlocked(skin: SkinId, stars: number, chaptersDone: number[]): boolean {
  if (skin === 'ink') return stars >= 30;
  if (skin === 'sand') return chaptersDone.includes(6);
  return true;
}
