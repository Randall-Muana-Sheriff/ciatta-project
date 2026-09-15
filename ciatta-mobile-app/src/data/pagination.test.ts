import assert from 'node:assert/strict';
import { test } from 'node:test';

import { paginateAll } from './pagination';

test('paginateAll concatenates every page until one comes back short', async () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  const out = await paginateAll(fetchPage);
  assert.deepEqual(out, rows);
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test('paginateAll stops after a single short page and never over fetches', async () => {
  const rows = [{ id: 1 }, { id: 2 }];
  let calls = 0;
  const out = await paginateAll(async () => {
    calls += 1;
    return { data: rows, error: null };
  });
  assert.deepEqual(out, rows);
  assert.equal(calls, 1);
});

test('paginateAll treats a null page as no rows and stops', async () => {
  const out = await paginateAll(async () => ({ data: null, error: null }));
  assert.deepEqual(out, []);
});

test('paginateAll throws the page error rather than returning partial data', async () => {
  await assert.rejects(
    paginateAll(async () => ({ data: null, error: new Error('boom') })),
    /boom/,
  );
});
