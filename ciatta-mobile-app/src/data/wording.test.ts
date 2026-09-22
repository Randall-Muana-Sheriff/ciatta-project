// wordInsight lives beside the intelligence edge function but is plain
// TypeScript, so this suite exercises it under node:test, as threads.test.ts
// does for the builder. The first test is the one that matters: every
// sentence any frame can produce is checked against the forbidden list.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COPY_DASH } from '../lib/displayCopy';
import type { ChangeRow, ThreadCandidate } from '../../supabase/functions/intelligence/threads';
import {
  contextEntry,
  FORBIDDEN,
  learningText,
  NOTHING_NOTED,
  offending,
  recommendationText,
  sinceText,
  wordInsight,
  type LearningEvent,
  type RecommendationKind,
  type SinceState,
  type ContextEntry,
  type InsightText,
  type WordingFacts,
} from '../../supabase/functions/intelligence/wording';

const occ = (at: string, a: string, b: string, linkId: string) => ({ at, aObservationId: a, bObservationId: b, linkId });

const candidate = (over: Partial<ThreadCandidate> = {}): ThreadCandidate => ({
  key: 'cycle_length~sleep_hours',
  title: 'Cycle length and sleep',
  domains: ['cycle', 'sleep'],
  occurrences: [occ('2026-01-30', 's1', 'p2', 'l1'), occ('2026-02-27', 's2', 'p3', 'l2')],
  recurrence: 2,
  firstObservedAt: '2026-01-30',
  lastObservedAt: '2026-02-27',
  evidence: [
    { role: 'supports', linkId: 'l1' },
    { role: 'supports', linkId: 'l2' },
    { role: 'supports', changeId: 'c1' },
  ],
  missing: ['no_context'],
  ...over,
});

const change = (id: string, metric: string, detectedOn: string, from: number, to: number, direction: 'lower' | 'higher' = 'lower'): ChangeRow => ({
  id,
  metric,
  direction,
  detected_on: detectedOn,
  deviation: -1.2,
  quality: 'ok',
  from_value: from,
  to_value: to,
  window_days: 14,
});

const facts = (over: Partial<WordingFacts> = {}): WordingFacts => ({
  changes: [change('c1', 'sleep_hours', '2026-01-29', 7.1, 5.4)],
  context: [],
  ...over,
});

const context: ContextEntry[] = [
  { on: '2026-01-27', metric: 'note', text: 'rough week' },
  { on: '2026-02-24', metric: 'symptom', text: 'Headache' },
];

// Every shape a sentence can take, so the forbidden list is checked against
// all of them and not only the happy path.
const FIXTURES: [string, ThreadCandidate, WordingFacts][] = [
  ['cycle pair, one change, no context', candidate(), facts()],
  ['cycle pair with context', candidate({ missing: [] }), facts({ context })],
  ['nothing missing at all', candidate({ missing: [] }), facts()],
  ['everything missing', candidate({ missing: ['no_change_row', 'single_source', 'no_context'], evidence: [] }), facts({ changes: [] })],
  [
    'two measured sides, both changed, seen three times',
    candidate({
      key: 'resting_hr~sleep_hours',
      occurrences: [occ('2026-03-02', 'h1', 's1', 'm1'), occ('2026-03-21', 's2', 'h2', 'm2'), occ('2026-04-11', 'h3', 's3', 'm3')],
      recurrence: 3,
      firstObservedAt: '2026-03-02',
      lastObservedAt: '2026-04-11',
      evidence: [{ role: 'supports', changeId: 'c1' }, { role: 'supports', changeId: 'c2' }],
      missing: ['single_source'],
    }),
    facts({ changes: [change('c1', 'sleep_hours', '2026-03-01', 7.1, 5.4), change('c2', 'resting_hr', '2026-03-02', 58, 64, 'higher')] }),
  ],
  [
    'a symptom side across two years with many occurrences and a long note',
    candidate({
      key: 'sleep_hours~symptom:headache',
      occurrences: ['2025-11-03', '2025-12-01', '2026-01-05', '2026-02-02', '2026-03-02'].map((d, i) => occ(d, `a${i}`, `s${i}`, `k${i}`)),
      recurrence: 5,
      firstObservedAt: '2025-11-03',
      lastObservedAt: '2026-03-02',
      missing: [],
    }),
    facts({
      context: [
        { on: '2025-11-01', metric: 'note', text: 'A very long note about a week that went on and on, with travel and late nights and a deadline that would not move at all.' },
        { on: '2025-12-01', metric: 'symptom', text: 'Headache' },
        { on: '2026-01-04', metric: 'pain_episode', text: 'pain' },
        { on: '2026-02-01', metric: 'note', text: 'tired' },
      ],
    }),
  ],
];

