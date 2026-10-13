// What a metric's own screen says: the latest reading against her usual
// range, the days of a chosen range drawn as they were, and the figures
// that belong beside that metric.
//
// Her usual is the range the baselines function works out on the server
// from her own history (days 35 to 90 back, at least 20 of them). When
// there is not enough history, the screen says so; a usual is never guessed
// from a handful of nights. A day with no reading is a gap, never a zero.

import type { Day } from '../data/daily';
import { dayNote } from './allMetrics';
import { fmtCount, fmtHours } from './engine';

export type MetricKey = 'sleep' | 'hrv' | 'rhr' | 'steps' | 'bp' | 'temp' | 'spo2';
export type Range = 'week' | 'month' | '3m' | '6m';

export const RANGES: { key: Range; label: string; days: number }[] = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: '3m', label: '3 Months', days: 91 },
  { key: '6m', label: '6 Months', days: 182 },
];

export const METRIC_TITLE: Record<MetricKey, string> = {
  sleep: 'Sleep',
  hrv: 'Heart Rate Variability',
  rhr: 'Resting Heart Rate',
  steps: 'Steps',
  bp: 'Blood Pressure',
  temp: 'Skin Temperature',
  spo2: 'Blood Oxygen',
};

// As the baselines table stores it.
export type BaselineRow = { metric: string; median: number | null; low: number | null; high: number | null; n: number; sufficient: boolean };
// One metric's readings on one day, from vital_days.
export type VitalDay = { metric: string; day: string; avg: number; min: number; max: number; n: number };
// For blood pressure `low` is the bottom number; for blood oxygen it is the
// day's lowest reading. Other metrics have none.
export type Point = { day: string; value: number | null; low?: number | null };
export type Row = { label: string; value: string; note?: string };
export type Section = { title: string; rows: Row[] };
export type Usual = { median: number; low: number; high: number; low2?: number; high2?: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : day;
};
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const has = (p: Point): p is Point & { value: number } => p.value != null;

export function dayKeys(range: Range, now: Date): string[] {
  return lastDays(RANGES.find((r) => r.key === range)!.days, now);
}

function lastDays(size: number, now: Date): string[] {
  return Array.from({ length: size }, (_, n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (size - 1 - n))));
}

const DAY_FIELD: Partial<Record<MetricKey, (d: Day) => number | null>> = {
  sleep: (d) => d.sleepHours,
  hrv: (d) => d.hrv,
  rhr: (d) => d.restingHR,
  steps: (d) => d.steps,
  temp: (d) => d.tempDeviation,
};

export function seriesFor(key: MetricKey, days: readonly Day[], vitals: readonly VitalDay[], range: Range, now: Date): Point[] {
  return seriesForDays(key, days, vitals, RANGES.find((r) => r.key === range)!.days, now);
}

// The same, for any number of days ending today: 7 on a Today card, 14 or
// 28 on the Health dashboard.
export function seriesForDays(key: MetricKey, days: readonly Day[], vitals: readonly VitalDay[], count: number, now: Date): Point[] {
  const keys = lastDays(count, now);
  const field = DAY_FIELD[key];
  if (field) {
    const byDay = new Map(days.map((d) => [d.date, field(d)]));
    return keys.map((day) => ({ day, value: byDay.get(day) ?? null }));
  }
  const of = (metric: string) => new Map(vitals.filter((v) => v.metric === metric).map((v) => [v.day, v]));
  if (key === 'bp') {
    const sys = of('blood_pressure_systolic');
    const dia = of('blood_pressure_diastolic');
    return keys.map((day) => ({ day, value: sys.get(day)?.avg ?? null, low: dia.get(day)?.avg ?? null }));
  }
  const o2 = of('oxygen_saturation');
  return keys.map((day) => ({ day, value: o2.get(day)?.avg ?? null, low: o2.get(day)?.min ?? null }));
}

