import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { sustained } from './engine';
import { anyReady, BASELINE_MIN, BASELINE_TO, metricLine, patternReadiness, readinessLine } from './patternReadiness';

const empty: Day = {
  date: '2026-10-11',
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

// A usual HRV that wobbles, then a week clearly below it: the shape
// sustained() exists to find, once it has a baseline to find it against.
const series = (n: number): Day[] =>
  Array.from({ length: n }, (_, i) => ({ ...empty, hrv: i >= n - 7 ? 20 : 48 + (i % 5) }));

const hrv = (days: Day[]) => patternReadiness(days).find((r) => r.key === 'hrv')!;

// The module duplicates engine.ts's numbers rather than importing them.
// This pins them to what the engine actually does, at the edge.
test('ready exactly when the engine can first produce a finding', () => {
  const edge = BASELINE_TO + BASELINE_MIN;
  assert.equal(hrv(series(edge - 1)).ready, false);
  assert.equal(sustained(series(edge - 1), (d) => d.hrv), null);
  assert.equal(hrv(series(edge)).ready, true);
  assert.notEqual(sustained(series(edge), (d) => d.hrv), null);
});

test('counts days that carry the reading, not days that exist', () => {
  // Worn one night in three: 80 days of calendar, 15 in the window.
  const days = Array.from({ length: 80 }, (_, i) => ({ ...empty, hrv: i % 3 ? null : 50 }));
  const r = hrv(days);
  assert.equal(r.total, 27);
  assert.equal(r.have, 15);
  assert.ok(r.have < BASELINE_MIN);
  assert.equal(r.ready, false);
});

test('says when the first comparison becomes possible', () => {
  const days = series(30);
  const line = readinessLine(days, patternReadiness(days));
  assert.match(line, /about 25 days from now/);
});

test('names what is ready, and only that', () => {
  const days = series(60);
  const ready = patternReadiness(days);
  assert.ok(anyReady(ready));
  assert.equal(readinessLine(days, ready), '1 of 5 measures have enough history for a comparison: heart rate variability.');
});

test('a long history with too few readings says so, rather than a date', () => {
  const days = Array.from({ length: 80 }, (_, i) => ({ ...empty, hrv: i % 4 ? null : 50 }));
  assert.match(readinessLine(days, patternReadiness(days)), /too few of them carry a reading/);
});

test('no days at all is said plainly', () => {
  assert.equal(readinessLine([], patternReadiness([])), 'No days have reached Ciatta yet.');
});

test('each metric line says what it is waiting for', () => {
  assert.equal(metricLine(hrv([])), 'Nothing has arrived for this yet.');
  assert.match(metricLine(hrv(series(20))), /^20 days recorded, but none yet/);
  assert.match(metricLine(hrv(series(45))), /^10 of 20 days/);
  assert.match(metricLine(hrv(series(60))), /Enough to compare against/);
});

test('no line carries a dash, which display copy forbids', () => {
  const days = series(45);
  const ready = patternReadiness(days);
  for (const s of [readinessLine(days, ready), ...ready.map(metricLine)]) assert.ok(!/[-–—]/.test(s), s);
});
