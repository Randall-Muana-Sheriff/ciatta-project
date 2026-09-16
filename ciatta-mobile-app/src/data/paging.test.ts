// readAllPages lives beside the baselines edge function (a Deno file
// imports it by relative path) but is plain TypeScript with no Deno or
// Supabase imports, so this suite exercises it directly under node:test,
// the same arrangement as src/data/links.test.ts.
//
// The fake below stands in for PostgREST and implements the same rule the
// keyset filter asks the database for: return rows ordered by
// (occurred_at, id), starting strictly after the cursor. That makes this a
// test of the loop and its boundary arithmetic. Whether the real Data API
// parses the filter the same way is a separate question, checked against
// the running stack and written up in the task report.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readAllPages, keysetFilter, type Cursor, type KeyedRow } from '../../supabase/functions/baselines/paging';

type Row = KeyedRow & { tag: string };

const row = (occurredAt: string, id: string): Row => ({ id, occurred_at: occurredAt, tag: `${occurredAt}#${id}` });

const ordered = (rows: Row[]): Row[] =>
  [...rows].sort((x, y) =>
    x.occurred_at < y.occurred_at ? -1 : x.occurred_at > y.occurred_at ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0
  );

// Serves pages the way the keyset filter asks the database to: strictly
// after the cursor under (occurred_at, id).
function fakeTable(rows: Row[]) {
  const all = ordered(rows);
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    fetchPage: (after: Cursor | null, limit: number) => {
      requests += 1;
      const start = after
        ? all.findIndex(
            (r) => r.occurred_at > after.occurredAt || (r.occurred_at === after.occurredAt && r.id > after.id)
          )
        : 0;
      const from = start === -1 ? all.length : start;
      return Promise.resolve({ data: all.slice(from, from + limit), error: null });
    },
  };
}

test('every row comes back exactly once, in order, across many pages', () => {
  const rows: Row[] = [];
  for (let i = 0; i < 25; i++) rows.push(row(`2026-09-${String(10 + (i % 5)).padStart(2, '0')}T00:00:00+00:00`, `id${String(i).padStart(2, '0')}`));
  const table = fakeTable(rows);

  return readAllPages<Row>(table.fetchPage, 4).then((out) => {
    assert.deepEqual(out, ordered(rows));
    assert.equal(new Set(out.map((r) => r.tag)).size, rows.length);
  });
});

// The case the tuple comparison exists for. Five rows share one instant and
// the page boundary falls in the middle of them, so a cursor on occurred_at
// alone would either skip the rest of the run or repeat all of it.
test('a run of rows sharing one occurred_at is neither skipped nor repeated at a page boundary', () => {
  const shared = '2026-09-10T06:00:00+00:00';
  const rows = [
    row('2026-09-09T06:00:00+00:00', 'id0'),
    row(shared, 'id1'),
    row(shared, 'id2'),
    row(shared, 'id3'),
    row(shared, 'id4'),
    row(shared, 'id5'),
    row('2026-09-11T06:00:00+00:00', 'id6'),
  ];
  const table = fakeTable(rows);

  // Page size 3 puts the first boundary after id2, mid run.
  return readAllPages<Row>(table.fetchPage, 3).then((out) => {
    assert.deepEqual(out.map((r) => r.id), ['id0', 'id1', 'id2', 'id3', 'id4', 'id5', 'id6']);
    assert.equal(out.filter((r) => r.occurred_at === shared).length, 5);
  });
});

test('every row sharing a single instant still pages completely', () => {
  const shared = '2026-09-10T06:00:00+00:00';
  const rows: Row[] = [];
  for (let i = 0; i < 10; i++) rows.push(row(shared, `id${String(i).padStart(2, '0')}`));
  const table = fakeTable(rows);

  return readAllPages<Row>(table.fetchPage, 3).then((out) => {
    assert.equal(out.length, 10);
    assert.equal(new Set(out.map((r) => r.id)).size, 10);
  });
});

// A full last page cannot be told from a final one, so the loop has to ask
// once more and accept an empty answer.
test('a row count that is an exact multiple of the page size terminates without duplicates', () => {
  const rows: Row[] = [];
  for (let i = 0; i < 6; i++) rows.push(row(`2026-09-1${i}T06:00:00+00:00`, `id${i}`));
  const table = fakeTable(rows);

  return readAllPages<Row>(table.fetchPage, 3).then((out) => {
    assert.equal(out.length, 6);
    assert.equal(new Set(out.map((r) => r.id)).size, 6);
    // Three requests: two full pages, then the empty one that ends it.
    assert.equal(table.requests, 3);
  });
});

test('an empty table is one request and no rows', () => {
  const table = fakeTable([]);
  return readAllPages<Row>(table.fetchPage, 10).then((out) => {
    assert.deepEqual(out, []);
    assert.equal(table.requests, 1);
  });
});

// A partial set is exactly what this file exists to prevent, so a failing
// page must not come back as a short, successful looking read.
test('a page that errors throws rather than returning what already arrived', async () => {
  const rows: Row[] = [];
  for (let i = 0; i < 10; i++) rows.push(row(`2026-09-1${i}T06:00:00+00:00`, `id${i}`));
  const good = fakeTable(rows);
  let calls = 0;
  const fetchPage = (after: Cursor | null, limit: number) => {
    calls += 1;
    if (calls === 2) return Promise.resolve({ data: null, error: { code: 'PGRST103' } });
    return good.fetchPage(after, limit);
  };

  await assert.rejects(() => readAllPages<Row>(fetchPage, 3), (e: unknown) => {
    assert.equal((e as { code: string }).code, 'PGRST103');
    return true;
  });
});

test('the keyset filter asks for the tuple after the cursor, not merely a later instant', () => {
  const filter = keysetFilter({ occurredAt: '2026-09-10T06:00:00+00:00', id: 'abc' });
  // Strictly later instants, or the same instant with a larger id. Never
  // the cursor row itself, and never a shared instant left behind.
  assert.equal(filter, 'occurred_at.gt."2026-09-10T06:00:00+00:00",and(occurred_at.eq."2026-09-10T06:00:00+00:00",id.gt.abc)');
  // Quoted, because the rendered offset carries a + that is otherwise
  // ambiguous in a filter value.
  assert.ok(filter.includes('"2026-09-10T06:00:00+00:00"'));
});