// A week or a month a day at a time; three or six months as weekly
// averages from the oldest day, so a bar is wide enough to read.
export function bucketize(points: readonly Point[], range: Range): Point[] {
  if (range === 'week' || range === 'month') return points.map((p) => ({ ...p }));
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const week = points.slice(i, i + 7);
    const values = week.filter(has).map((p) => p.value);
    const lows = week.map((p) => p.low).filter((v): v is number => v != null);
    const bucket: Point = { day: week[0].day, value: values.length ? avg(values) : null };
    if (week.some((p) => 'low' in p)) bucket.low = lows.length ? avg(lows) : null;
    out.push(bucket);
  }
  return out;
}

// A figure in the metric's own words.
export function fmt(key: MetricKey, v: number, low?: number | null): string {
  switch (key) {
    case 'sleep':
      return fmtHours(v);
    case 'hrv':
      return `${Math.round(v)} ms`;
    case 'rhr':
      return `${Math.round(v)} bpm`;
    case 'steps':
      return fmtCount(v);
    case 'spo2':
      return `${Math.round(v)}%`;
    case 'bp':
      return low != null ? `${Math.round(v)}/${Math.round(low)}` : `${Math.round(v)}`;
    case 'temp': {
      const size = Math.abs(v).toFixed(1);
      return size === '0.0' ? 'At usual' : `${size} °C ${v > 0 ? 'above' : 'below'} usual`;
    }
  }
}

export function summary(key: MetricKey, points: readonly Point[]): Row[] {
  const got = points.filter(has);
  const recorded = { label: 'Days recorded', value: `${got.length} of ${points.length}` };
  if (!got.length) return [recorded];
  const top = got.reduce((a, b) => (b.value > a.value ? b : a));
  const bottom = got.reduce((a, b) => (b.value < a.value ? b : a));
  const lows = got.map((p) => p.low).filter((v): v is number => v != null);
  const mean = key === 'bp' ? fmt(key, avg(got.map((p) => p.value)), lows.length ? avg(lows) : null) : fmt(key, avg(got.map((p) => p.value)));
  return [
    { label: 'Average', value: mean },
    { label: 'Highest', value: fmt(key, top.value, key === 'bp' ? top.low : undefined), note: shortDay(top.day) },
    { label: 'Lowest', value: fmt(key, bottom.value, key === 'bp' ? bottom.low : undefined), note: shortDay(bottom.day) },
    recorded,
  ];
}

const BASELINE_METRIC: Partial<Record<MetricKey, string>> = {
  sleep: 'sleep_hours',
  hrv: 'hrv',
  rhr: 'resting_hr',
  steps: 'steps',
  bp: 'blood_pressure_systolic',
  spo2: 'oxygen_saturation',
};

const sufficient = (rows: readonly BaselineRow[], metric: string) => {
  const r = rows.find((x) => x.metric === metric);
  return r && r.sufficient && r.median != null && r.low != null && r.high != null ? r : null;
};

// Her usual range for a metric, or null when there is not enough history.
export function usualFor(key: MetricKey, rows: readonly BaselineRow[]): Usual | null {
  const metric = BASELINE_METRIC[key];
  const r = metric ? sufficient(rows, metric) : null;
  if (!r) return null;
  const usual: Usual = { median: r.median!, low: r.low!, high: r.high! };
  if (key === 'bp') {
    const d = sufficient(rows, 'blood_pressure_diastolic');
    if (d) Object.assign(usual, { low2: d.low!, high2: d.high! });
  }
  return usual;
}

export type Headline = { value: string | null; when: string | null; compare: string | null };

