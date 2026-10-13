import assert from 'node:assert/strict';
import { test } from 'node:test';

import { editItem, mealTotals, readScan, type ScanItem } from './foodScan';

const raw = (items: unknown[], not_food = false) => ({ items, not_food });
const good = { name: 'Grilled Chicken', portion: '150 g', kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, x: 0.47, y: 0.32, r: 0.16 };

test('a good scan becomes estimated items pinned where the model saw them', () => {
  const r = readScan(raw([good]));
  assert.equal(r.notFood, false);
  assert.deepEqual(r.items, [
    { name: 'Grilled Chicken', portion: '150 g', kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, at: { x: 0.47, y: 0.32, r: 0.16 }, from: 'estimated' },
  ]);
});

test('an item with impossible numbers is dropped, not shown', () => {
  const r = readScan(raw([good, { ...good, name: 'Bad', kcal: -10 }, { ...good, name: 'Worse', protein_g: Number.NaN }, { ...good, name: '' }]));
  assert.deepEqual(r.items.map((i) => i.name), ['Grilled Chicken']);
});

test('a position off the photo leaves the item listed but unpinned', () => {
  const r = readScan(raw([{ ...good, x: 1.4 }]));
  assert.equal(r.items[0].at, null);
});

test('at most twelve foods', () => {
  assert.equal(readScan(raw(Array.from({ length: 20 }, (_, i) => ({ ...good, name: `Food ${i}` })))).items.length, 12);
});

test('not food, or garbage, reads as nothing found', () => {
  assert.deepEqual(readScan(raw([], true)), { items: [], notFood: true });
  assert.deepEqual(readScan(null), { items: [], notFood: true });
  assert.deepEqual(readScan({ items: 'nope' }), { items: [], notFood: true });
});

test('the meal adds up its items', () => {
  const items = readScan(raw([good, { ...good, name: 'Tomatoes', kcal: 22, protein_g: 1.1, carbs_g: 4.8, fat_g: 0.2 }])).items;
  assert.deepEqual(mealTotals(items), { kcal: 270, protein_g: 47.6, carbs_g: 4.8, fat_g: 5.6 });
});

test('an item she corrects is hers, no longer an estimate', () => {
  const item = readScan(raw([good])).items[0];
  const fixed: ScanItem = editItem(item, { protein_g: 40 });
  assert.equal(fixed.protein_g, 40);
  assert.equal(fixed.from, 'reported');
  assert.equal(item.from, 'estimated', 'the original is untouched');
});

test('a saved meal is inferred while any figure is still an estimate, reported once all are hers', async () => {
  const { mealProvenance } = await import('./foodScan');
  const est = readScan(raw([good])).items;
  assert.equal(mealProvenance(est), 'INFERRED');
  assert.equal(mealProvenance(est.map((i) => editItem(i, {}))), 'REPORTED');
  assert.equal(mealProvenance([]), 'REPORTED');
});

test('a stored meal row reads back, its items checked again', async () => {
  const { mealFromRow } = await import('./foodScan');
  const m = mealFromRow({
    client_id: 'm1',
    eaten_at: '2026-10-13T12:30:00Z',
    items: [{ ...good, at: { x: 0.5, y: 0.5, r: 0.1 }, from: 'reported' }, { name: '', kcal: 1 }],
    photo: { uri: 'file:///m1.jpg' },
  });
  assert.equal(m.id, 'm1');
  assert.equal(m.items.length, 1, 'a broken item is dropped on the way back too');
  assert.equal(m.items[0].from, 'reported');
  assert.deepEqual(m.items[0].at, { x: 0.5, y: 0.5, r: 0.1 });
  assert.equal(m.photoUri, 'file:///m1.jpg');
});

test('a broken stored item never shifts another item\'s flag', async () => {
  const { mealFromRow } = await import('./foodScan');
  const m = mealFromRow({
    client_id: 'm2',
    eaten_at: '2026-10-13T12:30:00Z',
    items: [{ ...good, name: 'Bad', kcal: -1, from: 'reported' }, { ...good, name: 'Tomatoes', from: 'estimated' }],
    photo: null,
  });
  assert.deepEqual(m.items.map((i) => [i.name, i.from]), [['Tomatoes', 'estimated']]);
});
