// Keeping the phone's reminders in step with what she has in.
//
// What is in decides which product reminders exist: anything else with a
// product id is cancelled, anything missing is scheduled. Run after every
// change and once at start, it repairs a reinstall, a changed time zone or
// a missed cancel, and running it twice changes nothing. Only identifiers
// starting "product-" are ever touched.

import type { ProductUse } from './periodProducts';
import { type Reminder, remindersFor } from './productSafety';

export type Scheduler = {
  list(): Promise<string[]>;
  schedule(r: Reminder): Promise<void>;
  cancel(id: string): Promise<void>;
};

export async function syncProductReminders(scheduler: Scheduler, current: ProductUse | null, now = new Date()): Promise<void> {
  const want = current ? remindersFor(current, now) : [];
  const wanted = new Set(want.map((r) => r.id));
  const have = (await scheduler.list()).filter((id) => id.startsWith('product-'));
  for (const id of have) if (!wanted.has(id)) await scheduler.cancel(id);
  const present = new Set(have);
  for (const r of want) if (!present.has(r.id)) await scheduler.schedule(r);
}