const sentencesOf = (t: InsightText): string[] => [t.title, t.meta, t.whatChanged, t.connected, t.youTold, ...t.notEstablished, ...t.alternatives];

test('no sentence any frame produces contains a forbidden word, a dash, or the product name', () => {
  for (const [name, c, f] of FIXTURES) {
    for (const s of sentencesOf(wordInsight(c, f))) {
      assert.equal(offending(s), null, `${name}: "${s}"`);
      assert.ok(!COPY_DASH.test(s), `${name} has a dash: "${s}"`);
      assert.ok(!/ciatta/i.test(s), `${name} names the product: "${s}"`);
      assert.ok(s.trim().length > 0, `${name} produced an empty sentence`);
    }
  }
});

test('offending finds the forbidden word case insensitively, and clears a clean sentence', () => {
  // 'because' carries 'cause' inside it, and the list is checked in order,
  // so the shorter word is the one reported; either way the sentence fails.
  assert.equal(offending('This happened Because of that'), 'cause');
  assert.equal(offending('It looks like you HAVE a thing'), 'you have');
  assert.equal(offending('A risk of something'), 'risk of');
  assert.equal(offending('Sleep ran lower than usual.'), null);
  assert.ok(FORBIDDEN.includes('diagnos'));
});

test('notEstablished is never empty, even when nothing is missing', () => {
  for (const [name, c, f] of FIXTURES) {
    const t = wordInsight(c, f);
    assert.ok(t.notEstablished.length >= 1, name);
    assert.ok(t.notEstablished[0].includes('do not show that one brought on the other'), name);
  }
  const clean = wordInsight(candidate({ missing: [] }), facts());
  assert.equal(clean.notEstablished.length, 2);
});

test('each missing item is named in words', () => {
  const t = wordInsight(candidate({ missing: ['no_change_row', 'single_source', 'no_context'], evidence: [] }), facts({ changes: [] }));
  assert.equal(t.notEstablished.length, 4);
  assert.ok(t.notEstablished.some((l) => l.includes('no finding behind this yet')));
  assert.ok(t.notEstablished.some((l) => l.includes('one source')));
  assert.ok(t.notEstablished.some((l) => l.includes('Nothing you noted')));
  assert.ok(t.alternatives.some((l) => l.includes('device')));
  assert.equal(t.whatChanged, 'No sustained change was detected on either side around these days.');
});

test('with no context entries, youTold is the fixed sentence rather than blank', () => {
  assert.equal(wordInsight(candidate(), facts()).youTold, NOTHING_NOTED);
  assert.equal(NOTHING_NOTED, 'You did not note anything around these days.');
});

test('youTold quotes a note, lowercases a symptom, and dates each', () => {
  const t = wordInsight(candidate({ missing: [] }), facts({ context }));
  assert.equal(t.youTold, 'You noted “rough week” on 27 January and headache on 24 February.');
});

test('youTold shows three entries and counts the rest, and shortens a long note', () => {
  const [, c, f] = FIXTURES[5];
  const t = wordInsight(c, f);
  assert.ok(t.youTold.endsWith(', and 1 more.'), t.youTold);
  assert.ok(t.youTold.includes('…”'), t.youTold);
  assert.ok(t.youTold.includes('on 1 November 2025'), 'years are shown when the entries span two');
});

test('seen twice across 7 months', () => {
  const t = wordInsight(
    candidate({ occurrences: [occ('2026-01-30', 's1', 'p2', 'l1'), occ('2026-08-30', 's2', 'p3', 'l2')], firstObservedAt: '2026-01-30', lastObservedAt: '2026-08-30' }),
    facts()
  );
  assert.equal(t.meta, 'Seen twice across 7 months');
  assert.ok(t.title.endsWith(', seen twice across 7 months'), t.title);
});

