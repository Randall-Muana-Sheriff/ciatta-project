import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import {
  bucketize,
  dayKeys,
  extras,
  fmt,
  headline,
  metricForRow,
  type Point,
  scaleFor,
  seriesFor,
  seriesForDays,
  hourly,
  RANGES,
  shortDay,
  summary,
  usualFor,
  type VitalDay,
} from './metricDetail';

const NOW = new Date(2026, 9, 14, 9, 0); // 14 Oct 2026, local

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date, sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null,
  steps: null, activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null,
  energy: null, mood: null, stress: null, caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});

const usual = (metric: string, median: number, low: number, high: number) => ({ metric, median, low, high, n: 40, sufficient: true });

test('a range is that many of her calendar days, ending today, oldest first', () => {
  const week = dayKeys('week', NOW);
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-10-08');
  assert.equal(week[6], '2026-10-14');
  assert.equal(dayKeys('year', NOW).length, 365);
});

test('a night with no reading is a gap, never a zero', () => {
  const days = [day('2026-10-12', { sleepHours: 7 }), day('2026-10-13', { sleepHours: null })];
  const points = seriesFor('sleep', days, [], 'week', NOW);
  assert.equal(points.length, 7);
  assert.deepEqual(points.slice(4).map((p) => p.value), [7, null, null]);
});

test('blood pressure carries both numbers; blood oxygen comes from the day averages', () => {
  const vitals: VitalDay[] = [
    { metric: 'blood_pressure_systolic', day: '2026-10-13', avg: 121, min: 118, max: 124, n: 2 },
    { metric: 'blood_pressure_diastolic', day: '2026-10-13', avg: 79, min: 78, max: 80, n: 2 },
    { metric: 'oxygen_saturation', day: '2026-10-14', avg: 97, min: 94, max: 99, n: 5 },
  ];
  const bp = seriesFor('bp', [], vitals, 'week', NOW);
  assert.deepEqual(bp[5], { day: '2026-10-13', value: 121, low: 79 });
  const spo2 = seriesFor('spo2', [], vitals, 'week', NOW);
  assert.deepEqual(spo2[6], { day: '2026-10-14', value: 97, low: 94 });
});

test('the ranges are Journey\'s, day first: Day, Week, Month, Year', () => {
  assert.deepEqual(RANGES.map((r) => r.label), ['Day', 'Week', 'Month', 'Year']);
  assert.equal(RANGES[0].key, 'day');
});

test('a week and a month are drawn a day at a time; a year as monthly averages', () => {
  const pts: Point[] = dayKeys('year', NOW).map((d) => ({ day: d, value: d.startsWith('2026-10') ? 6 : d.startsWith('2026-09') ? 8 : null }));
  const months = bucketize(pts, 'year');
  assert.equal(months.length, 13, 'the part months at each end count');
  assert.equal(months[0].day, '2025-10');
  assert.equal(months[months.length - 1].day, '2026-10');
  assert.equal(months[months.length - 1].value, 6);
  assert.equal(months[months.length - 2].value, 8);
  assert.equal(months[0].value, null, 'a month with no readings stays empty');
  assert.equal(bucketize(pts.slice(-7), 'week').length, 7);
});

test('a day is drawn hour by hour from today\'s readings', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m).toISOString();
  const readings = [
    { metric: 'resting_heart_rate', value: 60, at: at(7) },
    { metric: 'resting_heart_rate', value: 64, at: at(7, 30) },
    { metric: 'resting_heart_rate', value: 58, at: at(8) },
    { metric: 'resting_heart_rate', value: 99, at: new Date(2026, 9, 13, 8).toISOString() }, // yesterday
    { metric: 'steps', value: 300, at: at(8) },
    { metric: 'steps', value: 200, at: at(8, 40) },
    { metric: 'oxygen_saturation', value: 0.97, at: at(3) },
    { metric: 'blood_pressure_systolic', value: 120, at: at(9) },
    { metric: 'blood_pressure_diastolic', value: 78, at: at(9) },
  ];
  const rhr = hourly('rhr', readings, NOW);
  assert.equal(rhr.length, 24);
  assert.equal(rhr[0].day, '2026-10-14T00');
  assert.equal(rhr[7].value, 62);
  assert.equal(rhr[8].value, 58);
  assert.equal(rhr.filter((p) => p.value != null).length, 2, 'yesterday is not today');
  assert.equal(hourly('steps', readings, NOW)[8].value, 500, 'steps add up within the hour');
  assert.equal(hourly('spo2', readings, NOW)[3].value, 97, 'a fraction is read as a percent');
  assert.deepEqual(hourly('bp', readings, NOW)[9], { day: '2026-10-14T09', value: 120, low: 78 });
  // Sleep is a night and skin temperature one reading a night: no hours.
  assert.deepEqual(hourly('sleep', readings, NOW), []);
  assert.deepEqual(hourly('temp', readings, NOW), []);
});

