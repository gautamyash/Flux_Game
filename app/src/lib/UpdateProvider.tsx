import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { flushStore } from '../store/store';
import { waitForPendingLeaderboardSubmissions } from '../cloud/leaderboards';
import { UpdateManager } from './updateManager';

type UpdateContextValue = {
  status: ReturnType<UpdateManager['getSnapshot']>['status'];
  progress: number | null;
  enabled: boolean;
  runPrimaryAction: () => Promise<void>;
  checkUpdates: () => Promise<void>;
  setGameActive: (active: boolean) => void;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

async function flushBeforeReload() {
  await flushStore();
  await waitForPendingLeaderboardSubmissions();
  await flushStore();
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const native = Updates.useUpdates();
  const enabled = !__DEV__ && Updates.isEnabled;
  const manager = useMemo(() => new UpdateManager({
    enabled,
    development: __DEV__,
    checkForUpdateAsync: Updates.checkForUpdateAsync,
    fetchUpdateAsync: Updates.fetchUpdateAsync,
    reloadAsync: Updates.reloadAsync,
    flushBeforeReload,
  }), [enabled]);
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);

  useEffect(() => {
    manager.observeNativeState({
      isUpdateAvailable: native.isUpdateAvailable,
      isUpdatePending: native.isUpdatePending,
      isChecking: native.isChecking,
      isDownloading: native.isDownloading,
      downloadProgress: native.downloadProgress,
      lastCheckForUpdateTimeSinceRestart: native.lastCheckForUpdateTimeSinceRestart,
    });
  }, [manager, native.isUpdateAvailable, native.isUpdatePending, native.isChecking, native.isDownloading, native.downloadProgress, native.lastCheckForUpdateTimeSinceRestart]);

  useEffect(() => {
    if (native.checkError) manager.reportCheckError();
  }, [manager, native.checkError]);

  useEffect(() => {
    if (native.downloadError) manager.reportDownloadError();
  }, [manager, native.downloadError]);

  useEffect(() => {
    if (!enabled) return;
    // The preview APK performs this launch check natively with ON_LOAD.
    void manager.checkOnLaunch(Updates.checkAutomatically === Updates.UpdatesCheckAutomaticallyValue.ON_LOAD);

    let previousState = AppState.currentState;
    manager.setAppActive(previousState === 'active');
    const subscription = AppState.addEventListener('change', (nextState) => {
      manager.setAppActive(nextState === 'active');
      if (nextState === 'active' && previousState !== 'active') void manager.checkOnForeground();
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [enabled, manager]);

  const value = useMemo<UpdateContextValue>(() => ({
    status: snapshot.status,
    progress: snapshot.progress,
    enabled,
    runPrimaryAction: manager.runPrimaryAction,
    checkUpdates: () => manager.check(true),
    setGameActive: manager.setGameActive,
  }), [snapshot, enabled, manager]);

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdateManager() {
  const value = useContext(UpdateContext);
  if (!value) throw new Error('useUpdateManager outside UpdateProvider');
  return value;
}
