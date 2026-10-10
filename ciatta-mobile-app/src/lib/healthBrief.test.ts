import assert from 'node:assert/strict';
import { test } from 'node:test';

import { briefHasAnything, briefRange, buildBrief, type BriefInput, emptyLine } from './healthBrief';

function input(over: Partial<BriefInput> = {}): BriefInput {
  return {
    from: new Date(2026, 3, 1),
    to: new Date(2026, 9, 1),
    symptoms: [{ name: 'Fatigue', count: 9 }],
    conditions: ['Endometriosis'],
    medications: ['Levothyroxine'],
    readings: [{ label: 'Resting heart rate', value: '58 bpm', on: '2026-10-09' }],
    cycleLengths: [31, 29, 26],
    tried: [{ what: 'A short walk', outcome: 'reported better' }],
    notes: [{ on: '2026-10-08', text: 'Tired again by mid afternoon.' }],
    ...over,
  };
}

test('the brief runs in the order Ciatta works in', () => {
  assert.deepEqual(buildBrief(input()).map((s) => s.id), ['changed', 'around', 'tried', 'asking']);
});

test('a symptom is a count, never a conclusion', () => {
  const changed = buildBrief(input()).find((s) => s.id === 'changed');
  assert.equal(changed?.lines[0].text, 'Fatigue');
  assert.equal(changed?.lines[0].detail, 'logged 9 times');
  assert.ok(!/worse|severe|significant|caused/.test(JSON.stringify(changed)), 'the brief characterised a symptom');
});

test('one of something is a time, not 1 times', () => {
  const changed = buildBrief(input({ symptoms: [{ name: 'Nausea', count: 1 }] })).find((s) => s.id === 'changed');
  assert.equal(changed?.lines[0].detail, 'logged 1 time');
});

test('a measured reading carries the day it was measured', () => {
  // A clinician reading a figure needs to know whether it is from today or
  // from March. A bare number invites them to assume today.
  const changed = buildBrief(input()).find((s) => s.id === 'changed');
  const hr = changed?.lines.find((l) => l.text === 'Resting heart rate');
  assert.match(hr?.detail ?? '', /measured 2026-10-09/);
});

test('cycle length is reported as the span, not as a trend', () => {
  const changed = buildBrief(input()).find((s) => s.id === 'changed');
  const cycle = changed?.lines.find((l) => l.text === 'Cycle length');
  assert.equal(cycle?.detail, '31 days to 29 days over 3 cycles'.replace('29', '26'));
  assert.ok(!/shorter|shortening|declining/.test(cycle?.detail ?? ''), 'the brief named a direction');
});

test('one cycle is not a span', () => {
  const changed = buildBrief(input({ cycleLengths: [28] })).find((s) => s.id === 'changed');
  assert.ok(!changed?.lines.some((l) => l.text === 'Cycle length'), 'a single cycle was reported as a change');
});

test('an outcome nobody reported is unknown, never no effect', () => {
  // The worst sentence this document could contain: silence turned into a
  // finding that something did not work.
  const tried = buildBrief(input({ tried: [{ what: 'A short walk', outcome: null }] })).find((s) => s.id === 'tried');
  assert.equal(tried?.lines[0].detail, 'no outcome reported');
  assert.ok(!/no effect|did not help|ineffective/.test(JSON.stringify(tried)));
});

test('her words are carried verbatim', () => {
  const asking = buildBrief(input()).find((s) => s.id === 'asking');
  assert.equal(asking?.lines[0].text, 'Tired again by mid afternoon.');
});

test('an empty section is shown as empty, not dropped', () => {
  // A doctor reading "no symptoms recorded" learns something. A missing
  // section teaches them nothing and hides the gap.
  const sections = buildBrief(input({ symptoms: [], cycleLengths: [], readings: [] }));
  const changed = sections.find((s) => s.id === 'changed');
  assert.equal(sections.length, 4, 'a section disappeared');
  assert.equal(changed?.empty, true);
  assert.match(emptyLine('changed'), /Nothing logged or measured/);
});

test('every empty line says what is absent without saying it is none of it', () => {
  for (const id of ['changed', 'around', 'tried', 'asking']) {
    const line = emptyLine(id);
    assert.ok(line.length > 0);
    assert.ok(!/^None/.test(line), `${id} reports an absence as a quantity`);
  }
});

test('a wholly empty record is reported as having nothing', () => {
  const sections = buildBrief(input({ symptoms: [], conditions: [], medications: [], readings: [], cycleLengths: [], tried: [], notes: [] }));
  assert.equal(briefHasAnything(sections), false);
  assert.ok(sections.every((s) => s.empty));
});

test('the range reads as a range', () => {
  assert.equal(briefRange(new Date(2026, 3, 1), new Date(2026, 9, 1)), '1 Apr to 1 Oct');
});

test('no line holds a dash of any kind', () => {
  const all = JSON.stringify(buildBrief(input()));
  for (const dash of ['—', '–']) {
    assert.ok(!all.includes(dash), `the brief contains ${dash}`);
  }
});
