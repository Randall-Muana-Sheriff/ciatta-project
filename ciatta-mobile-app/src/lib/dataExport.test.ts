import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { buildExport, EXPORT_SKIPPED, EXPORT_TABLES, exportFileName } from './dataExport';

test('every table that holds her data is exported, or skipped with a reason', () => {
  const dir = join(__dirname, '../../supabase/migrations');
  const sql = readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const owned = new Set<string>();
  for (const m of sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) if (/\buser_id\b/.test(m[2])) owned.add(m[1]);
  for (const m of sql.matchAll(/create table public\.(\w+) \(like public\.(\w+)/g)) owned.add(m[1]);
  for (const t of owned) {
    assert.ok((EXPORT_TABLES as readonly string[]).includes(t) || t in EXPORT_SKIPPED, `${t} is neither exported nor skipped`);
  }
  assert.ok((EXPORT_TABLES as readonly string[]).includes('profiles'));
});

test('the export says what it is, what each part holds, and what could not be read', () => {
  const out = buildExport(
    { profiles: [{ id: 'u1' }], episodes: [{ id: 'e1' }, { id: 'e2' }], meals: { error: 'permission denied' } },
    'u1',
    new Date('2026-10-14T09:00:00Z'),
  );
  assert.equal(out.exported_at, '2026-10-14T09:00:00.000Z');
  assert.equal(out.user_id, 'u1');
  assert.deepEqual(out.tables.episodes, [{ id: 'e1' }, { id: 'e2' }]);
  assert.deepEqual(out.counts, { profiles: 1, episodes: 2 });
  assert.deepEqual(out.not_included, [
    { table: 'meals', reason: 'Could not be read: permission denied' },
    { table: 'jobs', reason: 'A queue of work for the server to do, not information about you.' },
    { table: 'food_scan_uses', reason: 'A count of meal scans per day, kept on the server only to limit scans to 40 a day.' },
    { table: 'lab_scan_uses', reason: 'A count of lab reports read per day, kept on the server only to limit them to 20 a day.' },
    { table: 'lab_analysis_uses', reason: 'A count of lab report analyses per day, kept on the server only to limit them to 20 a day.' },
    { table: 'log_read_uses', reason: 'A count of messages read for your timeline per day, kept on the server only to limit them to 200 a day.' },
    { table: 'fasten_connect_requests', reason: 'A one time code for connecting a provider through Fasten, kept for two hours and never information about you.' },
  ]);
  assert.match(out.about.files, /on this phone/);
  assert.match(out.about.files, /lab report/i, 'lab report originals are kept in her account, and the export says so');
  assert.ok(out.about.tables.episodes);
});

test('the file is named for the day', () => {
  assert.equal(exportFileName(new Date(2026, 9, 14, 23, 50)), 'ciatta-data-2026-10-14.json');
});
