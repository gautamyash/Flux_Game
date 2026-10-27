/** @jest-environment node */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

let env: any;
let assertFails: (promise: Promise<unknown>) => Promise<unknown>;
let assertSucceeds: (promise: Promise<unknown>) => Promise<unknown>;
let initializeTestEnvironment: (options: any) => Promise<any>;
const previousFetch = global.fetch;
const emulatorAvailable = !!process.env.FIRESTORE_EMULATOR_HOST;
const describeRules = emulatorAvailable ? describe : describe.skip;
const key = 'Abcdefghijklmnop1234';
const google = (uid: string) => env!.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const guest = (uid: string) => env!.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

beforeAll(async () => {
  if (!emulatorAvailable) return;
  // Keep emulator-only tooling optional for the normal Jest suite.
  ({ assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing'));
  const { fetch: nodeFetch } = require('undici');
  global.fetch = nodeFetch as typeof fetch;
  env = await initializeTestEnvironment({
    projectId: 'demo-flux-rules',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => { if (env) await env.clearFirestore(); });
afterAll(async () => { if (env) await env.cleanup(); global.fetch = previousFetch; });

describeRules('local Firestore rules: private progress', () => {
  test('allows owner reads and exact owner writes; denies other owners, guests, and list reads', async () => {
    const owner = google('user-a');
    const ref = doc(owner, 'users/user-a');
    await assertSucceeds(setDoc(ref, { data: '{"v":1}', updatedAt: Date.now() }));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(google('user-b'), 'users/user-a')));
    // An authenticated anonymous UID may read only its own legacy private progress document.
    await assertSucceeds(getDoc(doc(guest('user-a'), 'users/user-a')));
    await assertFails(getDocs(collection(owner, 'users')));
  });

  test('rejects missing, extra, or mistyped fields and only permits owner deletion', async () => {
    const owner = google('user-a');
    await assertFails(setDoc(doc(owner, 'users/user-a'), { data: '{}' }));
    await assertFails(setDoc(doc(owner, 'users/user-a'), { data: '{}', updatedAt: 'now' }));
    await assertFails(setDoc(doc(owner, 'users/user-a'), { data: '{}', updatedAt: Date.now(), email: 'private@example.com' }));
    await assertSucceeds(setDoc(doc(owner, 'users/user-a'), { data: '{}', updatedAt: Date.now() }));
    await assertFails(deleteDoc(doc(google('user-b'), 'users/user-a')));
    await assertSucceeds(deleteDoc(doc(owner, 'users/user-a')));
  });
});

describeRules('local Firestore rules: pseudonymous leaderboard', () => {
  async function createProfile(uid = 'user-a') {
    await assertSucceeds(setDoc(doc(google(uid), 'leaderboardProfiles', uid), { key }));
  }

  test('profiles are private, Google-only, UID-owned, and immutable except for deletion', async () => {
    await createProfile();
    await assertSucceeds(getDoc(doc(google('user-a'), 'leaderboardProfiles/user-a')));
    await assertFails(getDoc(doc(google('user-b'), 'leaderboardProfiles/user-a')));
    await assertFails(getDoc(doc(guest('user-a'), 'leaderboardProfiles/user-a')));
    await assertFails(setDoc(doc(google('user-a'), 'leaderboardProfiles/user-a'), { key: 'Z'.repeat(20) }));
    await assertFails(getDocs(collection(google('user-a'), 'leaderboardProfiles')));
  });

  test('score entry and run receipt must be an atomic matching transaction; duplicate receipts cannot be overwritten', async () => {
    await createProfile();
    const db = google('user-a');
    const batch = writeBatch(db);
    batch.set(doc(db, 'leaderboards/global/entries', key), {
      key, score: 6, solved: 2, lastRunId: 'run-12345678', updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'leaderboards/global/submissions/run-12345678'), { key });
    await assertSucceeds(batch.commit());

    await assertFails(setDoc(doc(db, 'leaderboards/global/submissions/run-12345678'), { key }));
    await assertFails(setDoc(doc(guest('user-b'), 'leaderboards/global/entries', key), {
      key, score: 999, solved: 99, lastRunId: 'run-87654321', updatedAt: serverTimestamp(),
    }));
  });

  test('enforces bounds, best-score tie rules, and real Daily calendar dates', async () => {
    await createProfile();
    const db = google('user-a');
    const globalEntry = doc(db, 'leaderboards/global/entries', key);
    const globalRun = doc(db, 'leaderboards/global/submissions/run-10000001');
    const batch = writeBatch(db);
    batch.set(globalEntry, { key, score: 6, solved: 2, lastRunId: 'run-10000001', updatedAt: serverTimestamp() });
    batch.set(globalRun, { key });
    await assertSucceeds(batch.commit());

    const lower = writeBatch(db);
    lower.set(doc(db, 'leaderboards/global/submissions/run-10000002'), { key });
    await assertSucceeds(lower.commit()); // valid run recorded; best entry is unchanged
    const invalid = writeBatch(db);
    invalid.set(doc(db, 'leaderboards/global/entries', key), { key, score: 100001, solved: 2, lastRunId: 'run-10000003', updatedAt: serverTimestamp() });
    invalid.set(doc(db, 'leaderboards/global/submissions/run-10000003'), { key });
    await assertFails(invalid.commit());

    const daily = writeBatch(db);
    daily.set(doc(db, 'leaderboards/2024-02-29/entries', key), {
      key, stars: 3, moves: 12, time: 30, lastRunId: 'run-daily-1234', updatedAt: serverTimestamp(),
    });
    daily.set(doc(db, 'leaderboards/2024-02-29/submissions/run-daily-1234'), { key });
    await assertSucceeds(daily.commit());
    const impossible = writeBatch(db);
    impossible.set(doc(db, 'leaderboards/2026-02-29/entries', key), {
      key, stars: 3, moves: 12, time: 30, lastRunId: 'run-daily-5678', updatedAt: serverTimestamp(),
    });
    impossible.set(doc(db, 'leaderboards/2026-02-29/submissions/run-daily-5678'), { key });
    await assertFails(impossible.commit());
  });

  test('allows Google reads of entries but denies guest reads and all submission listing', async () => {
    await createProfile();
    const db = google('user-a');
    const batch = writeBatch(db);
    batch.set(doc(db, 'leaderboards/global/entries', key), {
      key, score: 1, solved: 1, lastRunId: 'run-public-1234', updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'leaderboards/global/submissions/run-public-1234'), { key });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(google('user-b'), 'leaderboards/global/entries', key)));
    await assertFails(getDoc(doc(guest('user-b'), 'leaderboards/global/entries', key)));
    await assertFails(getDocs(collection(db, 'leaderboards/global/submissions')));
  });
});
