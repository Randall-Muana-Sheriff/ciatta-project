import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Insight } from '../engine';
import { answerAsk, answerPattern } from './capabilities';
import { buildRecord, type Sources } from './record';

const bare: Sources = {
  name: 'Jenny',
  today: null,
  days: [],
  episodes: [],
  reported: null,
  insights: [],
  references: [],
  cycleDay: null,
  cyclePhase: null,
};

const insight = (over: Partial<Insight>) =>
  ({
    id: 'i', title: 'Sleep and cycle', brief: 'Sleep fell in the week before three periods.',
    domains: [], evidence: { supports: [], notEstablished: ['One does not explain the other.'], alternatives: [] },
    recurrence: 3, magnitude: 0.4, ongoing: true, triage: 'watch', score: 1, ...over,
  }) as Insight;

// ── The bug this file exists for ─────────────────────────────────────

test('a cycle situation is never read as a condition she is managing', () => {
  // Situations are Regular, Irregular, Endometriosis and so on, all in one
  // list. Only what she reported as a condition may reach the agent.
  const r = buildRecord({ ...bare, reported: { conditions: ['Endometriosis'], surgeries: [], medications: [], supplements: [] } });
  assert.deepEqual(r.conditions, ['Endometriosis']);
  const said = answerAsk(r).text;
  assert.ok(!said.includes('Irregular'), said);
  assert.ok(!said.includes('Regular'), said);
});

test('no reported read yet is empty, and the agent abstains rather than inventing', () => {
  const r = buildRecord(bare);
  assert.deepEqual(r.conditions, []);
  assert.deepEqual(r.medications, []);
  assert.equal(answerAsk(r).abstained, 'no_data');
});

// ── Medications ──────────────────────────────────────────────────────

test('supplements are carried with medications, because the question is the same', () => {
  const r = buildRecord({
    ...bare,
    reported: { conditions: [], surgeries: [], medications: ['Naproxen'], supplements: ['Iron'] },
  });
  assert.deepEqual(r.medications, ['Naproxen', 'Iron']);
  assert.ok(answerAsk(r).text.includes('Naproxen and Iron'));
});

// ── Insights ─────────────────────────────────────────────────────────

test('insights arrive already ranked and are not re ranked here', () => {
  const a = insight({ title: 'First', brief: 'A.' });
  const b = insight({ title: 'Second', brief: 'B.' });
  const r = buildRecord({ ...bare, insights: [a, b] });
  assert.deepEqual(r.insights.map((i) => i.title), ['First', 'Second']);
});

test('only the first few are spoken, so the agent does not recite the whole list', () => {
  const many = Array.from({ length: 9 }, (_, n) => insight({ title: `T${n}` }));
  assert.equal(buildRecord({ ...bare, insights: many }).insights.length, 3);
});

test('what an insight does not show is carried with it, never dropped', () => {
  const r = buildRecord({ ...bare, insights: [insight({})] });
  assert.deepEqual(r.insights[0].notEstablished, ['One does not explain the other.']);
  // And it reaches the sentence, which is the point of carrying it.
  assert.ok(answerPattern(r).text.includes('does not show'));
});

test('with an insight wired, pattern answers instead of abstaining', () => {
  assert.equal(answerPattern(buildRecord(bare)).abstained, 'no_data');
  assert.equal(answerPattern(buildRecord({ ...bare, insights: [insight({})] })).abstained, undefined);
});

test('the wired record still never produces a forbidden word', () => {
  const r = buildRecord({
    ...bare,
    reported: { conditions: ['Endometriosis'], surgeries: ['Laparoscopy'], medications: ['Naproxen'], supplements: ['Iron'] },
    insights: [insight({})],
  });
  for (const a of [answerAsk(r), answerPattern(r)]) {
    const lower = a.text.toLowerCase();
    for (const w of ['you have', 'diagnos', 'because', 'risk of']) {
      assert.ok(!lower.includes(w), `${a.capability} said "${w}": ${a.text}`);
    }
  }
});
