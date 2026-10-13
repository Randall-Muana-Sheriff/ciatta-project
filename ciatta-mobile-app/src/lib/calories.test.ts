import assert from 'node:assert/strict';
import { test } from 'node:test';

import { caloriesBlock } from './calories';
import type { Meal, ScanItem } from './foodScan';

const NOW = new Date(2026, 9, 13, 20);
const item = (kcal: number, protein_g = 20, fat_g = 10, from: ScanItem['from'] = 'estimated'): ScanItem => ({
  name: 'Food', portion: '', kcal, protein_g, carbs_g: 30, fat_g, at: null, from,
});
const meal = (daysAgo: number, items: ScanItem[]): Meal => ({
  id: `m${daysAgo}-${items.length}-${items[0]?.kcal}`,
  eatenAt: new Date(2026, 9, 13 - daysAgo, 12).toISOString(),
  items,
  photoUri: null,
});

test('today in one figure, with protein and fat beside it, marked estimated when the scan gave it', () => {
  const b = caloriesBlock([meal(0, [item(600, 40, 20)]), meal(0, [item(650, 30, 16, 'reported')])], {}, NOW)!;
  assert.equal(b.kcal, '1,250');
  assert.equal(b.protein, '70g');
  assert.equal(b.fat, '36g');
  assert.equal(b.estimated, true);
  assert.equal(b.title, 'Calories');
});

test('every figure hers is not marked estimated', () => {
  assert.equal(caloriesBlock([meal(0, [item(500, 20, 10, 'reported')])], {}, NOW)!.estimated, false);
});

test('with her calorie target the dial fills toward it, and the title says progress', () => {
  const b = caloriesBlock([meal(0, [item(900)])], { kcal: 1800 }, NOW)!;
  assert.equal(b.title, 'Calories Progress');
  assert.deepEqual(b.dial, { fill: 0.5, label: 'Your target 1,800' });
});

test('without a target the dial fills toward her usual day, once she has seven logged days', () => {
  const past = [1, 2, 3, 4, 5, 6, 7].map((d) => meal(d, [item(2000)]));
  const b = caloriesBlock([...past, meal(0, [item(1000)])], {}, NOW)!;
  assert.deepEqual(b.dial, { fill: 0.5, label: 'Your usual 2,000' });
  // Six days are not enough to call anything usual.
  assert.equal(caloriesBlock([...past.slice(1), meal(0, [item(1000)])], {}, NOW)!.dial, null);
});

test('nothing eaten today but meals before: a zero day is shown as nothing logged yet, not 0 kcal', () => {
  const b = caloriesBlock([meal(2, [item(500)])], {}, NOW)!;
  assert.equal(b.kcal, null);
});

test('no meals at all means no block', () => {
  assert.equal(caloriesBlock([], {}, NOW), null);
});

test('one line from her record, only when it holds: protein under her target on most logged days', () => {
  const low = [0, 1, 2, 3, 4].map((d) => meal(d, [item(1500, 40)]));
  assert.equal(caloriesBlock(low, { protein_g: 90 }, NOW)!.note, 'Protein was under your target on 5 of your last 5 logged days.');
  assert.equal(caloriesBlock(low, {}, NOW)!.note, null, 'no target, nothing to say');
  const fine = [0, 1, 2].map((d) => meal(d, [item(1500, 120)]));
  assert.equal(caloriesBlock(fine, { protein_g: 90 }, NOW)!.note, null);
});
