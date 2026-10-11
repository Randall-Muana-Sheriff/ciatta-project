import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  answerAsk,
  answerContext,
  answerDecline,
  answerEscalate,
  answerNavigate,
  answerPattern,
  answerRecord,
  type Record as AgentRecord,
  respond,
} from './capabilities';
import { checkAnswer, FORBIDDEN, groundedNumbers, wordOrFallback } from './check';
import { classify, redFlagsIn } from './classify';
import type { Answer } from './types';

const bare: AgentRecord = {
  name: 'Jenny',
  today: null,
  days: [],
  episodes: [],
  conditions: [],
  medications: [],
  insights: [],
  references: [],
  cycleDay: null,
  cyclePhase: null,
};

const episode = (over: Partial<import('../../data/cycleLog').Episode>) =>
  ({
    id: 'e', loggedAt: '', date: '2026-10-01', kinds: ['Pain'], periodStart: null, periodEnd: null, flow: null,
    allDay: false, start: null, end: null, states: [], pattern: null, locations: [], sensations: [], severity: null,
    affect: [], trajectory: [], changes: [], dayImpact: [], symptoms: [], context: [], triggers: [],
    flareUpUserReported: null, helped: [], helpedAmount: null, note: '', noteContext: [], stool: null,
    bowelPain: null, bowelFlags: [], similar: false, attachments: [], ...over,
  }) as import('../../data/cycleLog').Episode;

// ── Classification ───────────────────────────────────────────────────

test('a red flag routes to escalate whatever else the message mentions', () => {
  assert.equal(classify('I fainted and also how did I sleep'), 'escalate');
  assert.equal(classify('the worst pain of my life'), 'escalate');
});

test('questions route to the capability that can answer them', () => {
  assert.equal(classify('how did I sleep last night'), 'record');
  assert.equal(classify('what should I ask my doctor'), 'ask');
  assert.equal(classify('has anything changed'), 'pattern');
  assert.equal(classify('is this covered by insurance'), 'navigate');
  assert.equal(classify('help me prepare for my appointment'), 'prepare');
});

test('anything unrecognised declines rather than guessing a capability', () => {
  assert.equal(classify('what should I eat for dinner'), 'decline');
  assert.equal(classify(''), 'decline');
  assert.equal(classify('hello'), 'decline');
});

test('the red flags are named, so escalate can say what it matched', () => {
  assert.deepEqual(redFlagsIn('I fainted'), ['fainted']);
});

// ── Capabilities abstain rather than improvise ───────────────────────

test('an empty record abstains everywhere rather than inventing an answer', () => {
  for (const a of [answerRecord(bare), answerPattern(bare), answerAsk(bare)]) {
    assert.equal(a.abstained, 'no_data', `${a.capability} should abstain`);
  }
});

test('no pattern is explained by time passing, not by anything about her', () => {
  const text = answerPattern(bare).text.toLowerCase();
  assert.ok(text.includes('more than once'));
  assert.ok(!text.includes('healthy') && !text.includes('normal') && !text.includes('fine'));
});

test('context abstains with no reviewed references, and says it will not', () => {
  const a = answerContext(bare);
  assert.equal(a.abstained, 'no_citations');
  assert.ok(a.text.includes('cannot cite'));
});

test('context cites a reference about what she is managing, and marks it not about her', () => {
  const a = answerContext({
    ...bare,
    conditions: ['Endometriosis'],
    references: [
      { id: 'r1', title: 'A paper', publication: 'A journal', year: 2024, summary: 'Something general.', domains: ['endometriosis'] },
    ],
  });
  assert.equal(a.abstained, undefined);
  assert.equal(a.facts[0].refId, 'r1');
  assert.equal(a.facts[0].from, 'reference');
  assert.ok(a.text.includes('not a statement about you'));
});

// ── What capabilities may never produce ──────────────────────────────

test('no capability produces a forbidden word, a diagnosis or an instruction', () => {
  const full: AgentRecord = {
    ...bare,
    conditions: ['Endometriosis'],
    medications: ['Naproxen'],
    episodes: [episode({ severity: 8 }), episode({ flareUpUserReported: true })],
    insights: [{ title: 'Sleep and cycle', whatChanged: 'Sleep fell in the week before three periods.', notEstablished: ['One does not explain the other.'] }],
    references: [{ id: 'r1', title: 'T', publication: null, year: null, summary: 'General.', domains: ['endometriosis'] }],
  };
  for (const r of [bare, full]) {
    for (const cap of ['record', 'pattern', 'prepare', 'ask', 'navigate', 'escalate', 'context', 'decline'] as const) {
      const a = respond('tell me', r, cap);
      const lower = a.text.toLowerCase();
      for (const w of FORBIDDEN) {
        // "condition" survives only inside the word she used herself, which
        // no capability writes. Nothing here should contain any of them.
        assert.ok(!lower.includes(w), `${cap} said "${w}": ${a.text}`);
      }
      assert.ok(!/[—–]/.test(a.text), `${cap} used a dash`);
      assert.ok(a.text.trim().length > 0, `${cap} said nothing`);
    }
  }
});