test('counts of times are words, as the engine writes them: three times, not 3 times', () => {
  const [, c, f] = FIXTURES[4];
  const t = wordInsight(c, f);
  assert.equal(t.meta, 'Seen three times across 1 month');
  assert.ok(!/\b3 times\b/.test(t.connected));
});

test('whatChanged says the direction, the two values with units, the span the usual came from, and the day', () => {
  const t = wordInsight(candidate(), facts());
  assert.equal(t.whatChanged, 'Sleep ran lower than usual: 5.4 hours against your usual 7.1 hours from the last 14 days, as of 29 January.');
});

test('a cycle pair is worded with followed, and a measured pair with alongside', () => {
  const cycle = wordInsight(candidate(), facts());
  assert.equal(
    cycle.connected,
    'A period start followed lower sleep within the week before it on 30 January and 27 February. Seen twice across 1 month.'
  );
  assert.equal(cycle.title, 'Cycle length and lower sleep, seen twice across 1 month');

  const [, c, f] = FIXTURES[4];
  const pair = wordInsight(c, f);
  assert.equal(
    pair.connected,
    'Higher resting heart rate and lower sleep occurred alongside each other on 2 March, 21 March and 11 April. Seen three times across 1 month.'
  );
  assert.equal(
    pair.whatChanged,
    'Resting heart rate ran higher than usual: 64 beats a minute against your usual 58 beats a minute from the last 14 days, as of 2 March. Sleep ran lower than usual: 5.4 hours against your usual 7.1 hours from the last 14 days, as of 1 March.'
  );
});

test('many occurrences across two years list three dates with years and count the rest', () => {
  const [, c, f] = FIXTURES[5];
  const t = wordInsight(c, f);
  assert.ok(t.connected.includes('on 3 November 2025, 1 December 2025, 5 January 2026 and 2 more days.'), t.connected);
  assert.equal(t.meta, 'Seen five times across 4 months');
  assert.equal(t.title, 'Lower sleep and headache, seen five times across 4 months');
});

test('a change the candidate does not cite is not worded, even if it is in the window', () => {
  const t = wordInsight(
    candidate({ evidence: [{ role: 'supports', linkId: 'l1' }], missing: ['no_change_row', 'no_context'] }),
    facts({ changes: [change('c9', 'sleep_hours', '2025-10-01', 7.1, 5.4)] })
  );
  assert.equal(t.whatChanged, 'No sustained change was detected on either side around these days.');
  assert.equal(t.title, 'Cycle length and sleep, seen twice across 1 month');
});

test('contextEntry turns what she reported into words, and nothing else', () => {
  const base = { id: 'o', domain: 'x', value: null, value_text: null, occurred_at: '2026-01-27T20:00:00.000Z', source_id: 'you', provenance: 'REPORTED', origin_id: 'e' };
  assert.deepEqual(contextEntry({ ...base, metric: 'note', value_text: ' rough week ' }), { on: '2026-01-27', metric: 'note', text: 'rough week' });
  assert.deepEqual(contextEntry({ ...base, metric: 'symptom', value_text: 'Headache' }), { on: '2026-01-27', metric: 'symptom', text: 'Headache' });
  assert.deepEqual(contextEntry({ ...base, metric: 'pain_episode', value_text: 'Pelvis, lower back' }), { on: '2026-01-27', metric: 'pain_episode', text: 'pain in your pelvis, lower back' });
  assert.deepEqual(contextEntry({ ...base, metric: 'pain_episode', value_text: 'Reported' }), { on: '2026-01-27', metric: 'pain_episode', text: 'pain' });
  assert.deepEqual(contextEntry({ ...base, metric: 'flow', value_text: 'Heavy' }), { on: '2026-01-27', metric: 'flow', text: 'heavy flow' });
  assert.deepEqual(contextEntry({ ...base, metric: 'period_start', value_text: '2026-01-27' }), { on: '2026-01-27', metric: 'period_start', text: 'a period start' });
  assert.equal(contextEntry({ ...base, metric: 'note', value_text: '   ' }), null);
  assert.equal(contextEntry({ ...base, metric: 'sleep_hours', value: 5.4, provenance: 'MEASURED' }), null);
  for (const e of [
    contextEntry({ ...base, metric: 'pain_episode', value_text: 'Pelvis' })!,
    contextEntry({ ...base, metric: 'flow', value_text: 'Light' })!,
  ]) {
    assert.equal(offending(e.text), null);
  }
});

