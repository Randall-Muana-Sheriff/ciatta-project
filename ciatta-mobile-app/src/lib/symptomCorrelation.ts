// Comparing what she logged, for the Symptoms card on Today: one symptom
// against another, or a symptom against a wearable reading, over the days
// in view. Said as what her own days show (how often, how much), never as
// one causing the other, and only once each side has enough days to say it.

import type { Day } from '../data/daily';
import { fmtCount, fmtHours } from './engine';
import type { Range } from './symptomStrip';

const DAY = 86400000;
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const lower = (s: string) => s.toLowerCase();

// Every day in the window, oldest first, ending today. Three months is
// compared day by day, even where the strip draws it a week at a time.
export function windowDays(range: Range, now: Date): string[] {
  const n = range === '90' ? 90 : Number(range);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: n }, (_, i) => key(new Date(today.getTime() - (n - 1 - i) * DAY)));
}

export type SymptomPair = { both: number; a: number; b: number; days: number; together: boolean; sentence: string };

export function symptomCorrelation(aName: string, aDays: ReadonlySet<string>, bName: string, bDays: ReadonlySet<string>, days: readonly string[]): SymptomPair {
  const inA = days.filter((d) => aDays.has(d));
  const inB = days.filter((d) => bDays.has(d));
  const both = inA.filter((d) => bDays.has(d)).length;
  const a = inA.length;
  const b = inB.length;
  const others = days.length - a;
  const bOutside = b - both;
  if (a < 2 || b < 2) {
    return { both, a, b, days: days.length, together: false, sentence: `Log ${lower(aName)} on at least 2 days, and ${lower(bName)} on at least 2, to compare them.` };
  }
  const together = both >= 2 && both / a > 1.5 * (others ? bOutside / others : 0);
  return {
    both,
    a,
    b,
    days: days.length,
    together,
    sentence: `${bName} came on ${both ? both : 'none'} of the ${a} days you logged ${lower(aName)}, against ${bOutside} of the other ${others} days.`,
  };
}

export type CompareMetric = 'sleep' | 'hrv' | 'rhr' | 'steps';
export const COMPARE_METRICS: { key: CompareMetric; label: string }[] = [
  { key: 'sleep', label: 'Sleep' },
  { key: 'hrv', label: 'HRV' },
  { key: 'rhr', label: 'RHR' },
  { key: 'steps', label: 'Steps' },
];

const READ: Record<CompareMetric, { get: (d: Day) => number | null; name: string; say: (n: number, x: string, on: number, off: number, a: number, b: number) => string }> = {
  sleep: {
    get: (d) => d.sleepHours,
    name: 'sleep',
    say: (_n, x, on, off, a, b) => `On the ${a} days you logged ${x}, you slept ${fmtHours(on)} on average, against ${fmtHours(off)} on the other ${b}.`,
  },
  hrv: {
    get: (d) => d.hrv,
    name: 'HRV',
    say: (_n, x, on, off, a, b) => `On the ${a} days you logged ${x}, your HRV averaged ${Math.round(on)} ms, against ${Math.round(off)} ms on the other ${b}.`,
  },
  rhr: {
    get: (d) => d.restingHR,
    name: 'resting heart rate',
    say: (_n, x, on, off, a, b) => `On the ${a} days you logged ${x}, your resting heart rate averaged ${Math.round(on)} bpm, against ${Math.round(off)} bpm on the other ${b}.`,
  },
  steps: {
    get: (d) => d.steps,
    name: 'steps',
    say: (_n, x, on, off, a, b) => `On the ${a} days you logged ${x}, you walked ${fmtCount(on)} steps on average, against ${fmtCount(off)} on the other ${b}.`,
  },
};

export function metricCorrelation(
  name: string,
  symptomDays: ReadonlySet<string>,
  metric: CompareMetric,
  days: readonly Day[],
  window: readonly string[],
): { direction: 'lower' | 'higher' | 'same' | null; sentence: string } {
  const r = READ[metric];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const on: number[] = [];
  const off: number[] = [];
  for (const k of window) {
    const d = byDate.get(k);
    const v = d ? r.get(d) : null;
    if (v == null) continue;
    (symptomDays.has(k) ? on : off).push(v);
  }
  if (on.length < 2 || off.length < 3) {
    return { direction: null, sentence: `Not enough ${r.name} readings on ${lower(name)} days and other days to compare yet.` };
  }
  const a = avg(on);
  const b = avg(off);
  const direction = Math.abs(a - b) / (b || 1) < 0.05 ? 'same' : a < b ? 'lower' : 'higher';
  return { direction, sentence: r.say(0, lower(name), a, b, on.length, off.length) };
}
