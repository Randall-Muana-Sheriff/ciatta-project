// The phone's notifications, behind the Scheduler the reminder logic uses.
//
// Permission is asked the first time she puts a product in, with the
// reason on screen; declined, the Today card still counts down and says
// reminders are off. Everything is scheduled on the phone; nothing is sent
// through a server.

import * as Notifications from 'expo-notifications';

import type { ProductUse } from '../lib/periodProducts';
import { type Scheduler, syncProductReminders } from '../lib/reminders';

// Shown while the app is open too, so a reminder is never silently lost.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const phoneScheduler: Scheduler = {
  list: async () => (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier),
  schedule: async (r) => {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
};

export async function remindersAllowed(ask: boolean): Promise<boolean> {
  try {
    const now = await Notifications.getPermissionsAsync();
    if (now.granted || !ask || !now.canAskAgain) return now.granted;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// After any change to what she has in: ask once if never asked, then make
// the scheduled reminders match. Silent if she said no.
export async function keepRemindersInStep(current: ProductUse | null, ask = false): Promise<boolean> {
  const allowed = await remindersAllowed(ask);
  if (allowed) await syncProductReminders(phoneScheduler, current).catch(() => {});
  return allowed;
}
