import type { AppState, DailyRecord, LevelRecord, Stats } from '../store/store';
import { ALL_LEVEL_DEFS, CAMPAIGN_PROGRESSION_DEFS } from '../lib/levels';
import { rewardForChest } from '../lib/rewards';

/** Everything that follows a Google account. Device-only things (resume snapshot, login mode, clock) stay out. */
export interface SyncData {
  v: 1;
  onboarded: boolean;
  settings: AppState['settings'];
  levels: AppState['levels'];
  campaignLevels?: AppState['campaignLevels'];
  /** Permanent one-time reward eligibility records; older cloud documents omit this field. */
  completionRewards?: AppState['completionRewards'];
  unlockedBoardSkins?: AppState['unlockedBoardSkins'];
  unlockedProfileBadges?: AppState['unlockedProfileBadges'];
  daily: AppState['daily'];
  stats: AppState['stats'];
  achievements: AppState['achievements'];
  seen: AppState['seen'];
  lastLevelId: string | null;
  profile: AppState['profile'];
  epoch: number;
  clockMax: number;
  updatedAt: number;
}

export function toSyncData(s: AppState): SyncData {
  return {
    v: 1,
    onboarded: s.onboarded,
    settings: s.settings,
    levels: s.levels,
    campaignLevels: s.campaignLevels,
    completionRewards: s.completionRewards,
    unlockedBoardSkins: s.unlockedBoardSkins,
    unlockedProfileBadges: s.unlockedProfileBadges,
    daily: s.daily,
    stats: s.stats,
    achievements: s.achievements,
    seen: s.seen,
    lastLevelId: s.lastLevelId,
    profile: s.profile,
    epoch: s.epoch,
    clockMax: s.clockMax,
    updatedAt: Date.now(),
  };
}

const levelOrder = (id: string | null) => (id ? ALL_LEVEL_DEFS.findIndex((d) => d.id === id) : -1);
const campaignIds = new Set(CAMPAIGN_PROGRESSION_DEFS.map((d) => d.id));

const minPos = (a: number, b: number) => (a > 0 && b > 0 ? Math.min(a, b) : a || b);

function mergeLevel(a: LevelRecord, b: LevelRecord): LevelRecord {
  return {
    stars: Math.max(a.stars, b.stars),
    moves: minPos(a.moves, b.moves),
    time: minPos(a.time, b.time),
    bonus: a.bonus || b.bonus,
    hintless: a.hintless || b.hintless,
  };
}

function mergeStats(a: Stats, b: Stats): Stats {
  const later = (a.lastDaily ?? '') >= (b.lastDaily ?? '') ? a : b;
  const mech: Record<string, number> = { ...a.mech };
  for (const [k, v] of Object.entries(b.mech)) mech[k] = Math.max(mech[k] ?? 0, v);
  const fastest = a.fastest === null ? b.fastest : b.fastest === null ? a.fastest : Math.min(a.fastest, b.fastest);
  const fastestLevel = fastest === null ? null : (a.fastest === fastest ? a.fastestLevel : b.fastestLevel);
  return {
    hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
    fastest,
    fastestLevel,
    perfect: Math.max(a.perfect, b.perfect),
    noHint: Math.max(a.noHint, b.noHint),
    speed: Math.max(a.speed, b.speed),
    streak: later.streak,
    longestStreak: Math.max(a.longestStreak, b.longestStreak, later.streak),
    lastDaily: later.lastDaily,
    rushBest: Math.max(a.rushBest, b.rushBest),
    endlessBest: Math.max(a.endlessBest, b.endlessBest),
    mech,
    solvedAny: Math.max(a.solvedAny, b.solvedAny),
  };
}

const progressCount = (d: Pick<SyncData, 'levels' | 'daily'> & { campaignLevels?: AppState['campaignLevels'] }) => Object.keys(d.levels).length + Object.keys(d.campaignLevels ?? {}).length + Object.keys(d.daily).length;

function normalizeReward(record: AppState['completionRewards'][string]): AppState['completionRewards'][string] {
  if (record.rewardId && record.rarity && record.status && record.expiresAt) return record;
  const assigned = rewardForChest(record.chestId);
  return { ...record, rewardId: assigned.id, rarity: assigned.rarity, status: 'pending', expiresAt: record.generatedAt + 24 * 60 * 60 * 1000 };
}