test('labels for an hour, a day and a month', () => {
  assert.equal(shortDay('2026-10-14T00'), '12a');
  assert.equal(shortDay('2026-10-14T15'), '3p');
  assert.equal(shortDay('2026-10-14'), '14 Oct');
  assert.equal(shortDay('2026-10'), 'Oct');
});

test('a day\'s summary counts hours; steps say the total so far', () => {
  const pts: Point[] = [{ day: '2026-10-14T07', value: 300 }, { day: '2026-10-14T08', value: 500 }, { day: '2026-10-14T09', value: null }];
  const steps = summary('steps', pts);
  assert.deepEqual(steps[0], { label: 'Total so far', value: '800' });
  assert.deepEqual(steps[steps.length - 1], { label: 'Hours with a reading', value: '2 of 3' });
  const months = summary('hrv', [{ day: '2026-09', value: 40 }, { day: '2026-10', value: null }]);
  assert.deepEqual(months[months.length - 1], { label: 'Months recorded', value: '1 of 2' });
});

test('the summary counts only days that have a reading', () => {
  const s = summary('sleep', [
    { day: '2026-10-12', value: 6 },
    { day: '2026-10-13', value: null },
    { day: '2026-10-14', value: 8 },
  ]);
  assert.deepEqual(s, [
    { label: 'Average', value: '7h 00m' },
    { label: 'Highest', value: '8h 00m', note: '14 Oct' },
    { label: 'Lowest', value: '6h 00m', note: '12 Oct' },
    { label: 'Days recorded', value: '2 of 3' },
  ]);
  assert.deepEqual(summary('sleep', [{ day: '2026-10-14', value: null }]), [{ label: 'Days recorded', value: '0 of 1' }]);
});

test('the latest reading is said against her usual range', () => {
  const pts = [{ day: '2026-10-13', value: 6.2 }, { day: '2026-10-14', value: null }];
  const h = headline('sleep', pts, usualFor('sleep', [usual('sleep_hours', 7.2, 6.6, 7.8)]), NOW);
  assert.equal(h.value, '6h 12m');
  assert.equal(h.when, 'Yesterday');
  assert.equal(h.compare, 'Below your usual range of 6h 36m to 7h 48m');
  const inside = headline('steps', [{ day: '2026-10-14', value: 8000 }], usualFor('steps', [usual('steps', 8200, 6000, 10000)]), NOW);
  assert.equal(inside.when, 'Today');
  assert.equal(inside.compare, 'Within your usual range of 6,000 to 10,000');
});

test('without enough history the usual is not guessed', () => {
  const h = headline('hrv', [{ day: '2026-10-14', value: 41 }], usualFor('hrv', [{ metric: 'hrv', median: null, low: null, high: null, n: 6, sufficient: false }]), NOW);
  assert.equal(h.compare, 'Not enough readings yet to know your usual range');
  assert.equal(headline('hrv', [{ day: '2026-10-14', value: null }], null, NOW).value, null);
});

test('skin temperature is already a difference from usual, said in words', () => {
  const pts = [{ day: '2026-10-14', value: -0.34 }];
  const h = headline('temp', pts, null, NOW);
  assert.equal(h.value, '0.3 °C');
  assert.equal(h.compare, 'Below your usual');
  assert.equal(headline('temp', [{ day: '2026-10-14', value: 0.04 }], null, NOW).compare, 'At your usual');
});

test('blood pressure is compared on both numbers', () => {
  const b = [usual('blood_pressure_systolic', 118, 110, 126), usual('blood_pressure_diastolic', 76, 70, 82)];
  const h = headline('bp', [{ day: '2026-10-14', value: 131, low: 80 }], usualFor('bp', b), NOW);
  assert.equal(h.value, '131/80');
  assert.equal(h.compare, 'Top number above your usual range of 110 to 126');
  assert.equal(headline('bp', [{ day: '2026-10-14', value: 120, low: 78 }], usualFor('bp', b), NOW).compare, 'Within your usual range of 110/70 to 126/82');
});

test('sleep shows stages, time in bed, and its shortest nights', () => {
  const days = [
    day('2026-10-12', { sleepHours: 7, timeInBed: 8, stages: { deep: 60, rem: 90, light: 270, awake: 20 } }),
    day('2026-10-13', { sleepHours: 5.5, timeInBed: 6, stages: { deep: 40, rem: 70, light: 220, awake: 10 } }),
    day('2026-10-14', { sleepHours: 6.5 }),
  ];
  const sections = extras('sleep', days, seriesFor('sleep', days, [], 'week', NOW), [], NOW);
  const titled = (t: string) => sections.find((s) => s.title === t)!.rows;
  assert.deepEqual(titled('Average night by stage'), [
    { label: 'Deep', value: '50 min', note: '13% of sleep' },
    { label: 'REM', value: '1h 20m', note: '21% of sleep' },
    { label: 'Light', value: '4h 05m', note: '65% of sleep' },
    { label: 'Awake', value: '15 min' },
  ]);
  assert.deepEqual(titled('In bed and asleep'), [
    { label: 'Average time in bed', value: '7h 00m' },
    { label: 'Average time asleep', value: '6h 20m' },
    { label: 'Asleep while in bed', value: '89%' },
  ]);
  assert.deepEqual(titled('Shortest nights').map((r) => r.label), ['13 Oct', '14 Oct', '12 Oct']);
});