export function headline(key: MetricKey, points: readonly Point[], usual: Usual | null, now: Date): Headline {
  const last = [...points].reverse().find(has);
  if (!last) return { value: null, when: null, compare: null };
  const when = dayNote(last.day, now) ?? 'Today';
  if (key === 'temp') {
    const size = Math.abs(last.value).toFixed(1);
    return { value: `${size} °C`, when, compare: size === '0.0' ? 'At your usual' : last.value > 0 ? 'Above your usual' : 'Below your usual' };
  }
  const value = fmt(key, last.value, key === 'bp' ? last.low : undefined);
  if (!usual) return { value, when, compare: 'Not enough readings yet to know your usual range' };
  const range = (lo: number, hi: number) => `${fmt(key, lo)} to ${fmt(key, hi)}`;
  const side = (v: number, lo: number, hi: number) => (v < lo ? 'below' : v > hi ? 'above' : null);
  if (key === 'bp') {
    const top = side(last.value, usual.low, usual.high);
    if (top) return { value, when, compare: `Top number ${top} your usual range of ${range(usual.low, usual.high)}` };
    if (last.low != null && usual.low2 != null && usual.high2 != null) {
      const bottom = side(last.low, usual.low2, usual.high2);
      if (bottom) return { value, when, compare: `Bottom number ${bottom} your usual range of ${range(usual.low2, usual.high2)}` };
      return { value, when, compare: `Within your usual range of ${fmt(key, usual.low, usual.low2)} to ${fmt(key, usual.high, usual.high2)}` };
    }
    return { value, when, compare: `Top number within your usual range of ${range(usual.low, usual.high)}` };
  }
  const s = side(last.value, usual.low, usual.high);
  const words = s ? `${s === 'below' ? 'Below' : 'Above'} your usual range of` : 'Within your usual range of';
  return { value, when, compare: `${words} ${range(usual.low, usual.high)}` };
}

const minutes = (m: number) => (Math.round(m) < 60 ? `${Math.round(m)} min` : fmtHours(m / 60));

function sleepExtras(days: readonly Day[]): Section[] {
  const out: Section[] = [];
  const stage = (k: 'deep' | 'rem' | 'light' | 'awake') => {
    const xs = days.map((d) => d.stages?.[k]).filter((v): v is number => v != null);
    return xs.length ? avg(xs) : null;
  };
  const deep = stage('deep');
  const rem = stage('rem');
  const light = stage('light');
  const awake = stage('awake');
  const asleep = (deep ?? 0) + (rem ?? 0) + (light ?? 0);
  const share = (m: number | null) => (m != null && asleep > 0 ? `${Math.round((m / asleep) * 100)}% of sleep` : undefined);
  const stages: Row[] = [];
  for (const [label, m] of [['Deep', deep], ['REM', rem], ['Light', light]] as const) {
    if (m != null) stages.push({ label, value: minutes(m), ...(share(m) ? { note: share(m) } : {}) });
  }
  if (awake != null) stages.push({ label: 'Awake', value: minutes(awake) });
  if (stages.length) out.push({ title: 'Average night by stage', rows: stages });

  const slept = days.map((d) => d.sleepHours).filter((v): v is number => v != null);
  const bed = days.map((d) => d.timeInBed).filter((v): v is number => v != null);
  const both = days.filter((d) => d.sleepHours != null && d.timeInBed != null && d.timeInBed > 0);
  if (bed.length) {
    const rows: Row[] = [{ label: 'Average time in bed', value: fmtHours(avg(bed)) }];
    if (slept.length) rows.push({ label: 'Average time asleep', value: fmtHours(avg(slept)) });
    if (both.length) {
      const pct = (both.reduce((a, d) => a + d.sleepHours!, 0) / both.reduce((a, d) => a + d.timeInBed!, 0)) * 100;
      rows.push({ label: 'Asleep while in bed', value: `${Math.round(Math.min(pct, 100))}%` });
    }
    out.push({ title: 'In bed and asleep', rows });
  }

  const nights = days.filter((d) => d.sleepHours != null).sort((a, b) => a.sleepHours! - b.sleepHours!).slice(0, 3);
  if (nights.length) out.push({ title: 'Shortest nights', rows: nights.map((d) => ({ label: shortDay(d.date), value: fmtHours(d.sleepHours!) })) });
  return out;
}

