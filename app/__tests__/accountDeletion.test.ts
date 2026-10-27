jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/config', () => ({ cloudConfigured: () => true, FIREBASE_CONFIG: {}, GOOGLE_WEB_CLIENT_ID: 'test-web-client' }));

const mockUser = { uid: 'google-a', providerData: [{ providerId: 'google.com' }] };
const mockAuth = { currentUser: mockUser, authStateReady: async () => undefined };
const mockBatch = { delete: jest.fn(), commit: jest.fn(async () => undefined) };
const mockDeleteUser = jest.fn(async (_user?: unknown) => undefined);

jest.mock('firebase/app', () => ({ getApps: () => [], getApp: () => ({}), initializeApp: () => ({}) }));
jest.mock('firebase/auth', () => ({
  initializeAuth: () => mockAuth,
  getReactNativePersistence: () => ({}),
  deleteUser: (user: unknown) => mockDeleteUser(user),
  signOut: jest.fn(async () => undefined),
}));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}), getFirestore: () => ({}),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  writeBatch: () => mockBatch,
}));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: { configure: jest.fn(), signOut: jest.fn() } }));

import { deleteCloudAccount } from '../src/cloud/auth';

describe('cloud account deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.uid = 'google-a';
    mockUser.providerData = [{ providerId: 'google.com' }];
    mockAuth.currentUser = mockUser;
    mockBatch.commit.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  test('deletes private progress and profile atomically before removing the Auth user', async () => {
    expect(await deleteCloudAccount('google-a')).toEqual({ ok: true });
    expect(mockBatch.delete.mock.calls).toEqual([['users/google-a'], ['leaderboardProfiles/google-a']]);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(mockUser);
  });

  test('a Firestore batch failure leaves the Firebase Auth user intact', async () => {
    mockBatch.commit.mockRejectedValueOnce(new Error('offline'));
    expect(await deleteCloudAccount('google-a')).toMatchObject({ ok: false });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test('reports when cloud documents were removed but recent authentication is required', async () => {
    mockDeleteUser.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
    expect(await deleteCloudAccount('google-a')).toMatchObject({ ok: false, error: expect.stringContaining('were deleted') });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  test('refuses to delete documents for a different or non-Google Firebase user', async () => {
    mockUser.uid = 'google-b';
    expect(await deleteCloudAccount('google-a')).toMatchObject({ ok: false });
    expect(mockBatch.commit).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
