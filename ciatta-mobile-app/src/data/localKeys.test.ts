import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEVICE_KEY, IMPORTED_KEY } from './deviceImport';
import { accountKeys, clearLocalRecord, LEGACY_LOOP_KEY, loopKey } from './localKeys';
import { LEGACY_OUTBOX_KEY, outboxKey } from './outbox';
import { memoryKV } from './testKV';

const A = 'user-a';
const B = 'user-b';

test('the loop is keyed per account, so watch flags never cross', () => {
  assert.notEqual(loopKey(A), loopKey(B));
  assert.equal(loopKey(A), 'ciatta.loop.v1.user-a');
});

test('deleting the account clears every app owned key on this phone', async () => {
  const kv = memoryKV({
    [IMPORTED_KEY]: '{"episodes":[]}',
    [DEVICE_KEY]: '{"episodes":[]}',
    [LEGACY_OUTBOX_KEY]: '[]',
    [LEGACY_LOOP_KEY]: '{}',
    [outboxKey(A)]: '[]',
    [loopKey(A)]: '{}',
    'some.other.app': 'kept',
  });
  const failed = await clearLocalRecord(kv, A);
  assert.deepEqual(failed, []);
  for (const key of accountKeys(A)) assert.equal(kv.data[key], undefined, `${key} must be gone`);
  assert.equal(kv.data['some.other.app'], 'kept', 'keys this app does not own are left alone');
});

test('a key that will not clear is reported rather than hidden', async () => {
  const kv = memoryKV({ [loopKey(A)]: '{}' });
  const stuck = {
    removeItem: async (key: string) => {
      if (key === loopKey(A)) throw new Error('storage full');
      await kv.removeItem(key);
    },
  };
  const failed = await clearLocalRecord(stuck, A);
  assert.deepEqual(failed, [loopKey(A)]);
});
