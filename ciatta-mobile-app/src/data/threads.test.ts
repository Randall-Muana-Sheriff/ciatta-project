// buildThreads lives beside the intelligence edge function (a Deno file
// imports it by relative path) but is plain TypeScript with no Deno or
// Supabase imports, so this suite exercises it directly under node:test,
// the same arrangement as links.test.ts and baselines.test.ts. The plan
// placed this file next to threads.ts; it lives here instead because
// `npm test` only globs src/**/*.test.ts, which is also why the other
// function modules are tested from this folder.
//
// The fixtures are shaped like the live record: sleep arrives as
// sleep_analysis readings from a watch (MEASURED), period starts and pain
// are hers (REPORTED), and what makes a reading unusual is a changes row
// for the measure it belongs to.
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
  sleep_analysis: 'sleep',
  steps: 'activity',
  heart_rate: 'vitals',
  note: 'context',
  symptom: 'symptom',
  pain_episode: 'pain',
  workout: 'activity',
};
const REPORTED = new Set(['period_start', 'note', 'symptom', 'pain_episode']);

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
const sleep = (id: string, day: string, hour = 7) => obs(id, 'sleep_analysis', `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`, { value: 5.5 });
const steps = (id: string, day: string) => obs(id, 'steps', `${day}T12:00:00.000Z`, { value: 3000 });
const pain = (id: string, day: string) => obs(id, 'pain_episode', `${day}T20:00:00.000Z`, { value: 6, value_text: 'Pelvis' });

// a is always the earlier observation, as the temporal_links rule requires.
function link(id: string, a: ObservationRow, b: ObservationRow, relation = 'within_3d'): LinkRow {
  const gap = (Date.parse(b.occurred_at) - Date.parse(a.occurred_at)) / 3600000;
  assert.ok(gap >= 0, `fixture ${id} has its ends reversed`);
  return { id, a_observation_id: a.id, b_observation_id: b.id, relation, gap_hours: gap, occurred_on: b.occurred_at.slice(0, 10) };
}
const change = (id: string, metric: string, detectedOn: string, direction: 'lower' | 'higher' = 'lower'): ChangeRow => ({
  id,
  metric,
  direction,
  detected_on: detectedOn,
  deviation: -1.2,
  quality: 'ok',
  from_value: 7.1,
  to_value: 5.4,
  window_days: 90,
});
const input = (partial: Partial<ThreadInput>): ThreadInput => ({
  changes: [],
  links: [],
  observations: [],
  episodes: [],
  journals: [],
  ...partial,
});

// Three period starts, so two completed cycles, each with a low sleep
// night before the start that closed it and a sustained drop in sleep
// detected the day before.
const p1 = period('p1', '2026-01-01');
const p2 = period('p2', '2026-01-30');
const p3 = period('p3', '2026-02-27');
const s0 = sleep('s0', '2025-12-30');
const s1 = sleep('s1', '2026-01-28');
const s2 = sleep('s2', '2026-02-25');
const c1 = change('c1', 'sleep_hours', '2026-01-29');
const c2 = change('c2', 'sleep_hours', '2026-02-26');
const cycleFixture = (extra: Partial<ThreadInput> = {}) =>
  input({
    observations: [p1, p2, p3, s0, s1, s2],
    links: [link('l0', s0, p1), link('l1', s1, p2), link('l2', s2, p3)],
    changes: [c1, c2],
    ...extra,
  });

test('two period starts, each after a stretch of unusual sleep, make one candidate named for the measure', () => {
  const [thread, ...rest] = buildThreads(cycleFixture());
  assert.deepEqual(rest, []);
  assert.equal(thread.key, 'cycle_length~sleep_hours', 'the side is the measure, sleep_hours, not the sample it arrived as');
  assert.equal(thread.title, 'Cycle length and sleep');
  assert.deepEqual(thread.domains, ['cycle', 'sleep']);
  assert.equal(thread.recurrence, 2);
  assert.deepEqual(
    thread.occurrences.map((o) => [o.at, o.aObservationId, o.bObservationId, o.linkId, o.changeId]),
    [
      ['2026-01-30', 's1', 'p2', 'l1', 'c1'],
      ['2026-02-27', 's2', 'p3', 'l2', 'c2'],
    ]
  );
  assert.equal(thread.firstObservedAt, '2026-01-30');
  assert.equal(thread.lastObservedAt, '2026-02-27');
  assert.deepEqual(
    thread.evidence.map((e) => [e.role, e.linkId ?? e.changeId]),
    [
      ['supports', 'l1'],
      ['supports', 'l2'],
      ['supports', 'c1'],
      ['supports', 'c2'],
    ]
  );
  assert.ok(!thread.missing.includes('no_change_row'));
});

