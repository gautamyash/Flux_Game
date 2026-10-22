import { getState, setGoogleAccount, setGuest, signOutLocal } from '../store/store';
import { deleteCloudAccount, signInWithGoogle, signOutCloud } from './auth';
import { resetSyncMemory, syncNow } from './sync';

export type LoginOutcome = { ok: true } | { ok: false; cancelled?: boolean; error: string };

/** Google sign-in, then merge this phone's progress (guest progress included) with the account's cloud copy. */
export async function loginWithGoogle(): Promise<LoginOutcome> {
  const r = await signInWithGoogle();
  if (!r.ok) return r;
  setGoogleAccount(r.account);
  await syncNow();
  return { ok: true };
}

export function continueAsGuest() {
  setGuest();
}

/** Sign out. The progress stays in the account; this phone is cleared so the next person starts fresh. */
export async function logout() {
  await syncNow(); // make sure the latest progress is uploaded first
  await signOutCloud();
  resetSyncMemory();
  signOutLocal();
}

export async function deleteAccount(): Promise<boolean> {
  const uid = getState().account?.uid;
  if (!uid) return false;
  const ok = await deleteCloudAccount(uid);
  if (ok) { resetSyncMemory(); signOutLocal(); }
  return ok;
}
