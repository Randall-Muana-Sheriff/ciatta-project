import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOLD_VERSION, foldKey, planRefresh, recordRefresh, REFRESH_EVERY_MS, refreshedKey } from './healthRefresh';
import type { AnchorStore } from './healthSync';

const USER = 'user-1';
const NOW = new Date(2026, 8, 27, 15, 20);

function memory(initial: Record<string, string> = {}) {
  const held: Record<string, string> = { ...initial };
  const store: AnchorStore = {
    async get(key) {
      return held[key] ?? null;
    },
    async set(key, value) {
      held[key] = value;
    },
  };
  return { store, held };
}

const current = { [foldKey(USER)]: String(FOLD_VERSION) };

test('a phone that has never written days under this fold reads the ninety days again', async () => {
  assert.equal(await planRefresh(USER, memory().store, NOW), 'recovery');
  assert.equal(await planRefresh(USER, memory({ [foldKey(USER)]: '1' }).store, NOW), 'recovery');
  // However recently it last read.
  const recent = memory({ [foldKey(USER)]: '1', [refreshedKey(USER)]: String(NOW.getTime() - 1000) });
  assert.equal(await planRefresh(USER, recent.store, NOW), 'recovery');
});

test('under this fold, it reads the last week when the last read is an hour old', async () => {
  assert.equal(await planRefresh(USER, memory(current).store, NOW), 'refresh');
  const old = memory({ ...current, [refreshedKey(USER)]: String(NOW.getTime() - REFRESH_EVERY_MS) });
  assert.equal(await planRefresh(USER, old.store, NOW), 'refresh');
});

test('and reads nothing when the last read is more recent than that', async () => {
  const recent = memory({ ...current, [refreshedKey(USER)]: String(NOW.getTime() - REFRESH_EVERY_MS + 1) });
  assert.equal(await planRefresh(USER, recent.store, NOW), null);
});

test('a last read stamped in the future does not hold the next one off', async () => {
  const ahead = memory({ ...current, [refreshedKey(USER)]: String(NOW.getTime() + 5 * REFRESH_EVERY_MS) });
  assert.equal(await planRefresh(USER, ahead.store, NOW), 'refresh');
  const junk = memory({ ...current, [refreshedKey(USER)]: 'soon' });
  assert.equal(await planRefresh(USER, junk.store, NOW), 'refresh');
});

test('only a recovery read moves the fold on', async () => {
  const week = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, week.store, 'refresh', NOW);
  assert.equal(week.held[foldKey(USER)], '1');
  assert.equal(week.held[refreshedKey(USER)], String(NOW.getTime()));
  assert.equal(await planRefresh(USER, week.store, NOW), 'recovery');

  const whole = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, whole.store, 'recovery', NOW);
  assert.equal(whole.held[foldKey(USER)], String(FOLD_VERSION));
  assert.equal(await planRefresh(USER, whole.store, NOW), null);
});

test('one account never reads or writes another account\'s marks', async () => {
  const { store, held } = memory();
  await recordRefresh(USER, store, 'recovery', NOW);
  assert.deepEqual(Object.keys(held).sort(), [foldKey(USER), refreshedKey(USER)].sort());
  assert.equal(await planRefresh('user-2', store, NOW), 'recovery');
});
