import assert from 'node:assert/strict';
import { test } from 'node:test';

import { airLines, daylightLine, type EnvironmentDay, weatherLines } from './weather';

const d = (day: string, max: number | null, min: number | null, humidity: number | null, daylight: number | null, air: Partial<EnvironmentDay> = {}): EnvironmentDay => ({
  day, tempMaxC: max, tempMinC: min, humidityMean: humidity, daylightMinutes: daylight, condition: null,
  pm25: null, usAqi: null, pollenGrass: null, pollenTree: null, pollenWeed: null, ...air,
});

test('the last week in three plain lines', () => {
  const days = [d('2026-10-07', 22, 14, 0.6, 680), d('2026-10-08', 24, 15, 0.7, 676), d('2026-10-09', 19, 12, 0.8, 672)];
  assert.deepEqual(weatherLines(days), ['12 to 24 °C', 'Humidity around 70%', 'Daylight about 11h 16m']);
});

test('a missing figure drops its line rather than showing a guess', () => {
  assert.deepEqual(weatherLines([d('2026-10-09', 20, 10, null, null)]), ['10 to 20 °C']);
});

test('no weather at all means no card', () => {
  assert.deepEqual(weatherLines([]), []);
});

test('below zero is said in words, because display copy turns any dash or minus sign into punctuation', () => {
  const lines = weatherLines([d('2026-10-09', 2, -4, 0.5, 500)]);
  assert.equal(lines[0], 'minus 4 to 2 °C');
  for (const l of lines) assert.ok(!/[-–—]/.test(l), l);
});

test('air quality in the EPA category words, from the worst day of the week', () => {
  const days = [d('2026-10-07', null, null, null, null, { usAqi: 34, pm25: 6 }), d('2026-10-08', null, null, null, null, { usAqi: 72, pm25: 14 })];
  assert.deepEqual(airLines(days), ['Air quality moderate at worst (AQI 72)']);
});

test('smoky or heavily polluted days are counted, by the EPA PM2.5 line', () => {
  const days = [d('2026-10-07', null, null, null, null, { usAqi: 160, pm25: 58 }), d('2026-10-08', null, null, null, null, { usAqi: 155, pm25: 41 })];
  assert.deepEqual(airLines(days), ['Air quality unhealthy at worst (AQI 160)', 'Smoky or polluted air on 2 days']);
});

test('pollen only when there was some, naming the highest', () => {
  const days = [d('2026-10-07', null, null, null, null, { pollenGrass: 12, pollenTree: 40, pollenWeed: 0 })];
  assert.deepEqual(airLines(days), ['Tree pollen up to 40 grains per m³']);
  assert.deepEqual(airLines([d('2026-10-07', null, null, null, null, { pollenGrass: 0 })]), []);
});

test('her own time in daylight, from Apple Health, when she has it', () => {
  assert.equal(daylightLine([{ day: '2026-10-07', minutes: 30 }, { day: '2026-10-08', minutes: 50 }]), 'You were outside in daylight about 40 min a day');
  assert.equal(daylightLine([]), null);
});
