export const UPDATE_CHECK_COOLDOWN_MS = 60_000;
const SAFE_RELOAD_DELAY_MS = 350;

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'deferred'
  | 'applying'
  | 'up-to-date'
  | 'check-error'
  | 'download-error'
  | 'apply-error';

export type UpdateManagerState = { status: UpdateStatus; progress: number | null };

export type UpdateApi = {
  enabled: boolean;
  development: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
  flushBeforeReload: () => Promise<void>;
};

export type NativeUpdateState = {
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress?: number;
  lastCheckForUpdateTimeSinceRestart?: Date;
};

export class UpdateManager {
  private state: UpdateManagerState;
  private listeners = new Set<() => void>();
  private checkPromise: Promise<void> | null = null;
  private actionPromise: Promise<void> | null = null;
  private nativeChecking = false;
  private nativeDownloading = false;
  private lastCheckAt: number | null = null;
  private gameActive = false;
  private appActive = true;
  private applyRequested = false;
  private deferredApplyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly api: UpdateApi, initiallyPending = false) {
    this.state = { status: initiallyPending ? 'ready' : 'idle', progress: initiallyPending ? 1 : null };
  }

  getSnapshot = (): UpdateManagerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(status: UpdateStatus, progress = status === 'downloading' ? this.state.progress : null) {
    if (this.state.status === status && this.state.progress === progress) return;
    this.state = { status, progress };
    this.listeners.forEach((listener) => listener());
  }

  private get canUseUpdates() {
    return this.api.enabled && !this.api.development;
  }

  observeNativeState(native: NativeUpdateState) {
    this.nativeChecking = native.isChecking;
    this.nativeDownloading = native.isDownloading;
    if (native.lastCheckForUpdateTimeSinceRestart) {
      this.lastCheckAt = native.lastCheckForUpdateTimeSinceRestart.getTime();
    }
    if (!this.canUseUpdates || this.state.status === 'applying') return;

    if (native.isUpdatePending) {
      if (this.state.status === 'deferred') return;
      this.applyRequested = false;
      this.setState('ready', 1);
    } else if (native.isDownloading) {
      const progress = Number.isFinite(native.downloadProgress) ? native.downloadProgress! : this.state.progress;
      this.setState('downloading', progress);
    } else if (native.isChecking) {
      this.setState('checking');
    } else if (native.isUpdateAvailable) {
      this.setState('available');
    } else if (this.state.status === 'checking') {
      this.setState('up-to-date');
    }
  }

  setGameActive = (active: boolean) => {
    if (this.gameActive === active) return;
    this.gameActive = active;
    if (this.deferredApplyTimer) {
      clearTimeout(this.deferredApplyTimer);
      this.deferredApplyTimer = null;
    }
    if (!active) this.scheduleDeferredApply();
  };

  setAppActive = (active: boolean) => {
    this.appActive = active;
    if (active) this.scheduleDeferredApply();
    else if (this.deferredApplyTimer) {
      clearTimeout(this.deferredApplyTimer);
      this.deferredApplyTimer = null;
    }
  };

  private scheduleDeferredApply() {
    if (!this.appActive || this.gameActive || !this.applyRequested || this.state.status !== 'deferred' || this.deferredApplyTimer) return;
    this.deferredApplyTimer = setTimeout(() => {
      this.deferredApplyTimer = null;
      this.applyRequested = false;
      this.setState('ready', 1);
    }, SAFE_RELOAD_DELAY_MS);
  }

  reportCheckError = () => {
    if (this.canUseUpdates && this.state.status !== 'ready' && this.state.status !== 'deferred' && this.state.status !== 'applying') this.setState('check-error');
  };

  reportDownloadError = () => {
    if (this.canUseUpdates && this.state.status !== 'ready' && this.state.status !== 'deferred' && this.state.status !== 'applying') this.setState('download-error');
  };

  checkOnLaunch = (nativeChecksOnLaunch: boolean): Promise<void> => (
    nativeChecksOnLaunch ? Promise.resolve() : this.check(true)
  );

  checkOnForeground = (): Promise<void> => this.check();

  check = (force = false): Promise<void> => {
    if (!this.canUseUpdates || this.state.status === 'ready' || this.state.status === 'deferred' || this.state.status === 'applying') return Promise.resolve();
    if (this.checkPromise) return this.checkPromise;
    if (this.nativeChecking || this.nativeDownloading || this.state.status === 'downloading') return Promise.resolve();
    if (!force && this.lastCheckAt !== null && Date.now() - this.lastCheckAt < UPDATE_CHECK_COOLDOWN_MS) return Promise.resolve();

    this.lastCheckAt = Date.now();
    this.setState('checking');
    const request = Promise.resolve()
      .then(() => this.api.checkForUpdateAsync())
      .then((result) => this.setState(result.isAvailable ? 'available' : 'up-to-date'))
      .catch(() => this.setState('check-error'))
      .finally(() => { this.checkPromise = null; });
    this.checkPromise = request;
    return request;
  };

  runPrimaryAction = (): Promise<void> => {
    if (this.actionPromise) return this.actionPromise;

    let action: (() => Promise<void>) | null = null;
    switch (this.state.status) {
      case 'available':
      case 'download-error':
        action = () => this.download();
        break;
      case 'ready':
      case 'apply-error':
        action = () => this.requestApply();
        break;
      case 'check-error':
      case 'up-to-date':
        action = () => this.check(true);
        break;
      default:
        return Promise.resolve();
    }

    const request = action().finally(() => {
      if (this.actionPromise === request) this.actionPromise = null;
    });
    this.actionPromise = request;
    return request;
  };

  private async download() {
    if (!this.canUseUpdates || this.nativeDownloading || this.nativeChecking) return;
    this.setState('downloading', 0);
    try {
      const result = await this.api.fetchUpdateAsync();
      if (result.isNew) this.setState('ready', 1);
      else this.setState('up-to-date');
    } catch {
      this.setState('download-error');
    }
  }

  private requestApply(): Promise<void> {
    if (!this.canUseUpdates) return Promise.resolve();
    if (this.gameActive) {
      this.applyRequested = true;
      this.setState('deferred', 1);
      return Promise.resolve();
    }
    return this.apply();
  }

  private async apply() {
    if (!this.canUseUpdates || !this.appActive || this.gameActive || this.state.status === 'applying' || this.applyRequested) return;
    this.applyRequested = false;
    this.setState('applying');
    try {
      await this.api.flushBeforeReload();
      // Navigation or app state can change while persistence and score writes are flushing.
      // Recheck immediately before reload so an update action cannot interrupt a new run.
      if (!this.appActive) {
        this.setState('ready', 1);
        return;
      }
      if (this.gameActive) {
        this.applyRequested = true;
        this.setState('deferred', 1);
        return;
      }
      await this.api.reloadAsync();
    } catch {
      this.setState('apply-error');
    }
  }
}
