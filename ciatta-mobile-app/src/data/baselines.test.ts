// The baselines edge function's maths live beside it (a Deno file imports
// them with a relative path), but they are plain TypeScript with no Deno
// or Supabase imports, so this suite exercises them directly under
// node:test, the same pattern as ingest.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { band as engineBand, median as engineMedian } from '../lib/engine';
import {
  band,
  baselineWindow,
  buildDenseWindow,
  computeMetric,
  computeTempDeviations,
  detectRun,
  median,
  MIN_BASELINE_N,
  recentWindow,
  WINDOW_SIZE,
} from '../../supabase/functions/baselines/compute';

// Builds a WINDOW_SIZE (91 day) values array: the first `baselineLen`
// entries hold the baseline window value, the rest (the recent window)
// hold the recent value, unless overridden by `overrides` (index -> value,
// counted from the end, 0 = today).
function fixedWindow(baselineValue: number, recentValue: number, overridesFromEnd: Record<number, number | null> = {}): (number | null)[] {
  const values: (number | null)[] = [];
  for (let i = 0; i < WINDOW_SIZE; i++) {
    values.push(i < WINDOW_SIZE - 35 ? baselineValue : recentValue);
  }
  for (const [k, v] of Object.entries(overridesFromEnd)) {
    values[values.length - 1 - Number(k)] = v;
  }
  return values;
}

