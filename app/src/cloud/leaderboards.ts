import { cloudConfigured } from '../config';
import { getState, isValidDateKey, solvedCount, totalStars } from '../store/store';
import { ensureGoogleFirebaseUser, leaderboardFirestore } from './auth';

/* Firebase is loaded lazily so guest play and unit tests work without configured cloud services. */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

export type LeaderboardKind = 'global' | 'daily';
export interface GlobalEntry { key: string; score: number; solved: number; lastRunId: string }
export interface DailyEntry { key: string; stars: number; moves: number; time: number; lastRunId: string }
export type LeaderboardEntry = GlobalEntry | DailyEntry;
export type LeaderboardDisplayEntry = LeaderboardEntry & { displayName: string };
export type SubmissionResult = 'submitted' | 'duplicate' | 'not-better' | 'unauthenticated' | 'unavailable' | 'rejected' | 'error';

const pendingSubmissions = new Set<Promise<SubmissionResult>>();

function trackSubmission(request: Promise<SubmissionResult>) {
  pendingSubmissions.add(request);
  void request.then(
    () => pendingSubmissions.delete(request),
    () => pendingSubmissions.delete(request),
  );
  return request;
}

/** Wait for score writes already started by the active game before reloading the JS runtime. */
export async function waitForPendingLeaderboardSubmissions() {
  while (pendingSubmissions.size) await Promise.all([...pendingSubmissions]);
}

function firestore() {
  return require('firebase/firestore');
}

function validRunId(runId: string): boolean {
  return /^[a-z0-9-]{8,64}$/i.test(runId);
}

export function compareDailyResult(a: Pick<DailyEntry, 'stars' | 'moves' | 'time'>, b: Pick<DailyEntry, 'stars' | 'moves' | 'time'>): number {
  return b.stars - a.stars || a.moves - b.moves || a.time - b.time;
}

export function isBetterGlobalResult(a: Pick<GlobalEntry, 'score' | 'solved'>, b: Pick<GlobalEntry, 'score' | 'solved'>): boolean {
  return a.score > b.score || (a.score === b.score && a.solved > b.solved);
}

async function getOrCreateKey(db: any, uid: string): Promise<string> {
  const { collection, doc, runTransaction } = firestore();
  const profileRef = doc(db, 'leaderboardProfiles', uid);
  const created = doc(collection(db, 'leaderboardKeys')).id;
  return runTransaction(db, async (tx: any) => {
    const snap = await tx.get(profileRef);
    const key = snap.exists() ? snap.data().key : created;
    if (!snap.exists()) tx.set(profileRef, { key });
    return key as string;
  });
}

function cleanDisplayName(name: string): string {
  const cleaned = name.trim().slice(0, 24);
  // A profile may contain an email accidentally; never publish an email-like identifier.
  return !cleaned || cleaned.includes('@') ? 'Player' : cleaned;
}

/** Publish the signed-in player's profile name under their random public leaderboard key. */
export async function syncLeaderboardDisplayName(uid: string, displayName: string, createProfile = false): Promise<void> {
  if (!cloudConfigured()) return;
  const db = await leaderboardFirestore(uid);
  if (!db) throw new Error('unauthenticated');
  const { doc, getDoc, setDoc } = firestore();
  const profileRef = doc(db, 'leaderboardProfiles', uid);
  let key: string;
  if (createProfile) {
    key = await getOrCreateKey(db, uid);
  } else {
    const profile = await getDoc(profileRef);
    if (!profile.exists()) return;
    key = profile.data().key;
  }
  await setDoc(doc(db, 'leaderboardNames', key), { displayName: cleanDisplayName(displayName) });
}

export function mapLeaderboardNames<T extends LeaderboardEntry>(entries: T[], names: Record<string, string>): (T & { displayName: string })[] {
  return entries.map((entry) => ({ ...entry, displayName: cleanDisplayName(names[entry.key] ?? '') }));
}

