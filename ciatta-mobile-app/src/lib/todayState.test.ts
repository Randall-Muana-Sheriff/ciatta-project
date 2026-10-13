import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { todayState } from './todayState';

const day = (over: Partial<Day>): Day => ({
  date: '2026-10-12', sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});

test('a new record, nothing measured, logged or cycled, is the empty state', () => {
  assert.deepEqual(todayState({ days: [], windows: 0, logs: 0 }), { state: 'empty', measured: false, logged: false, cycle: false });
  // Rows that hold nothing are still nothing.
  assert.equal(todayState({ days: [day({}), day({})], windows: 0, logs: 0 }).state, 'empty');
});

test('anything of hers makes it the content state, and says which parts exist', () => {
  assert.deepEqual(todayState({ days: [day({ hrv: 42 })], windows: 0, logs: 0 }), { state: 'content', measured: true, logged: false, cycle: false });
  assert.deepEqual(todayState({ days: [day({ mood: 3 })], windows: 0, logs: 0 }), { state: 'content', measured: false, logged: true, cycle: false });
  assert.deepEqual(todayState({ days: [], windows: 0, logs: 2 }), { state: 'content', measured: false, logged: true, cycle: false });
  assert.deepEqual(todayState({ days: [], windows: 1, logs: 0 }), { state: 'content', measured: false, logged: false, cycle: true });
  assert.equal(todayState({ days: [day({ foods: ['Oats'] })], windows: 0, logs: 0 }).logged, true);
  assert.equal(todayState({ days: [day({ steps: 4000 })], windows: 0, logs: 0 }).measured, true);
});
