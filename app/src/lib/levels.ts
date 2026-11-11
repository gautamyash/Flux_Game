import raw from '../levels/levels.json';
import { Dir, Level, LevelDef, parseLevel, hamiltonianPath, mulberry32 } from '../engine';
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

function makeCampaignLevel(number: number): LevelDef {
  const worldId = Math.ceil(number / 5);
  const levelInWorld = ((number - 1) % 5) + 1;
  const world = CAMPAIGN_WORLDS[worldId - 1];
  const size = 4 + Math.floor((worldId - 1) / 10);
  const N = size * size;

  // High-dispersion deterministic seed per level
  const seed = (number * 2654435761) ^ (worldId * 1013904223) ^ 0x85ebca6b;
  const rng = mulberry32(seed);

  // Generate an organic, non-repeating Hamiltonian path covering all cells
  const path = hamiltonianPath(size, rng);

  // Checkpoint count scales with grid size and level in world
  const kCount = Math.min(
    Math.floor(N / 3),
    4 + Math.floor((size - 4) * 1.5) + (levelInWorld % 2)
  );

  // Distribute checkpoints evenly along path with slight jitter
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
  const availableIndices = Array.from({ length: N }, (_, i) => i)
    .filter((i) => !checkpointIndexSet.has(i));

  const tokenAtPathIndex = new Map<number, string>();

  // Determine mechanics profile based on world theme and progression tier
  const tier = Math.ceil(worldId / 10); // 1 to 5
  const cycle = ((worldId - 1) % 5) + 1; // 1 to 5 thematic flavour
  const isMystery = levelInWorld === 5;

  const canHaveDir = worldId >= 2;
  const canHaveBurn = (worldId >= 3 && cycle % 2 === 1) || tier >= 3;
  const canHaveFreeze = (worldId >= 4 && (cycle === 3 || cycle === 4)) || tier >= 4;
  const canHaveSwitchGate = (worldId >= 5 && (cycle === 5 || cycle === 1 || cycle === 2)) || tier >= 3;
  const canHaveCountdown = (worldId >= 7 && (cycle === 2 || cycle === 4 || isMystery)) || tier >= 4;

  // 1. Switch & Gate pair (requires S at j, G at k where j < k, spacing >= 3)
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

  // 2. Countdown tile (must be reachable in moves <= countVal, with countVal in 2..5)
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

  // 3. Freeze tile (verify that path moves at idx+2, idx+3, idx+4 are not adjacent to freeze center)
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

  // 4. Burn tiles (cost 2 moves each)
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

  // 5. Direction arrows
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

  // Build grid rows
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

  // Compute solution and move limits
  const solution = path.slice(1);
  let solutionMoves = 0;
  for (let i = 1; i < path.length; i++) {
    const tok = tokenAtPathIndex.get(i);
    solutionMoves += tok === 'B' ? 2 : 1;
  }
  const slack = size >= 7 ? 4 : size >= 5 ? 3 : 2;
  const maxMoves = solutionMoves + slack;

  // Mystery configuration for Level 5
  let mysteryConfig = undefined;
  if (isMystery) {
    const hiddenStepIndices = [
      Math.round(N * 0.25),
      Math.round(N * 0.5),
      Math.round(N * 0.75),
      ...(size >= 6 ? [Math.round(N * 0.85)] : []),
    ].filter((stepIdx) => stepIdx >= 1 && stepIdx < N - 1);
    const hiddenCells = hiddenStepIndices.map((idx) => path[idx]);
    mysteryConfig = {
      hiddenCells,
      initialHiddenCount: hiddenCells.length,
      discoverOn: 'enter' as const,
      difficulty: worldId > 35 ? ('expert' as const) : ('advanced' as const),
      objective: 'Discover the hidden cells and reach the final node in order.',
    };
  }

  return {
    id: campaignLevelId(number),
    chapter: 9,
    index: number,
    size,
    rows,
    maxMoves,
    optimal: solutionMoves,
    title: world.name,
    solution,
    mystery: mysteryConfig,
  };
}

export const CAMPAIGN_LEVEL_DEFS: LevelDef[] = Array.from({ length: 250 }, (_, i) => makeCampaignLevel(i + 1));

