import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { DEVICE_KEY, IMPORTED_KEY, importDeviceRecord } from './deviceImport';
import { memoryKV } from './testKV';

const own = formToEpisode({ ...emptyForm(), kinds: ['Period'], periodStart: 3 }, false, new Date(2026, 8, 15));
const saved = JSON.stringify({ episodes: [own, { ...own, id: 'sample-3' }], profile: { situations: [] } });

test('her own episodes are imported once, sample ones never', async () => {
  const kv = memoryKV({ [DEVICE_KEY]: saved });
  const got: { id: string; extra: Record<string, unknown> }[] = [];
  const n = await importDeviceRecord(kv, async (e, extra) => void got.push({ id: e.id, extra }), async () => {});
  assert.equal(n, 1);
  assert.deepEqual(got, [{ id: own.id, extra: { imported_from: 'device' } }]);
  assert.equal(kv.data[DEVICE_KEY], undefined);
  assert.equal(kv.data[IMPORTED_KEY], saved);
  assert.equal(await importDeviceRecord(kv, async () => assert.fail('imported twice'), async () => {}), 0);
});

test('a failed import keeps the device record for next time', async () => {
  const kv = memoryKV({ [DEVICE_KEY]: saved });
  await assert.rejects(importDeviceRecord(kv, async () => { throw new Error('offline'); }, async () => {}));
  assert.equal(kv.data[DEVICE_KEY], saved);
});
