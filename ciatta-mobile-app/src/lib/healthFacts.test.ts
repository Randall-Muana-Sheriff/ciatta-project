import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageFact, bloodTypeLabel, heightFact, healthStats } from './healthFacts';

const NOW = new Date(2026, 9, 14);

test('age from her date of birth, in whole years', () => {
  assert.deepEqual(ageFact(new Date(1996, 3, 14), NOW), { label: 'Age', value: '30 years', sub: 'Born 14 Apr 1996' });
  assert.equal(ageFact(new Date(1996, 9, 15), NOW)!.value, '29 years', 'not a year older until her birthday');
  assert.equal(ageFact(null, NOW), null);
});

test('blood type as it is written, and nothing when Apple Health has none set', () => {
  // In words: a minus sign is a dash to display copy.
  assert.equal(bloodTypeLabel(1), 'A positive');
  assert.equal(bloodTypeLabel(6), 'AB negative');
  assert.equal(bloodTypeLabel(8), 'O negative');
  assert.equal(bloodTypeLabel(7), 'O positive');
  assert.equal(bloodTypeLabel(0), null);
  assert.equal(bloodTypeLabel(null), null);
});

test('height in centimetres with feet and inches, whatever unit it arrived in', () => {
  assert.deepEqual(heightFact({ value: 1.73, unit: 'm' }), { label: 'Height', value: '173 cm', sub: '5 ft 8 in' });
  assert.deepEqual(heightFact({ value: 173, unit: 'cm' }), { label: 'Height', value: '173 cm', sub: '5 ft 8 in' });
  assert.deepEqual(heightFact({ value: 68.1, unit: 'in' }), { label: 'Height', value: '173 cm', sub: '5 ft 8 in' });
  assert.equal(heightFact(null), null);
  assert.equal(heightFact({ value: 3, unit: 'furlong' }), null, 'a unit it does not know is not guessed');
});

test('the facts that were found, and only those', () => {
  const stats = healthStats({ dateOfBirth: new Date(1996, 3, 14), bloodType: 1, height: null }, NOW);
  assert.deepEqual(stats.map((s) => s.label), ['Age', 'Blood Type']);
});
