import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay } from './cycleLog';
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
  assert.equal(day.caffeine, null, 'caffeine unmeasured is null, not a fabricated zero cups');
  assert.equal(day.alcohol, null, 'alcohol unmeasured is null, not a fabricated zero drinks');
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
  assert.equal(gapDay!.caffeine, null);
  assert.equal(gapDay!.alcohol, null);
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

// Review fix: nothing downstream reads further back than baselineDays' 91
// day window, so a record with years of history should not rebuild an
// object per day back to the very first sync every time the app loads.
test('daysFromRows caps the window at roughly 91 days, even with years of history', () => {
  const today = new Date(2026, 8, 16);
  const rows = Array.from({ length: 1200 }, (_, i) => ({
    day: isoDay(addDays(today, -(1199 - i))),
    steps: 1000 + i,
  }));
  const days = daysFromRows(rows, today);
  assert.equal(days.length, 91, 'capped, not one entry per row ever synced');
  assert.equal(days[days.length - 1].date, isoDay(today));
  assert.equal(days[0].date, isoDay(addDays(today, -90)));
  // The oldest kept row still carries its real value; nothing outside the
  // window is silently corrupted, it is just not built.
  assert.equal(days[0].steps, 1000 + (1200 - 91));
});

// Review fix: a row a day ahead of the client's clock (device clock skew, or
// a timezone ahead of hers) must still get an entry rather than being
// silently dropped because the window used to always end at `today`.
test('a row dated after today still gets an entry, rather than being dropped', () => {
  const today = new Date(2026, 8, 16);
  const tomorrow = addDays(today, 1);
  const rows = [
    { day: isoDay(addDays(today, -1)), steps: 4000 },
    { day: isoDay(today), steps: 4500 },
    { day: isoDay(tomorrow), steps: 5000 },
  ];
  const days = daysFromRows(rows, today);
  assert.equal(days.length, 3, 'the window extends to the latest row, not just to today');
  assert.equal(days[days.length - 1].date, isoDay(tomorrow));
  assert.equal(days[days.length - 1].steps, 5000);
});
