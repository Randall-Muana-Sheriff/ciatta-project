// The health data Apple Health actually handed over, as she would read it.
//
// Counts prove a sync ran. Readings prove it worked: a woman who has just
// connected wants to see her own step count, not a number of rows. These
// are the measured fields of her day rows, which is the same data Today is
// built from, so what she sees here is what the app will use.
//
// Every rule in this file is the same rule: never show a number she did not
// produce. A missing reading is missing, never zero. A reading is shown with
// the day it came from, because the most recent value for a metric may be
// weeks old and a bare number would read as today's.

import type { Day } from '../data/daily';

export type Reading = {
  label: string;
  value: string;
  // The day the reading is from, as an ISO date, so the caller can say when.
  on: string;
};

function hoursAndMinutes(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (whole === 0) return `${minutes}m`;
  return minutes === 0 ? `${whole}h` : `${whole}h ${minutes}m`;
}

function withThousands(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// Each reading, with how to find it on a day and how to say it. Order is
// the order she sees them in: the two she recognises most first.
const FIELDS: { label: string; pick: (d: Day) => number | null; say: (n: number) => string }[] = [
  { label: 'Steps', pick: (d) => d.steps, say: (n) => withThousands(n) },
  { label: 'Sleep time', pick: (d) => d.sleepHours, say: hoursAndMinutes },
  { label: 'Resting heart rate', pick: (d) => d.restingHR, say: (n) => `${Math.round(n)} bpm` },
  { label: 'Heart rate variability', pick: (d) => d.hrv, say: (n) => `${Math.round(n)} ms` },
  { label: 'Active minutes', pick: (d) => d.activeMinutes, say: (n) => `${Math.round(n)} min` },
  { label: 'Time in bed', pick: (d) => d.timeInBed, say: hoursAndMinutes },
];

// The newest value for each reading, skipping any that never arrived.
//
// Newest rather than today's: a watch left on the side for two days has no
// reading today, and showing nothing would say Apple Health gave us nothing
// when it gave us a week. The day is carried so the screen can be honest
// about which day it is.
export function latestReadings(days: readonly Day[]): Reading[] {
  // Newest first. days arrives ordered by day ascending from the repo, and
  // this must not depend on that.
  const ordered = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));
  const out: Reading[] = [];

  for (const field of FIELDS) {
    const found = ordered.find((day) => {
      const v = field.pick(day);
      return v != null && Number.isFinite(v);
    });
    if (!found) continue;
    const value = field.pick(found);
    if (value == null) continue;
    out.push({ label: field.label, value: field.say(value), on: found.date });
  }

  return out;
}

// Workouts are counted rather than valued: one row saying 3 workouts is
// what she wants here, where six rows naming each would be the longest
// thing on the screen.
export function workoutCount(days: readonly Day[]): number {
  return days.reduce((n, day) => n + day.workouts.length, 0);
}