function fixedDates(): string[] {
  const out: string[] = [];
  const start = new Date('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < WINDOW_SIZE; i++) {
    out.push(new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

test('band() matches the engine reference band() for the same input', () => {
  const xs = [10, 12, 9, 11, 10, 13, 8, 10, 12, 11, 9, 10];
  const reference = engineBand(xs);
  const local = band(xs);
  assert.equal(local.median, reference.usual);
  assert.equal(local.low, reference.low);
  assert.equal(local.high, reference.high);
});

test('median() matches the engine reference median() for the same input', () => {
  const xs = [4, 8, 15, 16, 23, 42];
  assert.equal(median(xs), engineMedian(xs));
});

test('fewer than 20 baseline values yields sufficient false, all four figures null, no change', () => {
  const values = fixedWindow(7, 7);
  // Blank all but 10 of the 56 baseline entries.
  for (let i = 10; i < WINDOW_SIZE - 35; i++) values[i] = null;
  const result = computeMetric(fixedDates(), values);
  assert.ok(result);
  assert.equal(result!.baseline.sufficient, false);
  assert.equal(result!.baseline.median, null);
  assert.equal(result!.baseline.low, null);
  assert.equal(result!.baseline.high, null);
  assert.equal(result!.baseline.variability, null);
  assert.ok(result!.baseline.n < MIN_BASELINE_N);
  assert.equal(result!.change, null);
});

test('a flat series yields a band no narrower than 8 percent either side', () => {
  const values = fixedWindow(8, 8);
  const result = computeMetric(fixedDates(), values);
  assert.ok(result?.baseline.sufficient);
  assert.equal(result!.baseline.variability, 0); // no spread in a flat series, MAD is 0
  assert.ok(result!.baseline.low! <= 8 * 0.92 + 1e-9);
  assert.ok(result!.baseline.high! >= 8 * 1.08 - 1e-9);
});

test('a 6 day dip below the band yields one change row with direction lower', () => {
  const values = fixedWindow(10, 10, { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 });
  const result = computeMetric(fixedDates(), values);
  assert.ok(result?.baseline.sufficient);
  assert.ok(result!.change, 'expected a change row');
  assert.equal(result!.change!.direction, 'lower');
  assert.equal(result!.change!.fromValue, 10);
  assert.equal(result!.change!.toValue, 5);
  assert.equal(result!.change!.quality, 'ok');
});

test('one day back inside the band does not break a run, two do', () => {
  const b = band([10, 10, 10, 10, 10]); // low 9.2, high 10.8

  // 6 low days, one in band day tucked in the middle, 3 more low days: the
  // single in band day should be folded into the streak rather than
  // ending it.
  const oneGap = [10, 5, 5, 5, 10, 5, 5, 5];
  const runWithOneGap = detectRun(oneGap, b);
  assert.ok(runWithOneGap);
  assert.equal(runWithOneGap!.direction, 'lower');
  assert.equal(runWithOneGap!.streak, 7); // every low day counted, the one tolerated day folded in
  assert.equal(runWithOneGap!.firstIndex, 1);

  // Two in band days in a row end the run: only the days after the gap
  // count.
  const twoGap = [10, 5, 5, 5, 10, 10, 5, 5, 5];
  const runWithTwoGap = detectRun(twoGap, b);
  assert.ok(runWithTwoGap);
  assert.equal(runWithTwoGap!.direction, 'lower');
  assert.equal(runWithTwoGap!.streak, 3); // only the trailing 3 low days
  assert.equal(runWithTwoGap!.firstIndex, 6);
});

test('quality is partial when some days in the run are missing, low when fewer than half have values', () => {
  const values = fixedWindow(10, 10, { 0: 5, 1: 5, 2: 5, 3: null, 4: 5, 5: 5 });
  const result = computeMetric(fixedDates(), values);
  assert.ok(result?.change);
  assert.equal(result!.change!.quality, 'partial');

  // 5 matching days (still enough for a change) spread across an 11 day
  // span with 6 missing days folded silently in between: more than half
  // the run is missing, so quality drops to low rather than partial.
  const lowQualityValues = fixedWindow(10, 10, {
    0: 5,
    1: null,
    2: null,
    3: 5,
    4: null,
    5: null,
    6: 5,
    7: null,
    8: null,
    9: 5,
    10: 5,
  });
  const lowQualityResult = computeMetric(fixedDates(), lowQualityValues);
  assert.ok(lowQualityResult?.change);
  assert.equal(lowQualityResult!.change!.quality, 'low');
});

test('a metric with no values at all yields no result, not an insufficient row full of nulls', () => {
  const values = new Array(WINDOW_SIZE).fill(null);
  const result = computeMetric(fixedDates(), values);
  assert.equal(result, null);
});

test('buildDenseWindow leaves a day with no entry as null rather than skipping it', () => {
  const today = new Date('2026-06-10T12:00:00.000Z');
  const byDay = new Map([
    ['2026-06-10', 100],
    ['2026-06-08', 50],
  ]);
  const { dates, values } = buildDenseWindow(byDay, today, 5);
  assert.deepEqual(dates, ['2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10']);
  assert.deepEqual(values, [null, null, 50, null, 100]);
});

test('baselineWindow and recentWindow partition a 91 day window at the 35 day mark', () => {
  const values = Array.from({ length: WINDOW_SIZE }, (_, i) => i);
  const baseline = baselineWindow(values);
  const recent = recentWindow(values);
  assert.equal(baseline.length, 56);
  assert.equal(recent.length, 35);
  assert.equal(baseline[baseline.length - 1] + 1, recent[0]); // contiguous, no gap or overlap
});

test('the temperature deviation is the nights value minus the baseline median', () => {
  const values = fixedWindow(36.5, 36.5, { 0: 37.2, 2: 36.0 });
  const deviations = computeTempDeviations(fixedDates(), values);
  const dates = fixedDates();
  const today = dates[dates.length - 1];
  const twoAgo = dates[dates.length - 3];

  const todayDeviation = deviations.find((d) => d.day === today);
  const twoAgoDeviation = deviations.find((d) => d.day === twoAgo);
  assert.ok(todayDeviation);
  assert.ok(twoAgoDeviation);
  assert.ok(Math.abs(todayDeviation!.value - 0.7) < 1e-9);
  assert.ok(Math.abs(twoAgoDeviation!.value - -0.5) < 1e-9);
});

test('the temperature deviation is null (no entries) when the baseline is insufficient', () => {
  const values = fixedWindow(36.5, 37.0);
  // Blank all but 5 of the 56 baseline entries.
  for (let i = 5; i < WINDOW_SIZE - 35; i++) values[i] = null;
  const deviations = computeTempDeviations(fixedDates(), values);
  assert.equal(deviations.length, 0);
});
