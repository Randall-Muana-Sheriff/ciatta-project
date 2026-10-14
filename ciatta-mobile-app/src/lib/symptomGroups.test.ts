import assert from 'node:assert/strict';
import { test } from 'node:test';

import { category, LOG_TABS, symptomCategory, SYMPTOM_GROUPS } from './logCategories';
import { planSave } from './quickLog';

test('one Symptoms tab on the Log screen, in place of Body, Mind, Skin and Sexual', () => {
  assert.deepEqual(LOG_TABS, ['cycle', 'symptoms', 'gut', 'nutrition', 'meds', 'supplements', 'context', 'note']);
  assert.equal(category('symptoms').label, 'Symptoms');
});

test('every symptom sits in one group, says what it connects to, and is filed where the rest of the app reads it', () => {
  const seen = new Set<string>();
  for (const g of SYMPTOM_GROUPS) {
    assert.ok(g.feeds.length > 0, g.label);
    for (const item of g.items) {
      assert.ok(!seen.has(item), `${item} is in one group only`);
      seen.add(item);
      assert.ok(category(g.category).quick.includes(item), `${item} is one of ${g.category}'s chips`);
      assert.equal(symptomCategory(item), g.category);
    }
  }
  // Everything the old tabs offered is still here.
  for (const key of ['body', 'mind', 'skin', 'sexual'] as const) for (const item of category(key).quick) assert.ok(seen.has(item), item);
  for (const item of ['Palpitations', 'Shortness of breath', 'Insomnia', 'Pelvic pain', 'Hair shedding']) assert.ok(seen.has(item), item);
  assert.deepEqual(SYMPTOM_GROUPS.find((g) => g.label === 'Heart and breathing')!.feeds, ['Heart rate', 'HRV', 'Blood pressure', 'Blood oxygen', 'Iron labs']);
});

test('symptoms tapped across groups are each filed under their own category', () => {
  const plan = planSave({
    text: '', selected: 'symptoms', tapped: ['Palpitations', 'Brain fog', 'Bloating', 'Pain'], files: [],
    byCategory: { body: ['Palpitations', 'Pain'], mind: ['Brain fog'], gut: ['Bloating'] },
  })!;
  assert.deepEqual(plan.journal!.items, { body: ['Palpitations'], mind: ['Brain fog'] });
  assert.deepEqual(plan.daily, { digestion: ['Bloating'] });
  assert.deepEqual(plan.episode!.kinds, ['Pain']);
  // Words alone under Symptoms are a note filed with the body's.
  assert.equal(planSave({ text: 'Off all day', selected: 'symptoms', tapped: [], files: [] })!.journal!.category, 'body');
});
