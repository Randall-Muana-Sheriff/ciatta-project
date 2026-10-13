import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { patternLanes } from './patternLanes';

const NOW = new Date(2026, 9, 14, 12);
const iso = (n: number) => {
  const d = new Date(2026, 9, 14 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const day = (n: number, over: Partial<Day>): Day => ({
  date: iso(n), sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});
const ep = (n: number, symptoms: string[], severity: number | null, kinds = ['Symptoms']) => ({ date: iso(n), kinds, symptoms, severity });

test('fourteen days, oldest first, ending today; only lanes she has data for', () => {
  const v = patternLanes({ days: [day(0, { sleepHours: 7 })], episodes: [], periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW });
  assert.equal(v.days.length, 14);
  assert.equal(v.days[13], iso(0));
  assert.deepEqual(v.lanes.map((l) => l.key), ['sleep']);
  assert.equal(patternLanes({ days: [], episodes: [], periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW }).lanes.length, 0);
});

test('every lane on one axis: sleep, heart, mood, symptoms, cycle', () => {
  const days = [day(1, { sleepHours: 6, hrv: 40, mood: 2 }), day(0, { sleepHours: 8, restingHR: 60, mood: 4 })];
  const episodes = [ep(1, ['Headache', 'Bloating'], 6), ep(0, ['Headache'], null), ep(3, [], 8, ['Pain'])];
  const v = patternLanes({
    days, episodes, periodDays: new Set([iso(1), iso(0)]),
    usual: { sleep: 7.5, hrv: { low: 42, high: 55 } }, cycleDayToday: 2, now: NOW,
  });
  assert.deepEqual(v.lanes.map((l) => l.key), ['sleep', 'heart', 'mood', 'symptoms', 'cycle']);
  const sleep = v.lanes[0];
  assert.equal(sleep.kind === 'bars' && sleep.values[12], 6);
  assert.equal(sleep.kind === 'bars' && sleep.usual, 7.5);
  const heart = v.lanes[1];
  assert.equal(heart.kind === 'dots' && heart.label, 'HRV', 'HRV leads when she has it');
  const sym = v.lanes[3];
  assert.ok(sym.kind === 'heat');
  if (sym.kind === 'heat') {
    assert.deepEqual(sym.rows.map((r) => r.name), ['Headache', 'Bloating', 'Pain'], 'most frequent first');
    assert.equal(sym.rows[0].cells[12], 0.6, 'severity out of 10');
    assert.equal(sym.rows[0].cells[13], 0.5, 'logged without a severity reads as present');
    assert.equal(sym.rows[0].cells[0], null);
  }
  const cyc = v.lanes[4];
  assert.ok(cyc.kind === 'cycle' && cyc.period[13] && cyc.period[12] && !cyc.period[11]);
  assert.ok(cyc.kind === 'cycle' && cyc.cycleDay[13] === 2 && cyc.cycleDay[12] === 1 && cyc.cycleDay[11] === null);
});

test('resting heart rate stands in when there is no HRV', () => {
  const v = patternLanes({ days: [day(0, { restingHR: 61 })], episodes: [], periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW });
  assert.equal(v.lanes[0].label, 'Resting HR');
});

test('a pattern is said only when her own days show it, with the counts', () => {
  // Symptom days slept 6h, the others 8h.
  const days = Array.from({ length: 14 }, (_, n) => day(n, { sleepHours: [0, 3, 6, 9].includes(n) ? 6 : 8 }));
  const episodes = [0, 3, 6, 9].map((n) => ep(n, ['Headache'], 5));
  const v = patternLanes({ days, episodes, periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW });
  assert.equal(v.pattern, 'On the 4 days you logged symptoms, you slept 2h 00m less than on the other 10.');
  // Too few symptom days: nothing said.
  const few = patternLanes({ days, episodes: episodes.slice(0, 1), periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW });
  assert.equal(few.pattern, null);
  // No real difference: nothing said.
  const flat = Array.from({ length: 14 }, (_, n) => day(n, { sleepHours: 7 }));
  assert.equal(patternLanes({ days: flat, episodes, periodDays: new Set(), usual: {}, cycleDayToday: null, now: NOW }).pattern, null);
});
