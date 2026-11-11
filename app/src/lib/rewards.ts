export type RewardId =
  | 'unlimited-hints'
  | 'unlimited-energy'
  | 'extra-undo'
  | 'instant-energy'
  | 'time-freeze'
  | 'energy-shield'
  | 'board-skin-treasure'
  | 'profile-badge-prism';

export type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type RewardStatus = 'pending' | 'redeemed' | 'active' | 'completed' | 'expired';

export interface RewardDefinition {
  id: RewardId;
  name: string;
  description: string;
  rarity: RewardRarity;
  durationMs?: number;
}

export const REWARD_RARITY_PERCENT: Record<RewardRarity, number> = {
  common: 50,
  rare: 30,
  epic: 15,
  legendary: 5,
};

export const REWARD_CATALOG: RewardDefinition[] = [
  { id: 'instant-energy', name: 'Instant Energy Refill', description: 'Restore energy to its full capacity.', rarity: 'common' },
  { id: 'extra-undo', name: 'Extra Undo', description: 'Add 2 undo operations to your next eligible standard puzzle.', rarity: 'rare' },
  { id: 'time-freeze', name: 'Time Freeze', description: 'Pause an eligible puzzle clock for 30 seconds when activated.', rarity: 'rare', durationMs: 30_000 },
  { id: 'unlimited-hints', name: 'Unlimited Hints', description: 'Use hints freely for 10 minutes after redemption.', rarity: 'epic', durationMs: 10 * 60_000 },
  { id: 'energy-shield', name: 'Energy Shield', description: 'Protect one upcoming run from its energy charge.', rarity: 'epic' },
  { id: 'unlimited-energy', name: 'Unlimited Energy', description: 'Start runs without spending energy for 10 minutes.', rarity: 'legendary', durationMs: 10 * 60_000 },
  { id: 'board-skin-treasure', name: 'Treasure Board Skin', description: 'Permanently unlock the Treasure board theme.', rarity: 'legendary' },
  { id: 'profile-badge-prism', name: 'Prism Profile Badge', description: 'Permanently add the Prism badge to your profile.', rarity: 'legendary' },
];

const rarityOrder: RewardRarity[] = ['common', 'rare', 'epic', 'legendary'];

function seedFor(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 0x9e3779b9;
}

function randomFor(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

/** Stable per chest so independent devices assign the same reward without rerolling on retries. */
export function rewardForChest(chestId: string): RewardDefinition {
  const random = randomFor(seedFor(chestId));
  let draw = random() * 100;
  let rarity = rarityOrder[rarityOrder.length - 1];
  for (const group of rarityOrder) {
    draw -= REWARD_RARITY_PERCENT[group];
    if (draw < 0) { rarity = group; break; }
  }
  const choices = REWARD_CATALOG.filter((item) => item.rarity === rarity);
  return choices[Math.floor(random() * choices.length)];
}

export const rewardDefinition = (id: RewardId) => REWARD_CATALOG.find((reward) => reward.id === id)!;
