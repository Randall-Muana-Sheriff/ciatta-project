import assert from 'node:assert/strict';
import { test } from 'node:test';

import { startUse } from './periodProducts';
import type { Reminder } from './productSafety';
import { type Scheduler, syncProductReminders } from './reminders';

function fake(existing: string[] = []) {
  const scheduled = new Map<string, Reminder>(existing.map((id) => [id, { id, at: '', title: '', body: '' }]));
  const s: Scheduler = {
    list: async () => [...scheduled.keys()],
    schedule: async (r) => void scheduled.set(r.id, r),
    cancel: async (id) => void scheduled.delete(id),
  };
  return { s, scheduled };
}
const NOW = new Date(2026, 9, 12, 9);
const use = (id: string) => startUse([], { id, product: 'Tampon', size: 'Super', at: new Date(2026, 9, 12, 8).toISOString() })[0];

test('putting one in schedules its reminders', async () => {
  const { s, scheduled } = fake();
  await syncProductReminders(s, use('a'), NOW);
  assert.deepEqual([...scheduled.keys()].sort(), ['product-a-6', 'product-a-8']);
});

test('changing it cancels the old reminders and sets the new ones', async () => {
  const { s, scheduled } = fake(['product-a-6', 'product-a-8']);
  await syncProductReminders(s, use('b'), NOW);
  assert.deepEqual([...scheduled.keys()].sort(), ['product-b-6', 'product-b-8']);
});

test('taking it out cancels them all', async () => {
  const { s, scheduled } = fake(['product-a-6', 'product-a-8']);
  await syncProductReminders(s, null, NOW);
  assert.deepEqual([...scheduled.keys()], []);
});

test('other notifications are never touched', async () => {
  const { s, scheduled } = fake(['finding-123', 'product-a-6']);
  await syncProductReminders(s, null, NOW);
  assert.deepEqual([...scheduled.keys()], ['finding-123']);
});

test('running it twice changes nothing the second time', async () => {
  const { s, scheduled } = fake();
  await syncProductReminders(s, use('a'), NOW);
  await syncProductReminders(s, use('a'), NOW);
  assert.equal(scheduled.size, 2);
});
