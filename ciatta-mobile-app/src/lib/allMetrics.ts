// Everything measured today, not just the three that fit on Today.
//
// Today shows Sleep, HRV and Steps because three is what a glance holds.
// This is the rest of the row behind them, and the rule that matters here
// is the one daily.ts already states in its own comments: null is unknown,
// never zero. A woman who did not wear her ring last night did not sleep
// zero hours, and a day with no caffeine logged is not a day with no
// caffeine. So a missing figure reads "Not yet" and is never a number.
//
// Grouped the way the body groups them rather than the way the database
// stores them, because "Movement" is a thing she has a sense of and
// "daily_metrics columns 7 through 9" is not.

import type { Day } from '../data/daily';
import { fmtHours } from './engine';
import { type Trend, trendOf } from './trend';
import type { VitalCard } from './vitals';

export type MetricRow = {
  label: string;
  // Null means not recorded. The screen says so; it never prints a zero or
  // a dash, both of which read as a measurement of none.
  value: string | null;
  // What produced it. Instrument readings and her own check ins sit in the
  // same list, so each says which it is rather than leaving her to guess.
  from: 'measured' | 'reported';
  // Only when the number needs one. "4 of 5" needs no gloss; a temperature
  // deviation does.
  note?: string;
};

export type MetricGroup = { title: string; rows: MetricRow[] };

const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

// A 1 to 5 check in, said as what it is. Never relabelled "good" or "poor":
// she chose a number, and naming it for her is an interpretation.
const scale = (n: number | null) => (n == null ? null : `${n} of 5`);

export function buildMetrics(day: Day | null, vitals: readonly VitalCard[] = []): MetricGroup[] {
  const d = day;
  const mins = (n: number | null) => (n == null ? null : `${Math.round(n)} min`);

  const sleep: MetricRow[] = [
    { label: 'Time asleep', value: d?.sleepHours != null ? fmtHours(d.sleepHours) : null, from: 'measured' },
    { label: 'Time in bed', value: d?.timeInBed != null ? fmtHours(d.timeInBed) : null, from: 'measured' },
    { label: 'Deep', value: mins(d?.stages?.deep ?? null), from: 'measured' },
    { label: 'REM', value: mins(d?.stages?.rem ?? null), from: 'measured' },
    { label: 'Light', value: mins(d?.stages?.light ?? null), from: 'measured' },
    { label: 'Awake', value: mins(d?.stages?.awake ?? null), from: 'measured' },
  ];

  const heart: MetricRow[] = [
    {
      label: 'Heart rate variability',
      value: d?.hrv != null ? `${Math.round(d.hrv)} ms` : null,
      from: 'measured',
    },
    { label: 'Resting heart rate', value: d?.restingHR != null ? `${Math.round(d.restingHR)} bpm` : null, from: 'measured' },
    {
      label: 'Skin temperature',
      // In words, not signed: a minus is a dash to display copy.
      value:
        d?.tempDeviation == null
          ? null
          : one(Math.abs(d.tempDeviation)) === '0.0'
            ? 'At your usual'
            : `${one(Math.abs(d.tempDeviation))} °C ${d.tempDeviation > 0 ? 'above' : 'below'} usual`,
      from: 'measured',
      // Named as a difference, because that is what the sensor reports. A
      // bare figure here would read as a body temperature.
      note: 'Change from your own usual',
    },
  ];

  const movement: MetricRow[] = [
    { label: 'Steps', value: d?.steps != null ? Math.round(d.steps).toLocaleString('en-US') : null, from: 'measured' },
    { label: 'Active minutes', value: mins(d?.activeMinutes ?? null), from: 'measured' },
    {
      label: 'Workouts',
      // An empty array is a real answer here, unlike a null column: the day
      // row exists and lists no workouts. Without a row at all it is
      // unknown, which is the null case above it.
      value: d ? `${d.workouts.length}` : null,
      from: 'measured',
    },
  ];

  const checkIns: MetricRow[] = [
    { label: 'Energy', value: scale(d?.energy ?? null), from: 'reported' },
    { label: 'Mood', value: scale(d?.mood ?? null), from: 'reported' },
    { label: 'Stress', value: scale(d?.stress ?? null), from: 'reported' },
  ];

  const intake: MetricRow[] = [
    { label: 'Caffeine', value: d?.caffeine != null ? `${d.caffeine}` : null, from: 'reported' },
    { label: 'Alcohol', value: d?.alcohol != null ? `${d.alcohol}` : null, from: 'reported' },
    { label: 'Foods', value: d?.foods?.length ? d.foods.join(', ') : null, from: 'reported' },
    { label: 'Digestion', value: d?.digestion?.length ? d.digestion.join(', ') : null, from: 'reported' },
  ];

  // Blood pressure, blood oxygen and weight, which live in observations
  // rather than on the day row. Shown here with the same rule they carry
  // everywhere: the figure and when it was taken, or nothing.
  const vitalRows: MetricRow[] = vitals.map((v) => ({
    label: v.label,
    value: v.value,
    from: 'measured' as const,
    note: v.note,
  }));

  return [
    { title: 'Sleep', rows: sleep },
    { title: 'Heart', rows: heart },
    ...(vitalRows.length ? [{ title: 'Vitals', rows: vitalRows }] : []),
    { title: 'Movement', rows: movement },
    { title: 'How you felt', rows: checkIns },
    { title: 'Intake', rows: intake },
  ];
}

// How many of the metrics on offer actually have a figure today. Shown so
// the screen can say "9 of 19 recorded" rather than letting a page of "Not
// yet" imply something is broken.
export function recordedCount(groups: readonly MetricGroup[]): { recorded: number; total: number } {
  let recorded = 0;
  let total = 0;
  for (const g of groups) {
    for (const r of g.rows) {
      total += 1;
      if (r.value != null) recorded += 1;
    }
  }
  return { recorded, total };
}

