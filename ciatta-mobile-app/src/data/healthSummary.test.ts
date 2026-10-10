import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkSummary,
  FORBIDDEN,
  groundedNumbers,
  summaryPrompt,
  type SummaryFacts,
} from '../../supabase/functions/health-summary/summary';

function facts(over: Partial<SummaryFacts> = {}): SummaryFacts {
  return {
    name: 'Jenny',
    ageRange: '35 to 44',
    lifeStage: 'Cycles are irregular',
    opening: 'My cycles got shorter and I am tired all the time.',
    intents: ['your cycle'],
    conditions: ['Endometriosis'],
    surgeries: [],
    medications: ['Levothyroxine'],
    supplements: [],
    symptoms: ['Fatigue'],
    goals: [],
    readings: [{ label: 'Steps', value: '8,432', on: '2026-10-09' }],
    observationCount: 5017,
    daysOfHistory: 12,
    ...over,
  };
}

// ── The gate is the same gate ────────────────────────────────────────

test('a model summary is held to the same forbidden words as a written sentence', () => {
  // wording.ts refuses these in the deterministic sentences. A model that
  // writes them must be refused too, or the rule only applies to the code
  // that was never going to break it.
  assert.ok(FORBIDDEN.length > 0);
  for (const word of ['caused', 'diagnos', 'you have']) {
    const bad = checkSummary(`Your fatigue was ${word} by something.`, facts());
    assert.ok(bad.some((r) => r.reason === 'forbidden_word'), `"${word}" passed the gate`);
  }
});

// ── Numbers ──────────────────────────────────────────────────────────

test('every number in the summary must come from her record', () => {
  // The failure this exists for: a model totalling, rounding or inventing a
  // figure and it reading as a measurement she produced.
  const bad = checkSummary('You averaged 9,200 steps over the week.', facts());
  assert.ok(bad.some((r) => r.reason === 'invented_number' && r.detail === '9,200'));
});

test('numbers that are in her record pass, formatted either way', () => {
  const ok = checkSummary('Your most recent step count was 8,432 on 2026-10-09.', facts());
  assert.deepEqual(ok, [], `rejected a grounded number: ${JSON.stringify(ok)}`);
});

test('the grounded set is built from the facts, not written down', () => {
  const n = groundedNumbers(facts({ readings: [{ label: 'Sleep time', value: '7h 21m', on: '2026-10-08' }] }));
  assert.ok(n.has('7'), 'a reading value was not grounded');
  assert.ok(n.has('21'));
  assert.ok(n.has('5017'), 'the observation count was not grounded');
  assert.ok(!n.has('9200'));
});

// ── Terms she never gave ─────────────────────────────────────────────

test('a condition she never named is refused', () => {
  // The most dangerous output this file stops. A model pattern matching
  // irregular cycles to PCOS would be writing a diagnosis into her record.
  const bad = checkSummary('This pattern is common with PCOS.', facts());
  assert.ok(bad.some((r) => r.reason === 'ungrounded_term' && r.detail === 'pcos'));
});

test('a condition she did name may be repeated back', () => {
  const ok = checkSummary('You told Ciatta about endometriosis and that you take levothyroxine.', facts());
  assert.deepEqual(ok, [], `rejected her own words: ${JSON.stringify(ok)}`);
});

test('a medication she never named is refused even when the sentence is cautious', () => {
  const bad = checkSummary('Some women in this position are prescribed metformin.', facts());
  assert.ok(bad.some((r) => r.reason === 'ungrounded_term' && r.detail === 'metformin'));
});

// ── Shape ────────────────────────────────────────────────────────────

test('an empty answer is a rejection, not an empty summary', () => {
  assert.deepEqual(checkSummary('   ', facts()).map((r) => r.reason), ['empty']);
});

test('dashes are refused, because a model writes them every time', () => {
  assert.ok(checkSummary('You are tired — and that is recorded.', facts()).some((r) => r.reason === 'dash'));
});

test('a summary that runs long is refused', () => {
  assert.ok(checkSummary('word '.repeat(300), facts()).some((r) => r.reason === 'too_long'));
});

test('every reason is reported, not just the first', () => {
  // A prompt going wrong should be visible going wrong.
  const bad = checkSummary('PCOS was caused by 9,200 steps.', facts());
  const reasons = new Set(bad.map((r) => r.reason));
  assert.ok(reasons.has('forbidden_word'));
  assert.ok(reasons.has('ungrounded_term'));
  assert.ok(reasons.has('invented_number'));
});

// ── The prompt ───────────────────────────────────────────────────────

test('the prompt carries her facts and no others', () => {
  const { user } = summaryPrompt(facts());
  assert.ok(user.includes('Endometriosis'));
  assert.ok(user.includes('8,432'));
  assert.ok(user.includes('5017'));
});

test('the prompt warns about the phrase the checker takes literally', () => {
  // "you have" is refused outright, which also refuses "you have not". The
  // model will write that innocently unless it is told, and a checker that
  // keeps rejecting good answers gets switched off.
  assert.ok(/Never write the words "you have"/.test(summaryPrompt(facts()).system));
});

test('the prompt forbids the things the checker refuses', () => {
  // Belt and braces on purpose: the instruction keeps good answers cheap,
  // the checker is what makes bad answers impossible.
  const { system } = summaryPrompt(facts());
  for (const rule of ['Never diagnose', 'Never say one thing caused', 'Never state a number that is not in the facts']) {
    assert.ok(system.includes(rule), `the prompt does not say: ${rule}`);
  }
});

test('a thin record is a valid summary rather than an error', () => {
  // A woman who skipped everything still gets a paragraph, and the model is
  // told that saying so is the right answer.
  const { system } = summaryPrompt(facts({ conditions: [], medications: [], symptoms: [], readings: [], observationCount: 0 }));
  assert.ok(/thin/.test(system));
  const ok = checkSummary('Ciatta has very little yet. No source is connected and nothing has been logged.', facts({ observationCount: 0 }));
  assert.deepEqual(ok, [], `rejected an honest thin summary: ${JSON.stringify(ok)}`);
});
