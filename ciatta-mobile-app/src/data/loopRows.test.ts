import assert from 'node:assert/strict';
import { test } from 'node:test';

import { displayCopy } from '../lib/displayCopy';
import { interventionsFrom, type Since, sinceCopy, todayLoop, watchingFrom } from './loopRows';
import { sinceText } from '../../supabase/functions/intelligence/wording';

const raw = {
  last_visit_at: '2026-09-22T10:00:00+00:00',
  insight: {
    id: 'i1',
    title: 'Cycle length and lower sleep, seen twice across 1 month',
    status: 'new',
    since: 'new',
    thread_id: 't1',
    thread_key: 'cycle_length~sleep_hours',
    thread_status: 'watching',
    observation_count: 2,
    updated_at: '2026-09-22T09:00:00+00:00',
  },
  recommendations: [
    { id: 'r1', type: 'observe', title: 'Watch your next cycle', body: 'It will show here when your next cycle ends.', status: 'active', insight_id: null, thread_id: 't1', change_id: null },
  ],
  actions: [
    { id: 'a1', kind: 'walk', title: 'A short walk', intent: null, metric: 'steps', wanted: 'higher', started_on: '2026-09-20', status: 'ended', outcome: { reported: null, measured: 'improved', measured_evidence: {} } },
    { id: 'a2', kind: 'custom', title: 'An earlier bedtime', intent: 'Sleep', metric: 'sleep_hours', wanted: 'higher', started_on: '2026-09-21', status: 'active', outcome: null },
  ],
  learning: [{ id: 'l1', type: 'pattern_recurred', summary: 'The same combination came back: seen three times now.', occurred_at: '2026-09-22T08:00:00+00:00' }],
};

test('null or nonsense in gives null out', () => {
  assert.equal(todayLoop(null), null);
  assert.equal(todayLoop(undefined), null);
  assert.equal(todayLoop('no'), null);
});

test('a get_today document is projected with the columns renamed and unknowns kept null', () => {
  const loop = todayLoop(raw)!;
  assert.equal(loop.lastVisitAt, '2026-09-22T10:00:00+00:00');
  assert.deepEqual(loop.insight, {
    id: 'i1',
    title: 'Cycle length and lower sleep, seen twice across 1 month',
    status: 'new',
    since: 'new',
    threadId: 't1',
    threadKey: 'cycle_length~sleep_hours',
    threadStatus: 'watching',
    observationCount: 2,
  });
  assert.deepEqual(loop.recommendations[0], { id: 'r1', type: 'observe', title: 'Watch your next cycle', body: 'It will show here when your next cycle ends.', status: 'active', insightId: null, threadId: 't1', changeId: null });
  assert.deepEqual(loop.actions[0].outcome, { reported: null, measured: 'improved' });
  assert.equal(loop.actions[1].outcome, null);
  assert.equal(loop.actions[1].intent, 'Sleep');
  assert.deepEqual(loop.learning[0], { id: 'l1', type: 'pattern_recurred', summary: 'The same combination came back: seen three times now.', occurredAt: '2026-09-22T08:00:00+00:00' });
});

test('an empty today has no insight and empty lists', () => {
  const loop = todayLoop({ last_visit_at: null, insight: null, recommendations: [], actions: [], learning: [] })!;
  assert.equal(loop.insight, null);
  assert.deepEqual([loop.recommendations, loop.actions, loop.learning], [[], [], []]);
  assert.deepEqual(watchingFrom(loop), {});
  assert.deepEqual(watchingFrom(null), {});
});

test('the five since lines match the server wording and pass displayCopy unchanged', () => {
  const states: Since[] = ['new', 'updated', 'continuing', 'resolved', 'unchanged'];
  for (const s of states) {
    assert.equal(sinceCopy(s), sinceText(s));
    assert.equal(displayCopy(sinceCopy(s)), sinceCopy(s));
  }
});

test('her walks become the interventions the engine reads, and the thread status becomes the watch flag', () => {
  const loop = todayLoop(raw)!;
  assert.deepEqual(interventionsFrom(loop.actions), [{ id: 'a1', kind: 'walk', date: '2026-09-20' }]);
  assert.deepEqual(watchingFrom(loop), { nextCycle: true });
  assert.deepEqual(watchingFrom({ ...loop, insight: { ...loop.insight!, threadStatus: 'recurring' } }), { nextCycle: false });
});
