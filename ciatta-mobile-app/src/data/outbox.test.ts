import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { enqueue, flush, LEGACY_OUTBOX_KEY, outboxKey } from './outbox';
import { memoryKV } from './testKV';

const ep = (ms: number) => formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(ms));

const A = 'user-a';
const B = 'user-b';

test('a failed save waits once, however often it is queued', async () => {
  const kv = memoryKV();
  await enqueue(kv, A, ep(1));
  await enqueue(kv, A, ep(1));
  assert.equal(JSON.parse(kv.data[outboxKey(A)]).length, 1);
});

test('flush sends what it can and keeps the rest', async () => {
  const kv = memoryKV();
  await enqueue(kv, A, ep(1));
  await enqueue(kv, A, ep(2));
  const sent = await flush(kv, A, async (e) => {
    if (e.id === 'ep-2') throw new Error('offline');
  });
  assert.equal(sent, 1);
  assert.deepEqual(JSON.parse(kv.data[outboxKey(A)]).map((e: { id: string }) => e.id), ['ep-2']);
  assert.equal(await flush(kv, A, async () => {}), 1);
  assert.equal(kv.data[outboxKey(A)], undefined);
});

test('an episode queued by one account is never sent under another', async () => {
  const kv = memoryKV();
  await enqueue(kv, A, ep(1));

  // B signs in on the same phone and flushes.
  const sentAsB: string[] = [];
  const sent = await flush(kv, B, async (e) => void sentAsB.push(e.id));
  assert.equal(sent, 0, 'B has nothing of her own to send');
  assert.deepEqual(sentAsB, [], "A's episode is never handed to B's repo");
  assert.equal(JSON.parse(kv.data[outboxKey(A)]).length, 1, "A's episode is still waiting for A");

  // A signs back in and it goes to her own record.
  const sentAsA: string[] = [];
  assert.equal(await flush(kv, A, async (e) => void sentAsA.push(e.id)), 1);
  assert.deepEqual(sentAsA, ['ep-1']);
});

test('two accounts queue into separate keys and never see each other', async () => {
  const kv = memoryKV();
  await enqueue(kv, A, ep(1));
  await enqueue(kv, B, ep(2));
  assert.notEqual(outboxKey(A), outboxKey(B));
  assert.deepEqual(JSON.parse(kv.data[outboxKey(A)]).map((e: { id: string }) => e.id), ['ep-1']);
  assert.deepEqual(JSON.parse(kv.data[outboxKey(B)]).map((e: { id: string }) => e.id), ['ep-2']);

  const sentAsB: string[] = [];
  await flush(kv, B, async (e) => void sentAsB.push(e.id));
  assert.deepEqual(sentAsB, ['ep-2'], 'B sends only her own');
  assert.ok(kv.data[outboxKey(A)], "and A's queue is untouched");
});

test('the old device wide queue is never read by anybody', async () => {
  const kv = memoryKV({ [LEGACY_OUTBOX_KEY]: JSON.stringify([ep(1)]) });
  const sent: string[] = [];
  assert.equal(await flush(kv, A, async (e) => void sent.push(e.id)), 0);
  assert.equal(await flush(kv, B, async (e) => void sent.push(e.id)), 0);
  assert.deepEqual(sent, []);
});