test('the other metrics each add what belongs beside them', () => {
  const days = [day('2026-10-13', { activeMinutes: 30, restingHR: 60 }), day('2026-10-14', { activeMinutes: 50, restingHR: 64 })];
  const pts = seriesFor('steps', days, [], 'week', NOW);
  assert.deepEqual(extras('steps', days, pts, [], NOW)[0].rows[0], { label: 'Active minutes, daily average', value: '40 min' });
  assert.deepEqual(extras('hrv', days, pts, [usual('resting_hr', 61, 56, 66)], NOW)[0].rows, [
    { label: 'Average resting heart rate', value: '62 bpm' },
    { label: 'Your usual resting heart rate', value: '56 to 66 bpm' },
  ]);
  const temps = [{ day: 'a', value: 0.3 }, { day: 'b', value: -0.2 }, { day: 'c', value: 0.05 }, { day: 'd', value: null }];
  assert.deepEqual(extras('temp', [], temps, [], NOW)[0].rows, [
    { label: 'Nights above usual', value: '1' },
    { label: 'Nights below usual', value: '1' },
    { label: 'Nights at usual', value: '1' },
  ]);
  const spo2 = [{ day: '2026-10-13', value: 97, low: 93 }, { day: '2026-10-14', value: 98, low: 95 }];
  assert.deepEqual(extras('spo2', [], spo2, [], NOW)[0].rows, [{ label: 'Lowest reading', value: '93%', note: '13 Oct' }]);
  const bp = [{ day: '2026-10-13', value: 121, low: 79 }, { day: '2026-10-14', value: null, low: null }];
  assert.deepEqual(extras('bp', [], bp, [], NOW)[0].rows, [{ label: '13 Oct', value: '121/79' }]);
});

test('amounts are drawn from zero; levels around what was seen; temperature either side of usual', () => {
  const sleep = scaleFor('sleep', [{ day: 'a', value: 6 }, { day: 'b', value: 8 }], { median: 7, low: 6.5, high: 9 });
  assert.equal(sleep.min, 0);
  assert.ok(sleep.max >= 9);
  const o2 = scaleFor('spo2', [{ day: 'a', value: 97, low: 93 }, { day: 'b', value: 98, low: 95 }], null);
  assert.ok(o2.min > 80 && o2.min < 93 && o2.max > 98 && o2.max < 101);
  const temp = scaleFor('temp', [{ day: 'a', value: -0.2 }, { day: 'b', value: 0.6 }], null);
  assert.equal(temp.min, -temp.max);
  assert.ok(temp.max >= 0.6);
  const empty = scaleFor('hrv', [{ day: 'a', value: null }], null);
  assert.ok(empty.max > empty.min, 'an empty chart still has a scale');
});

test('rows on the All screen open the metric they belong to', () => {
  assert.equal(metricForRow('Deep'), 'sleep');
  assert.equal(metricForRow('Resting heart rate'), 'rhr');
  assert.equal(metricForRow('Active minutes'), 'steps');
  assert.equal(metricForRow('Blood oxygen'), 'spo2');
  assert.equal(metricForRow('Mood'), null, 'a check in has no metric screen');
});

test('any number of days can be drawn, for a card of 7, 14 or 28', () => {
  const days = [day('2026-10-14', { sleepHours: 7 }), day('2026-10-01', { sleepHours: 6 })];
  const two = seriesForDays('sleep', days, [], 14, NOW);
  assert.equal(two.length, 14);
  assert.equal(two[0].day, '2026-10-01');
  assert.deepEqual([two[0].value, two[13].value], [6, 7]);
});

test('resting heart rate is a level, drawn and compared like HRV', () => {
  const days = [day('2026-10-14', { restingHR: 61.4 })];
  assert.deepEqual(seriesForDays('rhr', days, [], 7, NOW)[6], { day: '2026-10-14', value: 61.4 });
  assert.equal(fmt('rhr', 61.4), '61 bpm');
  const u = usualFor('rhr', [{ metric: 'resting_hr', median: 60, low: 55, high: 66, n: 40, sufficient: true }]);
  assert.deepEqual(u, { median: 60, low: 55, high: 66 });
  assert.ok(scaleFor('rhr', [{ day: 'a', value: 61 }], u).min > 0, 'a level is not drawn from zero');
});