test('a period start with ordinary sleep before it is a period start, not an occurrence', () => {
  assert.deepEqual(buildThreads(cycleFixture({ changes: [c1] })), [], 'sleep was unusual before one start only: seen once, so nothing');
  assert.deepEqual(buildThreads(cycleFixture({ changes: [] })), [], 'sleep was never unusual: nothing happened');
  assert.deepEqual(
    buildThreads(cycleFixture({ changes: [change('c0', 'sleep_hours', '2025-10-01'), c2] })),
    [],
    'a change months before the start is about other days'
  );
  assert.deepEqual(
    buildThreads(cycleFixture({ changes: [change('x1', 'steps', '2026-01-29'), change('x2', 'steps', '2026-02-26')] })),
    [],
    'a change in another measure is not a finding about sleep'
  );
});

test('the first period start has no length, so it is never an occurrence of cycle length', () => {
  const [thread] = buildThreads(cycleFixture({ changes: [change('c0', 'sleep_hours', '2025-12-31'), c1, c2] }));
  assert.ok(!thread.occurrences.some((o) => o.linkId === 'l0'));
  assert.equal(thread.occurrences.length, 2);
});

test('a reading after the period started belongs to the next cycle, not the one whose length is known', () => {
  const after = sleep('after', '2026-01-31');
  const threads = buildThreads(
    input({ observations: [p1, p2, p3, after, s2], links: [link('la', p2, after), link('l2', s2, p3)], changes: [c1, c2] })
  );
  assert.deepEqual(threads, []);
});

test('one period start is one occurrence however many readings sit beside it, and the closest reading is the one kept', () => {
  const nearer = sleep('nearer', '2026-01-29', 22);
  const earlier = sleep('earlier', '2026-01-26');
  const [thread] = buildThreads(
    cycleFixture({
      observations: [p1, p2, p3, s0, s1, s2, nearer, earlier],
      links: [link('l1', s1, p2), link('ln', nearer, p2, 'within_24h'), link('le', earlier, p2, 'within_7d'), link('l2', s2, p3)],
    })
  );
  assert.equal(thread.occurrences.length, 2);
  assert.equal(thread.recurrence, 2);
  assert.equal(thread.occurrences[0].linkId, 'ln');
});

test('two device readings near each other are two series, never a thread', () => {
  const h1 = obs('h1', 'heart_rate', '2026-03-01T08:00:00.000Z', { value: 62 });
  const sl1 = sleep('sl1', '2026-03-02');
  const sl2 = sleep('sl2', '2026-03-20');
  const h2 = obs('h2', 'heart_rate', '2026-03-21T08:00:00.000Z', { value: 64 });
  const threads = buildThreads(
    input({
      observations: [h1, sl1, sl2, h2],
      links: [link('m1', h1, sl1), link('m2', sl2, h2)],
      changes: [change('c1', 'sleep_hours', '2026-03-02'), change('c2', 'sleep_hours', '2026-03-20')],
    })
  );
  assert.deepEqual(threads, []);
});

test('the pair is the same whichever of the two came first', () => {
  const a1 = pain('a1', '2026-03-01');
  const st1 = steps('st1', '2026-03-02');
  const st2 = steps('st2', '2026-03-20');
  const a2 = pain('a2', '2026-03-21');
  const [thread, ...rest] = buildThreads(
    input({
      observations: [a1, st1, st2, a2],
      links: [link('m1', a1, st1), link('m2', st2, a2)],
      changes: [change('c1', 'steps', '2026-03-02'), change('c2', 'steps', '2026-03-20')],
    })
  );
  assert.deepEqual(rest, []);
  assert.equal(thread.key, 'pain_episode~steps');
  assert.equal(thread.title, 'Pain and steps');
  assert.equal(thread.recurrence, 2);
  assert.deepEqual(thread.occurrences.map((o) => o.at), ['2026-03-01', '2026-03-21'], 'each is dated by her event, not by the reading');
});

test('one occurrence makes nothing: one earlier match is not enough to call it recurring', () => {
  assert.equal(MIN_RECURRENCE, 2);
  const threads = buildThreads(input({ observations: [p1, p2, s1], links: [link('l1', s1, p2)], changes: [c1] }));
  assert.deepEqual(threads, []);
});

test('two occurrences three days apart make nothing, and a third inside the separation of the second counts the pair as two', () => {
  assert.equal(MIN_SEPARATION_DAYS, 7);
  const a1 = pain('a1', '2026-03-02');
  const a2 = pain('a2', '2026-03-05');
  const a3 = pain('a3', '2026-03-21');
  const a4 = pain('a4', '2026-03-24');
  const st = [steps('st1', '2026-03-01'), steps('st2', '2026-03-04'), steps('st3', '2026-03-20'), steps('st4', '2026-03-23')];
  const changes = [change('c1', 'steps', '2026-03-03'), change('c2', 'steps', '2026-03-22')];
  const close = buildThreads(
    input({ observations: [a1, a2, st[0], st[1]], links: [link('m1', st[0], a1), link('m2', st[1], a2)], changes })
  );
  assert.deepEqual(close, []);
  const [thread] = buildThreads(
    input({
      observations: [a1, a3, a4, st[0], st[2], st[3]],
      links: [link('m1', st[0], a1), link('m3', st[2], a3), link('m4', st[3], a4)],
      changes,
    })
  );
  assert.equal(thread.occurrences.length, 3);
  assert.equal(thread.recurrence, 2);
});

