import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudConfigured } from '../config';
import {
  getState,
  setClaimedReferralCode,
  setPendingReferralCode,
  setReferralRewards,
  trustedNow,
  CompletionRewardRecord,
} from '../store/store';
import { ensureGoogleFirebaseUser, getFirebase } from './auth';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

export const REFERRAL_APK_URL =
  'https://expo.dev/artifacts/eas/4lAjZmoZ4AIA-0YlGXJ7PY82aWqx0CrbPyROC4IU4XM.apk';

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

export function referralShareMessage(code: string): string {
  return `Play FLUX with me! Use my invite code ${code} to get a free Reward Chest upon completing your first level.\n\nDownload the game here:\n${REFERRAL_APK_URL}`;
}

function firestore() {
  return require('firebase/firestore');
}

function getCallable<T = any, R = any>(name: string): (data?: T) => Promise<{ data: R }> {
  const { getFunctions, httpsCallable } = require('firebase/functions');
  const { app } = getFirebase();
  const fns = getFunctions(app);
  return httpsCallable(fns, name);
}

/** Deterministic 6-character alphanumeric code from UID, using unambiguous chars. */
export function generateReferralCodeForUid(uid: string): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let code = '';
  let val = Math.abs(h);
  for (let i = 0; i < 6; i++) {
    code += chars[val % chars.length];
    val = Math.floor(val / chars.length) ^ (i * 31);
    if (val === 0) val = Math.abs(h + i * 9973);
  }
  return `FLUX-${code}`;
}

export function normalizeReferralCode(raw: string): string {
  let cleaned = raw.trim().toUpperCase();
  if (!cleaned.startsWith('FLUX-') && !cleaned.includes('-')) {
    cleaned = `FLUX-${cleaned}`;
  }
  return cleaned;
}

export function isValidReferralCodeFormat(code: string): boolean {
  return /^FLUX-[2-9A-Z]{4,8}$/.test(code);
}

/**
 * Retrieve or generate a unique referral code via secure Cloud Function.
 */
export async function getOrRegisterUserReferral(uid: string): Promise<UserReferralData | null> {
  if (!cloudConfigured() || !(await ensureGoogleFirebaseUser(uid))) {
    return null;
  }
  try {
    const fn = getCallable<void, UserReferralData>('getOrRegisterReferralCode');
    const res = await fn();
    return res.data;
  } catch {
    // Fallback to authorized read if offline
    try {
      const { db } = getFirebase();
      const { doc, getDoc } = firestore();
      const userRef = doc(db, 'userReferrals', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const d = snap.data();
        return {
          uid,
          code: d.referralCode,
          invitedByUid: d.invitedByUid ?? null,
          invitedByCode: d.invitedByCode ?? null,
          successfulCount: Number(d.successfulCount ?? 0),
          pendingCount: Number(d.pendingCount ?? 0),
          earnedRewards: Number(d.earnedRewards ?? 0),
        };
      }
    } catch {
      /* offline */
    }
    return null;
  }
}

/**
 * Claim an invite code for the current user via secure Cloud Function.
 */
export async function claimReferralCode(
  invitedUid: string,
  rawCode: string
): Promise<{ ok: true; inviterUid: string } | { ok: false; error: string }> {
  if (!cloudConfigured()) {
    setPendingReferralCode(rawCode);
    return { ok: false, error: 'Sign in to Google to claim your invite code.' };
  }
  if (!(await ensureGoogleFirebaseUser(invitedUid))) {
    setPendingReferralCode(rawCode);
    return { ok: false, error: 'A verified Google sign-in is required to link this referral.' };
  }

  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCodeFormat(code)) {
    return { ok: false, error: 'Invalid code format. Codes look like FLUX-XXXXXX.' };
  }

  try {
    const fn = getCallable<{ code: string }, { ok: boolean; inviterUid: string }>('claimReferralCode');
    const res = await fn({ code });
    if (res.data?.ok) {
      setClaimedReferralCode(code);
      setPendingReferralCode(null);
      void triggerReferralCompletionCheck(invitedUid);
      return { ok: true, inviterUid: res.data.inviterUid };
    }
    return { ok: false, error: 'Could not claim referral code.' };
  } catch (e: any) {
    const message = e?.message || 'Could not claim referral code. Please retry.';
    return { ok: false, error: message };
  }
}

