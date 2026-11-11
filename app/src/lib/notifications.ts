import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  currentLevelId,
  dateKey,
  ENERGY_MAX,
  ENERGY_REFILL_MS,
  getState,
  HINTS_MAX,
  HINTS_REFILL_MS,
  trustedNow,
} from '../store/store';
import { rewardDefinition } from './rewards';

export const CHANNEL_DEFAULT = 'reminders';
export const CHANNEL_REWARDS = 'rewards';

export type NotifRoute = 'daily' | 'resume' | 'home' | 'rewards' | 'campaign';

export type NotifCategory =
  | 'daily'
  | 'energy'
  | 'hints'
  | 'rewards'
  | 'milestones'
  | 'updates';

export interface CandidateNotification {
  id: string;
  category: NotifCategory;
  priority: number; // 1 = highest, 4 = lowest
  targetTime: Date;
  expiresAt?: Date;
  title: string;
  body: string;
  route: NotifRoute;
  channelId: string;
}

export interface ScheduledManifestEntry {
  id: string;
  targetTime: number;
  dayKey: string;
}

const QUIET_START_HOUR = 21; // 9:00 PM local
const QUIET_END_HOUR = 9; // 9:00 AM local
const MIN_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours minimum spacing
const MAX_NOTIFICATIONS_PER_DAY = 2; // At most 2 notifications per calendar day

const DELIVERED_HISTORY_KEY = 'flux.notified.delivered.v2';
const SCHEDULED_MANIFEST_KEY = 'flux.notified.scheduled.v2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Immediately mark a notification as delivered if received while app is active
Notifications.addNotificationReceivedListener((notification) => {
  const id = notification.request.identifier;
  if (id) {
    void markNotificationDelivered(id);
  }
});

Notifications.addNotificationResponseReceivedListener((response) => {
  const id = response.notification.request.identifier;
  if (id) {
    void markNotificationDelivered(id);
  }
});

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: 'Puzzle reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#0B7F7A',
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_REWARDS, {
    name: 'Rewards & Refills',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#F0B642',
  });
}

/** Asks for permission (Android 13+ shows a system dialog); returns true when reminders may be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannels();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/** Reads persistently delivered notification timestamps, pruning entries older than 7 days. */
export async function getDeliveredHistory(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERED_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [key, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < 7 * 24 * 3600 * 1000) {
        pruned[key] = ts;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

/**
 * Marks a notification as genuinely delivered (only when targetTime elapses or received by OS).
 * Never called merely when a notification is scheduled!
 */
export async function markNotificationDelivered(id: string, timestamp = Date.now()): Promise<void> {
  try {
    const hist = await getDeliveredHistory();
    hist[id] = timestamp;
    await AsyncStorage.setItem(DELIVERED_HISTORY_KEY, JSON.stringify(hist));
  } catch {
    /* ignore */
  }
}

export async function getScheduledManifest(): Promise<Record<string, ScheduledManifestEntry>> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_MANIFEST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ScheduledManifestEntry>;
  } catch {
    return {};
  }
}

export async function saveScheduledManifest(manifest: Record<string, ScheduledManifestEntry>): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    /* ignore */
  }
}

function countDeliveredForDay(history: Record<string, number>, dayStr: string): number {
  let count = 0;
  for (const ts of Object.values(history)) {
    if (dateKey(new Date(ts)) === dayStr) {
      count++;
    }
  }
  return count;
}

/**
 * Adjusts a candidate delivery date to respect quiet hours (9 PM - 9 AM).
 * If delivery falls within quiet hours, it is moved to 9:00 AM the next morning.
 * If the adjusted time is within 60s of or past the event's expiry, the notification is discarded.
 */
export function adjustForQuietHours(date: Date, expiresAt?: Date): Date | null {
  const adjusted = new Date(date);
  const hour = adjusted.getHours();

  if (hour >= QUIET_START_HOUR) {
    // 9:00 PM to midnight -> move to 9:00 AM next morning
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(QUIET_END_HOUR, 0, 0, 0);
  } else if (hour < QUIET_END_HOUR) {
    // midnight to 9:00 AM -> move to 9:00 AM this morning
    adjusted.setHours(QUIET_END_HOUR, 0, 0, 0);
  }

  // Discard if adjusted delivery falls within 60 seconds of or after the event's actual expiration
  if (expiresAt && adjusted.getTime() >= expiresAt.getTime() - 60_000) {
    return null;
  }

  return adjusted;
}