export function campaignLevelNumber(id: string): number {
  const def = CAMPAIGN_LEVEL_DEFS.find((d) => d.id === id);
  return def?.index ?? 0;
}

export function campaignWorldComplete(levels: Record<string, { stars: number }>, worldId: number): boolean {
  const world = CAMPAIGN_WORLDS.find((w) => w.id === worldId);
  return !!world && world.levelIds.every((id) => !!levels[id]) && !!levels[campaignBossLevelId(worldId)];
}

export function campaignWorldUnlocked(levels: Record<string, { stars: number }>, worldId: number): boolean {
  return worldId === 1 || (worldId > 1 && !!levels[campaignBossLevelId(worldId - 1)]);
}

export function campaignLevelUnlocked(levels: Record<string, { stars: number }>, number: number): boolean {
  if (number < 1 || number > CAMPAIGN_LEVEL_DEFS.length) return false;
  const worldId = Math.ceil(number / 5);
  return campaignWorldUnlocked(levels, worldId) && (number % 5 === 1 || !!levels[campaignLevelId(number - 1)]);
}

export function campaignBossUnlocked(levels: Record<string, { stars: number }>, worldId: number): boolean {
  const world = CAMPAIGN_WORLDS.find((w) => w.id === worldId);
  return !!world && campaignWorldUnlocked(levels, worldId) && world.levelIds.every((id) => !!levels[id]);
}

export function campaignCurrentLevel(levels: Record<string, { stars: number }>): number {
  const current = CAMPAIGN_PROGRESSION_DEFS.find((d) => !levels[d.id]);
  return current ? current.index : CAMPAIGN_PROGRESSION_DEFS.length + 1;
}

export function campaignCurrentDef(levels: Record<string, { stars: number }>): LevelDef {
  return CAMPAIGN_PROGRESSION_DEFS.find((d) => !levels[d.id]) ?? CAMPAIGN_PROGRESSION_DEFS[CAMPAIGN_PROGRESSION_DEFS.length - 1];
}

export function newlyUnlockedCampaignWorld(
  before: Record<string, { stars: number }>, after: Record<string, { stars: number }>,
): CampaignWorld | null {
  return CAMPAIGN_WORLDS.find((world) => world.id > 1
    && !campaignWorldUnlocked(before, world.id) && campaignWorldUnlocked(after, world.id)) ?? null;
}

export function nextCampaignLevelId(id: string): string | null {
  const index = CAMPAIGN_PROGRESSION_DEFS.findIndex((d) => d.id === id);
  return index >= 0 && index + 1 < CAMPAIGN_PROGRESSION_DEFS.length ? CAMPAIGN_PROGRESSION_DEFS[index + 1].id : null;
}

