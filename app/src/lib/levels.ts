import raw from '../levels/levels.json';
import { Level, LevelDef, parseLevel } from '../engine';
import { SkinId } from '../theme/tokens';

export const LEVEL_DEFS = raw as LevelDef[];
export interface CampaignWorld {
  id: number;
  name: string;
  description: string;
  theme: string;
  palette: { accent: string; glow: string };
  background: { from: string; to: string; treatment: string };
  motif: string;
  challenge: string;
  unlockAfterWorld: number | null;
  levelIds: string[];
  firstLevel: number;
  lastLevel: number;
}

export function campaignLevelId(number: number): string {
  // Keep the first 25 IDs byte-for-byte compatible with the five-world release.
  return `campaign-${String(number).padStart(number < 100 ? 2 : 3, '0')}`;
}

type WorldSeed = Omit<CampaignWorld, 'id' | 'unlockAfterWorld' | 'levelIds' | 'firstLevel' | 'lastLevel'>;
const WORLD_THEMES: WorldSeed[] = [
  { name: 'Neon Genesis', description: 'Find your path among the first stars.', theme: 'Cyan megacity', palette: { accent: '#32D6D0', glow: '#89FFF4' }, background: { from: '#06192B', to: '#102D4B', treatment: 'neon skyline' }, motif: '✦', challenge: 'Learn the path and checkpoint basics.' },
  { name: 'Inferno Core', description: 'Navigate the heat and hazards of the core.', theme: 'Volcanic energy', palette: { accent: '#F47A35', glow: '#FFC36D' }, background: { from: '#260D16', to: '#65240F', treatment: 'lava bands' }, motif: '✹', challenge: 'Longer routes through a growing grid.' },
  { name: 'Frozen Abyss', description: 'Cross icy routes and avoid frozen traps.', theme: 'Ice-blue crystals', palette: { accent: '#57BCEB', glow: '#C7F5FF' }, background: { from: '#071A38', to: '#174B72', treatment: 'ice shelves' }, motif: '❄', challenge: 'More checkpoints spread across the board.' },
  { name: 'Cosmic Rift', description: 'Bend your route through distant portals.', theme: 'Purple cosmic energy', palette: { accent: '#A77AF4', glow: '#E6C8FF' }, background: { from: '#160C34', to: '#3D1A68', treatment: 'nebula arcs' }, motif: '⟡', challenge: 'Plan a longer route through ordered nodes.' },
  { name: 'Ascension', description: 'Master every challenge and reach the finale.', theme: 'Golden celestial', palette: { accent: '#E9B944', glow: '#FFF2A4' }, background: { from: '#261B08', to: '#725217', treatment: 'sun halo' }, motif: '☼', challenge: 'The first campaign milestone.' },
  { name: 'Verdant Canopy', description: 'Trace hidden paths beneath the giant leaves.', theme: 'Emerald jungle', palette: { accent: '#55C878', glow: '#C6FF9E' }, background: { from: '#09281F', to: '#1B5737', treatment: 'layered canopy' }, motif: '❧', challenge: 'Checkpoint spacing begins to vary.' },
  { name: 'Sunken Temple', description: 'Follow ancient marks through flooded halls.', theme: 'Deep-water jade', palette: { accent: '#31C5B0', glow: '#A0FFE4' }, background: { from: '#06232E', to: '#125568', treatment: 'water columns' }, motif: '◈', challenge: 'Longer boards with more turns.' },
  { name: 'Sandglass Dunes', description: 'Find the route through shifting desert stone.', theme: 'Desert amber', palette: { accent: '#E2A94B', glow: '#FFE39A' }, background: { from: '#38200E', to: '#805027', treatment: 'dune bands' }, motif: '◇', challenge: 'More numbered checkpoints.' },
  { name: 'Thunder Plains', description: 'Cross bright paths under a restless sky.', theme: 'Storm violet', palette: { accent: '#A98BFF', glow: '#E0D6FF' }, background: { from: '#171936', to: '#373E78', treatment: 'lightning seams' }, motif: 'ϟ', challenge: 'Route length and checkpoint count increase.' },
  { name: 'Ironworks', description: 'Navigate the gears of a sleeping machine.', theme: 'Brass and steel', palette: { accent: '#D88D50', glow: '#FFD1A0' }, background: { from: '#20252B', to: '#59402D', treatment: 'machine plates' }, motif: '⚙', challenge: 'First five-world progression milestone.' },
  { name: 'Prism Caverns', description: 'Thread a path through refracting crystal.', theme: 'Prismatic teal', palette: { accent: '#45D5C7', glow: '#B5FFF1' }, background: { from: '#102638', to: '#245B6B', treatment: 'crystal facets' }, motif: '✧', challenge: 'Boards expand to five cells across.' },
  { name: 'Coral Expanse', description: 'Discover a route among reefs and pale sand.', theme: 'Coral sea', palette: { accent: '#F07E86', glow: '#FFD4C8' }, background: { from: '#143047', to: '#6B3D5A', treatment: 'reef shelves' }, motif: '❋', challenge: 'Checkpoint order stretches across wider boards.' },
  { name: 'Wraithwood', description: 'Keep your bearings in the quiet forest.', theme: 'Ghostly forest', palette: { accent: '#8DC9A5', glow: '#D1F4C8' }, background: { from: '#111D24', to: '#344B42', treatment: 'mist layers' }, motif: '☘', challenge: 'More route choices around each checkpoint.' },
  { name: 'Skyward Isles', description: 'Link the floating islands one step at a time.', theme: 'High-altitude blue', palette: { accent: '#68B7F2', glow: '#D2F2FF' }, background: { from: '#10233F', to: '#416C9C', treatment: 'cloud bands' }, motif: '⌁', challenge: 'Longer sequences on five-by-five boards.' },
  { name: 'Clockwork Citadel', description: 'Read the sequence hidden in the towers.', theme: 'Copper clockwork', palette: { accent: '#E49A57', glow: '#FFE0A8' }, background: { from: '#291A22', to: '#674229', treatment: 'gear silhouettes' }, motif: '⟳', challenge: 'Checkpoint arrangements become denser.' },
  { name: 'Moonlit Marsh', description: 'Follow faint lights across still water.', theme: 'Moonlit indigo', palette: { accent: '#A7A5F5', glow: '#E3E4FF' }, background: { from: '#10182F', to: '#303C66', treatment: 'moon pools' }, motif: '☾', challenge: 'Longer paths and more checkpoints.' },
  { name: 'Emberfall', description: 'Cross the glowing bridges above the magma.', theme: 'Falling embers', palette: { accent: '#FF754C', glow: '#FFD08B' }, background: { from: '#301016', to: '#742A25', treatment: 'ember trails' }, motif: '✺', challenge: 'A new board size raises route length.' },
  { name: 'Glass Desert', description: 'Read the route reflected in the dunes.', theme: 'Rose-gold glass', palette: { accent: '#E8A5A7', glow: '#FFE0C4' }, background: { from: '#34202A', to: '#80535C', treatment: 'glass dunes' }, motif: '⌑', challenge: 'Checkpoints are distributed across larger boards.' },
  { name: 'Leviathan Trench', description: 'Descend through the vast blue dark.', theme: 'Abyssal blue', palette: { accent: '#4EA8D7', glow: '#A1E6FF' }, background: { from: '#071B32', to: '#103E68', treatment: 'trench bands' }, motif: '≋', challenge: 'Longer routes with varied checkpoint counts.' },
  { name: 'Aurora Frontier', description: 'Follow the lights to the edge of the world.', theme: 'Aurora spectrum', palette: { accent: '#6FD8A7', glow: '#D0FFCF' }, background: { from: '#122544', to: '#315C75', treatment: 'aurora ribbons' }, motif: '✳', challenge: 'Third world-milestone journey.' },
  { name: 'Obsidian Labyrinth', description: 'Find the ordered route through black glass.', theme: 'Obsidian red', palette: { accent: '#E86672', glow: '#FFB0A9' }, background: { from: '#1B111A', to: '#4A202B', treatment: 'dark facets' }, motif: '⬡', challenge: 'Boards grow to six-by-six.' },
  { name: 'Starforge', description: 'Trace the constellations of a cosmic forge.', theme: 'Starlit cobalt', palette: { accent: '#7398FF', glow: '#C7D5FF' }, background: { from: '#0C1838', to: '#293F7C', treatment: 'star plates' }, motif: '✦', challenge: 'Six-by-six routes with denser checkpoints.' },
  { name: 'Wildwood', description: 'Follow living trails through the ancient grove.', theme: 'Moss and jade', palette: { accent: '#79C96F', glow: '#D7F5A5' }, background: { from: '#142417', to: '#355A34', treatment: 'root lines' }, motif: '❀', challenge: 'More checkpoint combinations.' },
  { name: 'Sunken Observatory', description: 'Chart a path through the drowned stars.', theme: 'Submerged sapphire', palette: { accent: '#53C4E8', glow: '#C5F6FF' }, background: { from: '#0A2436', to: '#1C5278', treatment: 'lens circles' }, motif: '◎', challenge: 'Long routes with shifting checkpoint positions.' },
  { name: 'Titan’s Spine', description: 'Climb the ancient ridge one marker at a time.', theme: 'Fossil gold', palette: { accent: '#D3A65A', glow: '#FFE2A3' }, background: { from: '#29231A', to: '#66522D', treatment: 'ridge strata' }, motif: '⌃', challenge: 'Fourth world-milestone journey.' },
  { name: 'Mirage Nexus', description: 'Choose the true sequence among reflections.', theme: 'Mirage magenta', palette: { accent: '#D978CB', glow: '#FFD3F2' }, background: { from: '#28162F', to: '#633566', treatment: 'mirror bands' }, motif: '◇', challenge: 'Boards expand to seven cells across.' },
  { name: 'Stormglass', description: 'Navigate clear crystal in a turbulent sky.', theme: 'Electric cyan', palette: { accent: '#49CFE4', glow: '#BCFBFF' }, background: { from: '#102435', to: '#315F75', treatment: 'storm shards' }, motif: 'ϟ', challenge: 'Longer routes across seven-by-seven boards.' },
  { name: 'Crystal Monastery', description: 'Follow the quiet geometry of the peaks.', theme: 'Glacier lavender', palette: { accent: '#B6A5F2', glow: '#EDE3FF' }, background: { from: '#1A1B38', to: '#4B4F80', treatment: 'crystal spires' }, motif: '✥', challenge: 'Checkpoint sequences become more demanding.' },
  { name: 'Abyssal Garden', description: 'Find a way through the luminous deep.', theme: 'Bioluminescent green', palette: { accent: '#55D7AC', glow: '#C4FFE2' }, background: { from: '#082528', to: '#175450', treatment: 'glowing fronds' }, motif: '❋', challenge: 'Seven-by-seven route variations.' },
  { name: 'Radiant Divide', description: 'Cross the bright line between two skies.', theme: 'Solar rose', palette: { accent: '#F58F8A', glow: '#FFE1B1' }, background: { from: '#32192A', to: '#70413F', treatment: 'split horizon' }, motif: '◉', challenge: 'Fifth world-milestone journey.' },
  { name: 'Rust Horizon', description: 'Read the old tracks across the red plain.', theme: 'Oxide orange', palette: { accent: '#DB754A', glow: '#FFC58A' }, background: { from: '#2E1C19', to: '#71402E', treatment: 'rust shelves' }, motif: '⌁', challenge: 'Boards grow to eight-by-eight.' },
  { name: 'Cloud Kingdom', description: 'Connect the towers above the clouds.', theme: 'Cloud pearl', palette: { accent: '#83BFF0', glow: '#E4F5FF' }, background: { from: '#1A2E4B', to: '#52769A', treatment: 'cloud terraces' }, motif: '☁', challenge: 'Long eight-by-eight routes.' },
  { name: 'Volcanic Crown', description: 'Climb the rim above the glowing crater.', theme: 'Magma crown', palette: { accent: '#F26B50', glow: '#FFD078' }, background: { from: '#310F18', to: '#772A1C', treatment: 'crater rings' }, motif: '△', challenge: 'Many checkpoints span the full board.' },
  { name: 'Sapphire Catacombs', description: 'Follow blue marks through buried halls.', theme: 'Sapphire stone', palette: { accent: '#608DFA', glow: '#C7D7FF' }, background: { from: '#111B3A', to: '#2B4178', treatment: 'buried arches' }, motif: '⌂', challenge: 'Checkpoint layouts vary across long routes.' },
  { name: 'Eclipse Valley', description: 'Keep the sequence through a changing shadow.', theme: 'Eclipse bronze', palette: { accent: '#D79C64', glow: '#FFE0AE' }, background: { from: '#211A25', to: '#55404A', treatment: 'eclipse bands' }, motif: '◐', challenge: 'Sixth world-milestone journey.' },
  { name: 'Spirit Grove', description: 'Trace the glowing path through old trees.', theme: 'Spirit mint', palette: { accent: '#70D5B7', glow: '#D1FFE8' }, background: { from: '#102828', to: '#285653', treatment: 'spirit wisps' }, motif: '❧', challenge: 'Eight-by-eight ordered checkpoints.' },
  { name: 'Solar Armada', description: 'Plot a route between the fleet’s beacons.', theme: 'Solar navy', palette: { accent: '#E4B854', glow: '#FFF1A8' }, background: { from: '#17213D', to: '#59432A', treatment: 'orbit lanes' }, motif: '☀', challenge: 'Long routes with dense beacon sequences.' },
  { name: 'Deep Space', description: 'Navigate a quiet field of distant markers.', theme: 'Void blue', palette: { accent: '#7F9CF5', glow: '#D6DEFF' }, background: { from: '#0A1028', to: '#222F5C', treatment: 'star field' }, motif: '·', challenge: 'A wide eight-by-eight route.' },
  { name: 'Celestial Archive', description: 'Unlock the route written among the stars.', theme: 'Archive violet', palette: { accent: '#B07CE8', glow: '#F0D5FF' }, background: { from: '#1A1234', to: '#49306B', treatment: 'orbit glyphs' }, motif: '⌘', challenge: 'More ordered waypoints across the grid.' },
  { name: 'Singularity Gate', description: 'Reach the far side of the collapsing field.', theme: 'Singularity teal', palette: { accent: '#4ED4C6', glow: '#C7FFF3' }, background: { from: '#091F2A', to: '#1C4A56', treatment: 'gravity rings' }, motif: '⦿', challenge: 'Seventh world-milestone journey.' },
  { name: 'Golden Orbit', description: 'Follow the measured path around the sun.', theme: 'Golden orbit', palette: { accent: '#EBC454', glow: '#FFF3B5' }, background: { from: '#28200E', to: '#655021', treatment: 'orbital bands' }, motif: '⦾', challenge: 'Final ten worlds use the largest boards.' },
  { name: 'Astral Ocean', description: 'Cross a sea of quiet constellations.', theme: 'Astral blue', palette: { accent: '#5EB9E8', glow: '#C9F2FF' }, background: { from: '#0A1E37', to: '#245278', treatment: 'star waves' }, motif: '≋', challenge: 'Long routes with varied waypoint sequences.' },
  { name: 'Dawnspire', description: 'Climb toward the first light beyond the rift.', theme: 'Dawn coral', palette: { accent: '#F18A71', glow: '#FFE2B2' }, background: { from: '#321B2A', to: '#805044', treatment: 'rising rays' }, motif: '↟', challenge: 'More markers on the largest grid.' },
  { name: 'Eventide Veil', description: 'Find the ordered path between day and night.', theme: 'Eventide plum', palette: { accent: '#BC83D8', glow: '#F3D5FF' }, background: { from: '#20172F', to: '#553B68', treatment: 'twilight veil' }, motif: '◒', challenge: 'Eight-by-eight route mastery.' },
  { name: 'Gravity Well', description: 'Hold your course around a shifting center.', theme: 'Gravity indigo', palette: { accent: '#7797ED', glow: '#D5E1FF' }, background: { from: '#101933', to: '#333B70', treatment: 'orbit spirals' }, motif: '◎', challenge: 'Long checkpoint chains.' },
  { name: 'Comet Bastion', description: 'Cross the bright trail to the outer wall.', theme: 'Comet icefire', palette: { accent: '#78D3DC', glow: '#FFF0C2' }, background: { from: '#10263A', to: '#4C4D62', treatment: 'comet trails' }, motif: '☄', challenge: 'Eighth world-milestone journey.' },
  { name: 'Eternal Garden', description: 'Complete the living pattern among the stars.', theme: 'Eternal jade', palette: { accent: '#71C987', glow: '#D8FFB5' }, background: { from: '#10251D', to: '#315A43', treatment: 'celestial leaves' }, motif: '❀', challenge: 'The final large-grid checkpoint patterns.' },
  { name: 'Infinite Loom', description: 'Weave every beacon into one continuous path.', theme: 'Infinite spectrum', palette: { accent: '#D980CE', glow: '#D5E5FF' }, background: { from: '#1C1739', to: '#55436F', treatment: 'woven ribbons' }, motif: '⌘', challenge: 'Long routes before the final ascent.' },
  { name: 'Crown of Worlds', description: 'Gather the last paths before the finale.', theme: 'World-crown gold', palette: { accent: '#E9C15C', glow: '#FFF5B8' }, background: { from: '#29200F', to: '#6A5125', treatment: 'crown rays' }, motif: '♕', challenge: 'Ninth world-milestone journey.' },
  { name: 'Ascension Finale', description: 'Complete the final route and bring the worlds together.', theme: 'Celestial finale', palette: { accent: '#FFE078', glow: '#FFFFFF' }, background: { from: '#22163F', to: '#75528F', treatment: 'converging halos' }, motif: '✹', challenge: 'The final 8×8 route and campaign finale.' },
];

