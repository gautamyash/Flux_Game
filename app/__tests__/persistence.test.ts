jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { flushStore, loadStore, setProfile } from '../src/store/store';

describe('local persistence failures', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    await loadStore();
  });

  test('flushStore rejects when the local snapshot cannot be written', async () => {
    setProfile({ name: 'Unsaved' });
    const multiSet = jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(flushStore()).rejects.toThrow('storage unavailable');
    multiSet.mockRestore();
  });
});
