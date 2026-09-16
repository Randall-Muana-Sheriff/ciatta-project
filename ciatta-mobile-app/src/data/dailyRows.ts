import type { DailyRow } from '../lib/healthMetrics';
import { addDays, daysBetween, isoDay, parseDay, startOfDay } from './cycleLog';
import type { Day } from './daily';

// Projects public.daily_metrics rows into the Day shape every screen already
// reads. A column the row doesn't carry stays null (or, for the three list
// fields, an empty array): the database keeps the difference between
// "unknown" and "empty", but the screens above this layer don't need it, so
// it collapses here rather than forcing every reader to check for undefined
// as well as null.

// A day with no row for it at all: entirely empty, not a day of zeros.
function emptyDay(date: string): Day {
  return {
    date,
    sleepHours: null,
    stages: { awake: null, rem: null, light: null, deep: null },
    timeInBed: null,
    steps: null,
    activeMinutes: null,
    workouts: [],
    restingHR: null,
    hrv: null,
    tempDeviation: null,
    energy: null,
    mood: null,
    stress: null,
    caffeine: null,
    alcohol: null,
    foods: [],
    digestion: [],
  };
}

export function rowToDay(row: DailyRow): Day {
  return {
    date: row.day,
    sleepHours: row.sleep_hours ?? null,
    stages: {
      awake: row.stage_awake ?? null,
      rem: row.stage_rem ?? null,
      light: row.stage_light ?? null,
      deep: row.stage_deep ?? null,
    },
    timeInBed: row.time_in_bed ?? null,
    steps: row.steps ?? null,
    activeMinutes: row.active_minutes ?? null,
    workouts: row.workouts ?? [],
    restingHR: row.resting_hr ?? null,
    hrv: row.hrv ?? null,
    tempDeviation: row.temp_deviation ?? null,
    energy: row.energy ?? null,
    mood: row.mood ?? null,
    stress: row.stress ?? null,
    caffeine: row.caffeine ?? null,
    alcohol: row.alcohol ?? null,
    foods: row.foods ?? [],
    digestion: row.digestion ?? [],
    note: row.note ?? undefined,
  };
}

// Nothing downstream reads further back than the 35 to 90 day baseline
// window (see baselineDays in src/lib/engine.ts and WINDOW_SIZE in
// supabase/functions/baselines/compute.ts), so the density below never
// needs to reach back further than this, however long her record actually
// is: a build stays roughly this many objects rather than growing with
// years of history.
const WINDOW_DAYS = 91;

// One entry per calendar day, oldest first, with a day that has no row
// present as an entirely empty Day rather than skipped. That density is what
// lets a screen's `slice(-14)` span 14 calendar days rather than 14 rows: a
// week with no wearable worn stays a week, not a gap that quietly pulls
// older days into "the last 14". Mirrors buildDenseWindow in
// supabase/functions/baselines/compute.ts, which does the same for a single
// metric's sparse values rather than a full Day.
//
// The window ends at the later of `today` and the most recent row's day, so
// a row a device clock (or a timezone ahead of hers) dated past today still
// gets an entry instead of being silently dropped off the end.
export function daysFromRows(rows: DailyRow[], today: Date): Day[] {
  if (!rows.length) return [];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const sortedDays = [...byDay.keys()].sort();
  const earliest = parseDay(sortedDays[0]);
  const latestRow = parseDay(sortedDays[sortedDays.length - 1]);
  const todayStart = startOfDay(today);
  const end = latestRow.getTime() > todayStart.getTime() ? latestRow : todayStart;
  const start = daysBetween(earliest, end) >= WINDOW_DAYS ? addDays(end, -(WINDOW_DAYS - 1)) : earliest;
  const span = daysBetween(start, end);

  const out: Day[] = [];
  for (let i = 0; i <= span; i++) {
    const date = isoDay(addDays(start, i));
    const row = byDay.get(date);
    out.push(row ? rowToDay(row) : emptyDay(date));
  }
  return out;
}
