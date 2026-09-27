import { fmtHours, median } from '../lib/engine';
import { addDays, isoDay, parseDay, shortDate } from './cycleLog';
import type { Day } from './daily';

// What the Sleep screen reads, built from her own nights. A night is a day
// whose sleepHours is set: the night she woke from that morning. A day with
// nothing measured is a gap, in the averages and in the charts, and never a
// night of no sleep.

export type SleepView = {
  // What the headline number is an average of.
  caption: string;
  average: { hours: number; minutes: number };
  averageLabel: string;
  vsTypical: string;
  // True when the average sits under her typical, which is the one case the
  // line beneath the number is drawn in the warning colour.
  below: boolean;
  // One entry a week, oldest first, as a share of the chart's height. Null
  // is a week with no night recorded.
  weekly: (number | null)[];
  weekLabels: { label: string; i: number }[];
  lowWeeks: number[];
  tiles: { value: string; label: string }[];
  lowest: {
    week: string;
    value: string;
    // Monday to Sunday, null where no night was recorded.
    nights: (number | null)[];
    facts: { label: string; value: string }[];
  }[];
  source: string;
};

// The chart draws its seven hour line at 0.86 of its height, so a bar that
// fills it stands for this many hours.
export const FULL_BAR_HOURS = 7 / 0.86;
// The fewest nights her typical is taken from. The same floor the server
// holds a baseline to (MIN_BASELINE_N in supabase/functions/baselines/
// compute.ts), so the screen never names a typical the record would not.
export const MIN_TYPICAL_NIGHTS = 20;
// A week with fewer nights than this is too thin to be called a low week.
export const MIN_WEEK_NIGHTS = 3;
// And it takes this many weeks before one of them can be the lowest.
export const MIN_WEEKS_TO_RANK = 3;
const RECENT_DAYS = 28;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const share = (hours: number) => Math.min(1, Math.max(0, hours / FULL_BAR_HOURS));

// The Monday of the week a day falls in.
function mondayOf(iso: string): Date {
  const d = parseDay(iso);
  return addDays(d, -((d.getDay() + 6) % 7));
}

// A gap between two durations, in the words the screen uses for one.
function fmtGap(hours: number): string {
  const minutes = Math.round(Math.abs(hours) * 60);
  return minutes < 60 ? `${minutes}m` : fmtHours(minutes / 60);
}

type Week = { monday: Date; days: (Day | null)[]; nights: number[]; average: number | null };

function weeksOf(days: Day[]): Week[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const last = mondayOf(days[days.length - 1].date);
  const weeks: Week[] = [];
  for (let monday = mondayOf(days[0].date); monday.getTime() <= last.getTime(); monday = addDays(monday, 7)) {
    const week = Array.from({ length: 7 }, (_, i) => byDate.get(isoDay(addDays(monday, i))) ?? null);
    const nights = week.map((d) => d?.sleepHours).filter((h): h is number => h != null);
    weeks.push({ monday, days: week, nights, average: nights.length ? mean(nights) : null });
  }
  return weeks;
}

// A label under the first week of each month, and under the first bar when
// there is room before the next label.
function labelsFor(weeks: Week[]): { label: string; i: number }[] {
  const labels: { label: string; i: number }[] = [];
  weeks.forEach((w, i) => {
    if (i > 0 && w.monday.getMonth() !== weeks[i - 1].monday.getMonth()) labels.push({ label: MONTHS[w.monday.getMonth()], i });
  });
  if (!labels.length || labels[0].i >= 3) labels.unshift({ label: MONTHS[weeks[0].monday.getMonth()], i: 0 });
  return labels;
}

// Null when her record holds no night at all: the screen then says so, and
// draws nothing.
export function sleepView(days: Day[]): SleepView | null {
  const all = days.filter((d) => d.sleepHours != null);
  if (!all.length) return null;

  const recentDays = days.slice(-RECENT_DAYS);
  const recent = recentDays.filter((d) => d.sleepHours != null);
  // The last four weeks when they hold a night; otherwise every night there
  // is, and the caption says which.
  const counted = recent.length ? recent : all;
  const average = mean(counted.map((d) => d.sleepHours as number));
  const total = Math.round(average * 60);
  const caption = recent.length ? 'Average, last 4 weeks' : `Average, ${all.length === 1 ? '1 night' : `${all.length} nights`} recorded`;

  // Her typical: the median of days 35 to 90 back, the window the engine
  // and the server both call the baseline, so a recent change cannot hide
  // by becoming part of what is typical.
  const base = days
    .slice(Math.max(0, days.length - 91), Math.max(0, days.length - 35))
    .map((d) => d.sleepHours)
    .filter((h): h is number => h != null);
  let vsTypical = 'Too few nights yet to say what is typical for you';
  let below = false;
  if (base.length >= MIN_TYPICAL_NIGHTS) {
    const typical = median(base);
    const gap = Math.round(average * 60) - Math.round(typical * 60);
    below = gap < 0;
    vsTypical =
      gap === 0
        ? `In line with your typical ${fmtHours(typical)}`
        : `${fmtGap(gap / 60)} ${gap < 0 ? 'under' : 'over'} your typical ${fmtHours(typical)}`;
  }

  const weeks = weeksOf(days);
  const ranked = weeks
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.nights.length >= MIN_WEEK_NIGHTS);
  const lowestWeeks =
    ranked.length >= MIN_WEEKS_TO_RANK
      ? [...ranked].sort((x, y) => (x.w.average as number) - (y.w.average as number) || x.i - y.i).slice(0, 2)
      : [];

  const inBed = counted.map((d) => d.timeInBed).filter((h): h is number => h != null);
  const tiles = [
    ...(inBed.length ? [{ value: fmtHours(mean(inBed)), label: 'Time in bed' }] : []),
    {
      value: recent.length ? `${recent.length} of ${recentDays.length}` : `${all.length}`,
      label: 'Nights recorded',
    },
  ];

  return {
    caption,
    average: { hours: Math.floor(total / 60), minutes: total % 60 },
    averageLabel: fmtHours(average),
    vsTypical,
    below,
    weekly: weeks.map((w) => (w.average == null ? null : share(w.average))),
    weekLabels: labelsFor(weeks),
    lowWeeks: lowestWeeks.map(({ i }) => i),
    tiles,
    lowest: lowestWeeks.map(({ w }) => ({
      week: `Week of ${shortDate(w.monday)}`,
      value: fmtHours(w.average as number),
      nights: w.days.map((d) => (d?.sleepHours != null ? share(d.sleepHours) : null)),
      facts: [
        { label: 'Nights recorded', value: `${w.nights.length} of 7` },
        { label: 'Shortest night', value: fmtHours(Math.min(...w.nights)) },
        { label: 'Longest night', value: fmtHours(Math.max(...w.nights)) },
      ],
    })),
    source: 'Sleep from your phone and watch.',
  };
}
