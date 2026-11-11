import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { UserReferralData, ReferralHistoryItem, CompletionRewardRecord } from './types';
import { rewardForChest, rewardDefinition } from './rewards';
import { verifyLevelSolve } from './verifier';
import { getAuthoritativeLevelDef } from './levels';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/** Deterministic 6-character alphanumeric code from UID, using unambiguous chars. */
function generateReferralCodeForUid(uid: string): string {
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

function normalizeReferralCode(raw: string): string {
  let cleaned = raw.trim().toUpperCase();
  if (!cleaned.startsWith('FLUX-') && !cleaned.includes('-')) {
    cleaned = `FLUX-${cleaned}`;
  }
  return cleaned;
}

function isValidReferralCodeFormat(code: string): boolean {
  return /^FLUX-[2-9A-Z]{4,8}$/.test(code);
}

// ---------------------------------------------------------------------------
// 1. getOrRegisterReferralCode: Register or fetch user's unique referral code
// ---------------------------------------------------------------------------
export const getOrRegisterReferralCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated with Google.');
  }
  const uid = request.auth.uid;
  const userRef = db.collection('userReferrals').doc(uid);

  return await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (userSnap.exists) {
      const d = userSnap.data()!;
      return {
        uid,
        code: d.referralCode,
        invitedByUid: d.invitedByUid ?? null,
        invitedByCode: d.invitedByCode ?? null,
        successfulCount: Number(d.successfulCount ?? 0),
        pendingCount: Number(d.pendingCount ?? 0),
        earnedRewards: Number(d.earnedRewards ?? 0),
      } as UserReferralData;
    }

    // Generate unique candidate code
    let registeredCode: string | null = null;
    let candidate = generateReferralCodeForUid(uid);
    for (let attempts = 0; attempts < 10; attempts++) {
      const codeRef = db.collection('referralCodes').doc(candidate);
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists || codeSnap.data()?.uid === uid) {
        tx.set(codeRef, { code: candidate, uid, createdAt: Date.now() });
        registeredCode = candidate;
        break;
      }
      candidate = `FLUX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    if (!registeredCode) {
      throw new HttpsError('internal', 'Unable to allocate a unique referral code. Please retry.');
    }

    const initialData = {
      uid,
      referralCode: registeredCode,
      invitedByUid: null,
      invitedByCode: null,
      successfulCount: 0,
      pendingCount: 0,
      earnedRewards: 0,
      createdAt: Date.now(),
    };
    tx.set(userRef, initialData);

    return {
      uid,
      code: registeredCode,
      invitedByUid: null,
      invitedByCode: null,
      successfulCount: 0,
      pendingCount: 0,
      earnedRewards: 0,
    } as UserReferralData;
  });
});

// ---------------------------------------------------------------------------
// 2. claimReferralCode: Link invited user to an inviter code
// ---------------------------------------------------------------------------
export const claimReferralCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated with Google.');
  }
  const invitedUid = request.auth.uid;
  const rawCode = request.data?.code;

  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    throw new HttpsError('invalid-argument', 'Invite code is required.');
  }

  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCodeFormat(code)) {
    throw new HttpsError('invalid-argument', 'Invalid code format. Codes look like FLUX-XXXXXX.');
  }

  const codeRef = db.collection('referralCodes').doc(code);
  const invitedUserRef = db.collection('userReferrals').doc(invitedUid);

  return await db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) {
      throw new HttpsError('not-found', 'Invite code not found. Please verify the code.');
    }
    const inviterUid = codeSnap.data()?.uid;
    if (!inviterUid) {
      throw new HttpsError('invalid-argument', 'Invalid invite code.');
    }
    if (inviterUid === invitedUid) {
      throw new HttpsError('invalid-argument', 'You cannot use your own referral code.');
    }

    const invitedSnap = await tx.get(invitedUserRef);
    if (invitedSnap.exists && invitedSnap.data()?.invitedByUid) {
      throw new HttpsError('already-exists', 'You have already applied a referral code.');
    }

    const inviteDocRef = db.collection('referralInvites').doc(`${inviterUid}_${invitedUid}`);
    const inviteSnap = await tx.get(inviteDocRef);
    if (inviteSnap.exists) {
      throw new HttpsError('already-exists', 'This referral has already been linked.');
    }

    const inviterUserRef = db.collection('userReferrals').doc(inviterUid);
    const inviterSnap = await tx.get(inviterUserRef);
    const currentPending = inviterSnap.exists ? Number(inviterSnap.data()?.pendingCount ?? 0) : 0;

    tx.set(
      inviteDocRef,
      {
        inviterUid,
        invitedUid,
        code,
        status: 'pending',
        createdAt: Date.now(),
      },
      { merge: true }
    );

    tx.set(
      invitedUserRef,
      {
        uid: invitedUid,
        invitedByUid: inviterUid,
        invitedByCode: code,
        claimedAt: Date.now(),
      },
      { merge: true }
    );

    if (inviterSnap.exists) {
      tx.update(inviterUserRef, {
        pendingCount: currentPending + 1,
      });
    }

    return { ok: true, inviterUid };
  });
});

// ---------------------------------------------------------------------------
// 3. verifyReferralCompletion: Authoritative server solve check and chest issuance
// ---------------------------------------------------------------------------
export const verifyReferralCompletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated with Google.');
  }
  const invitedUid = request.auth.uid;
  const levelId: string | undefined = request.data?.levelId;
  const enteredPath: number[] | undefined = request.data?.enteredPath;

  // Step 1: If solve proof is provided, authoritatively verify against server game engine
  if (levelId && Array.isArray(enteredPath)) {
    const def = getAuthoritativeLevelDef(levelId);
    if (!def) {
      throw new HttpsError('not-found', `Unknown level ID "${levelId}". Only verified game levels are eligible.`);
    }

    const verification = verifyLevelSolve(def, enteredPath);
    if (verification.ok) {
      // Store authoritative completion certificate
      const certRef = db.collection('userCompletionCertificates').doc(invitedUid).collection('certs').doc(levelId);
      await certRef.set({
        uid: invitedUid,
        levelId,
        verifiedAt: Date.now(),
        moves: enteredPath.length - 1,
        status: 'certified',
      }, { merge: true });
    } else {
      throw new HttpsError('invalid-argument', `Invalid level solve proof: ${verification.reason ?? 'Failed rules check'}`);
    }
  }

  // Step 2: Authoritative verification check (has at least 1 verified certificate)
  const certsSnap = await db.collection('userCompletionCertificates').doc(invitedUid).collection('certs').limit(1).get();
  if (certsSnap.empty) {
    return { ok: false, error: 'No server-verified level completion found for this account.' };
  }

  // Step 3: Transactional referral reward issuance
  const invitedUserRef = db.collection('userReferrals').doc(invitedUid);

  return await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(invitedUserRef);
    if (!userSnap.exists) {
      return { ok: false, error: 'User referral profile not found.' };
    }
    const inviterUid = userSnap.data()?.invitedByUid;
    if (!inviterUid) {
      return { ok: false, error: 'No referral attribution linked to this account.' };
    }

    const inviteDocRef = db.collection('referralInvites').doc(`${inviterUid}_${invitedUid}`);
    const inviteSnap = await tx.get(inviteDocRef);
    if (!inviteSnap.exists) {
      return { ok: false, error: 'Referral invite record not found.' };
    }
    if (inviteSnap.data()?.status !== 'pending') {
      return { ok: true, message: 'Referral has already been completed.' };
    }

    // Deterministic chest IDs ensuring strict idempotency
    const chestInvited = `referral:invited:${invitedUid}`;
    const chestInviter = `referral:inviter:${invitedUid}`;
    const rewardInvited = rewardForChest(chestInvited);
    const rewardInviter = rewardForChest(chestInviter);
    const now = Date.now();
    const expiresAt = now + 24 * 3600 * 1000;

    // Check duplicate issuance
    const chestInvitedRef = db.collection('userReferralRewards').doc(invitedUid).collection('chests').doc(chestInvited);
    const chestInvitedSnap = await tx.get(chestInvitedRef);
    if (chestInvitedSnap.exists) {
      return { ok: true, message: 'Reward chest already issued.' };
    }

    // Mark invite completed
    tx.update(inviteDocRef, {
      status: 'completed',
      completedAt: now,
      chestInvited,
      chestInviter,
    });

    // Issue chest to invited user
    tx.set(chestInvitedRef, {
      playerId: invitedUid,
      progression: 'referral',
      levelId: 'referral-welcome',
      chestId: chestInvited,
      generatedAt: now,
      rewardId: rewardInvited.id,
      rarity: rewardInvited.rarity,
      status: 'pending',
      expiresAt,
    });

    // Issue chest to inviter
    const chestInviterRef = db.collection('userReferralRewards').doc(inviterUid).collection('chests').doc(chestInviter);
    tx.set(chestInviterRef, {
      playerId: inviterUid,
      progression: 'referral',
      levelId: `referral-${invitedUid.slice(0, 8)}`,
      chestId: chestInviter,
      generatedAt: now,
      rewardId: rewardInviter.id,
      rarity: rewardInviter.rarity,
      status: 'pending',
      expiresAt,
      fromUid: invitedUid,
    });

    // Update inviter counters
    const inviterUserRef = db.collection('userReferrals').doc(inviterUid);
    const inviterSnap = await tx.get(inviterUserRef);
    if (inviterSnap.exists) {
      const curSuccess = Number(inviterSnap.data()?.successfulCount ?? 0);
      const curPending = Number(inviterSnap.data()?.pendingCount ?? 0);
      const curEarned = Number(inviterSnap.data()?.earnedRewards ?? 0);
      tx.update(inviterUserRef, {
        successfulCount: curSuccess + 1,
        pendingCount: Math.max(0, curPending - 1),
        earnedRewards: curEarned + 1,
      });
    }

    // Update invited user counters
    const curEarnedInvited = Number(userSnap.data()?.earnedRewards ?? 0);
    tx.update(invitedUserRef, {
      earnedRewards: curEarnedInvited + 1,
    });

    return {
      ok: true,
      chestInvited,
      chestInviter,
      rewardInvited: rewardInvited.id,
      rewardInviter: rewardInviter.id,
    };
  });
});

// ---------------------------------------------------------------------------
// 4. redeemReferralChest: Server-authoritative chest redemption
// ---------------------------------------------------------------------------
export const redeemReferralChest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const uid = request.auth.uid;
  const chestId: string = request.data?.chestId;
  const action: string | undefined = request.data?.action; // 'redeem' | 'activate' | 'complete'

  if (!chestId || typeof chestId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid chestId is required.');
  }

  const chestRef = db.collection('userReferralRewards').doc(uid).collection('chests').doc(chestId);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(chestRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Reward chest not found.');
    }
    const reward = snap.data() as CompletionRewardRecord;
    const now = Date.now();

    // Handle updates for already redeemed/active rewards (e.g. consuming charges)
    if (reward.status === 'redeemed' || reward.status === 'active') {
      if (action === 'activate') {
        const patch: Partial<CompletionRewardRecord> = {
          status: 'active',
          activatedAt: now,
          effectEndsAt: now + (rewardDefinition(reward.rewardId).durationMs ?? 30_000),
        };
        tx.update(chestRef, patch);
        return { ok: true, reward: { ...reward, ...patch } };
      }
      if (action === 'complete') {
        const patch: Partial<CompletionRewardRecord> = {
          status: 'completed',
          completedAt: now,
        };
        tx.update(chestRef, patch);
        return { ok: true, reward: { ...reward, ...patch } };
      }
      return { ok: true, reward, message: `Chest is already ${reward.status}.` };
    }

    if (reward.status === 'completed' || reward.status === 'expired') {
      return { ok: true, reward, message: `Chest is already ${reward.status}.` };
    }

    // Initial redemption
    if (now >= reward.expiresAt) {
      tx.update(chestRef, { status: 'expired' });
      throw new HttpsError('deadline-exceeded', 'This reward chest has expired.');
    }

    let nextStatus: CompletionRewardRecord['status'] = 'redeemed';
    const patch: Partial<CompletionRewardRecord> = { redeemedAt: now };

    if (reward.rewardId === 'unlimited-hints' || reward.rewardId === 'unlimited-energy') {
      nextStatus = 'active';
      patch.activatedAt = now;
      patch.effectEndsAt = now + (rewardDefinition(reward.rewardId).durationMs ?? 0);
    } else if (
      reward.rewardId === 'instant-energy' ||
      reward.rewardId === 'board-skin-treasure' ||
      reward.rewardId === 'profile-badge-prism'
    ) {
      nextStatus = 'completed';
      patch.activatedAt = now;
      patch.completedAt = now;
    }

    patch.status = nextStatus;
    tx.update(chestRef, patch);

    return {
      ok: true,
      reward: { ...reward, ...patch },
    };
  });
});

// ---------------------------------------------------------------------------
// 5. fetchReferralProfile: Unified read of user referral stats, history & chests
// ---------------------------------------------------------------------------
export const fetchReferralProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const uid = request.auth.uid;

  const userDoc = await db.collection('userReferrals').doc(uid).get();
  const userData: UserReferralData = userDoc.exists
    ? {
        uid,
        code: userDoc.data()?.referralCode ?? '',
        invitedByUid: userDoc.data()?.invitedByUid ?? null,
        invitedByCode: userDoc.data()?.invitedByCode ?? null,
        successfulCount: Number(userDoc.data()?.successfulCount ?? 0),
        pendingCount: Number(userDoc.data()?.pendingCount ?? 0),
        earnedRewards: Number(userDoc.data()?.earnedRewards ?? 0),
      }
    : {
        uid,
        code: '',
        invitedByUid: null,
        invitedByCode: null,
        successfulCount: 0,
        pendingCount: 0,
        earnedRewards: 0,
      };

  const invitesSnap = await db
    .collection('referralInvites')
    .where('inviterUid', '==', uid)
    .get();

  const history: ReferralHistoryItem[] = [];
  invitesSnap.forEach((docSnap) => {
    const d = docSnap.data();
    history.push({
      id: docSnap.id,
      invitedUid: d.invitedUid ?? '',
      code: d.code ?? '',
      status: d.status ?? 'pending',
      createdAt: Number(d.createdAt ?? 0),
      completedAt: d.completedAt ? Number(d.completedAt) : undefined,
    });
  });
  history.sort((a, b) => b.createdAt - a.createdAt);

  const chestsSnap = await db
    .collection('userReferralRewards')
    .doc(uid)
    .collection('chests')
    .get();

  const chests: Record<string, CompletionRewardRecord> = {};
  chestsSnap.forEach((docSnap) => {
    const d = docSnap.data() as CompletionRewardRecord;
    chests[d.chestId] = d;
  });

  return {
    userData,
    history,
    chests,
  };
});

