// gate lives beside the intelligence edge function but is plain TypeScript,
// so this suite exercises it under node:test, as threads.test.ts does for
// the builder. The passing fixture is the spec's section 11 test 1 shape:
// cycles of 29, 28, 27 and 26 days, a sleep change row, and links from a
// low sleep night to each of the last two period starts. Every other
// fixture breaks one link of that chain and expects the reason named.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gate, STALE_DAYS, type GateRows } from '../../supabase/functions/intelligence/gate';
import {
  buildThreads,
  type ChangeRow,
  type LinkRow,
  type ObservationRow,
  type ThreadCandidate,
  type ThreadInput,
} from '../../supabase/functions/intelligence/threads';

function obs(id: string, metric: string, occurredAt: string, extra: Partial<ObservationRow> = {}): ObservationRow {
  const reported = metric === 'period_start';
  return {
    id,
    domain: reported ? 'cycle' : 'sleep',
    metric,
    value: null,
    value_text: null,
    occurred_at: occurredAt,
    source_id: reported ? 'you' : 'watch',
    provenance: reported ? 'REPORTED' : 'MEASURED',
    origin_id: null,
    ...extra,
  };
}
const period = (id: string, day: string, extra: Partial<ObservationRow> = {}) =>
  obs(id, 'period_start', `${day}T09:00:00.000Z`, { value_text: day, ...extra });
const sleep = (id: string, day: string, extra: Partial<ObservationRow> = {}) =>
  obs(id, 'sleep_hours', `${day}T07:00:00.000Z`, { value: 5.4, ...extra });
function link(id: string, a: ObservationRow, b: ObservationRow): LinkRow {
  return {
    id,
    a_observation_id: a.id,
    b_observation_id: b.id,
    relation: 'within_3d',
    gap_hours: (Date.parse(b.occurred_at) - Date.parse(a.occurred_at)) / 3600000,
    occurred_on: b.occurred_at.slice(0, 10),
  };
}
const change = (id: string, detectedOn: string): ChangeRow => ({
  id,
  metric: 'sleep_hours',
  direction: 'lower',
  detected_on: detectedOn,
  deviation: -1.2,
  quality: 'ok',
  from_value: 7.1,
  to_value: 5.4,
  window_days: 14,
});

// 1 Jan, 30 Jan, 27 Feb, 26 Mar, 21 Apr: cycles of 29, 28, 27 and 26 days.
const starts = ['2026-01-01', '2026-01-30', '2026-02-27', '2026-03-26', '2026-04-21'];
const periods = starts.map((d, i) => period(`p${i}`, d));
const s3 = sleep('s3', '2026-03-24');
const s4 = sleep('s4', '2026-04-19');
const TODAY = '2026-05-01';

function fixture(over: Partial<ThreadInput> = {}): { input: ThreadInput; rows: GateRows; candidate: ThreadCandidate } {
  const input: ThreadInput = {
    changes: [change('c1', '2026-03-25')],
    links: [link('l3', s3, periods[3]), link('l4', s4, periods[4])],
    observations: [...periods, s3, s4],
    episodes: [],
    journals: [],
    ...over,
  };
  const [candidate, ...rest] = buildThreads(input);
  assert.equal(rest.length, 0);
  assert.ok(candidate, 'the fixture must build one candidate');
  return { input, rows: { changes: input.changes, links: input.links, observations: input.observations }, candidate };
}

test('the spec shape passes: four shortening cycles, a sleep change, two traced links', () => {
  const { candidate, rows } = fixture();
  assert.equal(candidate.key, 'cycle_length~sleep_hours');
  assert.deepEqual(gate(candidate, rows, TODAY), { pass: true });
});

test('no_finding: neither side has a change row the candidate cites', () => {
  const { candidate, rows } = fixture({ changes: [] });
  assert.ok(candidate.missing.includes('no_change_row'));
  assert.deepEqual(gate(candidate, rows, TODAY), { pass: false, reason: 'no_finding' });
});

test('no_finding: the cited change row is no longer in the window', () => {
  const { candidate, rows } = fixture();
  assert.deepEqual(gate(candidate, { ...rows, changes: [] }, TODAY), { pass: false, reason: 'no_finding' });
});

test('no_relationship: an occurrence whose link row cannot be traced', () => {
  const { candidate, rows } = fixture();
  const withoutOne = { ...rows, links: rows.links.filter((l) => l.id !== 'l4') };
  assert.deepEqual(gate(candidate, withoutOne, TODAY), { pass: false, reason: 'no_relationship' });

  const rewired = { ...rows, links: rows.links.map((l) => (l.id === 'l4' ? { ...l, b_observation_id: 'p2' } : l)) };
  assert.deepEqual(gate(candidate, rewired, TODAY), { pass: false, reason: 'no_relationship' });

  assert.deepEqual(gate({ ...candidate, occurrences: [] }, rows, TODAY), { pass: false, reason: 'no_relationship' });
});

test('insufficient_recurrence: the builder floor is asserted again at the gate', () => {
  const { candidate, rows } = fixture();
  assert.deepEqual(gate({ ...candidate, recurrence: 1 }, rows, TODAY), { pass: false, reason: 'insufficient_recurrence' });
});

test('no_source: a measured observation with no device behind it', () => {
  const { candidate, rows } = fixture();
  const unsourced = rows.observations.map((o) => (o.id === 's4' ? { ...o, source_id: null } : o));
  assert.deepEqual(gate(candidate, { ...rows, observations: unsourced }, TODAY), { pass: false, reason: 'no_source' });

  const missing = rows.observations.filter((o) => o.id !== 's3');
  assert.deepEqual(gate(candidate, { ...rows, observations: missing }, TODAY), { pass: false, reason: 'no_source' });
});

test('a reported observation needs no device: her own word is its source', () => {
  const { candidate, rows } = fixture();
  const herOwn = rows.observations.map((o) => (o.metric === 'period_start' ? { ...o, source_id: null } : o));
  assert.deepEqual(gate(candidate, { ...rows, observations: herOwn }, TODAY), { pass: true });
});

test('stale: last seen more than 120 days ago fails, and exactly 120 still passes', () => {
  assert.equal(STALE_DAYS, 120);
  const { candidate, rows } = fixture();
  assert.deepEqual(gate(candidate, rows, '2026-08-19'), { pass: true });
  assert.deepEqual(gate(candidate, rows, '2026-08-20'), { pass: false, reason: 'stale' });
});

test('the reasons are checked in chain order: a finding is asked for before a source', () => {
  const { candidate, rows } = fixture({ changes: [] });
  const unsourced = rows.observations.map((o) => (o.id === 's4' ? { ...o, source_id: null } : o));
  assert.deepEqual(gate(candidate, { ...rows, observations: unsourced }, TODAY), { pass: false, reason: 'no_finding' });
});