// The line under the title. It states the count and nothing more: no
// encouragement, and no suggestion that a low count is a failing.
export function recordedLine(counts: { recorded: number; total: number }): string {
  if (counts.recorded === 0) return 'Nothing recorded today yet.';
  return `${counts.recorded} of ${counts.total} recorded today.`;
}


// The six on Today, three across and two down.
//
// Chosen by what her devices actually report rather than by what the
// schema happens to hold. Sleep, heart rate variability and steps come
// from the wearable; blood pressure, skin temperature and blood oxygen
// come from the cuff, the ring and the watch. Everything else moved
// behind All, which is what All is for.
//
// Three of these six do not exist on the Day object at all. Blood
// pressure, blood oxygen and weight sync into observations and were never
// folded into a daily row, so they arrive separately and lib/vitals says
// what may be shown of them and when.
//
// Labels stay short: "Resting HR" fits a third of a row and "Resting
// heart rate" does not. The All screen keeps the full names.
export type HeadlineMetric = {
  key: string;
  label: string;
  // Null means not recorded. Never zero, and never a dash.
  value: string | null;
  // Shown under the value when there is one. Carries when a reading was
  // taken, for the vitals that do not arrive daily.
  note?: string;
  from: 'measured' | 'reported' | 'derived';
  // Her recent readings and which way they move. Absent with too few.
  trend?: Trend;
};

// The latest value for a field, with the day it came from.
//
// Today's cards used to read today's row and nothing else, so every one
// of them went blank on any day the sync had not run. Ciatta syncs when
// she asks it to and at no other time, by design, which means "today's
// row" is often simply absent while last night's reading sits one row
// back. Blood pressure already worked this way and was the only card
// showing anything, which is how the asymmetry surfaced.
//
// So: the newest reading there is, and the card says how old it is.
// Absence still reads as absence; what changes is that a reading from
// yesterday is shown as yesterday's rather than thrown away.
function latest(
  days: readonly Day[],
  get: (d: Day) => number | null,
  now: Date,
): { value: number; note?: string } | null {
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const v = get(days[i]);
    if (v == null) continue;
    const note = dayNote(days[i].date, now);
    return note ? { value: v, note } : { value: v };
  }
  return null;
}

// How old a reading is, in her words. Today says nothing, because a card
// is assumed to hold today.
export function dayNote(iso: string, now: Date): string | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return null;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return `${Math.round(days / 7)} weeks ago`;
}

export function headlineMetrics(
  days: readonly Day[],
  vitals: readonly VitalCard[] = [],
  now: Date = new Date(),
): HeadlineMetric[] {
  const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
  const read = (get: (d: Day) => number | null) => latest(days, get, now);
  // The grid abbreviates. A third of a row does not hold "Blood
  // pressure", and BP and SpO2 are what she reads on the cuff and the
  // watch anyway. The All screen keeps the full names, where there is a
  // line to spell them on.
  const SHORT: Record<string, string> = { bp: 'BP', spo2: 'SpO2' };
  // A card from a reading, or the same card empty. The note carries the
  // age when there is one, and the qualifier only when there is a value
  // to qualify.
  const card = (
    key: string,
    label: string,
    found: { value: number; note?: string } | null,
    say: (v: number) => string,
    qualifier?: string,
  ): HeadlineMetric => ({
    key,
    label,
    value: found ? say(found.value) : null,
    note: found ? (found.note ?? qualifier) : undefined,
    from: 'measured',
  });
  const vital = (key: string): HeadlineMetric => {
    const found = vitals.find((v) => v.key === key);
    return {
      key,
      label: SHORT[key] ?? found?.label ?? key,
      value: found?.value ?? null,
      note: found?.note,
      from: 'measured',
      ...(found?.trend ? { trend: found.trend } : {}),
    };
  };
  // The card's line and arrow, from every day she has, not only the one
  // the figure came from.
  const trended = (m: HeadlineMetric, get: (d: Day) => number | null, unit: 'percent' | 'degrees'): HeadlineMetric => {
    const t = trendOf(days.map(get), unit);
    return t ? { ...m, trend: t } : m;
  };
  // Skin temperature is a difference from her usual. The figure carries no
  // sign, because a minus is a dash to display copy; the note says which
  // way, in words, and how old the reading is when it is not today's.
  const skinTemp = (found: { value: number; note?: string } | null): HeadlineMetric => {
    if (!found) return { key: 'temp', label: 'Skin temp', value: null, from: 'measured' };
    const size = one(Math.abs(found.value));
    const way = size === '0.0' ? 'At usual' : found.value > 0 ? 'Above usual' : 'Below usual';
    return {
      key: 'temp',
      label: 'Skin temp',
      value: `${size} °C`,
      note: found.note ? `${way}, ${found.note.charAt(0).toLowerCase()}${found.note.slice(1)}` : way,
      from: 'measured',
    };
  };
  return [
    trended(card('sleep', 'Sleep', read((d) => d.sleepHours), (v) => fmtHours(v)), (d) => d.sleepHours, 'percent'),
    trended(card('hrv', 'HRV', read((d) => d.hrv), (v) => `${Math.round(v)} ms`), (d) => d.hrv, 'percent'),
    trended(
      card('steps', 'Steps', read((d) => d.steps), (v) => Math.round(v).toLocaleString('en-US')),
      (d) => d.steps,
      'percent',
    ),
    vital('bp'),
    trended(skinTemp(read((d) => d.tempDeviation)), (d) => d.tempDeviation, 'degrees'),
    vital('spo2'),
  ];
}