test('when the measure moved the other way one time, that time is kept as evidence against and not counted', () => {
  const p4 = period('p4', '2026-03-27');
  const s3 = sleep('s3', '2026-03-25');
  const [thread] = buildThreads(
    cycleFixture({
      observations: [p1, p2, p3, p4, s0, s1, s2, s3],
      links: [link('l1', s1, p2), link('l2', s2, p3), link('l3', s3, p4)],
      changes: [c1, c2, change('c3', 'sleep_hours', '2026-03-26', 'higher')],
    })
  );
  assert.equal(thread.recurrence, 2);
  assert.deepEqual(thread.occurrences.map((o) => o.linkId), ['l1', 'l2']);
  assert.deepEqual(
    thread.evidence.filter((e) => e.role === 'contradicts').map((e) => e.linkId),
    ['l3']
  );
  assert.ok(!thread.evidence.some((e) => e.changeId === 'c3'), 'the contrary change is not cited as support');
});

test('two events near each other can recur with no measure between them, and say no finding is behind them', () => {
  const a1 = pain('a1', '2026-03-01');
  const a2 = pain('a2', '2026-03-29');
  const h1 = obs('h1', 'symptom', '2026-03-02T09:00:00.000Z', { value_text: 'Headache' });
  const h2 = obs('h2', 'symptom', '2026-03-30T09:00:00.000Z', { value_text: 'headache' });
  const [thread] = buildThreads(input({ observations: [a1, a2, h1, h2], links: [link('e1', a1, h1), link('e2', a2, h2)] }));
  assert.equal(thread.key, 'pain_episode~symptom:headache');
  assert.equal(thread.title, 'Pain and headache');
  assert.ok(thread.missing.includes('no_change_row'));
  assert.ok(!thread.evidence.some((e) => e.changeId));
});

test('missing names single_source only when every occurrence came from one source', () => {
  const mixed = buildThreads(cycleFixture())[0];
  assert.ok(!mixed.missing.includes('single_source'), 'her report and her watch are two sources');

  const w1 = obs('w1', 'workout', '2026-03-01T18:00:00.000Z', { value: 40, provenance: 'RECORDED' });
  const w2 = obs('w2', 'workout', '2026-03-21T18:00:00.000Z', { value: 35, provenance: 'RECORDED' });
  const sl1 = sleep('sl1', '2026-03-02');
  const sl2 = sleep('sl2', '2026-03-22');
  const [watchOnly] = buildThreads(
    input({
      observations: [w1, w2, sl1, sl2],
      links: [link('m1', w1, sl1), link('m2', w2, sl2)],
      changes: [change('c1', 'sleep_hours', '2026-03-02'), change('c2', 'sleep_hours', '2026-03-22')],
    })
  );
  assert.equal(watchOnly.key, 'sleep_hours~workout');
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
    input({ observations: [n1, s1, n2, s2], links: [link('k1', n1, s1), link('k2', n2, s2)], changes: [c1, c2] })
  );
  assert.deepEqual(threads, []);
});

test('candidates come out sorted by key, so a run over the same window yields the same order', () => {
  const st1 = steps('st1', '2026-01-28');
  const st2 = steps('st2', '2026-02-25');
  const threads = buildThreads(
    cycleFixture({
      observations: [p1, p2, p3, s0, s1, s2, st1, st2],
      links: [link('l1', s1, p2), link('l2', s2, p3), link('m1', st1, p2), link('m2', st2, p3)],
      changes: [c1, c2, change('d1', 'steps', '2026-01-29'), change('d2', 'steps', '2026-02-26')],
    })
  );
  assert.deepEqual(
    threads.map((t) => t.key),
    ['cycle_length~sleep_hours', 'cycle_length~steps']
  );
});

test('a record shaped like the live one: thousands of readings beside a few events is quick and yields no noise', () => {
  const observations: ObservationRow[] = [p1, p2, p3];
  const links: LinkRow[] = [];
  let n = 0;
  for (const start of [p2, p3]) {
    for (let k = 1; k <= 300; k++) {
      const at = new Date(Date.parse(start.occurred_at) - k * 30 * 60000).toISOString();
      const o = obs(`r${n}`, ['sleep_analysis', 'steps', 'heart_rate'][k % 3], at, { value: 1 });
      observations.push(o);
      links.push({ id: `k${n}`, a_observation_id: o.id, b_observation_id: start.id, relation: 'within_7d', gap_hours: k / 2, occurred_on: start.occurred_at.slice(0, 10) });
      n++;
    }
  }
  const began = process.cpuUsage();
  const threads = buildThreads(input({ observations, links, changes: [c1, c2] }));
  const cpuMs = (process.cpuUsage(began).user + process.cpuUsage(began).system) / 1000;
  assert.deepEqual(threads.map((t) => t.key), ['cycle_length~sleep_hours'], 'only the measure that was unusual makes a thread');
  assert.equal(threads[0].occurrences.length, 2);
  assert.ok(cpuMs < 300, `building took ${cpuMs} ms of CPU`);
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