export const CAMPAIGN_WORLDS: CampaignWorld[] = WORLD_THEMES.map((theme, index) => {
  const id = index + 1;
  const firstLevel = (id - 1) * 5 + 1;
  const lastLevel = firstLevel + 4;
  const size = 4 + Math.floor((id - 1) / 10);
  return {
    ...theme, id, firstLevel, lastLevel,
    unlockAfterWorld: id === 1 ? null : id - 1,
    levelIds: Array.from({ length: 5 }, (_, i) => campaignLevelId(firstLevel + i)),
    challenge: `${theme.challenge} ${size}×${size} grid.`,
  };
});

function snakePath(size: number): number[] {
  const path: number[] = [];
  for (let row = 0; row < size; row++) {
    for (let step = 0; step < size; step++) {
      const col = row % 2 === 0 ? step : size - 1 - step;
      path.push(row * size + col);
    }
  }
  return path;
}

function transformCell(cell: number, size: number, variant: number): number {
  let x = cell % size;
  let y = Math.floor(cell / size);
  if (variant >= 4) x = size - 1 - x;
  for (let turn = 0; turn < variant % 4; turn++) [x, y] = [size - 1 - y, x];
  return y * size + x;
}

function makeCampaignLevel(number: number): LevelDef {
  const worldId = Math.ceil(number / 5);
  const world = CAMPAIGN_WORLDS[worldId - 1];
  const size = 4 + Math.floor((worldId - 1) / 10);
  const serial = ((worldId - 1) % 10) * 5 + ((number - 1) % 5);
  const variant = serial % 8;
  const mask = serial + 1;
  const path = snakePath(size).map((cell) => transformCell(cell, size, variant));
  // Six stable interior cells encode a unique checkpoint layout for each level in this grid-size band.
  const signatures = [1, size, size + 1, size * 3 - 1, size * (size - 1) + 1, size * size - 2];
  const pathOrder = new Map(path.map((cell, i) => [cell, i]));
  const checkpointCells = [path[0], ...signatures.filter((_, bit) => (mask & (1 << bit)) !== 0), path[path.length - 1]];
  checkpointCells.sort((a, b) => (pathOrder.get(a) ?? 0) - (pathOrder.get(b) ?? 0));
  const cells = new Array<string>(size * size).fill('.');
  checkpointCells.forEach((cell, i) => { cells[cell] = String(i + 1); });
  const rows = Array.from({ length: size }, (_, row) => cells.slice(row * size, (row + 1) * size).join(' '));
  return {
    id: campaignLevelId(number), chapter: 9, index: number, size, rows,
    maxMoves: path.length + 4, optimal: path.length - 1, title: world.name,
    solution: path.slice(1),
  };
}

