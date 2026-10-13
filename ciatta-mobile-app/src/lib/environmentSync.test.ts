import assert from 'node:assert/strict';
import { test } from 'node:test';

import { roughly, syncRange } from './environmentSync';

test('her position leaves the phone only rounded to about 10 km', () => {
  assert.deepEqual(roughly(51.507351, -0.127758), { lat: 51.5, lon: -0.1 });
  assert.deepEqual(roughly(-33.86882, 151.20929), { lat: -33.9, lon: 151.2 });
});

test('the first time, the last 90 days through yesterday', () => {
  assert.deepEqual(syncRange(null, new Date(2026, 9, 13)), { from: '2026-07-15', to: '2026-10-12' });
});

test('after that, only the days since the newest one stored', () => {
  assert.deepEqual(syncRange('2026-10-09', new Date(2026, 9, 13)), { from: '2026-10-10', to: '2026-10-12' });
});

test('already up to date asks for nothing', () => {
  assert.equal(syncRange('2026-10-12', new Date(2026, 9, 13)), null);
});
