import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activeUnits,
  defaultUnits,
  formatDistance,
  formatHeight,
  formatTemp,
  formatTempChange,
  formatWeight,
  heightFromInput,
  setActiveUnits,
  tempSymbol,
  tempValue,
  toKg,
  unitsOf,
  weightFromInput,
} from './units';

test('two systems only: metric and imperial, and the old choices map onto them', () => {
  assert.equal(unitsOf('metric'), 'metric');
  assert.equal(unitsOf('imperial'), 'imperial');
  assert.equal(unitsOf('us'), 'imperial');
  assert.equal(unitsOf('uk'), 'imperial');
  assert.equal(unitsOf(undefined), null);
  assert.equal(unitsOf('furlongs'), null);
});

test('height reads in the units she chose, with the other system beside it', () => {
  assert.deepEqual(formatHeight(173, 'metric'), { value: '173 cm', other: '5 ft 8 in' });
  assert.deepEqual(formatHeight(173, 'imperial'), { value: '5 ft 8 in', other: '173 cm' });
  // 71.65 inches rounds to 72: 6 ft 0 in, never 5 ft 12 in.
  assert.deepEqual(formatHeight(182, 'imperial'), { value: '6 ft 0 in', other: '182 cm' });
});

test('weight in kilograms or pounds', () => {
  assert.deepEqual(formatWeight(64.2, 'metric'), { value: '64.2 kg', other: '141.5 lb' });
  assert.deepEqual(formatWeight(64.2, 'imperial'), { value: '141.5 lb', other: '64.2 kg' });
});

test('temperature, and a change in it, in Celsius or Fahrenheit', () => {
  assert.equal(formatTemp(21, 'metric'), '21 °C');
  assert.equal(formatTemp(21, 'imperial'), '70 °F');
  // A change scales by 1.8 and never shifts by 32.
  assert.equal(formatTempChange(0.4, 'metric'), '0.4 °C');
  assert.equal(formatTempChange(0.4, 'imperial'), '0.7 °F');
  assert.equal(formatTempChange(-0.5, 'imperial'), '0.9 °F');
});

test('distance in kilometres or miles', () => {
  assert.equal(formatDistance(10, 'metric'), '10 km');
  assert.equal(formatDistance(10, 'imperial'), '6 miles');
  assert.equal(formatDistance(1.6, 'imperial'), '1 mile');
});

test('the app reads one active system, metric until she or her region says otherwise', () => {
  assert.equal(activeUnits(), 'metric');
  setActiveUnits('imperial');
  assert.equal(formatTempChange(0.4), '0.7 °F');
  setActiveUnits('metric');
  assert.equal(formatTempChange(0.4), '0.4 °C');
});

test('what she types is read in whichever units she typed it', () => {
  assert.equal(heightFromInput({ cm: '173' }), 173);
  assert.equal(Math.round(heightFromInput({ ft: '5', in: '8' })! * 10) / 10, 172.7);
  assert.equal(heightFromInput({ cm: '20' }), null, 'not a height');
  assert.equal(heightFromInput({ ft: '5', in: '13' }), null, 'inches past 11');
  assert.equal(weightFromInput({ kg: '64.2' }), 64.2);
  assert.equal(Math.round(weightFromInput({ lb: '141.5' })! * 10) / 10, 64.2);
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
  assert.equal(defaultUnits('en-US'), 'imperial');
  assert.equal(defaultUnits('en-GB'), 'metric');
  assert.equal(defaultUnits('fr-FR'), 'metric');
  assert.equal(defaultUnits(undefined), 'metric');
});

test('a temperature as a number and its symbol, for copy that words a minus', () => {
  assert.equal(tempValue(-5, 'metric'), -5);
  assert.equal(tempValue(-5, 'imperial'), 23);
  assert.equal(tempSymbol('metric'), '°C');
  assert.equal(tempSymbol('imperial'), '°F');
});
