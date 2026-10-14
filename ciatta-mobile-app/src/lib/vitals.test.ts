import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bloodOxygen, bloodPressure, type Reading, VITAL_METRICS, weight, whenNote } from './vitals';

const NOW = new Date(2026, 9, 15, 9, 0);
const at = (daysAgo: number) => new Date(2026, 9, 15 - daysAgo, 8, 0).toISOString();
const r = (metric: string, value: number, daysAgo = 0, unit: string | null = null): Reading => ({
  metric, value, unit, at: at(daysAgo),
});

// ── When it was taken is part of the reading ─────────────────────────

test('today says nothing, because a card is assumed to hold today', () => {
  assert.equal(whenNote(at(0), NOW), null);
});

test('anything older says how old', () => {
  assert.equal(whenNote(at(1), NOW), 'Yesterday');
  assert.equal(whenNote(at(3), NOW), '3 days ago');
  assert.equal(whenNote(at(9), NOW), 'Last week');
  assert.equal(whenNote(at(21), NOW), '3 weeks ago');
});

test('a reading two months old is not shown as a current figure', () => {
  // Two months of nothing is a gap, not a blood pressure. Filling it with
  // the last thing seen would be lying quietly.
  const old = [r('oxygen_saturation', 0.98, 70)];
  assert.equal(bloodOxygen(old, NOW).value, null);
  assert.equal(weight([r('body_mass', 64, 70, 'kg')], NOW).value, null);
});

// ── Blood pressure is two numbers and one fact ───────────────────────

test('both halves, taken the same day, make a reading', () => {
  const card = bloodPressure([r('blood_pressure_systolic', 118.4), r('blood_pressure_diastolic', 76.6)], NOW);
  assert.equal(card.value, '118/77');
});

test('a systolic without a diastolic is not a blood pressure', () => {
  assert.equal(bloodPressure([r('blood_pressure_systolic', 118)], NOW).value, null);
  assert.equal(bloodPressure([r('blood_pressure_diastolic', 76)], NOW).value, null);
});

test('two halves from different days are two numbers, not a reading', () => {
  // A systolic from Tuesday over a diastolic from Friday is a slash
  // between two unrelated figures.
  const card = bloodPressure([r('blood_pressure_systolic', 118, 0), r('blood_pressure_diastolic', 76, 3)], NOW);
  assert.equal(card.value, null);
});

test('an older pair still shows, and says when', () => {
  const card = bloodPressure([r('blood_pressure_systolic', 120, 4), r('blood_pressure_diastolic', 80, 4)], NOW);
  assert.equal(card.value, '120/80');
  assert.equal(card.note, '4 days ago');
});

// ── Units ────────────────────────────────────────────────────────────

test('saturation reported as a fraction is shown as a percentage', () => {
  // HealthKit gives 0.98. Printed as 0.98 it means nothing to anyone who
  // has seen a pulse oximeter.
  assert.equal(bloodOxygen([r('oxygen_saturation', 0.98)], NOW).value, '98%');
});

test('saturation already in percent is left alone', () => {
  assert.equal(bloodOxygen([r('oxygen_saturation', 97)], NOW).value, '97%');
});

test('weight carries the unit the reading came with, never an assumed one', () => {
  assert.equal(weight([r('body_mass', 64.28, 0, 'kg')], NOW).value, '64.3 kg');
  assert.equal(weight([r('body_mass', 141.6, 0, 'lb')], NOW).value, '141.6 lb');
});

test('a weight with no unit shows the figure without inventing one', () => {
  assert.equal(weight([r('body_mass', 64)], NOW).value, '64');
});

// ── Absence ──────────────────────────────────────────────────────────

test('nothing recorded is absent, never zero', () => {
  for (const card of [bloodPressure([], NOW), bloodOxygen([], NOW), weight([], NOW)]) {
    assert.equal(card.value, null, card.key);
    assert.equal(card.note, undefined, card.key);
  }
});

test('the query asks for exactly the metrics this module reads', () => {
  assert.deepEqual([...VITAL_METRICS].sort(), [
    'blood_pressure_diastolic', 'blood_pressure_systolic', 'body_mass', 'height', 'oxygen_saturation',
  ]);
});

test('every vital is measured, so none is confused with what she reported', () => {
  for (const card of [bloodPressure([], NOW), bloodOxygen([], NOW), weight([], NOW)]) {
    assert.equal(card.from, 'measured');
  }
});

test('blood oxygen trends across her readings, newest last, as percent', () => {
  // Readings arrive newest first, as the repo returns them.
  const rows = [r('oxygen_saturation', 0.98, 0), r('oxygen_saturation', 0.97, 1), r('oxygen_saturation', 0.97, 2), r('oxygen_saturation', 0.96, 3)];
  const v = bloodOxygen(rows, NOW);
  assert.deepEqual(v.trend?.points, [96, 97, 97, 98]);
  assert.equal(v.value, '98%', 'the card still shows the newest');
});

test('blood pressure trends on the systolic, the number a cuff leads with', () => {
  const rows = [
    r('blood_pressure_systolic', 130, 0), r('blood_pressure_diastolic', 85, 0),
    r('blood_pressure_systolic', 120, 1), r('blood_pressure_systolic', 118, 2), r('blood_pressure_systolic', 122, 3),
  ];
  const v = bloodPressure(rows, NOW);
  assert.deepEqual(v.trend?.points, [122, 118, 120, 130]);
  assert.equal(v.trend?.change, '↑ 8%');
});

test('one reading of a vital has no trend', () => {
  assert.equal(bloodOxygen([r('oxygen_saturation', 0.98, 0)], NOW).trend, undefined);
});

test('weight reads in her units when she has chosen them', () => {
  const r = [{ metric: 'body_mass', value: 64.2, unit: 'kg', at: NOW.toISOString() }];
  assert.equal(weight(r, NOW, 'imperial').value, '141.5 lb');
  assert.equal(weight(r, NOW, 'metric').value, '64.2 kg');
  assert.equal(weight(r, NOW).value, '64.2 kg', 'as it arrived when no units are given');
});
