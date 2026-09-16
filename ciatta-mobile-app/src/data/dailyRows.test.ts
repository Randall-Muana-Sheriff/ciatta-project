import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysFromRows, rowToDay } from './dailyRows';

// A row from daily_metrics: every measured column is nullable, and a sync
// that only carried steps leaves every other column absent. rowToDay must
// pass that absence through as null, never as a fabricated zero.
test('a row carrying only steps projects to a Day whose sleepHours is null, not 0', () => {
  const day = rowToDay({ day: '2026-09-10', steps: 4200 });
  assert.equal(day.date, '2026-09-10');
  assert.equal(day.steps, 4200);
  assert.equal(day.sleepHours, null);
  assert.equal(day.timeInBed, null);
  assert.equal(day.activeMinutes, null);
  assert.equal(day.restingHR, null);
  assert.equal(day.hrv, null);
  assert.equal(day.tempDeviation, null);
  assert.equal(day.energy, null);
  assert.equal(day.mood, null);
  assert.equal(day.stress, null);
  assert.deepEqual(day.stages, { awake: null, rem: null, light: null, deep: null });
  assert.deepEqual(day.workouts, [], 'an absent list is an empty array at this layer');
  assert.deepEqual(day.foods, []);
  assert.deepEqual(day.digestion, []);
});

test('a row carrying its own workouts, foods and digestion keeps them', () => {
  const day = rowToDay({
    day: '2026-09-10',
    workouts: [{ type: 'Run', minutes: 30, intensity: 'Moderate' }],
    foods: ['Dairy'],
    digestion: ['Bloating'],
  });
  assert.deepEqual(day.workouts, [{ type: 'Run', minutes: 30, intensity: 'Moderate' }]);
  assert.deepEqual(day.foods, ['Dairy']);
  assert.deepEqual(day.digestion, ['Bloating']);
});

test('a missing calendar day appears as an entirely empty day, so slice(-14) spans 14 calendar days across the gap', () => {
  const today = new Date(2026, 8, 16); // 16 Sep 2026
  const rows = [
    { day: '2026-09-01', steps: 4000 },
    { day: '2026-09-16', steps: 5000 },
  ];
  const days = daysFromRows(rows, today);
  assert.equal(days.length, 16, 'one entry per calendar day from the earliest row through today');

  const gapDay = days.find((d) => d.date === '2026-09-08');
  assert.ok(gapDay, 'a day with no row still gets an entry');
  assert.equal(gapDay!.steps, null);
  assert.equal(gapDay!.sleepHours, null);
  assert.deepEqual(gapDay!.workouts, []);
  assert.deepEqual(gapDay!.foods, []);

  const last14 = days.slice(-14);
  assert.equal(last14.length, 14, 'slice(-14) still spans 14 calendar days, not 14 rows');
  assert.equal(last14[0].date, '2026-09-03');
  assert.equal(last14[13].date, '2026-09-16');
});

test('rows come back oldest first, regardless of the order they were fetched in', () => {
  const rows = [
    { day: '2026-09-16', steps: 1 },
    { day: '2026-09-01', steps: 2 },
    { day: '2026-09-10', steps: 3 },
  ];
  const days = daysFromRows(rows, new Date(2026, 8, 16));
  const dates = days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(days[0].date, '2026-09-01');
  assert.equal(days[days.length - 1].date, '2026-09-16');
});

test('no rows at all projects to no days', () => {
  assert.deepEqual(daysFromRows([], new Date(2026, 8, 16)), []);
});