export function campaignComplete(levels: Record<string, { stars: number }>): boolean {
  return CAMPAIGN_PROGRESSION_DEFS.every((d) => !!levels[d.id]);
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

const snake = (size: number) => Array.from({ length: size * size }, (_, i) => {
  const row = Math.floor(i / size), col = i % size;
  return row * size + (row % 2 === 0 ? col : size - 1 - col);
});

const BOSS_CELL_OVERRIDES: Record<number, Record<number, string>> = {
  1: {},
  2: { 1: 'dir', 4: 'dir', 8: 'dir' },
  3: { 1: 'B', 2: 'dir', 5: 'B', 8: 'dir' },
  4: { 1: 'dir', 4: 'T1', 5: 'T1', 8: 'B' },
  // Leave two route steps between the freeze cell and its next affected route tile.
  5: { 1: 'F', 5: 'B', 6: 'F' },
  6: { 1: 'S', 2: 'G', 4: 'dir', 10: 'G' },
  7: { 1: 'c5', 2: 'c7', 5: 'B', 8: 'F' },
  8: { 1: 'dir', 2: 'c5', 4: 'T1', 5: 'T1', 7: 'S', 8: 'F', 10: 'G', 12: 'B' },
};

function makeBossLevel(chapter: number): LevelDef {
  const size = chapter <= 3 ? 4 : chapter <= 5 ? 5 : chapter <= 7 ? 6 : 7;
  const path = snake(size);
  const overrides = BOSS_CELL_OVERRIDES[chapter];
  const specialIndices = new Set(Object.keys(overrides).map(Number));
  const checkpointPathIndices = [0];
  for (let checkpoint = 1; checkpoint < 5; checkpoint++) {
    let index = Math.round((path.length - 1) * checkpoint / 5);
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
  const objective = chapter === 6 ? 'Activate the switch to open both gates.'
    : chapter === 7 ? 'Reach countdown cells before they expire.'
      : chapter === 8 ? 'Combine portals, direction, countdown, freeze, switches and burn.'
        : chapter === 5 ? 'Plan around freezing zones and burn costs.'
          : chapter === 4 ? 'Use the paired portals and follow the route.'
            : chapter === 3 ? 'Account for burn cells while completing the route.'
              : chapter === 2 ? 'Follow the arrows while reaching each checkpoint.'
                : 'Reach every cell and the final node in order.';
  const normalCount = LEVEL_DEFS.filter((def) => def.chapter === chapter).length;
  return {
    id: `boss-${String(chapter).padStart(2, '0')}`, chapter, index: normalCount + 1, size, rows,
    maxMoves: moveLimit, optimal: movesForSolution, title: `${CHAPTERS[chapter - 1].name} Boss`, solution: enteredPath,
    boss: {
      undoAllowance: 3, moveLimit,
      starThresholds: { three: movesForSolution, two: moveLimit },
      difficulty: chapter < 5 ? 'advanced' : 'expert', objective,
    },
  };
}

export const BOSS_LEVEL_DEFS = CHAPTERS.map(({ n }) => makeBossLevel(n));
const chapterMysteries = new Set(CHAPTERS.map(({ n }) => LEVEL_DEFS.filter((def) => def.chapter === n).at(-1)?.id).filter((id): id is string => !!id));
const mysteryDefs = LEVEL_DEFS.map((def) => chapterMysteries.has(def.id)
  ? {
      ...def,
      mystery: {
        hiddenCells: (def.solution ?? []).slice(1, 4),
        initialHiddenCount: Math.min(3, Math.max(0, (def.solution ?? []).slice(1, 4).length)),
        discoverOn: 'enter' as const,
        difficulty: 'advanced' as const,
        objective: 'Discover the hidden cells and reach the final node in order.',
      },
    }
  : def);

export function campaignBossLevelId(world: number): string {
  return `campaign-boss-${String(world).padStart(2, '0')}`;
}

function makeCampaignBoss(world: CampaignWorld): LevelDef {
  const size = 4 + Math.floor((world.id - 1) / 10);
  const N = size * size;

  // High-dispersion deterministic seed for boss
  const seed = (world.id * 73856093) ^ 0x5bd1e995;
  const rng = mulberry32(seed);

  // Organic Hamiltonian path for the boss lair
  const path = hamiltonianPath(size, rng);

  // Checkpoints: 5 to 6 nodes
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
  const availableIndices = Array.from({ length: N }, (_, i) => i)
    .filter((i) => !checkpointIndexSet.has(i));

  const tokenAtPathIndex = new Map<number, string>();

  // Boss combinations scale with worldId
  // 1. Switch & Gate
  if (world.id >= 5 && availableIndices.length >= 4) {
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

  // 2. Countdown pressure
  if (world.id >= 10 && availableIndices.length > 0) {
    const earlyCandidates = availableIndices.filter((idx) => idx >= 1 && idx <= 4);
    if (earlyCandidates.length > 0) {
      const idx = earlyCandidates[Math.floor(rng() * earlyCandidates.length)];
      const countVal = Math.min(5, Math.max(2, idx + 1));
      tokenAtPathIndex.set(idx, `c${countVal}`);
      const pos = availableIndices.indexOf(idx);
      if (pos >= 0) availableIndices.splice(pos, 1);
    }
  }

  // 3. Freeze trap
  if (world.id >= 15 && availableIndices.length > 0) {
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

  // 4. Burn tiles
  if (world.id >= 3 && availableIndices.length > 0) {
    const maxBurn = size >= 6 ? 2 : 1;
    for (let b = 0; b < maxBurn; b++) {
      if (!availableIndices.length) break;
      const pickIdx = Math.floor(rng() * availableIndices.length);
      const idx = availableIndices[pickIdx];
      tokenAtPathIndex.set(idx, 'B');
      availableIndices.splice(pickIdx, 1);
    }
  }

  // 5. Direction arrows
  if (availableIndices.length > 0) {
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

  // Build grid rows
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

  const solution = path.slice(1);
  let solutionMoves = 0;
  for (let i = 1; i < path.length; i++) {
    const tok = tokenAtPathIndex.get(i);
    solutionMoves += tok === 'B' ? 2 : 1;
  }
  const moveLimit = solutionMoves + 2;

  const objective = world.id > 40
    ? 'Master the 8×8 apex boss route with multi-mechanic coordination.'
    : world.id > 30
      ? 'Coordinate gates, direction guides, and hazard avoidance.'
      : world.id > 20
        ? 'Overcome freeze zones, burn costs, and tight move budgeting.'
        : world.id > 10
          ? 'Navigate the expanding board and master directional flow.'
          : 'Follow the directional arrows and reach each checkpoint in order.';

  return {
    id: campaignBossLevelId(world.id),
    chapter: 9,
    index: CAMPAIGN_LEVEL_DEFS.length + world.id,
    size,
    rows,
    maxMoves: moveLimit,
    optimal: solutionMoves,
    title: `${world.name} Boss`,
    solution,
    boss: {
      undoAllowance: 3,
      moveLimit,
      starThresholds: { three: solutionMoves, two: moveLimit },
      difficulty: world.id > 30 ? 'expert' : 'advanced',
      objective,
      campaignWorld: world.id,
    },
  };
}

for (const world of CAMPAIGN_WORLDS) {
  const lastLevel = CAMPAIGN_LEVEL_DEFS[world.lastLevel - 1];
  if (!lastLevel.mystery) {
    const hiddenCells = (lastLevel.solution ?? []).slice(1, 4);
    lastLevel.mystery = {
      hiddenCells,
      initialHiddenCount: hiddenCells.length,
      discoverOn: 'enter',
      difficulty: world.id > 35 ? 'expert' : 'advanced',
      objective: 'Discover the hidden cells and reach the final node in order.',
    };
  }
}

export const CAMPAIGN_BOSS_LEVEL_DEFS = CAMPAIGN_WORLDS.map(makeCampaignBoss);
export const CAMPAIGN_PROGRESSION_DEFS: LevelDef[] = CAMPAIGN_WORLDS.flatMap((world) => [
  ...CAMPAIGN_LEVEL_DEFS.filter((def) => def.index >= world.firstLevel && def.index <= world.lastLevel),
  CAMPAIGN_BOSS_LEVEL_DEFS[world.id - 1],
]);
export const CHAPTER_LEVEL_DEFS: LevelDef[] = CHAPTERS.flatMap(({ n }) => [
  ...mysteryDefs.filter((def) => def.chapter === n),
  BOSS_LEVEL_DEFS[n - 1],
]);
export const ALL_LEVEL_DEFS = [...mysteryDefs, ...CAMPAIGN_PROGRESSION_DEFS, ...BOSS_LEVEL_DEFS];

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
  return CHAPTER_LEVEL_DEFS.filter((d) => d.chapter === ch);
}

export function nextLevelId(id: string): string | null {
  const i = CHAPTER_LEVEL_DEFS.findIndex((d) => d.id === id);
  return i >= 0 && i + 1 < CHAPTER_LEVEL_DEFS.length ? CHAPTER_LEVEL_DEFS[i + 1].id : null;
}

export function levelNumber(id: string): number {
  return CHAPTER_LEVEL_DEFS.findIndex((d) => d.id === id) + 1;
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

export function skinUnlocked(skin: SkinId, stars: number, chaptersDone: number[], unlockedSkins: SkinId[] = []): boolean {
  if (skin === 'ink') return stars >= 30;
  if (skin === 'sand') return chaptersDone.includes(6);
  if (skin === 'treasure') return unlockedSkins.includes('treasure');
  return true;
}
