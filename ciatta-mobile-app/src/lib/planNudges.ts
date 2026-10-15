// Plans through the day: each of today's plan items, sent as a local
// notification at a moment her calendar leaves free. Read from the
// calendar on her phone; nothing leaves it.
//
// The lock screen carries the plan's own title and nothing else: never a
// reading, a result or a symptom.

import type { PlanItem } from './actionPlan';
import type { CalEvent } from './calendarEvents';

export type Nudge = { id: string; title: string; body: string; at: Date };

const START_HOUR = 9;
const LAST_HOUR = 20;
const GAP_MIN = 30;
const SPACING = 2 * 3600000;
const MAX = 3;

const busy = (t: Date, events: readonly CalEvent[]) =>
  events.some((e) => !e.allDay && t.getTime() >= e.start.getTime() - 10 * 60000 && t.getTime() < e.end.getTime() + GAP_MIN * 60000);

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function planNudges(plan: readonly PlanItem[], events: readonly CalEvent[], now: Date): Nudge[] {
  const out: Nudge[] = [];
  const taken: number[] = [];
  const free = (t: Date) => t > now && !busy(t, events) && taken.every((x) => Math.abs(x - t.getTime()) >= SPACING);
  for (const item of plan) {
    if (out.length >= MAX) break;
    let when: Date | null = null;
    if (item.key === 'sleep') {
      const evening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), LAST_HOUR, 30);
      if (free(evening)) when = evening;
    } else {
      // Every half hour from the start of her day, the first free moment.
      for (let h = START_HOUR; h <= LAST_HOUR && !when; h += 0.5) {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(h), (h % 1) * 60);
        if (free(t)) when = t;
      }
    }
    if (!when) continue;
    taken.push(when.getTime());
    out.push({ id: `plan:${item.key}:${dayKey(now)}`, title: 'Ciatta', body: item.title, at: when });
  }
  return out;
}
