import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayPatterns, defaultPair, pairLine } from './dayPatterns';

const NOW = new Date(2026, 9, 14, 18, 30);
const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m).toISOString();

test('each wearable metric, hour by hour through today, only those with readings', () => {
  const v = dayPatterns(
    [
      { metric: 'heart_rate', value: 60, at: at(8) },
      { metric: 'heart_rate', value: 70, at: at(8, 30) },
      { metric: 'heart_rate', value: 110, at: at(14) },
      { metric: 'steps', value: 300, at: at(8) },
      { metric: 'steps', value: 200, at: at(8, 40) },
      { metric: 'oxygen_saturation', value: 0.97, at: at(3) },
      { metric: 'heart_rate', value: 99, at: new Date(2026, 9, 13, 8).toISOString() },
      { metric: 'sleep_analysis', value: null, at: at(6, 45) },
    ],
    NOW,
  );
  assert.deepEqual(v.series.map((s) => s.key), ['heart_rate', 'steps', 'oxygen_saturation']);
  const hr = v.series[0];
  assert.equal(hr.values.length, 24);
  assert.equal(hr.values[8], 65);
  assert.equal(hr.values[14], 110);
  assert.equal(hr.count, 2, 'hours with a reading');
  assert.equal(hr.range, '65 to 110 bpm');
  assert.equal(v.series[1].values[8], 500, 'steps add up within the hour');
  assert.equal(v.series[2].values[3], 97, 'a fraction is a percent');
  assert.equal(v.nowHour, 18);
  assert.equal(v.wokeAt, 6.75, 'the last sleep end today shades the night');
});

test('the pair: heart rate and HRV when both are there, else the two with most hours', () => {
  const s = (key: string, count: number) => ({ key, count }) as never;
  assert.deepEqual(defaultPair([s('steps', 9), s('heart_rate', 4), s('hrv', 2)]), ['heart_rate', 'hrv']);
  assert.deepEqual(defaultPair([s('steps', 9), s('oxygen_saturation', 2), s('respiratory_rate', 5)]), ['steps', 'respiratory_rate']);
  assert.deepEqual(defaultPair([s('steps', 9)]), ['steps']);
});

test('one line on how the two moved together, only when both say enough', () => {
  const v = dayPatterns(
    [
      ...[8, 10, 12, 14, 16].map((h, i) => ({ metric: 'heart_rate', value: [60, 70, 80, 120, 75][i], at: at(h) })),
      ...[8, 10, 12, 14, 16].map((h, i) => ({ metric: 'hrv', value: [55, 50, 45, 28, 48][i], at: at(h) })),
    ],
    NOW,
  );
  assert.equal(pairLine(v.series[0], v.series[1]), 'When your heart rate peaked, around 2p, your HRV was near its low for today.');
  // Too few hours: nothing said.
  const thin = dayPatterns([{ metric: 'heart_rate', value: 60, at: at(8) }, { metric: 'hrv', value: 50, at: at(8) }], NOW);
  assert.equal(pairLine(thin.series[0], thin.series[1]), null);
});

test('two lines for the pair: how they moved together, then each against her usual or today\'s range', async () => {
  const { pairInsight, rotatePair } = await import('./dayPatterns');
  const v = dayPatterns(
    [
      ...[8, 10, 12, 14, 16].map((h, i) => ({ metric: 'heart_rate', value: [60, 70, 80, 120, 75][i], at: at(h) })),
      ...[8, 10, 12, 14, 16].map((h, i) => ({ metric: 'hrv', value: [55, 50, 45, 28, 48][i], at: at(h) })),
      { metric: 'steps', value: 900, at: at(9) },
      { metric: 'steps', value: 400, at: at(15) },
    ],
    NOW,
  );
  const [hr, hrv, steps] = v.series;
  assert.deepEqual(pairInsight(hr, hrv, { hrv: 50 }), [
    'HRV dipped as heart rate peaked, around 2p.',
    'Heart rate 60 to 120 bpm today · HRV 10% below your usual',
  ]);
  // Too few hours together: today's ranges, and what more readings will show.
  assert.deepEqual(pairInsight(steps, hr, {}), ['Steps 1,300 so far today · Heart rate 60 to 120 bpm today', 'More readings through the day will show how they move together.']);
  // Rotation: a new metric replaces the older of the two; a selected one swaps the order.
  assert.deepEqual(rotatePair(['heart_rate', 'hrv'], 'steps'), ['hrv', 'steps']);
  assert.deepEqual(rotatePair(['heart_rate', 'hrv'], 'hrv'), ['hrv', 'heart_rate']);
  assert.deepEqual(rotatePair(['heart_rate'], 'steps'), ['heart_rate', 'steps']);
});
