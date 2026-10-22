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

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!cloudConfigured()) return { ok: false, error: 'Google sign-in is not set up in this build yet. You can continue as a guest.' };
  try {
    const gs = google();
    await gs.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await gs.signIn();
    if (res.type !== 'success') return { ok: false, cancelled: true, error: 'Sign-in cancelled.' };
    const idToken: string | null = res.data.idToken;
    if (!idToken) return { ok: false, error: 'Google did not return a sign-in token. Please try again.' };
    const { auth } = firebase();
    const { GoogleAuthProvider, signInWithCredential } = require('firebase/auth');
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
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
    if (net.includes('network')) return { ok: false, error: 'No internet connection. Check your network and try again, or continue as a guest.' };
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

export async function deleteRemote(uid: string): Promise<void> {
  const { db } = firebase();
  const { doc, deleteDoc } = require('firebase/firestore');
  await deleteDoc(doc(db, 'users', uid));
}

/** Delete the cloud copy and the Firebase user, then sign out. (The Firebase user delete may need a recent sign-in; the data itself is always removed first.) */
export async function deleteCloudAccount(uid: string): Promise<boolean> {
  let ok = true;
  try {
    if (cloudConfigured()) {
      await deleteRemote(uid);
      try {
        const { auth } = firebase();
        if (auth.currentUser?.uid === uid) await require('firebase/auth').deleteUser(auth.currentUser);
      } catch {
        /* the stored data is already gone; the empty sign-in record is harmless */
      }
    }
  } catch {
    ok = false;
  }
  if (ok) await signOutCloud();
  return ok;
}
