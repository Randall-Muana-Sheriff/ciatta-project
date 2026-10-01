import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLast, needsOnboarding, nextStep, STEPS, stepsFor } from './onboarding';

test('the steps come in one order, source before questions', () => {
  assert.deepEqual([...STEPS], ['welcome', 'source', 'cycle', 'name', 'expect']);
  assert.equal(nextStep('welcome'), 'source');
  assert.equal(nextStep('name'), 'expect');
  assert.equal(nextStep('expect'), null);
  assert.equal(isLast('expect'), true);
  assert.equal(isLast('welcome'), false);
});

test('every platform sees every step; only iOS can offer the source', () => {
  const ios = stepsFor('ios');
  const android = stepsFor('android');
  assert.deepEqual(ios.map((s) => s.step), [...STEPS]);
  assert.deepEqual(android.map((s) => s.step), [...STEPS]);
  assert.equal(ios.find((s) => s.step === 'source')!.available, true);
  assert.equal(android.find((s) => s.step === 'source')!.available, false);
  assert.equal(android.filter((s) => s.step !== 'source').every((s) => s.available), true);
});

test('the run is owed to her own record while nothing says she has been through it', () => {
  assert.equal(needsOnboarding('real', null), true);
  assert.equal(needsOnboarding('real', '2026-10-01T09:00:00Z'), false);
});

test('never to the example person, never while loading, never when the read failed', () => {
  assert.equal(needsOnboarding('demo', null), false);
  assert.equal(needsOnboarding('loading', null), false);
  assert.equal(needsOnboarding('signedOut', null), false);
  // A project without the column answers with no value at all.
  assert.equal(needsOnboarding('real', undefined), false);
});
