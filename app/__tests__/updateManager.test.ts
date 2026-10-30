import { UpdateApi, UpdateManager, UPDATE_CHECK_COOLDOWN_MS } from '../src/lib/updateManager';

function createApi(overrides: Partial<UpdateApi> = {}) {
  const api: UpdateApi = {
    enabled: true,
    development: false,
    checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: true }),
    fetchUpdateAsync: jest.fn().mockResolvedValue({ isNew: true }),
    reloadAsync: jest.fn().mockResolvedValue(undefined),
    flushBeforeReload: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return api;
}

describe('UpdateManager', () => {
  it('exposes an update only after a successful available check', async () => {
    const api = createApi();
    const manager = new UpdateManager(api);

    await manager.check();

    expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot().status).toBe('available');
  });

  it('checks on launch when native startup checking is disabled', async () => {
    const api = createApi();
    const manager = new UpdateManager(api);

    await manager.checkOnLaunch(false);

    expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot().status).toBe('available');
  });

  it('uses Expo native launch checking when it is enabled', async () => {
    const api = createApi();
    const manager = new UpdateManager(api);

    await manager.checkOnLaunch(true);
    manager.observeNativeState({ isUpdateAvailable: true, isUpdatePending: false, isChecking: false, isDownloading: false });

    expect(api.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(manager.getSnapshot().status).toBe('available');
  });

  it('coalesces concurrent launch and foreground checks', async () => {
    let finishCheck!: (value: { isAvailable: boolean }) => void;
    const checkForUpdateAsync = jest.fn(() => new Promise<{ isAvailable: boolean }>((resolve) => { finishCheck = resolve; }));
    const manager = new UpdateManager(createApi({ checkForUpdateAsync }));

    const launchCheck = manager.checkOnLaunch(false);
    const foregroundCheck = manager.checkOnForeground();
    await Promise.resolve();
    expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);

    finishCheck({ isAvailable: true });
    await Promise.all([launchCheck, foregroundCheck]);
    expect(manager.getSnapshot().status).toBe('available');
  });

  it('throttles foreground checks after a recent native check', async () => {
    const api = createApi();
    const manager = new UpdateManager(api);
    manager.observeNativeState({
      isUpdateAvailable: false,
      isUpdatePending: false,
      isChecking: false,
      isDownloading: false,
      lastCheckForUpdateTimeSinceRestart: new Date(Date.now() - UPDATE_CHECK_COOLDOWN_MS + 1000),
    });

    await manager.checkOnForeground();
    expect(api.checkForUpdateAsync).not.toHaveBeenCalled();

    manager.observeNativeState({
      isUpdateAvailable: false,
      isUpdatePending: false,
      isChecking: false,
      isDownloading: false,
      lastCheckForUpdateTimeSinceRestart: new Date(Date.now() - UPDATE_CHECK_COOLDOWN_MS - 1000),
    });
    await manager.checkOnForeground();
    expect(api.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not show an update when the server reports none', async () => {
    const manager = new UpdateManager(createApi({
      checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: false }),
    }));

    await manager.check();

    expect(manager.getSnapshot().status).toBe('up-to-date');
  });

  it('shows the downloaded update as ready to apply', async () => {
    const api = createApi();
    const manager = new UpdateManager(api);
    await manager.check();

    await manager.runPrimaryAction();

    expect(api.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(api.reloadAsync).not.toHaveBeenCalled();
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('reports download failure and allows retry', async () => {
    const fetchUpdateAsync = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ isNew: true });
    const manager = new UpdateManager(createApi({ fetchUpdateAsync }));
    await manager.check();

    await manager.runPrimaryAction();
    expect(manager.getSnapshot().status).toBe('download-error');

    await manager.runPrimaryAction();
    expect(fetchUpdateAsync).toHaveBeenCalledTimes(2);
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('coalesces duplicate taps while an update is downloading', async () => {
    let finishDownload!: (value: { isNew: boolean }) => void;
    const fetchUpdateAsync = jest.fn(() => new Promise<{ isNew: boolean }>((resolve) => { finishDownload = resolve; }));
    const manager = new UpdateManager(createApi({ fetchUpdateAsync }));
    await manager.check();

    const firstTap = manager.runPrimaryAction();
    const secondTap = manager.runPrimaryAction();
    expect(fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot().status).toBe('downloading');

    finishDownload({ isNew: true });
    await Promise.all([firstTap, secondTap]);
    expect(manager.getSnapshot().status).toBe('ready');
  });

  it('applies an already downloaded update without fetching it again', async () => {
    const api = createApi();
    const manager = new UpdateManager(api, true);

    await manager.runPrimaryAction();

    expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(api.flushBeforeReload).toHaveBeenCalledTimes(1);
    expect(api.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('coalesces duplicate restart taps while reload is being applied', async () => {
    let finishReload!: () => void;
    const api = createApi({ reloadAsync: jest.fn(() => new Promise<void>((resolve) => { finishReload = resolve; })) });
    const manager = new UpdateManager(api, true);

    const firstTap = manager.runPrimaryAction();
    const secondTap = manager.runPrimaryAction();
    await Promise.resolve();
    expect(api.reloadAsync).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot().status).toBe('applying');

    finishReload();
    await Promise.all([firstTap, secondTap]);
  });

  it('does not reload if saving local progress fails', async () => {
    const api = createApi({ flushBeforeReload: jest.fn().mockRejectedValueOnce(new Error('storage unavailable')) });
    const manager = new UpdateManager(api, true);

    await manager.runPrimaryAction();

    expect(manager.getSnapshot().status).toBe('apply-error');
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it('defers reload if gameplay starts while persistence is flushing', async () => {
    let finishFlush!: () => void;
    const api = createApi({ flushBeforeReload: jest.fn(() => new Promise<void>((resolve) => { finishFlush = resolve; })) });
    const manager = new UpdateManager(api, true);

    const apply = manager.runPrimaryAction();
    await Promise.resolve();
    manager.setGameActive(true);
    finishFlush();
    await apply;

    expect(manager.getSnapshot().status).toBe('deferred');
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it('cancels reload if the app backgrounds while persistence is flushing', async () => {
    let finishFlush!: () => void;
    const api = createApi({ flushBeforeReload: jest.fn(() => new Promise<void>((resolve) => { finishFlush = resolve; })) });
    const manager = new UpdateManager(api, true);

    const apply = manager.runPrimaryAction();
    await Promise.resolve();
    manager.setAppActive(false);
    finishFlush();
    await apply;

    expect(manager.getSnapshot().status).toBe('ready');
    expect(api.reloadAsync).not.toHaveBeenCalled();
  });

  it('defers an update restart during gameplay until the game route exits', async () => {
    jest.useFakeTimers();
    const api = createApi();
    const manager = new UpdateManager(api);
    await manager.check();
    await manager.runPrimaryAction();
    manager.setGameActive(true);

    await manager.runPrimaryAction();
    expect(manager.getSnapshot().status).toBe('deferred');
    expect(api.reloadAsync).not.toHaveBeenCalled();

    manager.setGameActive(false);
    await jest.advanceTimersByTimeAsync(350);
    expect(manager.getSnapshot().status).toBe('ready');
    expect(api.reloadAsync).not.toHaveBeenCalled();

    await manager.runPrimaryAction();
    expect(api.flushBeforeReload).toHaveBeenCalledTimes(1);
    expect(api.reloadAsync).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('shows retryable check errors without claiming an update is available', async () => {
    const checkForUpdateAsync = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ isAvailable: false });
    const manager = new UpdateManager(createApi({ checkForUpdateAsync }));

    await manager.check();
    expect(manager.getSnapshot().status).toBe('check-error');

    await manager.runPrimaryAction();
    expect(checkForUpdateAsync).toHaveBeenCalledTimes(2);
    expect(manager.getSnapshot().status).toBe('up-to-date');
  });
});
