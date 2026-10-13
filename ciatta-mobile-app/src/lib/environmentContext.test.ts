import assert from 'node:assert/strict';
import { test } from 'node:test';

import { environmentLine } from './environmentContext';
import type { EnvironmentDay } from './weather';

const NOW = new Date(2026, 9, 13, 12);
const iso = (daysAgo: number) => {
  const d = new Date(2026, 9, 13 - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// 111 days of weather: 90 days of usual, then the last three weeks.
const series = (recent: Partial<EnvironmentDay>, usual: Partial<EnvironmentDay> = {}): EnvironmentDay[] =>
  Array.from({ length: 111 }, (_, i) => {
    const daysAgo = 110 - i;
    const base = { tempMaxC: 20 + (i % 3), tempMinC: 12, humidityMean: 0.6 + (i % 3) * 0.01, daylightMinutes: 700 + (i % 3) * 5, condition: null };
    return { day: iso(daysAgo), ...base, ...(daysAgo < 21 ? recent : usual) };
  });

test('a hot, humid stretch is named against her own usual, with the figures', () => {
  assert.equal(
    environmentLine(series({ tempMaxC: 31, humidityMean: 0.8 }), NOW),
    'These last three weeks were hotter and more humid than your usual (31 °C, 80%).',
  );
});

test('short days are named too', () => {
  assert.equal(environmentLine(series({ daylightMinutes: 540 }), NOW), 'These last three weeks had less daylight than your usual (9h a day).');
});

test('nothing unusual says nothing', () => {
  assert.equal(environmentLine(series({}), NOW), null);
});

test('too little weather says nothing rather than guessing', () => {
  assert.equal(environmentLine(series({ tempMaxC: 31 }).slice(-10), NOW), null, 'no usual to compare with');
  const gappy = series({ tempMaxC: 31 }).filter((d, i) => i < 90 || i % 3 === 0);
  assert.equal(environmentLine(gappy, NOW), null, 'under 60% of the stretch has weather');
});

test('it never says the weather caused anything, and carries no dash', () => {
  const line = environmentLine(series({ tempMaxC: 31, humidityMean: 0.8, daylightMinutes: 540 }), NOW)!;
  assert.ok(!/\b(cause|caused|because|due to|led to|triggered)\b/i.test(line), line);
  assert.ok(!/[-–—]/.test(line), line);
});