async function submit(kind: LeaderboardKind, boardId: string, runId: string, result: { score: number; solved: number } | { stars: number; moves: number; time: number }): Promise<SubmissionResult> {
  if (!cloudConfigured() || !validRunId(runId)) return 'unavailable';
  const state = getState();
  if (state.mode !== 'google' || !state.account) return 'unauthenticated';
  const uid = state.account.uid;
  try {
    const db = await leaderboardFirestore(uid);
    if (!db) return 'unauthenticated';
    const key = await getOrCreateKey(db, uid);
    await syncLeaderboardDisplayName(uid, getState().profile.name || getState().account?.name || '');
    const { doc, runTransaction, serverTimestamp } = firestore();
    const entryRef = doc(db, 'leaderboards', boardId, 'entries', key);
    const submissionRef = doc(db, 'leaderboards', boardId, 'submissions', runId);
    return await runTransaction(db, async (tx: any) => {
      // All reads happen before writes, as required by Firestore transactions.
      const submission = await tx.get(submissionRef);
      if (submission.exists()) return 'duplicate' as const;
      const entrySnap = await tx.get(entryRef);
      const old = entrySnap.exists() ? entrySnap.data() : null;
      let better = !old;
      if (old && kind === 'global') better = isBetterGlobalResult(result as GlobalEntry, old as GlobalEntry);
      if (old && kind === 'daily') better = compareDailyResult(result as DailyEntry, old as DailyEntry) < 0;
      tx.set(submissionRef, { key });
      if (better) tx.set(entryRef, { key, ...result, lastRunId: runId, updatedAt: serverTimestamp() });
      return better ? 'submitted' as const : 'not-better' as const;
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied' || code === 'unauthorized') return 'rejected';
    if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') return 'unavailable';
    return 'error';
  }
}

/** Submit the existing all-level star total after a successfully completed Classic or Master puzzle. */
export function submitGlobalRun(runId: string): Promise<SubmissionResult> {
  const levels = getState().levels;
  return trackSubmission(submit('global', 'global', runId, { score: totalStars(levels), solved: solvedCount(levels) }));
}

/** Submit the existing Daily result after a successfully completed Daily puzzle. */
export function submitDailyRun(day: string, runId: string, result: { stars: number; moves: number; time: number }): Promise<SubmissionResult> {
  if (!isValidDateKey(day)) return Promise.resolve('unavailable');
  return trackSubmission(submit('daily', day, runId, result));
}

export async function loadLeaderboard(kind: LeaderboardKind, day?: string): Promise<LeaderboardDisplayEntry[]> {
  const state = getState();
  if (state.mode !== 'google' || !state.account || !cloudConfigured()) throw new Error('unauthenticated');
  if (!(await ensureGoogleFirebaseUser(state.account.uid))) throw new Error('unauthenticated');
  const db = await leaderboardFirestore(state.account.uid);
  if (!db) throw new Error('unauthenticated');
  const { collection, documentId, getDocsFromServer, getDoc, limit, orderBy, query, setDoc, where, doc } = firestore();
  const boardId = kind === 'global' ? 'global' : day;
  if (!boardId || (kind === 'daily' && !isValidDateKey(boardId))) throw new Error('invalid-board');
  const entries = collection(db, 'leaderboards', boardId, 'entries');
  const q = kind === 'global'
    ? query(entries, orderBy('score', 'desc'), orderBy('solved', 'desc'), limit(100))
    : query(entries, orderBy('stars', 'desc'), orderBy('moves', 'asc'), orderBy('time', 'asc'), limit(100));
  const snapshot = await getDocsFromServer(q);
  const rawEntries: LeaderboardEntry[] = snapshot.docs.map((d: any) => ({ key: d.id, ...d.data() } as LeaderboardEntry));
  // Refresh the current player's name on leaderboard visits, including legacy entries that
  // predate the public name mapping. The random key remains the only public player identifier.
  const ownProfile = await getDoc(doc(db, 'leaderboardProfiles', state.account.uid));
  if (ownProfile.exists()) {
    const ownKey = ownProfile.data().key;
    const ownName = state.profile.name || state.account.name || '';
    if (rawEntries.some((entry) => entry.key === ownKey)) {
      await setDoc(doc(db, 'leaderboardNames', ownKey), { displayName: cleanDisplayName(ownName) });
    }
  }
  const names: Record<string, string> = {};
  const keys = [...new Set(rawEntries.map((entry) => entry.key))];
  for (let i = 0; i < keys.length; i += 30) {
    const batch = keys.slice(i, i + 30);
    if (!batch.length) continue;
    const nameQuery = query(collection(db, 'leaderboardNames'), where(documentId(), 'in', batch));
    const nameSnapshot = await getDocsFromServer(nameQuery);
    for (const nameDoc of nameSnapshot.docs as any[]) {
      const value = nameDoc.data()?.displayName;
      if (typeof value === 'string') names[nameDoc.id] = value;
    }
  }
  return mapLeaderboardNames(rawEntries, names);
}
