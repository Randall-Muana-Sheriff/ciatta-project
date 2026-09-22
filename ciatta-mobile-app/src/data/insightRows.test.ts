import assert from 'node:assert/strict';
import { test } from 'node:test';

import { displayCopy } from '../lib/displayCopy';
import { type EvidenceRow, type InsightRow, insightView, NO_RESEARCH, type ObservationRef } from './insightRows';

const sleepObs: ObservationRef = { metric: 'sleep_hours', domain: 'sleep', value: '6.2', value_text: null, unit: 'hours', occurred_at: '2026-09-19T07:00:00+00:00' };
const periodObs: ObservationRef = { metric: 'period_start', domain: 'cycle', value: null, value_text: '2026-09-20', unit: null, occurred_at: '2026-09-20T09:00:00+00:00' };
const noteObs: ObservationRef = { metric: 'note', domain: 'context', value: null, value_text: 'Slept badly all week, work deadline', unit: null, occurred_at: '2026-09-17T21:00:00+00:00' };

const empty = { note: null, observations: null, changes: null, temporal_links: null, research_refs: null };
const link: EvidenceRow = { ...empty, role: 'supports', note: 'occurrence', temporal_links: { occurred_on: '2026-09-20', a: sleepObs, b: periodObs } };
const finding: EvidenceRow = { ...empty, role: 'supports', note: 'finding', changes: { metric: 'sleep_hours', direction: 'lower', from_value: '7.3', to_value: '6.2', detected_on: '2026-09-19' } };
const told: EvidenceRow = { ...empty, role: 'user_reported', note: 'context', observations: noteObs };

const row = (over: Partial<InsightRow> = {}): InsightRow => ({
  id: 'i1',
  thread_id: 't1',
  title: 'Cycle length and lower sleep, seen twice across 1 month',
  what_changed: 'Sleep ran lower than usual: 6.2 hours against your usual 7.3 hours from the last 90 days, as of 19 September.',
  connected: 'A period start followed lower sleep within the week before it on 25 August and 20 September. Seen twice across 1 month.',
  you_told: 'You noted “Slept badly all week, work deadline” on 17 September.',
  not_established: 'Things that happen near each other do not show that one brought on the other, or which came first.\nWhether this comes back again is not known yet.',
  alternatives: ['A busy or stressful stretch can move several of these at once.'],
  status: 'new',
  confidence: { recurrence: 2, occurrences: 2, missing: [] },
  valid_from: '2026-09-22T10:22:41+00:00',
  updated_at: '2026-09-22T10:22:41+00:00',
  threads: {
    key: 'cycle_length~sleep_hours',
    title: 'Cycle length and sleep',
    status: 'new',
    domains: ['cycle', 'sleep'],
    observation_count: 2,
    first_observed_at: '2026-08-25T00:00:00+00:00',
    last_observed_at: '2026-09-20T00:00:00+00:00',
    confidence: { recurrence: 2, occurrences: 2, missing: [] },
  },
  ...over,
});

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

test('null in gives null out', () => {
  assert.equal(insightView(null), null);
  assert.equal(insightView(null, [link]), null);
});

test('the headline is the stored title and the meta counts the thread', () => {
  const view = insightView(row(), [link, finding])!;
  assert.equal(view.headline, 'Cycle length and lower sleep, seen twice across 1 month');
  assert.equal(view.meta, 'Seen twice · across 1 month · updated 22 Sep');
});

test('two supports rows give two basedOn entries in date order, each pointing at a screen', () => {
  const view = insightView(row(), [link, finding])!;
  assert.deepEqual(view.basedOn, [
    { label: 'Sleep', sub: 'Lower than usual · 19 Sep', value: '6.2 hours', screen: 'sleep' },
    { label: 'Period start after sleep', sub: '20 Sep · 19 Sep', value: '6.2 hours', screen: 'cycle' },
  ]);
});

test('what she reported sits among the sources too, quoted and dated, with no value', () => {
  const view = insightView(row(), [link, finding, told])!;
  assert.equal(view.basedOn.length, 3);
  assert.deepEqual(view.basedOn[0], { label: '“Slept badly all week, work deadline”', sub: '17 Sep', value: '', screen: 'journal' });
});

test('with no research_context evidence the evidence box carries the fixed line', () => {
  const view = insightView(row(), [link, finding])!;
  assert.deepEqual(view.evidence, NO_RESEARCH);
  assert.equal(view.evidence.claim, 'No published research is attached to this yet.');
});

test('a research ref, when one is attached, is worded as about a cohort and never about her', () => {
  const ref: EvidenceRow = {
    ...empty,
    role: 'research_context',
    research_refs: { title: 'Sleep and cycle variability', publication: 'A journal', year: 2019, summary: 'Shorter sleep was associated with cycle variability in a cohort.' },
  };
  const view = insightView(row(), [link, finding, ref])!;
  assert.equal(view.evidence.claim, 'Shorter sleep was associated with cycle variability in a cohort.');
  assert.equal(view.evidence.meta, 'A journal · published 2019 · not about you');
  assert.equal(view.basedOn.length, 2, 'a research ref is not one of her sources');
});

test('stillOpen is not_established, its lines joined, and method always has four rows', () => {
  const view = insightView(row(), [link, finding])!;
  assert.equal(
    view.stillOpen,
    'Things that happen near each other do not show that one brought on the other, or which came first. Whether this comes back again is not known yet.'
  );
  assert.deepEqual(
    view.method.map((m) => m.label),
    ['Looked at', 'Pattern', 'Times seen', 'What is missing']
  );
  assert.deepEqual(view.method, [
    { label: 'Looked at', value: 'Cycle and sleep over the last 180 days' },
    { label: 'Pattern', value: 'Cycle length and sleep' },
    { label: 'Times seen', value: 'Twice' },
    { label: 'What is missing', value: 'Nothing named yet' },
  ]);

  const missing = insightView(
    row({ threads: { ...row().threads!, observation_count: 3, confidence: { missing: ['no_change_row', 'no_context'] } } }),
    []
  )!;
  assert.equal(missing.method.length, 4);
  assert.equal(missing.method[2].value, 'Three times');
  assert.equal(missing.method[3].value, 'A sustained change on either side and anything you noted around those days');
});

test('every string in the view passes displayCopy unchanged: no dashes anywhere', () => {
  for (const view of [insightView(row(), [link, finding, told])!, insightView(row(), [])!]) {
    for (const s of strings(view)) assert.equal(displayCopy(s), s.trim(), s);
  }
});

test('a thread the row somehow lacks still renders, from the row alone', () => {
  const view = insightView(row({ threads: null }), [])!;
  assert.equal(view.meta, 'Seen no times · across 1 month · updated 22 Sep');
  assert.equal(view.method[0].value, 'Her record over the last 180 days');
  assert.equal(view.method[1].value, row().title);
});
