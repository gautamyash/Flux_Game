import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'flux.crashlog';
const MAX = 8;

export interface CrashEntry {
  at: number;
  where: string;
  message: string;
  stack?: string;
}

let last: CrashEntry | null = null;

export function lastCrash(): CrashEntry | null {
  return last;
}

/** Record an error locally (kept on the phone, newest last). Never throws. */
export async function logCrash(where: string, err: unknown): Promise<void> {
  const e = err as { message?: unknown; stack?: unknown } | null;
  const entry: CrashEntry = {
    at: Date.now(),
    where,
    message: String(e && e.message !== undefined ? e.message : err).slice(0, 500),
    stack: typeof e?.stack === 'string' ? e.stack.slice(0, 1500) : undefined,
  };
  last = entry;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: CrashEntry[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

export async function readCrashLog(): Promise<CrashEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

export function reportText(list: CrashEntry[]): string {
  if (!list.length) return 'No crashes recorded.';
  return list
    .map((c) => `${new Date(c.at).toISOString()} [${c.where}] ${c.message}${c.stack ? '\n' + c.stack : ''}`)
    .join('\n\n');
}

/** Catch uncaught JS errors (and unhandled promise rejections) so they land in the crash log. */
export function installGlobalHandlers() {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void };
  };
  const eu = g.ErrorUtils;
  if (eu) {
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((e, fatal) => {
      void logCrash(fatal ? 'fatal' : 'error', e);
      prev(e, fatal);
    });
  }
}