function mergeCompletionRewards(local: AppState['completionRewards'] = {}, remote: AppState['completionRewards'] = {}): AppState['completionRewards'] {
  const rewards = { ...local };
  for (const [key, record] of Object.entries(remote)) {
    const current = rewards[key];
    if (!current) { rewards[key] = normalizeReward(record); continue; }
    const a = normalizeReward(current);
    const b = normalizeReward(record);
    const rank: Record<string, number> = { pending: 0, expired: 1, redeemed: 2, active: 3, completed: 4 };
    const winner = (rank[b.status] ?? 0) > (rank[a.status] ?? 0) ? b : a;
    rewards[key] = {
      ...winner,
      generatedAt: Math.min(a.generatedAt, b.generatedAt),
      expiresAt: Math.min(a.expiresAt, b.expiresAt),
      ...(a.redeemedAt !== undefined || b.redeemedAt !== undefined ? { redeemedAt: Math.min(a.redeemedAt ?? Number.MAX_SAFE_INTEGER, b.redeemedAt ?? Number.MAX_SAFE_INTEGER) } : {}),
      ...(a.effectEndsAt !== undefined && b.effectEndsAt !== undefined && a.status === 'active' && b.status === 'active'
        ? { effectEndsAt: Math.min(a.effectEndsAt, b.effectEndsAt) } : {}),
    };
  }
  return rewards;
}

function mergeUnique<T extends string>(a: T[] = [], b: T[] = []): T[] { return [...new Set([...a, ...b])]; }

/**
 * Combine two copies of one player's progress (this phone + the cloud). Never loses progress:
 * best stars/moves/time per level, union of badges and dailies, highest counters.
 * `sameAccount` = both copies belong to the same account and have been synced before, so a newer
 * "Reset progress" on either side wins outright instead of being merged back in.
 */
export function mergeSync(local: SyncData, remote: SyncData, sameAccount: boolean): SyncData {
  const normalizeCampaign = (data: SyncData): SyncData => {
    const levels: Record<string, LevelRecord> = {};
    const campaignLevels: Record<string, LevelRecord> = { ...(data.campaignLevels ?? {}) };
    for (const [id, record] of Object.entries(data.levels)) {
      const target = campaignIds.has(id) ? campaignLevels : levels;
      target[id] = target[id] ? mergeLevel(target[id], record) : record;
    }
    return { ...data, levels, campaignLevels };
  };
  local = normalizeCampaign(local);
  remote = normalizeCampaign(remote);
  if (sameAccount && remote.epoch !== local.epoch) {
    const winner = remote.epoch > local.epoch ? remote : local;
    const other = winner === remote ? local : remote;
    const completionRewards = mergeCompletionRewards(winner.completionRewards, other.completionRewards);
    return { ...winner, completionRewards,
      unlockedBoardSkins: mergeUnique(winner.unlockedBoardSkins, other.unlockedBoardSkins),
      unlockedProfileBadges: mergeUnique(winner.unlockedProfileBadges, other.unlockedProfileBadges) };
  }

  const levels: Record<string, LevelRecord> = { ...local.levels };
  const campaignLevels: Record<string, LevelRecord> = { ...(local.campaignLevels ?? {}) };
  for (const source of [local.levels, remote.levels]) {
    for (const [id, record] of Object.entries(source)) {
      levels[id] = levels[id] ? mergeLevel(levels[id], record) : record;
    }
  }
  for (const source of [local.campaignLevels ?? {}, remote.campaignLevels ?? {}]) {
    for (const [id, record] of Object.entries(source)) campaignLevels[id] = campaignLevels[id] ? mergeLevel(campaignLevels[id], record) : record;
  }

  const daily: Record<string, DailyRecord> = { ...local.daily };
  for (const [k, r] of Object.entries(remote.daily)) if (!daily[k] || r.stars > daily[k].stars) daily[k] = r;

  const achievements: Record<string, number> = { ...local.achievements };
  for (const [k, t] of Object.entries(remote.achievements)) achievements[k] = achievements[k] ? Math.min(achievements[k], t) : t;

  const localFresh = progressCount(local) === 0;
  return {
    v: 1,
    onboarded: local.onboarded || remote.onboarded,
    // settings are per-phone habits: keep this phone's, unless it is a fresh phone with nothing yet
    settings: localFresh ? remote.settings : local.settings,
    levels,
    campaignLevels,
    completionRewards: mergeCompletionRewards(local.completionRewards, remote.completionRewards),
    unlockedBoardSkins: mergeUnique(local.unlockedBoardSkins, remote.unlockedBoardSkins),
    unlockedProfileBadges: mergeUnique(local.unlockedProfileBadges, remote.unlockedProfileBadges),
    daily,
    stats: mergeStats(local.stats, remote.stats),
    achievements,
    seen: { ...remote.seen, ...local.seen },
    lastLevelId: levelOrder(local.lastLevelId) >= levelOrder(remote.lastLevelId) ? local.lastLevelId : remote.lastLevelId,
    profile: { ...remote.profile, ...local.profile, id: remote.profile.id || local.profile.id, name: local.profile.name || remote.profile.name, avatar: local.profile.name ? local.profile.avatar : remote.profile.avatar },
    epoch: Math.max(local.epoch, remote.epoch),
    clockMax: Math.max(local.clockMax, remote.clockMax),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

/** Cheap structural equality so we only upload when something really changed. */
export function sameSync(a: SyncData, b: SyncData): boolean {
  const strip = (d: SyncData) => JSON.stringify({ ...d, updatedAt: 0, clockMax: 0 });
  return strip(a) === strip(b);
}
