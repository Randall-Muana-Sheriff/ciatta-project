import type { SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, formToEpisode, isoDay } from './cycleLog';
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

test('demo mode writes nothing when a source status is saved', async () => {
  const repo = demoRepo();
  const before = await repo.loadSources();
  await repo.saveSourceStatus('apple_health', 'active', new Date().toISOString());
  assert.deepEqual(await repo.loadSources(), before, 'the example person is never changed');
});

// ── A query builder that caps a page the way PostgREST does ────

type Row = Record<string, unknown>;
type PageCall = { table: string; order: string[]; from: number; to: number };

// max_rows in supabase/config.toml: a single response never carries more.
const MAX_ROWS = 1000;

function fakeDb(tables: Record<string, Row[]>) {
  const calls: PageCall[] = [];
  const selects: string[] = [];
  const from = (table: string) => {
    const order: string[] = [];
    const builder = {
      select: (columns?: string) => {
        selects.push(columns ?? '*');
        return builder;
      },
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
  return { db: { from } as unknown as SupabaseClient, calls, selects };
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

// Fix round 1, item 7: daily_metrics carries eight columns (id, user_id,
// source_id, provenance, metadata, occurred_at, created_at, updated_at)
// nothing here reads, and every other realRepo method already names its
// columns rather than asking for '*'.
test('daily rows are read by named column, not select star, and project into Day', async () => {
  const today = new Date();
  const dailyRows: Row[] = [
    { day: isoDay(addDays(today, -1)), steps: 4000 },
    { day: isoDay(today), sleep_hours: 7.2 },
  ];
  const { db, calls, selects } = fakeDb({ daily_metrics: dailyRows });
  const days = await realRepo(db, 'user-a').loadDays();

  assert.ok(selects.length > 0);
  for (const columns of selects) {
    assert.notEqual(columns, '*', 'daily_metrics is read by named column, like every other realRepo method');
  }
  for (const column of ['day', 'sleep_hours', 'steps', 'workouts', 'foods', 'digestion', 'note']) {
    assert.ok(selects[0].includes(column), `expected ${column} among the named columns`);
  }
  for (const column of ['id', 'user_id', 'source_id', 'provenance', 'metadata', 'occurred_at', 'created_at', 'updated_at']) {
    assert.ok(!selects[0].includes(column), `${column} is never read here`);
  }
  assert.deepEqual(calls[0].order, ['day']);
  assert.equal(days.length, 2);
  assert.equal(days[0].steps, 4000);
  assert.equal(days[0].sleepHours, null);
  assert.equal(days[1].sleepHours, 7.2);
});

// ── saveSourceStatus ─────────────────────────────────────────────

type UpsertCall = { table: string; payload: Record<string, unknown>; onConflict?: string };

function fakeUpsertDb() {
  const upserts: UpsertCall[] = [];
  const from = (table: string) => ({
    upsert: async (payload: Record<string, unknown>, opts?: { onConflict?: string }) => {
      upserts.push({ table, payload, onConflict: opts?.onConflict });
      return { data: null, error: null };
    },
  });
  return { db: { from } as unknown as SupabaseClient, upserts };
}

test('saveSourceStatus writes a real source row keyed by user, kind and name', async () => {
  const { db, upserts } = fakeUpsertDb();
  await realRepo(db, 'user-a').saveSourceStatus('apple_health', 'active', '2026-09-16T00:00:00.000Z');
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].table, 'health_sources');
  assert.deepEqual(upserts[0].payload, {
    user_id: 'user-a',
    kind: 'apple_health',
    name: 'Apple Health',
    status: 'active',
    last_synced_at: '2026-09-16T00:00:00.000Z',
  });
  assert.equal(upserts[0].onConflict, 'user_id,kind,name');
});

test('saveSourceStatus without a synced time leaves last_synced_at out, rather than clearing it', async () => {
  const { db, upserts } = fakeUpsertDb();
  await realRepo(db, 'user-a').saveSourceStatus('apple_health', 'refused');
  assert.equal('last_synced_at' in upserts[0].payload, false, 'an existing last_synced_at must not be nulled out by a status only update');
});
