import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ETHNICITIES, ethnicityLabel } from './ethnicity';

test('ethnicity offers the broad, widely used groups, with a way to decline', () => {
  const labels = ETHNICITIES.map((e) => e.label);
  for (const want of ['East Asian', 'South Asian', 'African or Black', 'Hispanic or Latino', 'Middle Eastern or North African', 'White or European', 'Mixed or multiple', 'Prefer not to say']) {
    assert.ok(labels.includes(want), want);
  }
  assert.equal(new Set(ETHNICITIES.map((e) => e.id)).size, ETHNICITIES.length);
  // UI copy carries no hyphens or dashes.
  for (const l of labels) assert.ok(!/[-–—]/.test(l), l);
});

test('a stored ethnicity reads back as its label, and an unknown one as nothing', () => {
  assert.equal(ethnicityLabel('east_asian'), 'East Asian');
  assert.equal(ethnicityLabel(undefined), null);
  assert.equal(ethnicityLabel('martian'), null);
});
