import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { currentLevelId, dateKey, getState } from '../store/store';

const CHANNEL = 'reminders';

export type NotifRoute = 'daily' | 'resume' | 'home';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Puzzle reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#0B7F7A',
  });
}

/** asks for permission (Android 13+ shows a system dialog); returns true when reminders may be shown */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

async function schedule(title: string, body: string, route: NotifRoute, trigger: Notifications.NotificationTriggerInput) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { route }, color: '#0B7F7A' },
    trigger,
  });
}

const DAY = 24 * 60 * 60;

/**
 * Rebuilds every scheduled reminder from the current player state. Cheap, so it runs on app start,
 * when the app goes to the background and whenever a reminder setting changes:
 *  1. a daily reminder at the player's chosen hour (new puzzle ready),
 *  2. "streak ends tonight" at 21:30 when a streak is alive and today's puzzle is not done,
 *  3. come-back nudges 2 and 6 days after the last visit, naming the level that is waiting.
 */
export async function refreshNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = getState();
    if (!s.settings.notify) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    const name = s.profile.name.trim();
    const hi = name ? `${name}, ` : '';
    const channelId = CHANNEL;

    await schedule(
      'Today’s FLUX puzzle is ready',
      `${hi}a fresh daily puzzle is waiting. Keep your streak going.`,
      'daily',
      { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: s.settings.notifyHour, minute: 0, channelId },
    );

    const doneToday = !!s.daily[dateKey()];
    const now = new Date();
    if (s.stats.streak > 0 && !doneToday) {
      const at = new Date(now);
      at.setHours(21, 30, 0, 0);
      if (at.getTime() > now.getTime() + 60_000 && s.settings.notifyHour < 21) {
        await schedule(
          `Your ${s.stats.streak}-day streak ends tonight`,
          'One quick puzzle keeps it alive.',
          'daily',
          { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
        );
      }
    }

    const waiting = s.resume ? `Level ${s.resume.levelId} is saved right where you stopped.` : `Level ${currentLevelId(s.levels)} is waiting for you.`;
    const route: NotifRoute = s.resume ? 'resume' : 'home';
    await schedule(`We saved your spot${name ? ', ' + name : ''}`, waiting, route, { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 * DAY, channelId });
    await schedule('Your puzzles miss you', waiting, route, { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 6 * DAY, channelId });
  } catch {
    /* notifications are best effort */
  }
}

export function routeFromResponse(r: Notifications.NotificationResponse): NotifRoute {
  const d = r.notification.request.content.data as { route?: NotifRoute } | undefined;
  return d?.route ?? 'home';
}

export { Notifications };