const KINDS: RecommendationKind[] = ['observe', 'log', 'reflect', 'try', 'review', 'prepare', 'explore', 'discuss', 'connect', 'continue', 'no_action_yet'];
const SINCE: SinceState[] = ['new', 'updated', 'continuing', 'resolved', 'unchanged'];
const LESSONS: LearningEvent[] = [
  { type: 'pattern_recurred', count: 3 },
  { type: 'pattern_resolved' },
  { type: 'insight_updated' },
  { type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'improved', ratio: 0.18 },
  { type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'worse', ratio: -0.25 },
  { type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'unchanged', ratio: 0.02 },
  { type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'insufficient_evidence', ratio: null },
  { type: 'outcome_measured', action: 'An earlier bedtime', metric: null, measured: 'unknown', ratio: null },
  { type: 'outcome_reported', action: 'A short walk', reported: 'improved' },
  { type: 'outcome_reported', action: 'An earlier bedtime', reported: 'insufficient_evidence' },
];

test('every offer, lesson and since line is clean: no forbidden word, no dash, no product name', () => {
  const all: string[] = [];
  for (const k of KINDS) {
    for (const ctx of [{}, { cycle: true }, { kind: 'walk' as const }, { cycle: true, kind: 'custom' as const }]) {
      const t = recommendationText(k, ctx);
      all.push(t.title, t.body);
    }
  }
  for (const l of LESSONS) all.push(learningText(l));
  for (const s of SINCE) all.push(sinceText(s));
  for (const s of all) {
    assert.ok(s.trim().length > 0, 'nothing is blank');
    assert.equal(offending(s), null, s);
    assert.ok(!COPY_DASH.test(s), `dash in: ${s}`);
    assert.ok(!/ciatta/i.test(s), s);
  }
});

test('an offer to watch names the cycle when the thread is about one, and a try carries its condition', () => {
  assert.deepEqual(recommendationText('observe', { cycle: true }), { title: 'Watch your next cycle', body: 'It will show here when your next cycle ends.' });
  assert.equal(recommendationText('observe').title, 'Watch what happens next time');
  assert.equal(recommendationText('continue', { cycle: true }).title, 'Watching your next cycle');
  assert.equal(recommendationText('try', { kind: 'walk' }).title, 'A short walk today');
  assert.ok(recommendationText('try', { kind: 'walk' }).body.startsWith('Only if it feels appropriate.'));
  assert.ok(recommendationText('try').body.startsWith('Only if it feels appropriate.'));
  assert.equal(recommendationText('no_action_yet').title, 'Nothing to do yet');
});

test('a lesson says what was seen or measured, and never that the action did it', () => {
  assert.equal(learningText({ type: 'pattern_recurred', count: 3 }), 'The same combination came back: seen three times now.');
  assert.equal(learningText({ type: 'pattern_recurred', count: 2 }), 'The same combination came back: seen twice now.');
  assert.equal(
    learningText({ type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'improved', ratio: 0.18 }),
    'After a short walk, steps ran higher, about 18 percent, over the next three days.'
  );
  assert.equal(
    learningText({ type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'worse', ratio: -0.25 }),
    'After a short walk, steps ran lower, about 25 percent, over the next three days.'
  );
  assert.equal(
    learningText({ type: 'outcome_measured', action: 'A short walk', metric: 'steps', measured: 'insufficient_evidence', ratio: null }),
    'After a short walk, there were not enough readings in the days around it to say.'
  );
  assert.equal(
    learningText({ type: 'outcome_measured', action: 'An earlier bedtime', metric: null, measured: 'unknown', ratio: null }),
    'After an earlier bedtime, no measure was named, so nothing was measured.'
  );
  assert.equal(learningText({ type: 'outcome_reported', action: 'A short walk', reported: 'improved' }), 'You said a short walk left things better.');
  assert.equal(learningText({ type: 'outcome_reported', action: 'A short walk', reported: 'insufficient_evidence' }), 'You said a short walk left things hard to tell.');
});

test('the five since lines', () => {
  assert.deepEqual(SINCE.map(sinceText), [
    'New since your last visit',
    'Updated since your last visit',
    'Seen again since your last visit',
    'Resolved since your last visit',
    'No meaningful change since your last visit',
  ]);
});
