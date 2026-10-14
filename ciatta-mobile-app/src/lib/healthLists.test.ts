import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DETAIL_KINDS, DETAILS, detailSummary, isSupplement } from './healthLists';

test('every health detail has a title, an icon and a list to pick from', () => {
  assert.deepEqual(DETAIL_KINDS, ['conditions', 'allergies', 'medications', 'vaccinations', 'genetics', 'lifestyle']);
  for (const k of DETAIL_KINDS) {
    const d = DETAILS[k];
    assert.ok(d.title && d.icon && d.options.length >= 10, k);
    assert.equal(new Set(d.options.map((x) => x.toLowerCase())).size, d.options.length, `${k} has no repeats`);
    for (const o of d.options) assert.ok(!/[-–—]/.test(o), `${k}: ${o}`);
  }
});

test('a row says what is on the list, briefly', () => {
  assert.equal(detailSummary([]), 'None added');
  assert.equal(detailSummary(['Endometriosis']), 'Endometriosis');
  assert.equal(detailSummary(['Endometriosis', 'Hypothyroidism', 'Migraine']), 'Endometriosis, Hypothyroidism and 1 more');
});

test('a supplement is told apart from a medication, for where it is filed', () => {
  assert.ok(isSupplement('Magnesium'));
  assert.ok(isSupplement('vitamin d'));
  assert.ok(!isSupplement('Levothyroxine'));
});
