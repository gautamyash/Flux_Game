import { getState, removeAccountProgressSnapshot, saveAccountProgressSnapshot, selectGoogleAccount, setGoogleAccount, setGuest, signOutLocal } from '../store/store';
import { flushStore } from '../store/store';
import { deleteCloudAccount, ensureGoogleFirebaseUser, signInWithGoogle, signOutCloud } from './auth';
import { mergeLocalProgress, resetSyncMemory, syncNow } from './sync';

export type LoginOutcome = { ok: true; warning?: string } | { ok: false; cancelled?: boolean; error: string };

/** Google sign-in, then merge this phone's progress (guest progress included) with the account's cloud copy. */
export async function loginWithGoogle(): Promise<LoginOutcome> {
  // Persist the guest snapshot before opening native auth. Cancellation or network errors then
  // cannot leave recent play only in memory when the app returns from the Google activity.
  let before = getState();
  try {
    await flushStore();
    before = getState();
    if (before.mode === 'google') {
      if (!before.account?.uid) return { ok: false, error: 'This saved progress has no verified account owner. It remains on this device; sign in to its original account before switching.' };
      await saveAccountProgressSnapshot(before.account.uid);
    }
  } catch {
    return { ok: false, error: 'Could not safely save this device’s progress before sign-in. Your current account and game remain unchanged; try again.' };
  }

  // Account-owned progress from an existing Google session must never be treated as guest data
  // during anonymous Firebase credential linking.
  const r = await signInWithGoogle(mergeLocalProgress, before.mode !== 'google');
  if (!r.ok) return r;
  const switching = before.mode === 'google' && before.account?.uid !== r.account.uid;
  try {
    if (switching) await selectGoogleAccount(r.account);
    else setGoogleAccount(r.account);
    if (switching) resetSyncMemory();
    // Persist the account association and matching progress before cloud I/O so a process kill
    // restores a retryable local state rather than pairing one account with another's save.
    await flushStore();
  } catch {
    await signOutCloud();
    return { ok: false, error: 'The new account could not be selected safely. Your previous progress remains on this device; sign in to the account that owns it to recover or sync it.' };
  }
  const sync = await syncNow();
  if (!sync.ok) return { ok: false, error: sync.error };
  try { await removeAccountProgressSnapshot(r.account.uid); } catch { /* cloud sync is confirmed; a stale local backup is safe to retry later */ }
  return switching
    ? { ok: true, warning: 'Your previous account’s progress was kept separate on this device. Sign in to that account again to sync or restore it.' }
    : { ok: true };
}

export function continueAsGuest() {
  setGuest();
}

/** Sign out. The progress stays in the account; this phone is cleared so the next person starts fresh. */
export async function logout(): Promise<{ ok: true } | { ok: false; error: string }> {
  const synced = await syncNow();
  if (!synced.ok) return synced; // keep this device's copy if the cloud write did not confirm
  const uid = getState().account?.uid;
  if (uid) {
    try { await removeAccountProgressSnapshot(uid); } catch {
      return { ok: false, error: 'Progress synced, but this device could not clear its saved account copy. Try signing out again.' };
    }
  }
  await signOutCloud();
  resetSyncMemory();
  signOutLocal();
  return { ok: true };
}

export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const uid = getState().account?.uid;
  if (!uid) return { ok: false, error: 'Sign in to the Google account whose cloud data you want to delete, then retry.' };
  if (!(await ensureGoogleFirebaseUser(uid))) return { ok: false, error: 'Sign in to the Google account whose cloud data you want to delete, then retry.' };
  try { await removeAccountProgressSnapshot(uid); }
  catch { return { ok: false, error: 'Could not clear the saved account copy on this device, so no cloud deletion was started. Try again.' }; }
  const result = await deleteCloudAccount(uid);
  if (result.ok) { resetSyncMemory(); signOutLocal(); }
  return result;
}