export const CAMPAIGN_LEVEL_DEFS: LevelDef[] = Array.from({ length: 250 }, (_, i) => makeCampaignLevel(i + 1));
export const ALL_LEVEL_DEFS = [...LEVEL_DEFS, ...CAMPAIGN_LEVEL_DEFS];

export function campaignLevelNumber(id: string): number {
  const def = CAMPAIGN_LEVEL_DEFS.find((d) => d.id === id);
  return def?.index ?? 0;
}

export function campaignWorldComplete(levels: Record<string, { stars: number }>, worldId: number): boolean {
  const world = CAMPAIGN_WORLDS.find((w) => w.id === worldId);
  return !!world && world.levelIds.every((id) => !!levels[id]);
}

export function campaignWorldUnlocked(levels: Record<string, { stars: number }>, worldId: number): boolean {
  return worldId === 1 || (worldId > 1 && campaignWorldComplete(levels, worldId - 1));
}

export function campaignLevelUnlocked(levels: Record<string, { stars: number }>, number: number): boolean {
  return number === 1 || (number > 1 && number <= CAMPAIGN_LEVEL_DEFS.length && !!levels[campaignLevelId(number - 1)]);
}

export function campaignCurrentLevel(levels: Record<string, { stars: number }>): number {
  return CAMPAIGN_LEVEL_DEFS.find((d) => !levels[d.id])?.index ?? CAMPAIGN_LEVEL_DEFS.length + 1;
}

export function newlyUnlockedCampaignWorld(
  before: Record<string, { stars: number }>, after: Record<string, { stars: number }>,
): CampaignWorld | null {
  return CAMPAIGN_WORLDS.find((world) => world.id > 1
    && !campaignWorldUnlocked(before, world.id) && campaignWorldUnlocked(after, world.id)) ?? null;
}

export function nextCampaignLevelId(id: string): string | null {
  const number = campaignLevelNumber(id);
  return number > 0 && number < CAMPAIGN_LEVEL_DEFS.length ? campaignLevelId(number + 1) : null;
}

export function campaignComplete(levels: Record<string, { stars: number }>): boolean {
  return CAMPAIGN_LEVEL_DEFS.every((d) => !!levels[d.id]);
}

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
    const def = ALL_LEVEL_DEFS.find((d) => d.id === id);
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
