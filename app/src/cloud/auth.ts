import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG, GOOGLE_WEB_CLIENT_ID, cloudConfigured } from '../config';
import type { Account } from '../store/store';

/* Firebase is loaded lazily so the app (and the tests) work without it being configured. */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

let appInst: any = null;
let authInst: any = null;
let dbInst: any = null;
let configured = false;

function firebase() {
  if (appInst) return { app: appInst, auth: authInst, db: dbInst };
  const { initializeApp, getApps, getApp } = require('firebase/app');
  const fbAuth = require('firebase/auth');
  const { initializeFirestore, getFirestore } = require('firebase/firestore');
  appInst = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  try {
    authInst = fbAuth.initializeAuth(appInst, { persistence: fbAuth.getReactNativePersistence(AsyncStorage) });
  } catch {
    authInst = fbAuth.getAuth(appInst);
  }
  try {
    dbInst = initializeFirestore(appInst, { experimentalForceLongPolling: true });
  } catch {
    dbInst = getFirestore(appInst);
  }
  return { app: appInst, auth: authInst, db: dbInst };
}

function google() {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
    configured = true;
  }
  return GoogleSignin;
}

export type SignInResult = { ok: true; account: Account } | { ok: false; cancelled?: boolean; error: string };

export async function signInWithGoogle(onAccountCollision: (anonymousCloudJson: string | null) => Promise<void>, allowAnonymousLink = true): Promise<SignInResult> {
  if (!cloudConfigured()) return { ok: false, error: 'Google sign-in is not set up in this build yet. You can continue as a guest.' };
  try {
    const { auth } = firebase();
    await auth.authStateReady?.();
    const gs = google();
    await gs.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await gs.signIn();
    if (res.type !== 'success') return { ok: false, cancelled: true, error: 'Sign-in cancelled.' };
    const idToken: string | null = res.data.idToken;
    if (!idToken) return { ok: false, error: 'Google did not return a sign-in token. Please try again.' };
    const fbAuth = require('firebase/auth');
    const credential = fbAuth.GoogleAuthProvider.credential(idToken);
    let cred: any;
    // Anonymous Firebase users already have a UID and possibly private cloud data. Link first
    // so successful conversion keeps that UID; an already-used Google credential is handled
    // by signing into that existing UID and merging progress in the normal sync transaction.
    if (auth.currentUser?.isAnonymous && allowAnonymousLink) {
      try {
        cred = await fbAuth.linkWithCredential(auth.currentUser, credential);
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') throw e;
        // Preserve any private data already attached to the anonymous UID locally before
        // Firebase switches currentUser to the pre-existing Google UID.
        const anonymousCloudJson = await readRemote(auth.currentUser.uid);
        await onAccountCollision(anonymousCloudJson);
        cred = await fbAuth.signInWithCredential(auth, credential);
      }
    } else {
      cred = await fbAuth.signInWithCredential(auth, credential);
    }
    const u = cred.user;
    return {
      ok: true,
      account: { uid: u.uid, email: u.email ?? res.data.user.email ?? '', name: u.displayName ?? res.data.user.name ?? '', photo: u.photoURL ?? res.data.user.photo ?? null },
    };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === 'ERR_CANCELED') return { ok: false, cancelled: true, error: 'Sign-in cancelled.' };
    if (code === 'IN_PROGRESS') return { ok: false, error: 'Sign-in is already in progress.' };
    if (code === 'PLAY_SERVICES_NOT_AVAILABLE') return { ok: false, error: 'Google Play services are missing or out of date on this phone.' };
    const net = String((e as { message?: string })?.message ?? '').toLowerCase();
    if (code === 'auth/network-request-failed' || net.includes('network')) return { ok: false, error: 'No internet connection. Your local progress is safe; reconnect and try again.' };
    return { ok: false, error: 'Could not sign in. Please try again, or continue as a guest.' };
  }
}

/** true once Firebase has a signed-in user (restored from the previous session). */
export async function ensureFirebaseUser(expectUid: string): Promise<boolean> {
  if (!cloudConfigured()) return false;
  try {
    const { auth } = firebase();
    await auth.authStateReady?.();
    return auth.currentUser?.uid === expectUid;
  } catch {
    return false;
  }
}

