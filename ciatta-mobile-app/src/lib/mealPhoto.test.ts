import assert from 'node:assert/strict';
import { test } from 'node:test';

import { latestMeal, mealOf } from './mealPhoto';

const at = (h: number, daysAgo = 0) => new Date(2026, 9, 13 - daysAgo, h, 15).toISOString();
const photo = (name: string) => ({ id: name, kind: 'photo' as const, name, uri: `file:///${name}.jpg`, addedAt: at(9) });

test('the meal is named by when she ate', () => {
  assert.equal(mealOf(new Date(2026, 9, 13, 8)), 'Breakfast');
  assert.equal(mealOf(new Date(2026, 9, 13, 12, 30)), 'Lunch');
  assert.equal(mealOf(new Date(2026, 9, 13, 16)), 'Snack');
  assert.equal(mealOf(new Date(2026, 9, 13, 19)), 'Dinner');
  assert.equal(mealOf(new Date(2026, 9, 13, 23)), 'Snack');
  assert.equal(mealOf(new Date(2026, 9, 13, 4)), 'Snack');
});

test('the header is her most recent photo logged under Nutrition', () => {
  const entries = [
    { at: at(8, 2), category: 'nutrition' as const, text: 'Porridge', attachments: [photo('porridge')] },
    { at: at(13, 0), category: 'nutrition' as const, text: 'Chicken salad', attachments: [photo('salad')] },
    { at: at(18, 0), category: 'mind' as const, text: 'Foggy', attachments: [photo('notfood')] },
    { at: at(19, 0), category: 'nutrition' as const, text: 'No photo', attachments: [] },
  ];
  assert.deepEqual(latestMeal(entries), { uri: 'file:///salad.jpg', title: 'Chicken salad', meal: 'Lunch' });
});

test('a photo only counts under Nutrition, so nothing else she photographed becomes food', () => {
  assert.equal(latestMeal([{ at: at(9), category: 'gut', text: 'x', attachments: [photo('a')] }]), null);
});

test('a photo with no words is titled by the meal, not left blank', () => {
  assert.equal(latestMeal([{ at: at(8), category: 'nutrition', text: '', attachments: [photo('a')] }])?.title, 'Breakfast');
});

test('no meal photo means no header', () => {
  assert.equal(latestMeal([]), null);
});
