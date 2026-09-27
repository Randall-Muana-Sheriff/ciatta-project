import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOLD_VERSION, foldKey, planRefresh, recordRefresh, REFRESH_EVERY_MS, refreshedKey, refreshOutcome } from './healthRefresh';
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
});

test('a ninety day read that did not bring her nights up is tried again in an hour, not on every open', async () => {
  const tried = memory({ [foldKey(USER)]: '1', [refreshedKey(USER)]: String(NOW.getTime() - 1000) });
  assert.equal(await planRefresh(USER, tried.store, NOW), null);
  assert.equal(await planRefresh(USER, tried.store, new Date(NOW.getTime() + REFRESH_EVERY_MS)), 'recovery');
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

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const STEPS = 'HKQuantityTypeIdentifierStepCount';
const whole = { observations: 120, failed: [] };

test('only a recovery read moves the fold on', async () => {
  const week = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, week.store, 'refresh', whole, NOW);
  assert.equal(week.held[foldKey(USER)], '1');
  assert.equal(week.held[refreshedKey(USER)], String(NOW.getTime()));
  // Still owed the ninety days, once the hour is up.
  assert.equal(await planRefresh(USER, week.store, new Date(NOW.getTime() + REFRESH_EVERY_MS)), 'recovery');

  const ninety = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, ninety.store, 'recovery', whole, NOW);
  assert.equal(ninety.held[foldKey(USER)], String(FOLD_VERSION));
  assert.equal(await planRefresh(USER, ninety.store, NOW), null);
});

test('a read with nothing new in it still counts as made', async () => {
  const { store, held } = memory(current);
  await recordRefresh(USER, store, 'refresh', { observations: 0, failed: [] }, NOW);
  assert.equal(held[refreshedKey(USER)], String(NOW.getTime()));
});

test('a read made with no signal leaves nothing behind, so it is made again', async () => {
  const { store, held } = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, store, 'recovery', { observations: 0, failed: [STEPS, SLEEP] }, NOW);
  assert.deepEqual(held, { [foldKey(USER)]: '1' });
  assert.equal(await planRefresh(USER, store, NOW), 'recovery');
});

test('one measure that never arrives does not bring the ninety days back on every open', async () => {
  const { store, held } = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, store, 'recovery', { observations: 4000, failed: [STEPS] }, NOW);
  assert.equal(held[foldKey(USER)], String(FOLD_VERSION));
  assert.equal(await planRefresh(USER, store, NOW), null);
  assert.equal(await planRefresh(USER, store, new Date(NOW.getTime() + REFRESH_EVERY_MS)), 'refresh');
});

test('a recovery read that did not carry sleep through has not brought her nights up to this fold', async () => {
  const { store, held } = memory({ [foldKey(USER)]: '1' });
  await recordRefresh(USER, store, 'recovery', { observations: 4000, failed: [SLEEP] }, NOW);
  assert.equal(held[foldKey(USER)], '1');
  // Its time is kept, so the next try is in an hour and not on every open.
  assert.equal(held[refreshedKey(USER)], String(NOW.getTime()));
  assert.deepEqual(refreshOutcome('recovery', { observations: 4000, failed: [SLEEP] }), { keepTime: true, moveFold: false });
});

test("one account never reads or writes another account's marks", async () => {
  const { store, held } = memory();
  await recordRefresh(USER, store, 'recovery', whole, NOW);
  assert.deepEqual(Object.keys(held).sort(), [foldKey(USER), refreshedKey(USER)].sort());
  assert.equal(await planRefresh('user-2', store, NOW), 'recovery');
});
