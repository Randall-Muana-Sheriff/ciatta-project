import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { latestReadings, workoutCount } from './healthReadings';

function day(date: string, over: Partial<Day> = {}): Day {
  return {
    date,
    sleepHours: null,
    stages: { awake: null, rem: null, light: null, deep: null },
    timeInBed: null,
    steps: null,
    activeMinutes: null,
    workouts: [],
    restingHR: null,
    hrv: null,
    tempDeviation: null,
    ...(over as Day),
  } as Day;
}

test('no days means no readings, not a row of blanks', () => {
  assert.deepEqual(latestReadings([]), []);
});

test('a reading that never arrived is left out, never shown as zero', () => {
  // The rule the whole file exists for. A woman with no watch has unknown
  // heart rate variability, and a zero would be a measurement she never
  // produced.
  const readings = latestReadings([day('2026-10-09', { steps: 8432 })]);
  assert.deepEqual(readings.map((r) => r.label), ['Steps']);
  assert.ok(!readings.some((r) => r.value === '0'));
});

test('each reading is the newest one there is, with the day it came from', () => {
  // Newest rather than today's: a watch left on the side for two days still
  // has a week of real data behind it, and showing nothing would say Apple
  // Health gave us nothing.
  const readings = latestReadings([
    day('2026-10-05', { steps: 2000, restingHR: 61 }),
    day('2026-10-09', { steps: 8432 }),
    day('2026-10-07', { steps: 5000, restingHR: 58 }),
  ]);
  const steps = readings.find((r) => r.label === 'Steps');
  const hr = readings.find((r) => r.label === 'Resting heart rate');
  assert.equal(steps?.value, '8,432');
  assert.equal(steps?.on, '2026-10-09');
  assert.equal(hr?.value, '58 bpm', 'it did not take the newest heart rate');
  assert.equal(hr?.on, '2026-10-07', 'the day shown is not the day the reading is from');
});

test('the order does not depend on the order the rows arrived in', () => {
  const ascending = latestReadings([day('2026-10-01', { steps: 100 }), day('2026-10-09', { steps: 900 })]);
  const descending = latestReadings([day('2026-10-09', { steps: 900 }), day('2026-10-01', { steps: 100 })]);
  assert.deepEqual(ascending, descending);
  assert.equal(ascending[0].value, '900');
});

test('sleep reads as hours and minutes, not as a decimal', () => {
  const readings = latestReadings([day('2026-10-09', { sleepHours: 7.35, timeInBed: 8 })]);
  assert.equal(readings.find((r) => r.label === 'Sleep time')?.value, '7h 21m');
  assert.equal(readings.find((r) => r.label === 'Time in bed')?.value, '8h');
});

test('a short night still reads as minutes', () => {
  assert.equal(latestReadings([day('2026-10-09', { sleepHours: 0.5 })])[0].value, '30m');
});

test('steps are grouped, and every value carries its unit', () => {
  const readings = latestReadings([
    day('2026-10-09', { steps: 12345, restingHR: 58.4, hrv: 42.6, activeMinutes: 37 }),
  ]);
  const by = Object.fromEntries(readings.map((r) => [r.label, r.value]));
  assert.equal(by.Steps, '12,345');
  assert.equal(by['Resting heart rate'], '58 bpm');
  assert.equal(by['Heart rate variability'], '43 ms');
  assert.equal(by['Active minutes'], '37 min');
});

test('no reading label or value holds a dash of any kind', () => {
  const readings = latestReadings([
    day('2026-10-09', { steps: 1, sleepHours: 1.5, restingHR: 1, hrv: 1, activeMinutes: 1, timeInBed: 1 }),
  ]);
  assert.equal(readings.length, 6, 'a reading went missing');
  for (const r of readings) {
    for (const dash of ['—', '–', '-']) {
      assert.ok(!r.label.includes(dash) && !r.value.includes(dash), `${r.label} ${r.value} contains ${dash}`);
    }
  }
});

test('workouts are counted across every day', () => {
  assert.equal(workoutCount([]), 0);
  assert.equal(
    workoutCount([
      day('2026-10-09', { workouts: [{}, {}] as Day['workouts'] }),
      day('2026-10-08', { workouts: [{}] as Day['workouts'] }),
    ]),
    3,
  );
});
