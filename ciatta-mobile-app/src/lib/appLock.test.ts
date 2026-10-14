import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LOCK_AFTER_MS, shouldLock } from './appLock';

test('with Face ID on, Ciatta locks when it opens', () => {
  assert.equal(shouldLock({ on: true, backgroundedAt: null, now: 1000 }), true);
  assert.equal(shouldLock({ on: false, backgroundedAt: null, now: 1000 }), false);
});

test('a quick switch away does not lock it again; a longer absence does', () => {
  const t = 1_000_000;
  assert.equal(shouldLock({ on: true, backgroundedAt: t, now: t + 5_000, unlocked: true }), false);
  assert.equal(shouldLock({ on: true, backgroundedAt: t, now: t + LOCK_AFTER_MS + 1, unlocked: true }), true);
  assert.equal(shouldLock({ on: false, backgroundedAt: t, now: t + LOCK_AFTER_MS * 10, unlocked: true }), false);
});
