import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { buildMetrics, headlineMetrics, recordedCount, recordedLine } from './allMetrics';

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

const find = (day: Day | null, label: string) =>
  buildMetrics(day)
    .flatMap((g) => g.rows)
    .find((r) => r.label === label);

// ── Missing is unknown, never zero ───────────────────────────────────

test('no row at all leaves every metric unrecorded', () => {
  const groups = buildMetrics(null);
  assert.ok(groups.length > 0);
  for (const g of groups) for (const r of g.rows) assert.equal(r.value, null, `${r.label} should be null`);
});

test('a row of nulls is unknown, and never prints a zero', () => {
  for (const g of buildMetrics(empty)) {
    for (const r of g.rows) {
      // Workouts is the one real zero: the day exists and lists none.
      if (r.label === 'Workouts') continue;
      assert.equal(r.value, null, `${r.label} should be null, got ${r.value}`);
    }
  }
});

test('zero steps is a measured zero and says so, unlike a missing one', () => {
  assert.equal(find({ ...empty, steps: 0 }, 'Steps')?.value, '0');
  assert.equal(find(empty, 'Steps')?.value, null);
});

test('a day with no workouts logged says none, but no day at all says nothing', () => {
  assert.equal(find(empty, 'Workouts')?.value, '0');
  assert.equal(find(null, 'Workouts')?.value, null);
});

// ── How each figure is said ──────────────────────────────────────────

test('sleep is hours and minutes, not a decimal', () => {
  assert.equal(find({ ...empty, sleepHours: 7.5 }, 'Time asleep')?.value, '7h 30m');
});

test('stages are minutes', () => {
  const day = { ...empty, stages: { awake: 22, rem: 95, light: 210, deep: 61 } };
  assert.equal(find(day, 'Deep')?.value, '61 min');
  assert.equal(find(day, 'REM')?.value, '95 min');
});

test('skin temperature is signed and named as a change, never a body temperature', () => {
  const warm = find({ ...empty, tempDeviation: 0.42 }, 'Skin temperature');
  assert.equal(warm?.value, '+0.4 °C');
  assert.equal(warm?.note, 'Change from your own usual');
  assert.equal(find({ ...empty, tempDeviation: -0.3 }, 'Skin temperature')?.value, '-0.3 °C');
});

test('a check in is the number she chose, never relabelled', () => {
  const row = find({ ...empty, mood: 4 }, 'Mood');
  assert.equal(row?.value, '4 of 5');
  for (const word of ['good', 'poor', 'low', 'high']) {
    assert.ok(!(row?.value ?? '').toLowerCase().includes(word));
  }
});

// ── Measured and reported stay apart ─────────────────────────────────

test('instrument readings and her own check ins are labelled differently', () => {
  assert.equal(find(empty, 'Heart rate variability')?.from, 'measured');
  assert.equal(find(empty, 'Steps')?.from, 'measured');
  assert.equal(find(empty, 'Mood')?.from, 'reported');
  assert.equal(find(empty, 'Caffeine')?.from, 'reported');
});

// ── The count ────────────────────────────────────────────────────────

test('an empty day counts only the workouts zero', () => {
  const counts = recordedCount(buildMetrics(empty));
  assert.equal(counts.recorded, 1);
  assert.ok(counts.total > 10);
});

test('the line states the count and does not editorialise', () => {
  assert.equal(recordedLine({ recorded: 0, total: 19 }), 'Nothing recorded today yet.');
  assert.equal(recordedLine({ recorded: 9, total: 19 }), '9 of 19 recorded today.');
});

test('no label or value carries a dash, which display copy forbids', () => {
  const day: Day = { ...empty, sleepHours: 7, hrv: 40, steps: 900, tempDeviation: -0.2, mood: 3 };
  for (const g of buildMetrics(day)) {
    assert.ok(!/[—–]/.test(g.title), g.title);
    for (const r of g.rows) {
      assert.ok(!/[—–]/.test(r.label), r.label);
      // A minus sign on a temperature is an arithmetic sign, not a dash.
      assert.ok(!/[—–]/.test(r.value ?? ''), r.value ?? '');
    }
  }
});

// ── The six on Today ─────────────────────────────────────────────────

test('six headline metrics, in a stable order', () => {
  const keys = headlineMetrics(null).map((m) => m.key);
  assert.deepEqual(keys, ['sleep', 'hrv', 'restingHR', 'steps', 'active', 'temp']);
});

test('with no day at all, every card is absent rather than zero', () => {
  for (const m of headlineMetrics(null)) assert.equal(m.value, null, m.key);
});

test('heart rate variability and resting heart rate carry their units', () => {
  const day = { ...empty, hrv: 42.4, restingHR: 58.6 };
  const by = Object.fromEntries(headlineMetrics(day).map((m) => [m.key, m.value]));
  assert.equal(by.hrv, '42 ms');
  assert.equal(by.restingHR, '59 bpm');
});

test('a measured zero still shows, unlike a missing figure', () => {
  const by = Object.fromEntries(headlineMetrics({ ...empty, steps: 0 }).map((m) => [m.key, m.value]));
  assert.equal(by.steps, '0');
  assert.equal(Object.fromEntries(headlineMetrics(empty).map((m) => [m.key, m.value])).steps, null);
});

test('skin temperature is signed and says it is a difference', () => {
  const m = headlineMetrics({ ...empty, tempDeviation: 0.42 }).find((x) => x.key === 'temp')!;
  assert.equal(m.value, '+0.4 °C');
  assert.equal(m.note, 'From your usual');
});

test('an absent skin temperature carries no note either', () => {
  assert.equal(headlineMetrics(empty).find((x) => x.key === 'temp')!.note, undefined);
});

test('every headline is measured, so none is confused with what she reported', () => {
  for (const m of headlineMetrics(empty)) assert.equal(m.from, 'measured', m.key);
});
