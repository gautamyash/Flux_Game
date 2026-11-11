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

export interface CompletionRewardRecord {
  playerId: string;
  progression: 'chapters' | 'campaign' | 'referral';
  levelId: string;
  chestId: string;
  generatedAt: number;
  rewardId: RewardId;
  rarity: RewardRarity;
  status: RewardStatus;
  expiresAt: number;
  redeemedAt?: number;
  activatedAt?: number;
  effectEndsAt?: number;
  activatedRunId?: string;
  completedAt?: number;
  fromUid?: string;
}

export interface UserReferralData {
  uid: string;
  code: string;
  invitedByUid: string | null;
  invitedByCode: string | null;
  successfulCount: number;
  pendingCount: number;
  earnedRewards: number;
}

export interface ReferralHistoryItem {
  id: string;
  invitedUid: string;
  code: string;
  status: 'pending' | 'completed';
  createdAt: number;
  completedAt?: number;
}

export type Dir = 'u' | 'r' | 'd' | 'l';

export type CellDef =
  | { kind: 'empty' }
  | { kind: 'dead' }
  | { kind: 'dir'; dir: Dir }
  | { kind: 'burn' }
  | { kind: 'freeze' }
  | { kind: 'switch' }
  | { kind: 'gate'; open: boolean }
  | { kind: 'bonus' }
  | { kind: 'tele'; pair: number }
  | { kind: 'count'; n: number }
  | { kind: 'node'; n: number };

export interface LevelDef {
  id: string;
  size: number;
  rows: string[];
  maxMoves: number;
  optimal?: number;
}

export interface Level {
  id: string;
  size: number;
  cells: CellDef[];
  start: number;
  nodeCount: number;
  required: number[];
  partner: number[];
  around: number[][];
  gates: number[];
  maxMoves: number;
}

