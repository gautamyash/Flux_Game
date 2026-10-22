import { AppState, chaptersDone, totalStars } from '../store/store';

export type Tier = 'bronze' | 'silver' | 'gold';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  tier: Tier;
  /** cell glyph kind, icon name, or 'text' */
  visual: { type: 'cell'; kind: string; state?: string } | { type: 'icon'; name: string } | { type: 'text'; text: string };
  target: number;
  progress: (s: AppState) => number;
}

const stars = (s: AppState) => totalStars(s.levels);
const solved = (s: AppState) => Object.keys(s.levels).length;
const mech = (k: string) => (s: AppState) => s.stats.mech[k] || 0;
const chapterDone = (n: number) => (s: AppState) => (chaptersDone(s.levels).includes(n) ? 1 : 0);

const CH = ['Basics', 'Direction', 'Hazards', 'Warp', 'Freeze', 'Switch', 'Pressure', 'Master'];
const CH_CELL = ['node', 'dir', 'burn', 'tele', 'freeze', 'switch', 'count', 'node'];

const chapterBadges: AchievementDef[] = CH.map((name, i) => ({
  id: `ch${i + 1}`,
  name: `${name} Complete`,
  desc: `Solve every level in chapter ${i + 1}: ${name}.`,
  tier: (i < 2 ? 'bronze' : i < 5 ? 'silver' : 'gold') as Tier,
  visual: i === 7 ? { type: 'text' as const, text: '8' } : { type: 'cell' as const, kind: CH_CELL[i], state: i === 5 ? 'on' : undefined },
  target: 1,
  progress: chapterDone(i + 1),
}));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'First Solve', desc: 'Solve any level.', tier: 'bronze', visual: { type: 'icon', name: 'check' }, target: 1, progress: (s) => s.stats.solvedAny },
  { id: 'lv10', name: 'Getting Started', desc: 'Solve 10 different levels.', tier: 'bronze', visual: { type: 'text', text: '10' }, target: 10, progress: solved },
  { id: 'lv25', name: 'Warming Up', desc: 'Solve 25 different levels.', tier: 'silver', visual: { type: 'text', text: '25' }, target: 25, progress: solved },
  { id: 'lv50', name: 'Halfway There', desc: 'Solve 50 different levels.', tier: 'silver', visual: { type: 'text', text: '50' }, target: 50, progress: solved },
  { id: 'hundred', name: 'Century', desc: 'Solve all 100 levels.', tier: 'gold', visual: { type: 'text', text: '100' }, target: 100, progress: solved },
  { id: 'perfect', name: 'Perfect Path', desc: 'Solve a level with 3 stars.', tier: 'bronze', visual: { type: 'icon', name: 'star' }, target: 1, progress: (s) => s.stats.perfect },
  { id: 'perfect25', name: 'Perfectionist', desc: 'Earn 3 stars on 25 solves.', tier: 'silver', visual: { type: 'icon', name: 'star' }, target: 25, progress: (s) => s.stats.perfect },
  { id: 'stars50', name: 'Star Collector', desc: 'Collect 50 stars.', tier: 'bronze', visual: { type: 'icon', name: 'star' }, target: 50, progress: stars },
  { id: 'stars150', name: 'Star Hoarder', desc: 'Collect 150 stars.', tier: 'silver', visual: { type: 'icon', name: 'star' }, target: 150, progress: stars },
  { id: 'stars300', name: 'Full Constellation', desc: 'Collect all 300 stars.', tier: 'gold', visual: { type: 'icon', name: 'star' }, target: 300, progress: stars },
  { id: 'nohint', name: 'No Hint', desc: 'Solve 10 levels without a hint.', tier: 'silver', visual: { type: 'icon', name: 'bulb' }, target: 10, progress: (s) => s.stats.noHint },
  { id: 'nohint50', name: 'Own Mind', desc: 'Solve 50 levels without a hint.', tier: 'gold', visual: { type: 'icon', name: 'bulb' }, target: 50, progress: (s) => s.stats.noHint },
  { id: 'speed', name: 'Speed Solver', desc: 'Solve 5 levels in under 30 seconds.', tier: 'silver', visual: { type: 'icon', name: 'bolt' }, target: 5, progress: (s) => s.stats.speed },
  ...chapterBadges,
  { id: 'dir', name: 'Pathfinder', desc: 'Solve 15 puzzles with direction cells.', tier: 'bronze', visual: { type: 'cell', kind: 'dir' }, target: 15, progress: mech('dir') },
  { id: 'burn', name: 'Burn Survivor', desc: 'Solve 10 puzzles with burn cells.', tier: 'silver', visual: { type: 'cell', kind: 'burn' }, target: 10, progress: mech('burn') },
  { id: 'tele', name: 'Teleporter Master', desc: 'Solve 10 puzzles with portals.', tier: 'silver', visual: { type: 'cell', kind: 'tele' }, target: 10, progress: mech('tele') },
  { id: 'freeze', name: 'Freeze Expert', desc: 'Solve 10 puzzles with freeze cells.', tier: 'silver', visual: { type: 'cell', kind: 'freeze' }, target: 10, progress: mech('freeze') },
  { id: 'switch', name: 'Switch Master', desc: 'Solve 10 puzzles with switches.', tier: 'silver', visual: { type: 'cell', kind: 'switch', state: 'on' }, target: 10, progress: mech('switch') },
  { id: 'count', name: 'Beat the Clock', desc: 'Solve 10 puzzles with countdown cells.', tier: 'silver', visual: { type: 'cell', kind: 'count' }, target: 10, progress: mech('count') },
  { id: 'daily3', name: 'Daily Habit', desc: 'Play the daily puzzle 3 days in a row.', tier: 'bronze', visual: { type: 'icon', name: 'calendar' }, target: 3, progress: (s) => s.stats.longestStreak },
  { id: 'daily7', name: 'Week Streak', desc: 'Play the daily puzzle 7 days in a row.', tier: 'silver', visual: { type: 'icon', name: 'calendar' }, target: 7, progress: (s) => s.stats.longestStreak },
  { id: 'daily', name: 'Daily Streak', desc: 'Play the daily puzzle 30 days in a row.', tier: 'gold', visual: { type: 'icon', name: 'calendar' }, target: 30, progress: (s) => s.stats.longestStreak },
  { id: 'rush5', name: 'Rusher', desc: 'Solve 5 puzzles in one Rush run.', tier: 'bronze', visual: { type: 'icon', name: 'bolt' }, target: 5, progress: (s) => s.stats.rushBest },
  { id: 'rush12', name: 'Rush Hour', desc: 'Solve 12 puzzles in one Rush run.', tier: 'gold', visual: { type: 'icon', name: 'bolt' }, target: 12, progress: (s) => s.stats.rushBest },
  { id: 'endless10', name: 'Endurance', desc: 'Solve 10 puzzles in one Endless run.', tier: 'silver', visual: { type: 'icon', name: 'endless' }, target: 10, progress: (s) => s.stats.endlessBest },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export function evaluateAchievements(s: AppState): string[] {
  return ACHIEVEMENTS.filter((a) => a.progress(s) >= a.target).map((a) => a.id);
}
