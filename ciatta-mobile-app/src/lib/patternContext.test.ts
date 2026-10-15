import assert from 'node:assert/strict';
import { test } from 'node:test';

import { patternContext } from './patternContext';

const rhr = { key: 'resting_hr', label: 'Resting heart rate', latest: '74 bpm', on: '2026-10-19', usual: '55 to 68 bpm', side: 'above' as const, daysOutside: 3 };
const hrvOk = { key: 'hrv', label: 'HRV', latest: '50 ms', on: '2026-10-19', usual: '40 to 60 ms', side: 'within' as const, daysOutside: 0 };

test('a pattern carries her readings against her usual, how long, and where she is in her cycle', () => {
  const out = patternContext('cycle-physiology', ['Today is day 22 of your cycle, likely luteal.'], { readings: [rhr, hrvOk], cycle: { day: 22, phase: 'Likely luteal' } });
  assert.deepEqual(out.lines, [
    'Today is day 22 of your cycle, likely luteal.',
    'Resting heart rate has been above your usual of 55 to 68 bpm on 3 days, latest 74 bpm.',
  ]);
  assert.deepEqual(out.metrics, ['resting_hr', 'hrv']);
});

test('the cycle line is added when the record line did not say it', () => {
  const out = patternContext('iron-fatigue', ['Ferritin was low, 12 ng/mL on 3 Oct.'], { readings: [], cycle: { day: 4, phase: 'During period' } });
  assert.deepEqual(out.lines, ['Ferritin was low, 12 ng/mL on 3 Oct.', 'Today is day 4 of your cycle, during period.']);
});

test('a reading within her usual adds nothing, and no cycle adds nothing', () => {
  const out = patternContext('sleep-cycle', ['You logged insomnia on 4 days in the last 90.'], { readings: [hrvOk], cycle: null });
  assert.deepEqual(out.lines, ['You logged insomnia on 4 days in the last 90.']);
  assert.deepEqual(out.metrics, ['sleep_hours']);
});

test('a day said once reads as one day', () => {
  const out = patternContext('cycle-physiology', [], { readings: [{ ...rhr, daysOutside: 1 }], cycle: null });
  assert.equal(out.lines[0], 'Resting heart rate has been above your usual of 55 to 68 bpm on 1 day, latest 74 bpm.');
});

test('an insight with no metrics of its own points at none', () => {
  assert.deepEqual(patternContext('bristol', ['x'], { readings: [rhr], cycle: null }).metrics, []);
});
