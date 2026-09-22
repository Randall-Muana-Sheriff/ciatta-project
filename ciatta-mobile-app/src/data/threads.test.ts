// buildThreads lives beside the intelligence edge function (a Deno file
// imports it by relative path) but is plain TypeScript with no Deno or
// Supabase imports, so this suite exercises it directly under node:test,
// the same arrangement as links.test.ts and baselines.test.ts. The plan
// placed this file next to threads.ts; it lives here instead because
// `npm test` only globs src/**/*.test.ts, which is also why the other
// function modules are tested from this folder.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseDay } from './cycleLog';
import { cycleWindows } from '../lib/cycleModel';
import { cycleTrend } from '../lib/engine';
import {
  buildThreads,
  cycleLengths,
  MIN_RECURRENCE,
  MIN_SEPARATION_DAYS,
  type ChangeRow,
  type LinkRow,
  type ObservationRow,
  type ThreadInput,
} from '../../supabase/functions/intelligence/threads';

const DOMAIN: Record<string, string> = {
  period_start: 'cycle',
  sleep_hours: 'sleep',
  resting_hr: 'heart',
  steps: 'activity',
  note: 'context',
  symptom: 'symptom',
};
const REPORTED = new Set(['period_start', 'note', 'symptom']);

function obs(id: string, metric: string, occurredAt: string, extra: Partial<ObservationRow> = {}): ObservationRow {
  const reported = REPORTED.has(metric);
  return {
    id,
    domain: DOMAIN[metric] ?? metric,
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
const sleep = (id: string, day: string, hours = 5.5) => obs(id, 'sleep_hours', `${day}T07:00:00.000Z`, { value: hours });
const hr = (id: string, day: string, bpm = 62) => obs(id, 'resting_hr', `${day}T08:00:00.000Z`, { value: bpm });

// a is always the earlier observation, as the temporal_links rule requires.
function link(id: string, a: ObservationRow, b: ObservationRow, relation = 'within_3d'): LinkRow {
  const gap = (Date.parse(b.occurred_at) - Date.parse(a.occurred_at)) / 3600000;
  assert.ok(gap >= 0, `fixture ${id} has its ends reversed`);
  return { id, a_observation_id: a.id, b_observation_id: b.id, relation, gap_hours: gap, occurred_on: b.occurred_at.slice(0, 10) };
}
const change = (id: string, metric: string, detectedOn: string): ChangeRow => ({
  id,
  metric,
  direction: 'lower',
  detected_on: detectedOn,
  deviation: -1.2,
  quality: 'ok',
  from_value: 7.1,
  to_value: 5.4,
  window_days: 14,
});
const input = (partial: Partial<ThreadInput>): ThreadInput => ({
  changes: [],
  links: [],
  observations: [],
  episodes: [],
  journals: [],
  ...partial,
});

// Three period starts, so two completed cycles, each preceded by a low
// sleep night that the links step paired with the start that closed it.
const p1 = period('p1', '2026-01-01');
const p2 = period('p2', '2026-01-30');
const p3 = period('p3', '2026-02-27');
const s0 = sleep('s0', '2025-12-30');
const s1 = sleep('s1', '2026-01-28');
const s2 = sleep('s2', '2026-02-25');
const cycleFixture = (extra: Partial<ThreadInput> = {}) =>
  input({
    observations: [p1, p2, p3, s0, s1, s2],
    links: [link('l0', s0, p1), link('l1', s1, p2), link('l2', s2, p3)],
    ...extra,
  });

test('two occurrences a month apart make one candidate, keyed by the sorted pair', () => {
  const [thread, ...rest] = buildThreads(cycleFixture());
  assert.deepEqual(rest, []);
  assert.equal(thread.key, 'cycle_length~sleep_hours');
  assert.equal(thread.title, 'Cycle length and sleep');
  assert.deepEqual(thread.domains, ['cycle', 'sleep']);
  assert.equal(thread.recurrence, 2);
  assert.deepEqual(
    thread.occurrences.map((o) => [o.at, o.aObservationId, o.bObservationId, o.linkId]),
    [
      ['2026-01-30', 's1', 'p2', 'l1'],
      ['2026-02-27', 's2', 'p3', 'l2'],
    ]
  );
  assert.equal(thread.firstObservedAt, '2026-01-30');
  assert.equal(thread.lastObservedAt, '2026-02-27');
  assert.deepEqual(
    thread.evidence.filter((e) => e.linkId).map((e) => [e.role, e.linkId]),
    [
      ['supports', 'l1'],
      ['supports', 'l2'],
    ]
  );
});

test('the first period start has no length, so a link to it is not an occurrence of cycle length', () => {
  const [thread] = buildThreads(cycleFixture());
  assert.ok(!thread.occurrences.some((o) => o.linkId === 'l0'));
});

test('a partner observed after the period started belongs to the next cycle, not the one whose length is known', () => {
  const after = sleep('after', '2026-01-31');
  const threads = buildThreads(
    input({ observations: [p1, p2, p3, after, s2], links: [link('la', p2, after), link('l2', s2, p3)] })
  );
  assert.deepEqual(threads, []);
});

test('the same pair with its ends the other way round makes the same key', () => {
  const h1 = hr('h1', '2026-03-01');
  const sl1 = sleep('sl1', '2026-03-02');
  const sl2 = sleep('sl2', '2026-03-20');
  const h2 = hr('h2', '2026-03-21');
  const [thread, ...rest] = buildThreads(
    input({ observations: [h1, sl1, sl2, h2], links: [link('m1', h1, sl1), link('m2', sl2, h2)] })
  );
  assert.deepEqual(rest, []);
  assert.equal(thread.key, 'resting_hr~sleep_hours');
  assert.equal(thread.title, 'Resting heart rate and sleep');
  assert.equal(thread.recurrence, 2);
});

test('one occurrence makes nothing: one earlier match is not enough to call it recurring', () => {
  assert.equal(MIN_RECURRENCE, 2);
  const threads = buildThreads(input({ observations: [p1, p2, s1], links: [link('l1', s1, p2)] }));
  assert.deepEqual(threads, []);
});

test('two occurrences three days apart make nothing', () => {
  assert.equal(MIN_SEPARATION_DAYS, 7);
  const h1 = hr('h1', '2026-03-01');
  const sl1 = sleep('sl1', '2026-03-02');
  const h2 = hr('h2', '2026-03-04');
  const sl2 = sleep('sl2', '2026-03-05');
  const threads = buildThreads(
    input({ observations: [h1, sl1, h2, sl2], links: [link('m1', h1, sl1), link('m2', h2, sl2)] })
  );
  assert.deepEqual(threads, []);
});

test('a third occurrence inside the separation of the second still counts the pair as two, not three', () => {
  const h1 = hr('h1', '2026-03-01');
  const sl1 = sleep('sl1', '2026-03-02');
  const h2 = hr('h2', '2026-03-20');
  const sl2 = sleep('sl2', '2026-03-21');
  const h3 = hr('h3', '2026-03-23');
  const sl3 = sleep('sl3', '2026-03-24');
  const [thread] = buildThreads(
    input({
      observations: [h1, sl1, h2, sl2, h3, sl3],
      links: [link('m1', h1, sl1), link('m2', h2, sl2), link('m3', h3, sl3)],
    })
  );
  assert.equal(thread.occurrences.length, 3);
  assert.equal(thread.recurrence, 2);
});

test('two links between the same two observations are one occurrence', () => {
  const twice = cycleFixture({
    links: [link('l1', s1, p2), link('l1b', s1, p2, 'within_7d'), link('l2', s2, p3)],
  });
  const [thread] = buildThreads(twice);
  assert.equal(thread.occurrences.length, 2);
  assert.equal(thread.recurrence, 2);
});

test('missing names no_change_row when neither side has a change row, and drops it when one was detected nearby', () => {
  const bare = buildThreads(cycleFixture())[0];
  assert.ok(bare.missing.includes('no_change_row'));

  const far = buildThreads(cycleFixture({ changes: [change('c0', 'sleep_hours', '2025-10-01')] }))[0];
  assert.ok(far.missing.includes('no_change_row'), 'a change months before the occurrences is not the finding');

  const near = buildThreads(cycleFixture({ changes: [change('c1', 'sleep_hours', '2026-01-29')] }))[0];
  assert.ok(!near.missing.includes('no_change_row'));
  assert.ok(near.evidence.some((e) => e.role === 'supports' && e.changeId === 'c1'));
});

test('missing names single_source only when every occurrence came from one source', () => {
  const mixed = buildThreads(cycleFixture())[0];
  assert.ok(!mixed.missing.includes('single_source'), 'her report and her watch are two sources');

  const h1 = hr('h1', '2026-03-01');
  const sl1 = sleep('sl1', '2026-03-02');
  const sl2 = sleep('sl2', '2026-03-20');
  const h2 = hr('h2', '2026-03-21');
  const [watchOnly] = buildThreads(
    input({ observations: [h1, sl1, sl2, h2], links: [link('m1', h1, sl1), link('m2', sl2, h2)] })
  );
  assert.ok(watchOnly.missing.includes('single_source'));
});

test('missing names no_context until she has told the record something near an occurrence', () => {
  const silent = buildThreads(cycleFixture())[0];
  assert.ok(silent.missing.includes('no_context'));

  // The period episode itself is what the occurrence is made of, not
  // context around it.
  const ownEpisode = buildThreads(
    cycleFixture({
      observations: [p1, period('p2', '2026-01-30', { origin_id: 'e2' }), p3, s0, s1, s2],
      episodes: [{ id: 'e2', occurred_on: '2026-01-30', kinds: ['Period'], period_start: '2026-01-30' }],
    })
  )[0];
  assert.ok(ownEpisode.missing.includes('no_context'));

  const note = obs('n1', 'note', '2026-01-27T20:00:00.000Z', { value_text: 'rough week', origin_id: 'j1' });
  const told = buildThreads(
    cycleFixture({
      observations: [p1, p2, p3, s0, s1, s2, note],
      journals: [{ id: 'j1', occurred_on: '2026-01-27' }],
    })
  )[0];
  assert.ok(!told.missing.includes('no_context'));
  assert.ok(told.evidence.some((e) => e.role === 'user_reported' && e.observationId === 'n1'));

  const tooFar = buildThreads(cycleFixture({ journals: [{ id: 'j9', occurred_on: '2026-01-10' }] }))[0];
  assert.ok(tooFar.missing.includes('no_context'));
});

test('a journal note is context, never one side of a pair', () => {
  const n1 = obs('n1', 'note', '2026-01-27T20:00:00.000Z', { value_text: 'x' });
  const n2 = obs('n2', 'note', '2026-02-24T20:00:00.000Z', { value_text: 'y' });
  const threads = buildThreads(
    input({ observations: [n1, s1, n2, s2], links: [link('k1', n1, s1), link('k2', n2, s2)] })
  );
  assert.deepEqual(threads, []);
});

test('a symptom is keyed by what she named, so headaches and cramps are two threads, not one', () => {
  const a1 = obs('a1', 'symptom', '2026-01-27T20:00:00.000Z', { value_text: 'Headache' });
  const a2 = obs('a2', 'symptom', '2026-02-24T20:00:00.000Z', { value_text: 'headache' });
  const [thread] = buildThreads(
    input({ observations: [a1, s1, a2, s2], links: [link('k1', a1, s1), link('k2', a2, s2)] })
  );
  assert.equal(thread.key, 'sleep_hours~symptom:headache');
  assert.equal(thread.title, 'Sleep and headache');
  assert.deepEqual(thread.domains, ['sleep', 'symptom']);
});

test('candidates come out sorted by key, so a run over the same window yields the same order', () => {
  const h1 = hr('h1', '2026-01-27');
  const h2 = hr('h2', '2026-02-24');
  const threads = buildThreads(
    cycleFixture({
      observations: [p1, p2, p3, s0, s1, s2, h1, h2],
      links: [link('l1', s1, p2), link('l2', s2, p3), link('m1', h1, s1), link('m2', h2, s2)],
    })
  );
  assert.deepEqual(
    threads.map((t) => t.key),
    ['cycle_length~sleep_hours', 'resting_hr~sleep_hours']
  );
});

test('cycle lengths come from consecutive period starts: 1 Jan, 30 Jan, 27 Feb give 29 and 28', () => {
  assert.deepEqual(
    cycleLengths([p1, p2, p3]).map((c) => [c.observationId, c.start, c.end, c.length]),
    [
      ['p2', '2026-01-01', '2026-01-30', 29],
      ['p3', '2026-01-30', '2026-02-27', 28],
    ]
  );
});

test('a single period start has no length: unknown, not zero', () => {
  assert.deepEqual(cycleLengths([p1]), []);
  assert.deepEqual(cycleLengths([]), []);
});

test('the period start date is the date she gave, not the moment the episode was logged', () => {
  const late = period('px', '2026-01-30', { occurred_at: '2026-02-01T18:00:00.000Z' });
  assert.deepEqual(
    cycleLengths([p1, late]).map((c) => [c.end, c.length]),
    [['2026-01-30', 29]]
  );
});

test('cross check: the lengths agree with cycleTrend in the engine for one shared fixture, duplicate logging included', () => {
  // Jan 5 is the same period logged twice; the engine merges starts closer
  // than ten days and so must this.
  const days = ['2026-01-01', '2026-01-05', '2026-01-30', '2026-02-27', '2026-03-28'];
  const observations = days.map((d, i) => period(`q${i}`, d));
  const ours = cycleLengths(observations);
  const engine = cycleTrend(cycleWindows(days.map(parseDay)), [], 10);
  assert.deepEqual(
    ours.map((c) => c.length),
    engine.map((p) => p.length)
  );
  assert.deepEqual(
    ours.map((c) => c.start),
    engine.map((p) => `${p.start.getFullYear()}-${String(p.start.getMonth() + 1).padStart(2, '0')}-${String(p.start.getDate()).padStart(2, '0')}`)
  );
});
