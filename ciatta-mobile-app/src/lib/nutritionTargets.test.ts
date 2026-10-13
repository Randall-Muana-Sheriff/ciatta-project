import assert from 'node:assert/strict';
import { test } from 'node:test';

import { macroGauge, normalizeTargets, targetFromInput } from './nutritionTargets';

test('targets are hers and optional: nothing set reads as nothing', () => {
  assert.deepEqual(normalizeTargets(null), {});
  assert.deepEqual(normalizeTargets({}), {});
});

test('only sensible positive numbers survive', () => {
  assert.deepEqual(normalizeTargets({ kcal: 1800, protein_g: 90, carbs_g: -5, fat_g: 'lots' }), { kcal: 1800, protein_g: 90 });
  assert.deepEqual(normalizeTargets({ kcal: 99999 }), {}, 'past any real day is a typo, not a target');
});

test('what she types becomes a target, and an empty box clears it', () => {
  assert.equal(targetFromInput('120'), 120);
  assert.equal(targetFromInput(' 85.5 '), 86);
  assert.equal(targetFromInput(''), undefined);
  assert.equal(targetFromInput('abc'), undefined);
  assert.equal(targetFromInput('0'), undefined);
});

// macroGauge(name, this meal's grams, her daily target, today's total
// including this meal).
test('with a target the gauge counts down what is left today, and fills toward it', () => {
  assert.deepEqual(macroGauge('Protein', 40, 120, 60), { figure: '60 g', caption: 'Protein Left', fill: 0.5 });
  // Past the target: nothing left, the ring full, never a negative.
  assert.deepEqual(macroGauge('Protein', 40, 120, 140), { figure: '0 g', caption: 'Protein Left', fill: 1 });
});

test('without a target it shows what she ate, and its share of today', () => {
  // This meal 30 g of a 60 g day.
  assert.deepEqual(macroGauge('Carbs', 30, undefined, 60), { figure: '30 g', caption: 'Carbs, of today', fill: 0.5 });
  assert.deepEqual(macroGauge('Fat', 0, undefined, 0), { figure: '0 g', caption: 'Fat, of today', fill: 0 });
});
