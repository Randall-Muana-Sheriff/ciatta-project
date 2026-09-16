import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dataFor, dataForSession } from './adapter';
import { loadDays } from './daily';
import { daysFromRows } from './dailyRows';
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

test('real mode carries the days her record loaded while every sample piece stays null', () => {
  const days = daysFromRows([{ day: '2026-09-10', steps: 4000 }], new Date(2026, 8, 10));
  const d = dataFor('real', 'Ada', days);
  assert.deepEqual(d.days, days);
  for (const key of ['records', 'sleep', 'symptoms', 'medications', 'journey', 'insight', 'profile'] as const) {
    assert.equal(d[key], null, `${key} must be empty in real mode`);
  }
});

test('only the demo reads as the sample person', () => {
  for (const mode of ['loading', 'signedOut', 'real'] as const) {
    const d = dataForSession(mode, null);
    assert.equal(d.mode, 'real', `${mode} must not fall open to the sample`);
    assert.equal(d.profile, null, `${mode} must carry no sample profile`);
    assert.deepEqual(d.days, [], `${mode} must carry no sample days`);
  }
  assert.equal(dataForSession('demo', null).profile, sample.profile);
});

test('demo mode is the sample, unchanged', () => {
  const d = dataFor('demo', null);
  assert.equal(d.days, loadDays());
  assert.equal(d.records, sample.records);
  assert.equal(d.today, sample.today);
  assert.equal(d.person?.firstName, sample.person.firstName);
});
