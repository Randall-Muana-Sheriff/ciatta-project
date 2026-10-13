import assert from 'node:assert/strict';
import { test } from 'node:test';

import { weatherLines } from './weather';

const d = (day: string, max: number | null, min: number | null, humidity: number | null, daylight: number | null) => ({
  day, tempMaxC: max, tempMinC: min, humidityMean: humidity, daylightMinutes: daylight, condition: null,
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
