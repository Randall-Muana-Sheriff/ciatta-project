import assert from 'node:assert/strict';
import { test } from 'node:test';

import { respond } from './capabilities';
import { capabilityCards, readinessLine } from './readiness';
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

const dayRow = { date: '2026-10-11', sleepHours: 7, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: 8432, activeMinutes: null, workouts: [], restingHR: null, hrv: 42, tempDeviation: null, energy: null, mood: null, stress: null, caffeine: null, alcohol: null, foods: [], digestion: [] };

const stocked: Sources = {
  ...bare,
  reported: { conditions: ['Endometriosis'], surgeries: [], medications: ['Naproxen'], supplements: [] },
  today: dayRow,
  days: [dayRow],
  references: [{ id: 'r1', title: 'A paper', publication: 'A journal', year: 2024, summary: 'Something general.' }],
};

test('escalation is never offered as a capability to browse', () => {
  assert.ok(!capabilityCards(buildRecord(bare)).some((c) => c.id === 'escalate'));
  assert.ok(!capabilityCards(buildRecord(bare)).some((c) => c.id === 'decline'));
});

test('readiness is the capability itself, not a second opinion about it', () => {
  // The claim the screen makes has to be the thing that happens on tap, so
  // every card is checked against actually running its own question.
  for (const src of [bare, stocked]) {
    const record = buildRecord(src);
    for (const card of capabilityCards(record)) {
      const answer = respond(card.ask, record, card.id);
      assert.equal(card.ready, !answer.abstained, `${card.id} claims ready=${card.ready}`);
    }
  }
});

test('an empty record says so plainly rather than offering six dead rows', () => {
  const cards = capabilityCards(buildRecord(bare));
  assert.ok(cards.every((c) => !c.ready || c.id === 'navigate'));
  assert.equal(readinessLine(cards.map((c) => ({ ...c, ready: false }))), 'None of these can be answered from your record yet.');
});

test('a stocked record turns the rows on', () => {
  const cards = capabilityCards(buildRecord(stocked));
  const ready = cards.filter((c) => c.ready).map((c) => c.id);
  for (const id of ['record', 'ask', 'prepare', 'context']) {
    assert.ok(ready.includes(id as never), `${id} should be ready: ready are ${ready.join(', ')}`);
  }
});

test('a blocked row says which problem it has, because the fixes differ', () => {
  const cards = capabilityCards(buildRecord({ ...stocked, references: [] }));
  const context = cards.find((c) => c.id === 'context');
  const pattern = cards.find((c) => c.id === 'pattern');
  assert.equal(context?.blocked, 'No reviewed sources yet');
  assert.equal(pattern?.blocked, 'Not enough in your record yet');
});

test('the count is stated and never reassures', () => {
  const cards = capabilityCards(buildRecord(stocked));
  const line = readinessLine(cards);
  assert.ok(/\d/.test(line) || line.startsWith('All'));
  for (const w of ['great', 'good', 'healthy', 'well done', 'keep']) {
    assert.ok(!line.toLowerCase().includes(w), line);
  }
});

test('every card carries a question the classifier routes to that same capability', () => {
  // Otherwise tapping a row would run one capability and the transcript
  // would show the message for another.
  const { classify } = require('./classify') as typeof import('./classify');
  for (const card of capabilityCards(buildRecord(stocked))) {
    assert.equal(classify(card.ask), card.id, `"${card.ask}" routes to ${classify(card.ask)}, not ${card.id}`);
  }
});
