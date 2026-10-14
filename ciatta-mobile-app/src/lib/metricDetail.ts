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
import { NAME } from './metricNames';
import { hourLabel } from './timeAxis';
import { formatTempChange } from './units';

export type MetricKey = 'sleep' | 'hrv' | 'rhr' | 'steps' | 'bp' | 'temp' | 'spo2';
// The same four scales Journey reads by, day first: a day hour by hour,
// a week and a month a day at a time, a year a month at a time.
export type Range = 'day' | 'week' | 'month' | 'year';

export const RANGES: { key: Range; label: string; days: number }[] = [
  { key: 'day', label: 'Day', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'year', label: 'Year', days: 365 },
];

export const METRIC_TITLE: Record<MetricKey, string> = {
  sleep: NAME.sleep,
  hrv: NAME.hrv,
  rhr: NAME.rhr,
  steps: NAME.steps,
  bp: NAME.bp,
  temp: NAME.temp,
  spo2: NAME.spo2,
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
// A point's label: an hour ('2026-10-14T15'), a day, or a month ('2026-10').
export const shortDay = (day: string) => {
  if (day.includes('T')) return hourLabel(Number(day.slice(11, 13)));
  const [, m, d] = day.split('-').map(Number);
  if (m && d) return `${d} ${MONTHS[m - 1]}`;
  return m ? MONTHS[m - 1] : day;
};
const pointUnit = (day: string) => (day.includes('T') ? 'hour' : day.length === 7 ? 'month' : 'day');
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

// A week or a month a day at a time; a year as monthly averages, oldest
// first, as Journey's year is twelve months.
export function bucketize(points: readonly Point[], range: Range): Point[] {
  if (range !== 'year') return points.map((p) => ({ ...p }));
  const months = new Map<string, Point[]>();
  for (const p of points) months.set(p.day.slice(0, 7), [...(months.get(p.day.slice(0, 7)) ?? []), p]);
  return [...months].map(([month, group]) => {
    const values = group.filter(has).map((p) => p.value);
    const lows = group.map((p) => p.low).filter((v): v is number => v != null);
    const bucket: Point = { day: month, value: values.length ? avg(values) : null };
    if (group.some((p) => 'low' in p)) bucket.low = lows.length ? avg(lows) : null;
    return bucket;
  });
}

// The observations each metric's day is drawn from.
export const INTRADAY: Record<MetricKey, string[]> = {
  sleep: [],
  temp: [],
  hrv: ['hrv'],
  rhr: ['resting_heart_rate'],
  steps: ['steps'],
  spo2: ['oxygen_saturation'],
  bp: ['blood_pressure_systolic', 'blood_pressure_diastolic'],
};

export type Reading = { metric: string; value: number | null; at: string };

// Today, hour by hour, from the readings that arrived today. Steps add up
// within an hour; the rest average. Sleep is a night and skin temperature
// one reading a night, so neither has hours: the screen says so instead.
export function hourly(key: MetricKey, readings: readonly Reading[], now: Date): Point[] {
  const names = INTRADAY[key];
  if (!names.length) return [];
  const today = iso(now);
  const hours = Array.from({ length: 24 }, () => new Map<string, number[]>());
  for (const r of readings) {
    if (r.value == null || !names.includes(r.metric)) continue;
    const at = new Date(r.at);
    if (iso(at) !== today) continue;
    const slot = hours[at.getHours()];
    slot.set(r.metric, [...(slot.get(r.metric) ?? []), r.value]);
  }
  return hours.map((slot, h) => {
    const day = `${today}T${String(h).padStart(2, '0')}`;
    const vals = slot.get(names[0]) ?? [];
    const value = !vals.length ? null : key === 'steps' ? vals.reduce((a, b) => a + b, 0) : avg(vals);
    if (key === 'bp') {
      const dia = slot.get(names[1]) ?? [];
      return { day, value, low: dia.length ? avg(dia) : null };
    }
    return { day, value: value != null && key === 'spo2' && value <= 1 ? value * 100 : value };
  });
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
      return size === '0.0' ? 'At usual' : `${formatTempChange(v)} ${v > 0 ? 'above' : 'below'} usual`;
    }
  }
}

export function summary(key: MetricKey, points: readonly Point[]): Row[] {
  const got = points.filter(has);
  const unit = points.length ? pointUnit(points[0].day) : 'day';
  const recorded = {
    label: unit === 'hour' ? 'Hours with a reading' : unit === 'month' ? 'Months recorded' : 'Days recorded',
    value: `${got.length} of ${points.length}`,
  };
  if (!got.length) return [recorded];
  if (unit === 'hour' && key === 'steps') {
    const busiest = got.reduce((a, b) => (b.value > a.value ? b : a));
    return [
      { label: 'Total so far', value: fmt(key, got.reduce((a, p) => a + p.value, 0)) },
      { label: 'Busiest hour', value: fmt(key, busiest.value), note: shortDay(busiest.day) },
      recorded,
    ];
  }
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
    return { value: formatTempChange(last.value), when, compare: size === '0.0' ? 'At your usual' : last.value > 0 ? 'Above your usual' : 'Below your usual' };
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
      return rows.length ? [{ title: NAME.rhr, rows }] : [];
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
  [NAME.timeAsleep]: 'sleep',
  [NAME.timeInBed]: 'sleep',
  [NAME.deep]: 'sleep',
  [NAME.rem]: 'sleep',
  [NAME.light]: 'sleep',
  [NAME.awake]: 'sleep',
  [NAME.hrv]: 'hrv',
  [NAME.rhr]: 'rhr',
  [NAME.temp]: 'temp',
  [NAME.steps]: 'steps',
  [NAME.active]: 'steps',
  [NAME.bp]: 'bp',
  [NAME.spo2]: 'spo2',
};

export const metricForRow = (label: string): MetricKey | null => ROW_METRIC[label] ?? null;
