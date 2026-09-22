import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COPY_DASH } from '../lib/displayCopy';
import { buildLearningEvents, type LearningInput, type ThreadCount } from '../../supabase/functions/intelligence/learning';
import { offending } from '../../supabase/functions/intelligence/wording';

const thread = (count: number, status = 'recurring'): ThreadCount => ({ id: 't1', key: 'cycle_length~sleep_hours', status, observation_count: count });
const input = (over: Partial<LearningInput> = {}): LearningInput => ({ before: [], after: [], insightsWritten: [], measured: [], reported: [], ...over });

test('a thread whose count rose yields one lesson, and the same counts again yield none', () => {
  const rose = buildLearningEvents(input({ before: [thread(2)], after: [thread(3)] }));
  assert.deepEqual(rose.map((e) => [e.key, e.type, e.threadId]), [['pattern_recurred:t1:3', 'pattern_recurred', 't1']]);
  assert.equal(rose[0].summary, 'The same combination came back: seen three times now.');
  assert.deepEqual(rose[0].evidence, { from: 2, to: 3, key: 'cycle_length~sleep_hours' });
  assert.deepEqual(buildLearningEvents(input({ before: [thread(3)], after: [thread(3)] })), []);
  assert.deepEqual(buildLearningEvents(input({ before: [], after: [thread(3)] })), [], 'a thread seen for the first time this run is not a recurrence lesson');
});

test('a thread that became resolved yields one lesson', () => {
  const out = buildLearningEvents(input({ before: [thread(3)], after: [thread(3, 'resolved')] }));
  assert.deepEqual(out.map((e) => e.key), ['pattern_resolved:t1']);
});

test('only an insight written as updated is a lesson', () => {
  const out = buildLearningEvents(
    input({ insightsWritten: [{ id: 'i1', thread_id: 't1', status: 'new' }, { id: 'i2', thread_id: 't1', status: 'updated' }, { id: 'i3', thread_id: 't1', status: 'continuing' }] })
  );
  assert.deepEqual(out.map((e) => e.key), ['insight_updated:i2']);
});

test('a measured outcome and a reported outcome are each a lesson, keyed so a report can change', () => {
  const out = buildLearningEvents(
    input({
      measured: [{ outcomeId: 'o1', actionId: 'a1', actionTitle: 'A short walk', threadId: null, metric: 'steps', measured: 'improved', ratio: 0.18 }],
      reported: [{ outcomeId: 'o1', actionId: 'a1', actionTitle: 'A short walk', threadId: null, reported: 'unchanged' }],
    })
  );
  assert.deepEqual(out.map((e) => e.key), ['outcome_measured:o1', 'outcome_reported:o1:unchanged']);
  assert.equal(out[0].summary, 'After a short walk, steps ran higher, about 18 percent, over the next three days.');
  assert.equal(out[1].summary, 'You said a short walk left things about the same.');
  assert.deepEqual([out[0].actionId, out[0].outcomeId], ['a1', 'o1']);
});

test('lessons come out sorted by key, and every summary is clean', () => {
  const out = buildLearningEvents(
    input({
      before: [thread(2)],
      after: [thread(3)],
      insightsWritten: [{ id: 'i2', thread_id: 't1', status: 'updated' }],
      measured: [{ outcomeId: 'o1', actionId: 'a1', actionTitle: 'An earlier bedtime', threadId: 't1', metric: null, measured: 'unknown', ratio: null }],
    })
  );
  assert.deepEqual(out.map((e) => e.key), [...out.map((e) => e.key)].sort());
  for (const e of out) {
    assert.equal(offending(e.summary), null, e.summary);
    assert.ok(!COPY_DASH.test(e.summary), e.summary);
  }
});
