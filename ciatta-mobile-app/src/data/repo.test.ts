import type { SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { demoRepo, realRepo } from './repo';
import { episodeToRow } from './rows';
import { journal, sources } from './sample';

test('demo mode serves the sample and keeps writes in memory', async () => {
  const repo = demoRepo();
  assert.equal(repo.mode, 'demo');
  assert.deepEqual(await repo.loadSources(), sources);
  assert.equal((await repo.loadJournal()).count, journal.count);
  await repo.addJournal('Tired today.', 'Notes');
  assert.equal((await repo.loadJournal()).count, journal.count + 1);
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(2026, 8, 15));
  await repo.saveEpisode(ep);
  assert.deepEqual((await repo.loadEpisodes()).map((e) => e.id), [ep.id]);
  assert.equal(await repo.firstName(), 'Maya');
  assert.equal(demoRepo().mode, 'demo');
  assert.deepEqual(await demoRepo().loadEpisodes(), [], 'a fresh demo starts clean');
});

// ── A query builder that caps a page the way PostgREST does ────

type Row = Record<string, unknown>;
type PageCall = { table: string; order: string[]; from: number; to: number };

// max_rows in supabase/config.toml: a single response never carries more.
const MAX_ROWS = 1000;

function fakeDb(tables: Record<string, Row[]>) {
  const calls: PageCall[] = [];
  const from = (table: string) => {
    const order: string[] = [];
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: null, error: null }),
      order: (column: string) => {
        order.push(column);
        return builder;
      },
      range: async (start: number, end: number) => {
        calls.push({ table, order: [...order], from: start, to: end });
        assert.ok(order.length > 0, 'a paged read must ask for a stable order');
        const rows = [...(tables[table] ?? [])].sort((a, b) =>
          order.reduce((cmp, column) => cmp || String(a[column]).localeCompare(String(b[column])), 0),
        );
        return { data: rows.slice(start, Math.min(end, start + MAX_ROWS - 1) + 1), error: null };
      },
    };
    return builder;
  };
  return { db: { from } as unknown as SupabaseClient, calls };
}

const base = formToEpisode({ ...emptyForm(), kinds: ['Pain'] }, false, new Date(Date.UTC(2020, 0, 1)));

// 2500 episodes, written in an order nothing can rely on, each an hour apart.
const episodeRows: Row[] = Array.from({ length: 2500 }, (_, i) => ({
  ...episodeToRow({ ...base, id: `ep-${String(i).padStart(4, '0')}` }),
  occurred_at: new Date(Date.UTC(2020, 0, 1) + i * 3600000).toISOString(),
})).reverse();

const journalRows: Row[] = Array.from({ length: 2500 }, (_, i) => ({
  client_id: `j-${String(i).padStart(4, '0')}`,
  text: `Note ${i}`,
  kind: 'Notes',
  tag: null,
  occurred_at: new Date(Date.UTC(2020, 0, 1) + i * 3600000).toISOString(),
})).reverse();

test('every episode comes back, past the 1000 row cap', async () => {
  const { db, calls } = fakeDb({ episodes: episodeRows });
  const episodes = await realRepo(db, 'user-a').loadEpisodes();
  assert.equal(episodes.length, 2500, 'nothing is silently dropped');
  assert.equal(episodes[0].id, 'ep-0000', 'the oldest is first');
  assert.equal(episodes[episodes.length - 1].id, 'ep-2499', 'and the most recent is still there');
  assert.equal(new Set(episodes.map((e) => e.id)).size, 2500, 'no episode is fetched twice');
  assert.deepEqual(
    calls.map((c) => [c.from, c.to]),
    [
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ],
  );
  assert.deepEqual(calls[0].order, ['occurred_at', 'client_id'], 'ordered so pages cannot shift under her');
});

test('every note comes back, past the 1000 row cap, in a stable order', async () => {
  const { db, calls } = fakeDb({ journal_entries: journalRows });
  const view = await realRepo(db, 'user-a').loadJournal();
  assert.equal(view.count, 2500, 'no note is truncated away');
  assert.equal(view.months[0].items[0].text, 'Note 2499', 'the newest note is shown first');
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].order, ['occurred_at', 'client_id']);
});

test('a short first page is the end of the record, not the start of a loop', async () => {
  const { db, calls } = fakeDb({ episodes: episodeRows.slice(0, 3) });
  assert.equal((await realRepo(db, 'user-a').loadEpisodes()).length, 3);
  assert.equal(calls.length, 1);
});
