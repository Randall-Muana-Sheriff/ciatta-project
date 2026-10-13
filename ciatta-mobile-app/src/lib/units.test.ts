import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultUnits, formatHeight, formatWeight, heightFromInput, toKg, weightFromInput } from './units';

test('height reads in the units she chose, with the other system beside it', () => {
  assert.deepEqual(formatHeight(173, 'metric'), { value: '173 cm', other: '5 ft 8 in' });
  assert.deepEqual(formatHeight(173, 'us'), { value: '5 ft 8 in', other: '173 cm' });
  assert.deepEqual(formatHeight(173, 'uk'), { value: '5 ft 8 in', other: '173 cm' });
  // 71.65 inches rounds to 72: 6 ft 0 in, never 5 ft 12 in.
  assert.deepEqual(formatHeight(182, 'us'), { value: '6 ft 0 in', other: '182 cm' });
});

test('weight in kilograms, pounds, or stones and pounds', () => {
  assert.deepEqual(formatWeight(64.2, 'metric'), { value: '64.2 kg', other: '141.5 lb' });
  assert.deepEqual(formatWeight(64.2, 'us'), { value: '141.5 lb', other: '64.2 kg' });
  assert.deepEqual(formatWeight(64.2, 'uk'), { value: '10 st 1.5 lb', other: '64.2 kg' });
  // 13.95 lb over a stone is 14 lb, which is the next stone, not 10 st 14 lb.
  assert.equal(formatWeight(69.85, 'uk').value, '11 st 0 lb');
});

test('what she types is read in whichever units she typed it', () => {
  assert.equal(heightFromInput({ cm: '173' }), 173);
  assert.equal(Math.round(heightFromInput({ ft: '5', in: '8' })! * 10) / 10, 172.7);
  assert.equal(heightFromInput({ cm: '20' }), null, 'not a height');
  assert.equal(heightFromInput({ ft: '5', in: '13' }), null, 'inches past 11');
  assert.equal(weightFromInput({ kg: '64.2' }), 64.2);
  assert.equal(Math.round(weightFromInput({ lb: '141.5' })! * 10) / 10, 64.2);
  assert.equal(Math.round(weightFromInput({ st: '10', lb: '1.5' })! * 10) / 10, 64.2);
  assert.equal(weightFromInput({ kg: 'heavy' }), null);
  assert.equal(weightFromInput({ kg: '900' }), null, 'not a weight');
});

test('a reading from a device is turned into kilograms whatever its unit', () => {
  assert.equal(toKg(64.2, 'kg'), 64.2);
  assert.equal(Math.round(toKg(141.5, 'lb')! * 10) / 10, 64.2);
  assert.equal(toKg(64200, 'g'), 64.2);
  assert.equal(toKg(3, 'furlong'), null);
});

test('her units follow her region until she chooses', () => {
  assert.equal(defaultUnits('en-US'), 'us');
  assert.equal(defaultUnits('en-GB'), 'uk');
  assert.equal(defaultUnits('fr-FR'), 'metric');
  assert.equal(defaultUnits(undefined), 'metric');
});
