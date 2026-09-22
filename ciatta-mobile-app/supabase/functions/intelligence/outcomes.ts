// What happened after something she tried, measured the way the app
// already measures a planned walk (walkOutcomes in src/lib/engine.ts):
// the three days before the start against the three days from it. The
// verdict is one of five words, and three of them are refusals: unknown
// when the action named no measure, insufficient_evidence when either
// window holds fewer than two readings, and unchanged when the move is
// under the threshold either way. A number is never invented to fill a
// window.
//
// Plain TypeScript, no Deno or Supabase imports, tested from
// src/data/outcomes.test.ts, including a cross check against the engine.

import { daysApart, shiftDay } from './threads.ts';
import type { OutcomeValue } from './wording.ts';

export type MetricName = 'sleep_hours' | 'steps' | 'resting_hr' | 'hrv' | 'active_minutes';
export type Wanted = 'higher' | 'lower';

export type MetricDayRow = {
  day: string;
  steps: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  active_minutes: number | null;
  energy: number | null;
};

export type ActionToMeasure = {
  id: string;
  kind: string;
  metric: MetricName | null;
  wanted: Wanted | null;
  started_on: string;
};

export type WindowSummary = { from: string; to: string; n: number; mean: number | null };

export type MeasuredOutcome = {
  measured: OutcomeValue;
  evidence: {
    metric: MetricName | null;
    before: WindowSummary;
    after: WindowSummary;
    // after over before, minus one: 0.18 is eighteen percent higher.
    ratio: number | null;
    // For a walk, how her reported energy moved, when both windows have
    // check ins. Never a substitute for the metric.
    energyDelta: number | null;
  };
};

// The engine's windows, exactly.
export const WINDOW_DAYS = 3;
// A move smaller than this either way is unchanged; the engine's own bar
// for a walk having done anything to steps.
export const CHANGE_THRESHOLD = 0.1;
// The fewest readings a window needs before its mean means anything.
export const MIN_READINGS = 2;

// Which way is better when the action did not say. Resting heart rate is
// the one measure a lower reading is the hoped for direction of.
const DEFAULT_WANTED: Record<MetricName, Wanted> = {
  sleep_hours: 'higher',
  steps: 'higher',
  resting_hr: 'lower',
  hrv: 'higher',
  active_minutes: 'higher',
};

const nums = (xs: (number | null | undefined)[]) => xs.filter((v): v is number => v != null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function windowRows(days: Map<string, MetricDayRow>, start: string, offsets: number[]): { rows: MetricDayRow[]; from: string; to: string } {
  const list = offsets.map((k) => shiftDay(start, k));
  return { rows: list.map((d) => days.get(d)).filter((r): r is MetricDayRow => !!r), from: list[0], to: list[list.length - 1] };
}

// Null until the after window has fully elapsed: a half elapsed window
// reports a number as if it were the result.
export function measureOutcome(action: ActionToMeasure, days: MetricDayRow[], today: string): MeasuredOutcome | null {
  if (daysApart(action.started_on, today) < WINDOW_DAYS) return null;

  const byDay = new Map(days.map((d) => [d.day, d]));
  const before = windowRows(byDay, action.started_on, [-3, -2, -1]);
  const after = windowRows(byDay, action.started_on, [0, 1, 2]);

  const energyBefore = nums(before.rows.map((d) => d.energy));
  const energyAfter = nums(after.rows.map((d) => d.energy));
  const energyDelta =
    action.kind === 'walk' && energyBefore.length && energyAfter.length ? (mean(energyAfter) as number) - (mean(energyBefore) as number) : null;

  const summarise = (w: { rows: MetricDayRow[]; from: string; to: string }, values: number[]): WindowSummary => ({
    from: w.from,
    to: w.to,
    n: values.length,
    mean: mean(values),
  });

  if (!action.metric) {
    return {
      measured: 'unknown',
      evidence: { metric: null, before: summarise(before, []), after: summarise(after, []), ratio: null, energyDelta },
    };
  }

  const metric = action.metric;
  const bv = nums(before.rows.map((d) => d[metric]));
  const av = nums(after.rows.map((d) => d[metric]));
  const evidence = { metric, before: summarise(before, bv), after: summarise(after, av), ratio: null as number | null, energyDelta };
  if (bv.length < MIN_READINGS || av.length < MIN_READINGS) return { measured: 'insufficient_evidence', evidence };

  const bm = mean(bv) as number;
  const am = mean(av) as number;
  if (bm === 0) return { measured: 'insufficient_evidence', evidence };
  const ratio = am / bm - 1;
  evidence.ratio = ratio;

  const wanted = action.wanted ?? DEFAULT_WANTED[metric];
  const moved = wanted === 'higher' ? ratio : -ratio;
  const measured: OutcomeValue = moved >= CHANGE_THRESHOLD ? 'improved' : moved <= -CHANGE_THRESHOLD ? 'worse' : 'unchanged';
  return { measured, evidence };
}
