import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyForm, formToEpisode } from './cycleLog';
import { episodeToRow, journalView, rowToEpisode, sourceView } from './rows';

const now = new Date(2026, 8, 15, 10, 0);

test('an episode survives the round trip to a row and back', () => {
  const ep = formToEpisode(
    { ...emptyForm(), kinds: ['Pain'], day: 1, start: 9.5, locations: ['Pelvis'], severity: null, stool: null },
    false,
    now,
  );
  assert.deepEqual(rowToEpisode(episodeToRow(ep)), ep);
});

test('a known start time sets when it happened', () => {
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Pain'], day: 0, start: 9.5 }, false, now);
  const row = episodeToRow(ep);
  assert.equal(new Date(row.occurred_at).getHours(), 9);
  assert.equal(new Date(row.occurred_at).getMinutes(), 30);
  assert.equal(row.metadata.time_known, true);
});

test('an unknown time is marked as unknown, not invented', () => {
  const ep = formToEpisode({ ...emptyForm(), kinds: ['Period'], periodStart: 2, allDay: true }, false, now);
  const row = episodeToRow(ep, { imported_from: 'device' });
  assert.equal(row.metadata.time_known, false);
  assert.equal(row.metadata.imported_from, 'device');
  assert.equal(row.severity, null);
  assert.equal(row.flow, null);
});

test('notes group by month, newest first', () => {
  const view = journalView([
    { client_id: 'j1', text: 'Stressful stretch at work.', kind: 'Context', tag: null, occurred_at: '2026-03-14T12:00:00Z' },
    { client_id: 'j2', text: 'Slept through four nights.', kind: 'Notes', tag: 'Sleep', occurred_at: '2026-07-03T12:00:00Z' },
  ]);
  assert.equal(view.count, 2);
  assert.equal(view.since, 'Since March');
  assert.deepEqual(view.months.map((m) => m.month), ['July 2026', 'March 2026']);
  assert.deepEqual(view.months[0].items[0], {
    text: 'Slept through four nights.', date: '3 Jul', tag: 'Sleep', kind: 'Notes', usedInInsight: false,
  });
  assert.equal(view.months[1].items[0].tag, 'Context');
});

test('no notes reads as no notes', () => {
  assert.deepEqual(journalView([]), { count: 0, since: 'No entries yet', months: [] });
});

test('a source row reads the way Profile shows sources', () => {
  const v = sourceView({ kind: 'user_report', name: 'You', status: 'active', last_synced_at: null, created_at: '2026-09-15T08:00:00Z' });
  assert.deepEqual(v, {
    name: 'You', kind: 'logged', status: 'Active',
    facts: [{ label: 'Since', value: '15 Sep' }, { label: 'Last updated', value: 'Not yet' }],
  });
  assert.equal(sourceView({ kind: 'apple_health', name: 'Apple Health', status: 'unsupported', last_synced_at: null, created_at: '2026-09-15T08:00:00Z' }).status, 'Not available yet');
});