/**
 * Rebuilds all scheduled notifications dynamically from actual persisted game state:
 * 1. Reconciles previously scheduled manifest: any past targetTime is marked as delivered.
 * 2. Cancels pending OS alarms via cancelAllScheduledNotificationsAsync().
 * 3. Enforces quiet hours (9 PM to 9 AM local).
 * 4. Enforces max 2 notifications per calendar day, counting both already delivered and scheduled.
 * 5. Enforces minimum 6-hour gap without pushing reminders past their expiry.
 * 6. Prevents conflict between daily announcement and evening streak protection.
 * 7. Expiry-aware: daily/streak expire at midnight; chests never schedule beyond expiresAt.
 */
export async function refreshNotifications(): Promise<void> {
  try {
    const nowMs = trustedNow();
    const nowDate = new Date(nowMs);

    // 1. Reconcile previously scheduled notifications against current time
    const prevScheduled = await getScheduledManifest();
    const deliveredHistory = await getDeliveredHistory();
    let deliveredUpdated = false;

    for (const [id, entry] of Object.entries(prevScheduled)) {
      if (entry.targetTime <= nowMs) {
        // Target time has elapsed while app was closed or backgrounded:
        // The OS delivered this notification.
        if (!deliveredHistory[id]) {
          deliveredHistory[id] = entry.targetTime;
          deliveredUpdated = true;
        }
      }
    }

    if (deliveredUpdated) {
      try {
        await AsyncStorage.setItem(DELIVERED_HISTORY_KEY, JSON.stringify(deliveredHistory));
      } catch {
        /* ignore */
      }
    }

    // 2. Clear all previously scheduled notifications in OS so we can reschedule cleanly
    await Notifications.cancelAllScheduledNotificationsAsync();

    const s = getState();
    if (!s.settings.notify) {
      await saveScheduledManifest({});
      return;
    }

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await saveScheduledManifest({});
      return;
    }

    await ensureChannels();

    const prefs = s.notificationPreferences;
    const candidates: CandidateNotification[] = [];

    // -------------------------------------------------------------------------
    // A. Reward Chest Expiry Reminder (Priority 1)
    // -------------------------------------------------------------------------
    if (prefs.rewards) {
      const allChests = [
        ...Object.values(s.completionRewards),
        ...Object.values(s.referralRewards ?? {}),
      ];

      // Filter to unredeemed, non-expired pending chests with at least 2 minutes remaining
      const pendingChests = allChests
        .filter((r) => r.status === 'pending' && r.expiresAt > nowMs + 2 * 60 * 1000)
        .sort((a, b) => a.expiresAt - b.expiresAt);

      // Group nearby expiring chests to prevent multiple conflicting delayed alerts
      const handledChestIds = new Set<string>();

      for (const reward of pendingChests) {
        if (handledChestIds.has(reward.chestId)) continue;
        const id = `reward:exp:${reward.chestId}`;
        if (deliveredHistory[id]) {
          handledChestIds.add(reward.chestId);
          continue;
        }

        // Find other pending chests expiring within 6 hours of this chest
        const nearby = pendingChests.filter(
          (c) =>
            !handledChestIds.has(c.chestId) &&
            Math.abs(c.expiresAt - reward.expiresAt) < MIN_GAP_MS
        );
        nearby.forEach((c) => handledChestIds.add(c.chestId));

        const def = rewardDefinition(reward.rewardId);
        const targetMs = reward.expiresAt - 2 * 60 * 60 * 1000; // 2 hours before expiry
        let targetTime: Date;

        if (targetMs > nowMs + 60_000) {
          targetTime = new Date(targetMs);
        } else {
          // Less than 2 hours remaining: schedule soon, but strictly before expiry
          const soonMs = Math.min(reward.expiresAt - 60_000, nowMs + 2 * 60 * 1000);
          if (soonMs <= nowMs + 30_000) continue;
          targetTime = new Date(soonMs);
        }

        const title =
          nearby.length > 1
            ? 'Reward Chests expiring soon!'
            : 'Reward Chest expiring soon!';
        const body =
          nearby.length > 1
            ? `${def.name} and ${nearby.length - 1} other chest(s) expire soon. Redeem them in your inventory before they disappear!`
            : `${def.name} (${def.rarity.toUpperCase()}) expires soon. Redeem it in your inventory before it disappears!`;

        candidates.push({
          id,
          category: 'rewards',
          priority: 1,
          targetTime,
          expiresAt: new Date(reward.expiresAt),
          title,
          body,
          route: 'rewards',
          channelId: CHANNEL_REWARDS,
        });
      }
    }

    // -------------------------------------------------------------------------
    // B. Daily Puzzle & Streak Reminders (Priority 1 & 2)
    // -------------------------------------------------------------------------
    if (prefs.daily) {
      const todayKey = dateKey(nowDate);
      const doneToday = !!s.daily[todayKey];
      const midnight = new Date(nowDate);
      midnight.setHours(23, 59, 59, 999);

      // Streak protection condition
      const streakId = `streak:${todayKey}`;
      const streakEligible = s.stats.streak > 0 && !doneToday && !deliveredHistory[streakId];
      const streakDate = new Date(nowDate);
      streakDate.setHours(20, 30, 0, 0); // 8:30 PM local

      // 1. Streak protection (Priority 1)
      if (streakEligible && streakDate.getTime() > nowMs + 60_000) {
        candidates.push({
          id: streakId,
          category: 'daily',
          priority: 1,
          targetTime: streakDate,
          expiresAt: midnight,
          title: `Your ${s.stats.streak}-day streak ends tonight`,
          body: 'One quick puzzle keeps it alive. Complete today’s challenge before midnight!',
          route: 'daily',
          channelId: CHANNEL_DEFAULT,
        });
      }

      // 2. Daily puzzle announcement (Priority 2)
      const dailyId = `daily:${todayKey}`;
      if (!doneToday && !deliveredHistory[dailyId]) {
        const targetHour = Math.min(20, Math.max(9, s.settings.notifyHour));
        const dailyDate = new Date(nowDate);
        dailyDate.setHours(targetHour, 0, 0, 0);

        // Prevent conflict between daily announcement and evening streak protection:
        // If streak protection is active tonight, avoid sending a duplicate reminder within 6h
        const conflictsWithStreak =
          streakEligible &&
          streakDate.getTime() > nowMs + 60_000 &&
          Math.abs(dailyDate.getTime() - streakDate.getTime()) < MIN_GAP_MS;

        if (!conflictsWithStreak && dailyDate.getTime() > nowMs + 60_000) {
          candidates.push({
            id: dailyId,
            category: 'daily',
            priority: 2,
            targetTime: dailyDate,
            expiresAt: midnight, // Daily reminder expires at local midnight!
            title: 'Today’s FLUX puzzle is ready',
            body: 'A fresh daily puzzle is waiting. Can you find the path in minimum moves?',
            route: 'daily',
            channelId: CHANNEL_DEFAULT,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // C. Energy Full Refill (Priority 3) - Only when energy becomes 20/20
    // -------------------------------------------------------------------------
    if (prefs.energy && s.energy < ENERGY_MAX && s.energyRefillStartedAt !== null) {
      const fullRefillMs = s.energyRefillStartedAt + ENERGY_REFILL_MS;
      const id = `energy:full:${s.energyRefillStartedAt}`;
      if (!deliveredHistory[id] && fullRefillMs > nowMs + 30_000) {
        candidates.push({
          id,
          category: 'energy',
          priority: 3,
          targetTime: new Date(fullRefillMs),
          title: 'Energy fully refilled!',
          body: 'Your energy is back to 20/20. You’re ready for your next puzzle run.',
          route: 'home',
          channelId: CHANNEL_REWARDS,
        });
      }
    }

    // -------------------------------------------------------------------------
    // D. Hints Genuine Renewal (Priority 3) - Only when 3/3 hints renew
    // -------------------------------------------------------------------------
    if (prefs.hints && s.hintsRemaining < HINTS_MAX && s.hintsRefillStartedAt !== null) {
      const fullHintsMs = s.hintsRefillStartedAt + HINTS_REFILL_MS;
      const id = `hints:full:${s.hintsRefillStartedAt}`;
      if (!deliveredHistory[id] && fullHintsMs > nowMs + 30_000) {
        candidates.push({
          id,
          category: 'hints',
          priority: 3,
          targetTime: new Date(fullHintsMs),
          title: 'Hints renewed!',
          body: 'Your full set of 3 hints has renewed and is ready to assist your route.',
          route: 'home',
          channelId: CHANNEL_DEFAULT,
        });
      }
    }

    // -------------------------------------------------------------------------
    // E. Milestones & Come-Back Nudge (Priority 4)
    // -------------------------------------------------------------------------
    if (prefs.milestones) {
      const comebackId = `comeback:2d:${dateKey(nowDate)}`;
      if (!deliveredHistory[comebackId]) {
        const comebackDate = new Date(nowMs + 2 * 24 * 3600 * 1000);
        comebackDate.setHours(14, 0, 0, 0); // 2:00 PM
        const name = s.profile.name.trim();
        const waiting = s.resume
          ? `Level ${s.resume.levelId} is saved right where you stopped.`
          : `Level ${currentLevelId(s.levels)} is waiting for you.`;
        candidates.push({
          id: comebackId,
          category: 'milestones',
          priority: 4,
          targetTime: comebackDate,
          title: `We saved your spot${name ? ', ' + name : ''}`,
          body: waiting,
          route: s.resume ? 'resume' : 'home',
          channelId: CHANNEL_DEFAULT,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Filter, Priority Sort & Apply Constraints
    // -------------------------------------------------------------------------
    // Sort by priority (1 before 4), then by earliest target time
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.targetTime.getTime() - b.targetTime.getTime();
    });

    const dayCounts: Record<string, number> = {};
    const scheduledTimes: number[] = [];
    const newScheduledManifest: Record<string, ScheduledManifestEntry> = {};

    for (const cand of candidates) {
      // 1. Must be in the future
      if (cand.targetTime.getTime() <= nowMs + 30_000) continue;

      // 2. Adjust for quiet hours (9 PM to 9 AM)
      let adjusted = adjustForQuietHours(cand.targetTime, cand.expiresAt);
      if (!adjusted || adjusted.getTime() <= nowMs + 30_000) continue;

      // 3. Enforce 6-hour gap with existing scheduled notifications
      let conflict = true;
      let attempts = 0;
      while (conflict && attempts < 4) {
        conflict = false;
        for (const t of scheduledTimes) {
          const diff = Math.abs(adjusted.getTime() - t);
          if (diff < MIN_GAP_MS) {
            conflict = true;
            // Slide forward beyond the 6-hour gap
            adjusted = new Date(t + MIN_GAP_MS + 5 * 60 * 1000);
            adjusted = adjustForQuietHours(adjusted, cand.expiresAt);
            if (!adjusted || (cand.expiresAt && adjusted.getTime() >= cand.expiresAt.getTime() - 60_000)) {
              adjusted = null;
            }
            break;
          }
        }
        attempts++;
        if (!adjusted) break;
      }

      if (!adjusted) continue;

      // 4. Enforce max 2 notifications per calendar day (counting already delivered today + newly scheduled)
      const dayStr = dateKey(adjusted);
      if (dayCounts[dayStr] === undefined) {
        dayCounts[dayStr] = countDeliveredForDay(deliveredHistory, dayStr);
      }

      if (dayCounts[dayStr] >= MAX_NOTIFICATIONS_PER_DAY) {
        continue;
      }

      // Candidate approved: record constraints
      dayCounts[dayStr] = (dayCounts[dayStr] || 0) + 1;
      scheduledTimes.push(adjusted.getTime());

      // 5. Schedule via Expo Notifications
      await Notifications.scheduleNotificationAsync({
        identifier: cand.id,
        content: {
          title: cand.title,
          body: cand.body,
          data: { route: cand.route, key: cand.id },
          color: '#0B7F7A',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: adjusted,
          channelId: cand.channelId,
        },
      });

      // Track newly scheduled item in manifest (NOT marked delivered yet!)
      newScheduledManifest[cand.id] = {
        id: cand.id,
        targetTime: adjusted.getTime(),
        dayKey: dayStr,
      };
    }

    await saveScheduledManifest(newScheduledManifest);
  } catch {
    /* notifications are best effort */
  }
}

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced notification refresh triggered after relevant state mutations. */
export function scheduleNotificationRefresh(delayMs = 400): void {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(() => {
    refreshDebounceTimer = null;
    void refreshNotifications();
  }, delayMs);
}

let coldStartRoute: NotifRoute | null = null;
let coldStartResolved = false;

/** Synchronously checks if a notification response caused the cold start. */
export function getColdStartNotificationRoute(): NotifRoute | null {
  if (coldStartResolved) return coldStartRoute;
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      coldStartRoute = routeFromResponse(last);
    }
  } catch {
    /* ignore */
  }
  coldStartResolved = true;
  return coldStartRoute;
}

/** Consumes the cold start route exactly once so subsequent transitions don't re-trigger. */
export function consumeColdStartNotificationRoute(): NotifRoute | null {
  const r = getColdStartNotificationRoute();
  coldStartRoute = null;
  return r;
}

export function routeFromResponse(r: Notifications.NotificationResponse): NotifRoute {
  const d = r.notification.request.content.data as { route?: NotifRoute } | undefined;
  return d?.route ?? 'home';
}

export { Notifications };
