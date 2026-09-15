import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { enqueue, flush, type KV, OUTBOX_KEY } from './outbox';
import { memoryKV } from './testKV';

const ep = (ms: number) => formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(ms));

test('a failed save waits once, however often it is queued', async () => {
  const kv = memoryKV();
  await enqueue(kv, ep(1));
  await enqueue(kv, ep(1));
  assert.equal(JSON.parse(kv.data[OUTBOX_KEY]).length, 1);
});

test('flush sends what it can and keeps the rest', async () => {
  const kv = memoryKV();
  await enqueue(kv, ep(1));
  await enqueue(kv, ep(2));
  const sent = await flush(kv, async (e) => {
    if (e.id === 'ep-2') throw new Error('offline');
  });
  assert.equal(sent, 1);
  assert.deepEqual(JSON.parse(kv.data[OUTBOX_KEY]).map((e: { id: string }) => e.id), ['ep-2']);
  assert.equal(await flush(kv, async () => {}), 1);
  assert.equal(kv.data[OUTBOX_KEY], undefined);
});