test('ask phrases everything as a question for her, never as a finding', () => {
  const a = answerAsk({ ...bare, conditions: ['Endometriosis'], episodes: [episode({ severity: 9 })] });
  assert.ok(a.text.includes('Ask '));
  for (const claim of ['is concerning', 'is abnormal', 'is too', 'you need']) {
    assert.ok(!a.text.toLowerCase().includes(claim), a.text);
  }
});

test('navigate prepares and says plainly that it does not act', () => {
  const a = answerNavigate({ ...bare, conditions: ['PCOS'] });
  assert.ok(a.text.includes('does not contact anyone on your behalf'));
  for (const s of a.suggestions) assert.ok(s.screen || s.tab, 'every suggestion opens a screen');
});

test('escalate refuses to assess and points at real care', () => {
  const a = answerEscalate('I fainted', bare);
  assert.ok(a.text.includes('not able to assess'));
  assert.ok(a.text.toLowerCase().includes('emergency'));
  assert.equal(a.facts[0].value, 'fainted');
});

test('decline says what it cannot do and what it can', () => {
  const a = answerDecline();
  assert.equal(a.abstained, 'out_of_scope');
  // Stated without using any of the forbidden substrings, which the test
  // above enforces for every capability including this disclaimer.
  assert.ok(a.text.includes('does not practise medicine'));
  assert.ok(a.text.includes('will not tell you what is wrong with you'));
});

test('every fact carries where it came from, and reported never reads as measured', () => {
  const a = answerRecord({ ...bare, cycleDay: 5, cyclePhase: 'During period' });
  const cycle = a.facts.find((f) => f.label === 'Cycle day');
  assert.equal(cycle?.from, 'reported');
});

// ── The check on model rewrites ──────────────────────────────────────

const grounded: Answer = {
  capability: 'record',
  text: 'Jenny, today your record holds sleep 7h 20m.',
  facts: [{ label: 'Sleep', value: '7h 20m', from: 'measured', on: '2026-10-11' }],
  suggestions: [],
};

test('a number not in the facts is refused', () => {
  const bad = checkAnswer('You slept 9h 00m last night.', grounded);
  assert.ok(bad.some((r) => r.reason === 'invented_number'));
});

test('numbers that are in the facts pass', () => {
  assert.deepEqual(groundedNumbers(grounded.facts).has('7'), true);
  assert.equal(checkAnswer('Your sleep was 7h 20m.', grounded).length, 0);
});

test('a diagnosis dressed as a hunch is refused', () => {
  for (const line of ['That sounds like endometriosis.', 'This is consistent with PCOS.', 'You may have a thyroid issue.']) {
    assert.ok(checkAnswer(line, grounded).some((r) => r.reason === 'diagnostic' || r.reason === 'forbidden_word'), line);
  }
});

test('an instruction about her body or medicine is refused', () => {
  for (const line of ['Take magnesium in the evening.', 'Stop the pill for a month.', 'Increase your dose.']) {
    assert.ok(checkAnswer(line, grounded).some((r) => r.reason === 'treatment'), line);
  }
});

test('a past tense report of what she did is not read as an instruction', () => {
  assert.ok(!checkAnswer('Your caffeine intake was logged.', grounded).some((r) => r.reason === 'treatment'));
});

test('research mentioned with no reference fact is refused', () => {
  assert.ok(checkAnswer('Studies show this is common.', grounded).some((r) => r.reason === 'uncited_research'));
});

test('an abstention may not be reworded into an answer with figures', () => {
  const abstained: Answer = { capability: 'record', text: 'Nothing yet.', facts: [], suggestions: [], abstained: 'no_data' };
  assert.ok(checkAnswer('You slept 7 hours.', abstained).some((r) => r.reason === 'answered_an_abstention'));
});

test('a dash is refused, as everywhere else in the app', () => {
  assert.ok(checkAnswer('Your sleep was fine — mostly.', grounded).some((r) => r.reason === 'dash'));
});

test('an empty rewrite is refused', () => {
  assert.equal(checkAnswer('   ', grounded)[0].reason, 'empty');
});

// ── The fallback is the whole safety argument ────────────────────────

test('no rewrite at all keeps the deterministic sentence', () => {
  const out = wordOrFallback(grounded, null);
  assert.equal(out.text, grounded.text);
  assert.equal(out.worded, false);
});

test('a failing rewrite is thrown away, not patched', () => {
  const out = wordOrFallback(grounded, 'You have endometriosis and slept 9 hours.');
  assert.equal(out.text, grounded.text);
  assert.equal(out.worded, false);
});

test('a passing rewrite is used and marked as the model speaking', () => {
  const out = wordOrFallback(grounded, 'Sleep came in at 7h 20m today.');
  assert.equal(out.text, 'Sleep came in at 7h 20m today.');
  assert.equal(out.worded, true);
});

// ── The duplicated list may not drift ────────────────────────────────

test('the forbidden list matches the one the edge functions hold', () => {
  const source = readFileSync(new URL('../../../supabase/functions/intelligence/wording.ts', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('export const FORBIDDEN'));
  for (const w of FORBIDDEN) {
    assert.ok(block.includes(`'${w}'`), `wording.ts is missing "${w}"`);
  }
});
