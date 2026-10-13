import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WHAT_HAPPENED } from '../data/cycleLog';
import { BOWEL, CATEGORIES, category } from './logCategories';

test('eight categories, in the order the Log screen shows them', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.key),
    ['cycle', 'nutrition', 'body', 'mind', 'skin', 'sexual', 'context', 'note'],
  );
});

test('every category has a real example sentence', () => {
  for (const c of CATEGORIES) assert.ok(c.example.length > 15, c.key);
});

test('no label, example or chip carries a dash', () => {
  for (const c of CATEGORIES) {
    for (const s of [c.label, c.example, c.detailLabel ?? '', ...c.quick]) assert.ok(!/[-–—]/.test(s), s);
  }
});

test('a detailed form is named only where one exists', () => {
  assert.equal(category('cycle').detail, 'cycleLog');
  assert.equal(category('nutrition').detail, 'dailyLog');
  assert.equal(category('note').detail, 'journal');
  assert.equal(category('mind').detail, null);
  for (const c of CATEGORIES) assert.equal(c.detail === null, c.detailLabel === null, c.key);
});

test('stool is logged under Nutrition and gut, as the episode kind the record already reads', () => {
  assert.ok(category('nutrition').quick.includes(BOWEL));
  assert.ok((WHAT_HAPPENED as readonly string[]).includes(BOWEL));
});

test('journal kinds stay inside the table check constraint', () => {
  for (const c of CATEGORIES) assert.ok(['Notes', 'Symptoms', 'Context'].includes(c.journalKind), c.key);
});

test('no chip appears in two categories, so a tap has one meaning', () => {
  const seen = new Map<string, string>();
  for (const c of CATEGORIES) {
    for (const q of c.quick) {
      assert.ok(!seen.has(q), `${q} is in ${seen.get(q)} and ${c.key}`);
      seen.set(q, c.key);
    }
  }
});
