import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Insight } from '../engine';
import { answerAsk, answerContext, answerPattern } from './capabilities';
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

// ── References are matched to her, not just present ──────────────────

const endoRef = {
  id: 'r1',
  title: 'Endometriosis: A Review',
  publication: 'JAMA',
  year: 2025,
  summary: 'The diagnosis is often delayed, averaging 5 to 12 years after onset of symptoms.',
  domains: ['endometriosis', 'diagnosis'],
};

test('a reference about her condition is quoted verbatim and marked general', () => {
  const r = buildRecord({
    ...bare,
    reported: { conditions: ['Endometriosis'], surgeries: [], medications: [], supplements: [] },
    references: [endoRef],
  });
  const a = answerContext(r);
  assert.equal(a.abstained, undefined);
  assert.ok(a.text.includes(endoRef.summary), a.text);
  assert.ok(a.text.includes('not a statement about you'));
  assert.equal(a.facts[0].refId, 'r1');
});

test('a reference about a different condition is never quoted at her', () => {
  // Having sources and having a source about her are different things.
  const r = buildRecord({
    ...bare,
    reported: { conditions: ['PCOS'], surgeries: [], medications: [], supplements: [] },
    references: [endoRef],
  });
  const a = answerContext(r);
  assert.equal(a.abstained, 'no_citations');
  assert.ok(!a.text.includes(endoRef.summary));
  assert.ok(a.text.includes('research on something else'));
});

test('references but no condition told to Ciatta still abstains', () => {
  const a = answerContext(buildRecord({ ...bare, references: [endoRef] }));
  assert.equal(a.abstained, 'no_citations');
});

test('the seeded summaries carry no dash and no forbidden word', () => {
  // They are quoted verbatim and rendered, so they have to clear the same
  // bar as copy the app wrote itself. A source that cannot be quoted
  // cleanly is left out of the seed rather than edited.
  const sql = readFileSync(new URL('../../../supabase/migrations/20261011170000_seed_research_refs.sql', import.meta.url), 'utf8');
  const summaries = [...sql.matchAll(/^\s{4}'([^']{40,})',$/gm)].map((m) => m[1]);
  assert.ok(summaries.length >= 5, `found ${summaries.length} summaries`);
  for (const line of summaries) {
    assert.ok(!/[—–]/.test(line), line);
    for (const w of ['cause', 'because', 'diagnos', 'you have', 'risk of']) {
      // "diagnosis" is the subject of several of these and is allowed in a
      // quoted finding about a population; what is refused is the app
      // saying it about her. The agent's own sentence is checked
      // separately, so only the dashes and second person matter here.
      if (w === 'diagnos') continue;
      assert.ok(!line.toLowerCase().includes(w), `${w} in ${line}`);
    }
    assert.ok(!/\byou\b/i.test(line), `second person in a general finding: ${line}`);
  }
});