export interface PendingSolveProof {
  levelId: string;
  enteredPath: number[];
  solvedAt: number;
}

const PENDING_PROOFS_KEY = 'flux.referral.pending_proofs.v1';

export async function getPendingSolveProofs(): Promise<PendingSolveProof[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PROOFS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingSolveProof[];
  } catch {
    return [];
  }
}

export async function queuePendingSolveProof(proof: { levelId: string; enteredPath?: number[] }): Promise<void> {
  if (!proof.enteredPath || proof.enteredPath.length < 2) return;
  try {
    const list = await getPendingSolveProofs();
    if (!list.some((p) => p.levelId === proof.levelId)) {
      list.push({
        levelId: proof.levelId,
        enteredPath: proof.enteredPath,
        solvedAt: Date.now(),
      });
      const capped = list.slice(-10);
      await AsyncStorage.setItem(PENDING_PROOFS_KEY, JSON.stringify(capped));
    }
  } catch {
    /* ignore */
  }
}

export async function removePendingSolveProof(levelId: string): Promise<void> {
  try {
    const list = await getPendingSolveProofs();
    const filtered = list.filter((p) => p.levelId !== levelId);
    await AsyncStorage.setItem(PENDING_PROOFS_KEY, JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

/**
 * Authoritatively verifies level completion and issues chests via Cloud Function.
 * Automatically queues and retries offline solve proofs.
 */
export async function triggerReferralCompletionCheck(
  invitedUid: string,
  solveProof?: { levelId: string; enteredPath?: number[] }
): Promise<boolean> {
  if (solveProof?.enteredPath) {
    await queuePendingSolveProof(solveProof);
  }

  if (!cloudConfigured() || !(await ensureGoogleFirebaseUser(invitedUid))) {
    return false;
  }

  let verifiedAny = false;

  // 1. Process all pending solve proofs in the queue
  try {
    const pending = await getPendingSolveProofs();
    for (const p of pending) {
      try {
        const fn = getCallable<{ levelId: string; enteredPath: number[] }, { ok: boolean }>('verifyReferralCompletion');
        const res = await fn({ levelId: p.levelId, enteredPath: p.enteredPath });
        if (res.data?.ok) {
          verifiedAny = true;
          await removePendingSolveProof(p.levelId);
        }
      } catch {
        // Network or verification error; retain proof for later retry
        break;
      }
    }
  } catch {
    /* ignore */
  }

  // 2. Trigger check for already certified account or initial issuance
  try {
    const fn = getCallable<void, { ok: boolean; chestInvited?: string }>('verifyReferralCompletion');
    const res = await fn();
    if (res.data?.ok) {
      await syncReferralRewards(invitedUid);
      return true;
    }
  } catch {
    /* ignore */
  }

  if (verifiedAny) {
    await syncReferralRewards(invitedUid);
    return true;
  }

  return false;
}

/**
 * Fetch list of referral invites initiated by this user.
 */
export async function fetchUserReferralHistory(uid: string): Promise<ReferralHistoryItem[]> {
  if (!cloudConfigured() || !(await ensureGoogleFirebaseUser(uid))) return [];
  try {
    const fn = getCallable<void, { history: ReferralHistoryItem[] }>('fetchReferralProfile');
    const res = await fn();
    if (res.data?.history) {
      return res.data.history;
    }
  } catch {
    // Fallback to authorized direct Firestore query
    try {
      const { db } = getFirebase();
      const { collection, getDocs, query, where } = firestore();
      const q = query(collection(db, 'referralInvites'), where('inviterUid', '==', uid));
      const snap = await getDocs(q);
      const list: ReferralHistoryItem[] = [];
      snap.forEach((docSnap: any) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          invitedUid: d.invitedUid ?? '',
          code: d.code ?? '',
          status: d.status ?? 'pending',
          createdAt: Number(d.createdAt ?? 0),
          completedAt: d.completedAt ? Number(d.completedAt) : undefined,
        });
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      return list;
    } catch {
      /* offline */
    }
  }
  return [];
}

/**
 * Sync all referral reward chests issued to this Google user and merge them into local store.
 */
export async function syncReferralRewards(uid: string): Promise<Record<string, CompletionRewardRecord>> {
  if (!cloudConfigured() || !(await ensureGoogleFirebaseUser(uid))) {
    return getState().referralRewards;
  }
  try {
    const fn = getCallable<void, { chests: Record<string, CompletionRewardRecord> }>('fetchReferralProfile');
    const res = await fn();
    if (res.data?.chests) {
      const remoteRewards = res.data.chests;
      const localRewards = getState().referralRewards;
      const merged = { ...localRewards };
      for (const [chestId, remoteRecord] of Object.entries(remoteRewards)) {
        const local = localRewards[chestId];
        if (!local || (local.status === 'pending' && remoteRecord.status !== 'pending')) {
          merged[chestId] = remoteRecord;
        }
      }
      setReferralRewards(merged);
      return merged;
    }
  } catch {
    // Fallback to authorized read from subcollection
    try {
      const { db } = getFirebase();
      const { collection, getDocs } = firestore();
      const snap = await getDocs(collection(db, 'userReferralRewards', uid, 'chests'));
      const remoteRewards: Record<string, CompletionRewardRecord> = {};
      const now = trustedNow();

      snap.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (!d.chestId || !d.rewardId) return;
        const status =
          d.status === 'pending' && now >= Number(d.expiresAt)
            ? 'expired'
            : d.status ?? 'pending';

        remoteRewards[d.chestId] = {
          playerId: uid,
          progression: 'referral',
          levelId: d.levelId ?? 'referral',
          chestId: d.chestId,
          generatedAt: Number(d.generatedAt ?? now),
          rewardId: d.rewardId,
          rarity: d.rarity ?? 'rare',
          status,
          expiresAt: Number(d.expiresAt ?? now + 24 * 3600 * 1000),
          redeemedAt: d.redeemedAt ? Number(d.redeemedAt) : undefined,
          activatedAt: d.activatedAt ? Number(d.activatedAt) : undefined,
          completedAt: d.completedAt ? Number(d.completedAt) : undefined,
        };
      });

      const localRewards = getState().referralRewards;
      const merged = { ...localRewards };
      for (const [chestId, remoteRecord] of Object.entries(remoteRewards)) {
        const local = localRewards[chestId];
        if (!local || (local.status === 'pending' && remoteRecord.status !== 'pending')) {
          merged[chestId] = remoteRecord;
        }
      }
      setReferralRewards(merged);
      return merged;
    } catch {
      /* offline */
    }
  }
  return getState().referralRewards;
}

/**
 * Sync redeemed/activated/completed state of a referral chest via secure Cloud Function.
 */
export async function updateRemoteReferralChest(
  uid: string,
  reward: CompletionRewardRecord,
  action?: 'redeem' | 'activate' | 'complete'
): Promise<void> {
  if (!cloudConfigured() || !(await ensureGoogleFirebaseUser(uid))) return;
  try {
    const resolvedAction =
      action ??
      (reward.status === 'completed'
        ? 'complete'
        : reward.status === 'active'
        ? 'activate'
        : 'redeem');
    const fn = getCallable<{ chestId: string; action: string }, { ok: boolean; reward: CompletionRewardRecord }>('redeemReferralChest');
    await fn({ chestId: reward.chestId, action: resolvedAction });
  } catch {
    /* offline safe */
  }
}
