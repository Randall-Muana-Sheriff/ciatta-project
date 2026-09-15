import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dataFor } from './adapter';
import { loadDays } from './daily';
import * as sample from './sample';

test('real mode carries no sample data', () => {
  const d = dataFor('real', 'Ada');
  assert.deepEqual(d.days, []);
  for (const key of ['records', 'sleep', 'symptoms', 'medications', 'journey', 'insight', 'profile'] as const) {
    assert.equal(d[key], null, `${key} must be empty in real mode`);
  }
  assert.deepEqual(d.person, { firstName: 'Ada' });
  assert.notEqual(d.today.headline, sample.today.headline);
});

test('real mode without a name greets without one', () => {
  assert.equal(dataFor('real', null).person, null);
});

test('demo mode is the sample, unchanged', () => {
  const d = dataFor('demo', null);
  assert.equal(d.days, loadDays());
  assert.equal(d.records, sample.records);
  assert.equal(d.today, sample.today);
  assert.equal(d.person?.firstName, sample.person.firstName);
});
