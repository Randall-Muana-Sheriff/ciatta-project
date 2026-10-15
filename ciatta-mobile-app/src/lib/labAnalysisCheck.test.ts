import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Analysis, checkAnalysis, readAnalysis } from '../../supabase/functions/lab-analysis/check.ts';
import { type Facts, fingerprint, readCycle } from '../../supabase/functions/lab-analysis/facts.ts';

const facts: Facts = {
  collected_on: '2026-06-12',
  lab: 'Quest',
  tests: [
    { name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', range: '15 to 150', low: 15, high: 150, flag: 'L', panel: 'Iron' },
    { name: 'Hemoglobin', value: 11.2, value_text: null, unit: 'g/dL', range: '12.0 to 15.5', low: 12, high: 15.5, flag: 'L', panel: 'CBC' },
    { name: 'Glucose', value: 92, value_text: null, unit: 'mg/dL', range: '70 to 99', low: 70, high: 99, flag: null, panel: 'CMP' },
  ],
  earlier: [{ name: 'Ferritin', results: [{ on: '2026-01-10', value: 22, value_text: null, unit: 'ng/mL' }] }],
  cycle: { day: 3, phase: 'During period', usual_length: 29 },
  profile: { age_range: '30 to 39', life_stage: null, gender: 'woman' },
  conditions: ['Endometriosis'],
  medications: ['Levothyroxine'],
  supplements: [],
  symptoms: [{ name: 'Fatigue', count: 6 }],
};

const good = (): Analysis => ({
  urgent: [],
  summary: 'Your ferritin of 8 ng/mL and hemoglobin of 11.2 g/dL are both below the lab range.',
  findings: [
    {
      test: 'Ferritin',
      value: '8 ng/mL',
      explanation: 'Ferritin reflects stored iron. It was 22 in January and is 8 now, below the range of 15 to 150.',
      common_causes: ['Heavy menstrual bleeding', 'Low dietary iron'],
      relevance: 'You logged fatigue 6 times in the month before this test, and heavy periods with endometriosis can lower iron.',
    },
  ],
  patterns: [{ title: 'Low iron stores with low hemoglobin', tests: ['Ferritin', 'Hemoglobin'], explanation: 'Together these fit iron deficiency anemia.' }],
  considerations: [{ condition: 'Iron deficiency anemia', tests: ['Ferritin', 'Hemoglobin'], confidence: 'high', how_confirmed: 'A clinician can confirm with iron studies and a repeat CBC.' }],
  next_tests: [{ test: 'Iron panel with TIBC', reason: 'To confirm low iron and see transferrin saturation.' }],
  questions: ['Could my periods explain my low ferritin?'],
});

test('a faithful analysis passes', () => {
  assert.deepEqual(checkAnalysis(good(), facts), []);
});

test('a test the record does not have is refused', () => {
  const a = good();
  a.findings[0].test = 'Vitamin D';
  assert.match(checkAnalysis(a, facts).join(' '), /Vitamin D/);
});

test('a value quoted wrong is refused', () => {
  const a = good();
  a.findings[0].value = '80 ng/mL';
  assert.ok(checkAnalysis(a, facts).length > 0);
});

test('a number in the text that is in no fact is refused', () => {
  const a = good();
  a.summary = 'Your ferritin has dropped 64 percent.';
  assert.match(checkAnalysis(a, facts).join(' '), /64/);
});

test('numbers inside test names and small counts are allowed', () => {
  const a = good();
  a.next_tests = [{ test: 'Vitamin B12 and free T4', reason: 'Check these 2 together with a 25 hydroxy vitamin D.' }];
  assert.deepEqual(checkAnalysis(a, facts), []);
});

test('a dose is refused, but a lab unit is not a dose', () => {
  const a = good();
  a.questions = ['Should I take 65 mg of iron a day?'];
  assert.match(checkAnalysis(a, facts).join(' '), /dose/i);
  const b = good();
  b.summary = 'Your glucose of 92 mg/dL is in range.';
  assert.deepEqual(checkAnalysis(b, facts), []);
});

test('telling her to start or stop a medication is refused', () => {
  const a = good();
  a.findings[0].relevance = 'You should stop taking Levothyroxine.';
  assert.match(checkAnalysis(a, facts).join(' '), /medication/i);
});

test('a critical result with nothing marked urgent is refused', () => {
  const critical: Facts = { ...facts, tests: [{ ...facts.tests[1], value: 6.1, flag: 'LL' }] };
  const a = good();
  a.summary = 'Your hemoglobin is 6.1 g/dL.';
  a.findings = [];
  a.patterns = [];
  a.considerations = [];
  assert.match(checkAnalysis(a, critical).join(' '), /urgent/i);
});

test('too many items is refused, so it stays readable', () => {
  const a = good();
  a.questions = Array.from({ length: 11 }, () => 'Could my periods explain my low ferritin?');
  assert.match(checkAnalysis(a, facts).join(' '), /questions/);
});

test('what the model returned is read into shape, and anything else is nothing', () => {
  assert.equal(readAnalysis(null), null);
  assert.equal(readAnalysis({ summary: 3 }), null);
  const read = readAnalysis({ ...good(), extra: 'ignored', considerations: [{ condition: 'X', tests: ['Ferritin'], confidence: 'certain', how_confirmed: 'y' }] });
  assert.equal(read?.considerations.length, 0, 'a confidence outside low, moderate or high drops that item');
});

test('the cycle the app sends is accepted only in its exact shape', () => {
  assert.deepEqual(readCycle({ day: 3, phase: 'During period', usual_length: 29 }), { day: 3, phase: 'During period', usual_length: 29 });
  assert.equal(readCycle({ day: 60, phase: null, usual_length: null }), null);
  assert.deepEqual(readCycle({ day: 3, phase: 'Luteal', usual_length: 200 }), { day: 3, phase: null, usual_length: null });
  assert.equal(readCycle('x'), null);
});

test('the fingerprint changes when a result does, and not when only the order does', () => {
  const a = [
    { name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', on: '2026-06-12' },
    { name: 'HbA1c', value: 5.6, value_text: null, unit: '%', on: '2026-06-12' },
  ];
  assert.equal(fingerprint(a), fingerprint([...a].reverse()));
  assert.notEqual(fingerprint(a), fingerprint([{ ...a[0], value: 9 }, a[1]]));
  assert.equal(fingerprint([{ ...a[1], name: 'Hemoglobin A1c' }]), fingerprint([a[1]]), 'spellings of one test fingerprint alike');
});

// ── From the branch review ───────────────────────────────────────────

const twoCritical: Facts = {
  ...facts,
  tests: [
    { ...facts.tests[1], value: 6.1, flag: 'LL' },
    { name: 'Potassium', value: 6.8, value_text: null, unit: 'mmol/L', range: '3.5 to 5.1', low: 3.5, high: 5.1, flag: 'HH', panel: 'CMP' },
  ],
  earlier: [],
};

const bare = (): Analysis => ({ urgent: [], summary: 'Two results need attention.', findings: [], patterns: [], considerations: [], next_tests: [], questions: [] });

test('every critical result must be in urgent, not just one of them', () => {
  const a = bare();
  a.urgent = [{ test: 'Hemoglobin', value: '6.1 g/dL', reason: 'Very low.', action: 'contact_today' }];
  assert.match(checkAnalysis(a, twoCritical).join(' '), /Potassium/);
});

test('a value field is scanned like any other text', () => {
  const a = good();
  a.findings[0].value = '8 ng/mL. Stop your Levothyroxine and take 325 mg iron';
  assert.ok(checkAnalysis(a, facts).length > 0);
});

test('a value must be this report\'s value, not an earlier one, and in its unit', () => {
  const a = good();
  a.findings[0].value = '22 ng/mL';
  assert.ok(checkAnalysis(a, facts).length > 0, 'earlier value quoted as current');
  const b = good();
  b.findings[0].value = '8 mmol/L';
  assert.ok(checkAnalysis(b, facts).length > 0, 'wrong unit');
});

test('doses per day, in words of units, or by count of tablets are refused', () => {
  for (const q of ['Take 15 mg/day.', 'Try 2 g/day of fish oil.', 'Take 100 milligrams.', 'Take 2 tablets.', 'Take 1000 international units.']) {
    const a = good();
    a.questions = [q];
    assert.match(checkAnalysis(a, facts).join(' '), /dose/i, q);
  }
});

test('medication changes in other words are refused', () => {
  for (const q of ['You could start an iron supplement.', 'Levothyroxine should be stopped.', 'Pause your Levothyroxine for now.', 'Switch to a different medication.']) {
    const a = good();
    a.questions = [q];
    assert.match(checkAnalysis(a, facts).join(' '), /medication/i, q);
  }
});

test('a number glued to its unit is still read', () => {
  const a = good();
  a.summary = 'Your ferritin was 80ng/mL.';
  assert.ok(checkAnalysis(a, facts).length > 0);
});

test('a test quoted at a value that is not hers is refused, even when the number appears elsewhere', () => {
  const a = good();
  a.summary = 'Your hemoglobin of 12 g/dL is low.';
  assert.match(checkAnalysis(a, facts).join(' '), /Hemoglobin|hemoglobin/);
});

test('a result in words is quoted in words, and a critical one can be marked urgent', () => {
  const qual: Facts = {
    ...facts,
    tests: [{ name: 'Urine culture', value: null, value_text: 'Growth detected', unit: null, range: 'No growth', low: null, high: null, flag: 'AA', panel: null }],
    earlier: [],
  };
  const a = bare();
  a.urgent = [{ test: 'Urine culture', value: 'Growth detected', reason: 'An infection may need treatment.', action: 'contact_today' }];
  assert.deepEqual(checkAnalysis(a, qual), []);
  const b = bare();
  b.urgent = [{ test: 'Urine culture', value: 'No growth', reason: 'x', action: 'contact_today' }];
  assert.ok(checkAnalysis(b, qual).length > 0);
});