/** Leaderboards require the Google provider, not only a locally selected Google mode. */
export async function ensureGoogleFirebaseUser(expectUid: string): Promise<boolean> {
  if (!(await ensureFirebaseUser(expectUid))) return false;
  try {
    const { auth } = firebase();
    return auth.currentUser?.providerData?.some((p: { providerId?: string }) => p.providerId === 'google.com') ?? false;
  } catch {
    return false;
  }
}

/** Firestore handle for leaderboard operations, only after confirming the signed-in Google UID. */
export async function leaderboardFirestore(expectUid: string): Promise<any | null> {
  if (!(await ensureGoogleFirebaseUser(expectUid))) return null;
  return firebase().db;
}

export async function signOutCloud(): Promise<void> {
  try {
    if (cloudConfigured()) {
      const { auth } = firebase();
      await require('firebase/auth').signOut(auth);
      try { await google().signOut(); } catch { /* ignore */ }
    }
  } catch {
    /* ignore */
  }
}

export async function readRemote(uid: string): Promise<string | null> {
  const { db } = firebase();
  const { doc, getDoc } = require('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return typeof d?.data === 'string' ? d.data : null;
}

export async function writeRemote(uid: string, json: string): Promise<void> {
  const { db } = firebase();
  const { doc, setDoc } = require('firebase/firestore');
  await setDoc(doc(db, 'users', uid), { data: json, updatedAt: Date.now() });
}

/** Read/merge/write one private progress document atomically so another device cannot be lost. */
export async function transactRemote<T>(uid: string, update: (currentJson: string | null) => { json: string | null; result: T }): Promise<T> {
  const { db } = firebase();
  const { doc, runTransaction } = require('firebase/firestore');
  const ref = doc(db, 'users', uid);
  return runTransaction(db, async (tx: any) => {
    const snap = await tx.get(ref);
    const raw = snap.exists() ? snap.data()?.data : null;
    if (raw !== null && typeof raw !== 'string') throw new Error('Cloud progress has an unsupported format. Your local progress is safe.');
    const next = update(raw);
    if (next.json !== null && next.json !== raw) tx.set(ref, { data: next.json, updatedAt: Date.now() });
    return next.result;
  });
}

export async function deleteRemote(uid: string): Promise<void> {
  const { db } = firebase();
  const { doc, deleteDoc } = require('firebase/firestore');
  await deleteDoc(doc(db, 'users', uid));
}

export async function deleteLeaderboardProfile(uid: string): Promise<void> {
  if (!cloudConfigured()) return;
  const { db } = firebase();
  const { doc, deleteDoc } = require('firebase/firestore');
  await deleteDoc(doc(db, 'leaderboardProfiles', uid));
}

/** Delete the cloud copy and the Firebase user, then sign out. (The Firebase user delete may need a recent sign-in; the data itself is always removed first.) */
export type DeleteCloudAccountResult = { ok: true } | { ok: false; error: string };

export async function deleteCloudAccount(uid: string): Promise<DeleteCloudAccountResult> {
  try {
    if (!cloudConfigured()) return { ok: false, error: 'Firebase is not configured in this build.' };
    const { auth, db } = firebase();
    await auth.authStateReady?.();
    const current = auth.currentUser;
    if (current?.uid !== uid || !current.providerData?.some((p: { providerId?: string }) => p.providerId === 'google.com')) {
      return { ok: false, error: 'Sign in to the Google account whose cloud data you want to delete, then retry.' };
    }
    const { doc, writeBatch } = require('firebase/firestore');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid));
    batch.delete(doc(db, 'leaderboardProfiles', uid));
    await batch.commit();

    try {
      await require('firebase/auth').deleteUser(current);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        return { ok: false, error: 'Your cloud progress and private leaderboard profile were deleted. Firebase requires a recent sign-in to remove the Google login; sign in again, then retry deletion.' };
      }
      return { ok: false, error: 'Your cloud data was deleted, but Firebase could not remove the sign-in account. Sign in again and retry deletion.' };
    }
    await signOutCloud();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete your cloud data. Nothing was deleted unless the request was confirmed; check your connection and retry.' };
  }
}
