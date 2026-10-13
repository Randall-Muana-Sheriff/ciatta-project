import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overviewFacts, resolveBody } from './overviewFacts';

const NOW = new Date(2026, 9, 20);

test('six facts, in a fixed order, the sixth her cycle situation', () => {
  const facts = overviewFacts({
    age: { value: '30 years', sub: 'Born 14 Apr 1996' },
    body: resolveBody({ manual: { height_cm: 173, weight_kg: 64.2, weight_on: '2026-10-19', blood_type: 1 }, health: { bloodType: null, height: null, weight: null } }),
    insurance: { value: 'Anthem', sub: 'PPO' },
    situations: ['Endometriosis', 'Irregular'],
    units: 'uk',
    now: NOW,
  });
  assert.deepEqual(facts.map((f) => f.label), ['Age', 'Height', 'Weight', 'Blood Type', 'Insurance', 'Cycle situation']);
  assert.deepEqual(facts[1], { key: 'height', label: 'Height', value: '5 ft 8 in', sub: '173 cm', icon: 'ruler' });
  assert.deepEqual(facts[2], { key: 'weight', label: 'Weight', value: '10 st 1.5 lb', sub: '64.2 kg', icon: 'body' });
  assert.deepEqual(facts[3], { key: 'blood', label: 'Blood Type', value: 'A positive', sub: 'Entered by you', icon: 'drop' });
  assert.deepEqual(facts[5], { key: 'situation', label: 'Cycle situation', value: 'Endometriosis', sub: 'and 1 more', icon: 'calendar' });
});

test('what she entered wins for height and blood type; the newer reading wins for weight', () => {
  const b = resolveBody({
    manual: { height_cm: 170, blood_type: 7, weight_kg: 60, weight_on: '2026-09-01' },
    health: { bloodType: 1, height: { value: 1.73, unit: 'm' }, weight: { value: 141.5, unit: 'lb', at: '2026-10-18T08:00:00Z' } },
  });
  assert.equal(b.heightCm, 170);
  assert.equal(b.bloodType?.code, 7);
  assert.equal(b.bloodType?.from, 'you');
  assert.equal(Math.round(b.weightKg! * 10) / 10, 64.2);
  assert.equal(b.weightFrom, 'apple');
});

test('Apple Health fills in what she has not entered, and says so', () => {
  const b = resolveBody({ manual: null, health: { bloodType: 3, height: { value: 173, unit: 'cm' }, weight: null } });
  assert.equal(b.heightCm, 173);
  assert.deepEqual(b.bloodType, { code: 3, from: 'apple' });
  const facts = overviewFacts({ age: null, body: b, insurance: null, situations: [], units: 'metric', now: NOW });
  assert.equal(facts[3].sub, 'From Apple Health');
});

test('nothing known reads as not added, never invented', () => {
  const facts = overviewFacts({ age: null, body: resolveBody({ manual: null, health: { bloodType: null, height: null, weight: null } }), insurance: null, situations: [], units: 'metric', now: NOW });
  assert.equal(facts.length, 6);
  for (const f of facts) assert.equal(f.value, null, f.label);
});
