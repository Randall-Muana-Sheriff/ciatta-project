import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COPY_DASH } from '../lib/displayCopy';
import { buildRecommendations, type RecommendInput } from '../../supabase/functions/intelligence/recommend';
import type { ChangeRow } from '../../supabase/functions/intelligence/threads';
import { offending } from '../../supabase/functions/intelligence/wording';

const TODAY = '2026-09-22';
const stepsDrop = (id: string, detectedOn: string): ChangeRow => ({
  id,
  metric: 'steps',
  direction: 'lower',
  detected_on: detectedOn,
  deviation: -1.4,
  quality: 'ok',
  from_value: 6200,
  to_value: 3100,
  window_days: 90,
});
const input = (over: Partial<RecommendInput> = {}): RecommendInput => ({
  today: TODAY,
  insights: [{ id: 'i1', thread_id: 't1', status: 'new', valid_to: null }],
  threads: [{ id: 't1', key: 'cycle_length~sleep_hours', status: 'new', observation_count: 2 }],
  changes: [],
  dailyMetrics: [],
  painEpisodes: [],
  openActions: [],
  ...over,
});
const keys = (i: RecommendInput) => buildRecommendations(i).map((c) => c.key);

test('a live insight on a cycle thread is offered watching, reflecting and the evidence', () => {
  const out = buildRecommendations(input());
  assert.deepEqual(
    out.map((c) => [c.key, c.type, c.threadId ?? c.insightId]),
    [
      ['observe:t1', 'observe', 't1'],
      ['reflect:i1', 'reflect', 'i1'],
      ['review:i1', 'review', 'i1'],
    ]
  );
  assert.equal(out[0].title, 'Watch your next cycle');
});

test('a thread already watched is offered continuing instead of watching', () => {
  const out = buildRecommendations(input({ threads: [{ id: 't1', key: 'cycle_length~sleep_hours', status: 'watching', observation_count: 2 }] }));
  assert.equal(out[0].key, 'continue:t1');
  assert.equal(out[0].title, 'Watching your next cycle');
});

test('a thread that is not about a cycle is watched in general words', () => {
  const out = buildRecommendations(input({ threads: [{ id: 't1', key: 'resting_hr~sleep_hours', status: 'new', observation_count: 2 }] }));
  assert.equal(out[0].title, 'Watch what happens next time');
});

test('seen three times, an appointment is worth preparing for', () => {
  assert.ok(!keys(input()).includes('prepare:t1'));
  const out = keys(input({ threads: [{ id: 't1', key: 'cycle_length~sleep_hours', status: 'recurring', observation_count: 3 }] }));
  assert.ok(out.includes('prepare:t1'));
});

test('an insight that has been replaced, dismissed or resolved offers nothing', () => {
  assert.deepEqual(keys(input({ insights: [{ id: 'i1', thread_id: 't1', status: 'new', valid_to: '2026-09-20T00:00:00Z' }] })), []);
  assert.deepEqual(keys(input({ insights: [{ id: 'i1', thread_id: 't1', status: 'dismissed', valid_to: null }] })), []);
  assert.deepEqual(keys(input({ insights: [{ id: 'i1', thread_id: 't1', status: 'resolved', valid_to: null }] })), []);
});

test('a walk is offered on a fresh drop in steps, grounded in that change', () => {
  const out = buildRecommendations(input({ insights: [], changes: [stepsDrop('c1', '2026-09-21')] }));
  assert.deepEqual(out.map((c) => [c.key, c.type, c.changeId]), [['try:walk:c1', 'try', 'c1']]);
  assert.equal(out[0].title, 'A short walk today');
  assert.ok(out[0].body.startsWith('Only if it feels appropriate.'));
});

test('the walk is not offered when the drop is old, energy is fine, pain is severe, or a walk is already planned', () => {
  const fresh = stepsDrop('c1', '2026-09-21');
  assert.deepEqual(keys(input({ insights: [], changes: [stepsDrop('c0', '2026-09-15')] })), [], 'an old drop');
  assert.deepEqual(
    keys(input({ insights: [], changes: [fresh], dailyMetrics: [{ day: '2026-09-20', steps: 3000, energy: 4 }, { day: '2026-09-21', steps: 3000, energy: 3 }] })),
    [],
    'energy fine'
  );
  assert.deepEqual(keys(input({ insights: [], changes: [fresh], painEpisodes: [{ occurred_on: '2026-09-21', severity: 8 }] })), [], 'severe pain');
  assert.deepEqual(keys(input({ insights: [], changes: [fresh], openActions: [{ kind: 'walk', started_on: TODAY }] })), [], 'already planned');
  assert.deepEqual(
    keys(input({ insights: [], changes: [fresh], dailyMetrics: [{ day: '2026-09-21', steps: 3000, energy: 2 }], painEpisodes: [{ occurred_on: '2026-09-18', severity: 9 }] })),
    ['try:walk:c1'],
    'low energy and old pain do not stop it'
  );
});

test('the newest drop grounds the walk when there are several', () => {
  const out = buildRecommendations(input({ insights: [], changes: [stepsDrop('c1', '2026-09-20'), stepsDrop('c2', '2026-09-22')] }));
  assert.equal(out[0].changeId, 'c2');
});

test('keys are stable and sorted, so a second run over the same record yields the same offers', () => {
  const a = keys(input({ changes: [stepsDrop('c1', '2026-09-22')] }));
  const b = keys(input({ changes: [stepsDrop('c1', '2026-09-22')] }));
  assert.deepEqual(a, b);
  assert.deepEqual(a, [...a].sort());
});

test('every title and body is clean', () => {
  for (const c of buildRecommendations(input({ changes: [stepsDrop('c1', '2026-09-22')], threads: [{ id: 't1', key: 'cycle_length~sleep_hours', status: 'recurring', observation_count: 4 }] }))) {
    for (const s of [c.title, c.body]) {
      assert.equal(offending(s), null, s);
      assert.ok(!COPY_DASH.test(s), s);
    }
  }
});