export function extras(key: MetricKey, days: readonly Day[], points: readonly Point[], baselines: readonly BaselineRow[], _now: Date): Section[] {
  const inRange = new Set(points.map((p) => p.day));
  const shown = days.filter((d) => inRange.has(d.date));
  switch (key) {
    case 'sleep':
      return sleepExtras(shown);
    case 'steps': {
      const active = shown.map((d) => d.activeMinutes).filter((v): v is number => v != null);
      return active.length ? [{ title: 'Activity', rows: [{ label: 'Active minutes, daily average', value: `${Math.round(avg(active))} min` }] }] : [];
    }
    case 'rhr':
      return [];
    case 'hrv': {
      const rhr = shown.map((d) => d.restingHR).filter((v): v is number => v != null);
      const rows: Row[] = [];
      if (rhr.length) rows.push({ label: 'Average resting heart rate', value: `${Math.round(avg(rhr))} bpm` });
      const u = sufficient(baselines, 'resting_hr');
      if (u) rows.push({ label: 'Your usual resting heart rate', value: `${Math.round(u.low!)} to ${Math.round(u.high!)} bpm` });
      return rows.length ? [{ title: 'Resting heart rate', rows }] : [];
    }
    case 'temp': {
      const got = points.filter(has);
      if (!got.length) return [];
      const count = (f: (v: number) => boolean) => String(got.filter((p) => f(p.value)).length);
      return [
        {
          title: 'Nights',
          rows: [
            { label: 'Nights above usual', value: count((v) => v >= 0.1) },
            { label: 'Nights below usual', value: count((v) => v <= -0.1) },
            { label: 'Nights at usual', value: count((v) => Math.abs(v) < 0.1) },
          ],
        },
      ];
    }
    case 'spo2': {
      const lows = points.filter((p): p is Point & { low: number } => p.low != null);
      if (!lows.length) return [];
      const lowest = lows.reduce((a, b) => (b.low < a.low ? b : a));
      return [{ title: 'Lowest', rows: [{ label: 'Lowest reading', value: `${Math.round(lowest.low)}%`, note: shortDay(lowest.day) }] }];
    }
    case 'bp': {
      const got = points.filter(has).reverse().slice(0, 7);
      return got.length ? [{ title: 'Readings, daily average', rows: got.map((p) => ({ label: shortDay(p.day), value: fmt('bp', p.value, p.low) })) }] : [];
    }
  }
}

// The chart's vertical scale. Sleep and steps are amounts, so their bars
// stand on zero. Skin temperature is a difference from usual, so usual sits
// in the middle. Everything else is a level, scaled to what was seen and to
// her usual range, so a change of a few points is visible.
export function scaleFor(key: MetricKey, points: readonly Point[], usual: Usual | null): { min: number; max: number } {
  const values = points.flatMap((p) => [p.value, p.low]).filter((v): v is number => v != null);
  if (key === 'temp') {
    const m = Math.max(0.5, ...values.map(Math.abs)) * 1.2;
    return { min: -m, max: m };
  }
  const seen = [...values, ...(usual ? [usual.low, usual.high, usual.low2, usual.high2] : [])].filter((v): v is number => v != null);
  if (key === 'sleep' || key === 'steps') {
    const top = seen.length ? Math.max(...seen) : key === 'sleep' ? 8 : 8000;
    return { min: 0, max: top * 1.1 };
  }
  if (!seen.length) return { min: 0, max: 1 };
  const lo = Math.min(...seen);
  const hi = Math.max(...seen);
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 1);
  return { min: Math.max(0, lo - pad), max: key === 'spo2' ? Math.min(100.5, hi + pad) : hi + pad };
}

// Which metric screen a row on the All screen opens. Sleep's stages open
// Sleep; resting heart rate opens HRV, where it is shown beside it; active
// minutes open Steps. Her check ins have no screen of their own here.
const ROW_METRIC: Record<string, MetricKey> = {
  'Time asleep': 'sleep',
  'Time in bed': 'sleep',
  Deep: 'sleep',
  REM: 'sleep',
  Light: 'sleep',
  Awake: 'sleep',
  'Heart rate variability': 'hrv',
  'Resting heart rate': 'rhr',
  'Skin temperature': 'temp',
  Steps: 'steps',
  'Active minutes': 'steps',
  'Blood pressure': 'bp',
  'Blood oxygen': 'spo2',
};

export const metricForRow = (label: string): MetricKey | null => ROW_METRIC[label] ?? null;
