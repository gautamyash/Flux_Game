jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/config', () => ({
  FIREBASE_CONFIG: {}, GOOGLE_WEB_CLIENT_ID: 'test-web-client', cloudConfigured: () => true,
}));

const mockState = {
  user: { uid: 'guest-uid', isAnonymous: true, providerData: [], email: null, displayName: null, photoURL: null },
  google: {
    configure: jest.fn(), hasPlayServices: jest.fn(async () => undefined),
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'id-token', user: { email: 'player@example.com', name: 'Player', photo: null } } })),
    signOut: jest.fn(),
  },
  linkWithCredential: jest.fn(),
  signInWithCredential: jest.fn(),
  anonymousCloud: null as string | null,
};

jest.mock('firebase/app', () => ({ getApps: () => [], getApp: () => ({}), initializeApp: () => ({}) }));
jest.mock('firebase/auth', () => ({
  initializeAuth: () => ({ currentUser: mockState.user, authStateReady: async () => undefined }),
  getReactNativePersistence: () => ({}), getAuth: () => ({ currentUser: mockState.user }),
  GoogleAuthProvider: { credential: (token: string) => ({ token }) },
  linkWithCredential: (...args: unknown[]) => mockState.linkWithCredential(...args),
  signInWithCredential: (...args: unknown[]) => mockState.signInWithCredential(...args),
}));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}), getFirestore: () => ({}), doc: () => ({}),
  getDoc: async () => ({ exists: () => mockState.anonymousCloud !== null, data: () => ({ data: mockState.anonymousCloud }) }),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: mockState.google }));

import { signInWithGoogle } from '../src/cloud/auth';

describe('Google sign-in account linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.user.uid = 'guest-uid';
    mockState.user.isAnonymous = true;
    mockState.anonymousCloud = null;
    mockState.google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token', user: { email: 'player@example.com', name: 'Player', photo: null } } });
    mockState.linkWithCredential.mockResolvedValue({ user: { uid: 'guest-uid', email: 'player@example.com', displayName: 'Player', photoURL: null } });
    mockState.signInWithCredential.mockResolvedValue({ user: { uid: 'google-uid', email: 'player@example.com', displayName: 'Player', photoURL: null } });
  });

  test('first sign-in links Google to an existing anonymous Firebase UID', async () => {
    const result = await signInWithGoogle(jest.fn(async () => undefined));
    expect(result).toMatchObject({ ok: true, account: { uid: 'guest-uid' } });
    expect(mockState.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(mockState.signInWithCredential).not.toHaveBeenCalled();
  });

  test('credential already used signs into that existing account without deleting the guest UID', async () => {
    mockState.linkWithCredential.mockRejectedValueOnce({ code: 'auth/credential-already-in-use' });
    mockState.anonymousCloud = '{"legacy":"guest-cloud"}';
    const importBeforeSwitch = jest.fn(async (_json: string | null) => undefined);
    const result = await signInWithGoogle(importBeforeSwitch);
    expect(result).toMatchObject({ ok: true, account: { uid: 'google-uid' } });
    expect(mockState.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(mockState.user.uid).toBe('guest-uid');
    expect(importBeforeSwitch).toHaveBeenCalledWith(mockState.anonymousCloud);
    expect(importBeforeSwitch.mock.invocationCallOrder[0]).toBeLessThan(mockState.signInWithCredential.mock.invocationCallOrder[0]);
  });

  test('a canceled Google picker does not link or sign into a Firebase account', async () => {
    mockState.google.signIn.mockResolvedValueOnce({ type: 'cancelled' } as never);
    expect(await signInWithGoogle(jest.fn(async () => undefined))).toMatchObject({ ok: false, cancelled: true });
    expect(mockState.linkWithCredential).not.toHaveBeenCalled();
    expect(mockState.signInWithCredential).not.toHaveBeenCalled();
  });

  test('an established app account never links an unexpected anonymous Firebase session', async () => {
    const importCollision = jest.fn(async (_json: string | null) => undefined);
    const result = await signInWithGoogle(importCollision, false);
    expect(result).toMatchObject({ ok: true, account: { uid: 'google-uid' } });
    expect(mockState.linkWithCredential).not.toHaveBeenCalled();
    expect(importCollision).not.toHaveBeenCalled();
    expect(mockState.signInWithCredential).toHaveBeenCalledTimes(1);
  });

  test('network failure while linking returns a recoverable failure without changing the UID', async () => {
    mockState.linkWithCredential.mockRejectedValueOnce({ code: 'auth/network-request-failed', message: 'network request failed' });
    expect(await signInWithGoogle(jest.fn(async () => undefined))).toMatchObject({ ok: false, error: expect.stringContaining('local progress is safe') });
    expect(mockState.user.uid).toBe('guest-uid');
  });
});
