// The drain helpers live beside the edge function (a Deno file imports them
// with a relative path), but they are plain TypeScript with no Deno or
// Supabase imports, so this suite exercises them directly under node:test.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chunk, collectPaths, type Entry } from '../../supabase/functions/delete-account/drain';

test('collectPaths lists flat files under the root', async () => {
  const list = async (prefix: string, _limit: number, offset: number): Promise<Entry[]> =>
    prefix === 'u1' && offset === 0
      ? [
          { name: 'a.pdf', id: '1' },
          { name: 'b.pdf', id: '2' },
        ]
      : [];
  const paths = (await collectPaths(list, 'u1')).sort();
  assert.deepEqual(paths, ['u1/a.pdf', 'u1/b.pdf']);
});

test('collectPaths descends into folder entries instead of trying to remove them', async () => {
  const pages: Record<string, Entry[]> = {
    u1: [
      { name: 'sub', id: null },
      { name: 'top.pdf', id: '1' },
    ],
    'u1/sub': [{ name: 'nested.pdf', id: '2' }],
  };
  const list = async (prefix: string, _limit: number, offset: number): Promise<Entry[]> => (offset === 0 ? (pages[prefix] ?? []) : []);
  const paths = (await collectPaths(list, 'u1')).sort();
  assert.deepEqual(paths, ['u1/sub/nested.pdf', 'u1/top.pdf']);
});

test('collectPaths pages a single directory past one page size', async () => {
  const page1: Entry[] = Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.pdf`, id: `${i}` }));
  const page2: Entry[] = [{ name: 'f100.pdf', id: '100' }];
  const list = async (_prefix: string, _limit: number, offset: number): Promise<Entry[]> => {
    if (offset === 0) return page1;
    if (offset === 100) return page2;
    return [];
  };
  const paths = await collectPaths(list, 'u1');
  assert.equal(paths.length, 101);
  assert.ok(paths.includes('u1/f100.pdf'));
});

test('collectPaths throws rather than loop forever on a listing that never shrinks', async () => {
  // Every prefix reports one more folder to descend into, forever.
  const list = async (): Promise<Entry[]> => [{ name: 'loop', id: null }];
  await assert.rejects(collectPaths(list, 'u1', 5), /did not finish/);
});

test('chunk splits into groups of at most size, in order', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk<number>([], 2), []);
  assert.deepEqual(chunk([1, 2], 100), [[1, 2]]);
});
