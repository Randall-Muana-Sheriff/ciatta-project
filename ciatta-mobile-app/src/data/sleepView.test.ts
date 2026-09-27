import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COPY_DASH } from '../lib/displayCopy';
import type { DailyRow } from '../lib/healthMetrics';
import { addDays, isoDay } from './cycleLog';
import { daysFromRows } from './dailyRows';
import * as sample from './sample';
import { FULL_BAR_HOURS, sleepView, type SleepView } from './sleepView';

// Sunday 27 September 2026. The 91 day window then begins on Monday 29
// June, so it holds thirteen whole weeks.
const TODAY = new Date(2026, 8, 27);
const ago = (n: number) => isoDay(addDays(TODAY, -n));

// A record with a night on each of the days named, and a steps row on the
// first day of the window so the window is always the full 91 days.
function record(nights: Record<number, number>, extra: Record<number, Partial<DailyRow>> = {}) {
  const rows = new Map<string, DailyRow>();
  rows.set(ago(90), { day: ago(90), steps: 100 });
  for (const [n, hours] of Object.entries(nights)) {
    const day = ago(Number(n));
    rows.set(day, { ...rows.get(day), day, sleep_hours: hours });
  }
  for (const [n, fields] of Object.entries(extra)) {
    const day = ago(Number(n));
    rows.set(day, { ...rows.get(day), day, ...fields });
  }
  return daysFromRows([...rows.values()], TODAY);
}

const every = (from: number, to: number, hours: number) =>
  Object.fromEntries(Array.from({ length: from - to + 1 }, (_, i) => [to + i, hours]));

test('a record with no night in it has no sleep view', () => {
  assert.equal(sleepView([]), null);
  assert.equal(sleepView(record({})), null);
  // Time in bed alone is where she was, not a night of sleep.
  assert.equal(sleepView(record({}, { 3: { time_in_bed: 6 } })), null);
});

test('the average is over the nights recorded in the last four weeks, and gaps are not nights', () => {
  const view = sleepView(record({ 1: 6, 2: 7, 10: 8, 40: 3 }))!;
  assert.equal(view.caption, 'Average, last 4 weeks');
  assert.deepEqual(view.average, { hours: 7, minutes: 0 });
  assert.equal(view.averageLabel, '7h 00m');
  assert.deepEqual(view.tiles, [{ value: '3 of 28', label: 'Nights recorded' }]);
});

test('with no night in the last four weeks the average is over every night there is, and says so', () => {
  const view = sleepView(record({ 40: 6, 41: 7 }))!;
  assert.equal(view.caption, 'Average, 2 nights recorded');
  assert.deepEqual(view.average, { hours: 6, minutes: 30 });
  assert.deepEqual(view.tiles, [{ value: '2', label: 'Nights recorded' }]);
});

test('her typical is named only once twenty nights stand behind it', () => {
  const thin = sleepView(record({ ...every(60, 42, 7), 1: 6 }))!;
  assert.equal(thin.vsTypical, 'Too few nights yet to say what is typical for you');
  assert.equal(thin.below, false);

  const under = sleepView(record({ ...every(60, 41, 7), 1: 6.5, 2: 6.5 }))!;
  assert.equal(under.vsTypical, '30m under your typical 7h 00m');
  assert.equal(under.below, true);

  const over = sleepView(record({ ...every(60, 41, 7), 1: 8.25 }))!;
  assert.equal(over.vsTypical, '1h 15m over your typical 7h 00m');
  assert.equal(over.below, false);

  const level = sleepView(record({ ...every(60, 41, 7), 1: 7 }))!;
  assert.equal(level.vsTypical, 'In line with your typical 7h 00m');
});

test('a night inside the last five weeks is not part of what is typical', () => {
  // Twenty nights, but the most recent of them only 34 days back.
  const view = sleepView(record({ ...every(53, 34, 7), 1: 6 }))!;
  assert.equal(view.vsTypical, 'Too few nights yet to say what is typical for you');
});

test('weeks run Monday to Sunday, and a week with no night is a gap', () => {
  const view = sleepView(record({ 0: 7, 6: 7, 7: 3.5 }))!;
  assert.equal(view.weekly.length, 13);
  // The last week holds Monday 21 (6 days back) and Sunday 27 (today); the
  // week before it holds Sunday 20 alone.
  assert.equal(view.weekly[12], 7 / FULL_BAR_HOURS);
  assert.equal(view.weekly[11], 3.5 / FULL_BAR_HOURS);
  assert.equal(view.weekly[10], null);
  assert.equal(view.weekly.filter((w) => w != null).length, 2);
});

test('a bar never stands taller than the chart', () => {
  const view = sleepView(record({ 0: 12 }))!;
  assert.equal(view.weekly[12], 1);
});

test('the months are labelled where they begin, and the first bar when there is room', () => {
  const view = sleepView(record({ 0: 7 }))!;
  // Mondays: 29 June, then July from the 6th, August from the 3rd,
  // September from the 7th. June has one week, too close to July to label.
  assert.deepEqual(view.weekLabels, [
    { label: 'Jul', i: 1 },
    { label: 'Aug', i: 5 },
    { label: 'Sep', i: 10 },
  ]);
});

test('the lowest weeks are the two lowest of the weeks with enough nights to say', () => {
  const view = sleepView(
    record({
      // Week of 21 September: three nights averaging 6h.
      0: 6, 1: 6, 2: 6,
      // Week of 14 September: three nights averaging 5h, one of them short.
      7: 4, 8: 5, 9: 6,
      // Week of 7 September: four nights averaging 7h.
      14: 7, 15: 7, 16: 7, 17: 7,
      // Week of 31 August: one night of 2h, too thin to be called a week.
      21: 2,
    }),
  )!;
  assert.deepEqual(view.lowWeeks, [11, 12]);
  assert.deepEqual(
    view.lowest.map((w) => [w.week, w.value]),
    [
      ['Week of 14 Sep', '5h 00m'],
      ['Week of 21 Sep', '6h 00m'],
    ],
  );
  assert.deepEqual(view.lowest[0].facts, [
    { label: 'Nights recorded', value: '3 of 7' },
    { label: 'Shortest night', value: '4h 00m' },
    { label: 'Longest night', value: '6h 00m' },
  ]);
  // Friday, Saturday and Sunday of that week, Monday first.
  assert.deepEqual(view.lowest[0].nights, [null, null, null, null, 6 / FULL_BAR_HOURS, 5 / FULL_BAR_HOURS, 4 / FULL_BAR_HOURS]);
});

test('with too few weeks to rank, none is called the lowest', () => {
  const view = sleepView(record({ 0: 6, 1: 6, 2: 6, 7: 4, 8: 5, 9: 6 }))!;
  assert.deepEqual(view.lowWeeks, []);
  assert.deepEqual(view.lowest, []);
});

test('time in bed is averaged over the nights that recorded it', () => {
  const view = sleepView(record({ 1: 6, 2: 7 }, { 1: { time_in_bed: 7 }, 2: { time_in_bed: 8 } }))!;
  assert.deepEqual(view.tiles, [
    { value: '7h 30m', label: 'Time in bed' },
    { value: '2 of 28', label: 'Nights recorded' },
  ]);
});

test('nothing the view says carries a dash', () => {
  const view = sleepView(record({ ...every(60, 41, 7), 0: 6, 1: 6, 2: 6, 7: 4, 8: 5, 9: 6, 14: 7, 15: 7, 16: 7 }))!;
  const said = [
    view.caption,
    view.averageLabel,
    view.vsTypical,
    view.source,
    ...view.weekLabels.map((l) => l.label),
    ...view.tiles.flatMap((t) => [t.value, t.label]),
    ...view.lowest.flatMap((w) => [w.week, w.value, ...w.facts.flatMap((f) => [f.label, f.value])]),
  ];
  for (const line of said) assert.equal(COPY_DASH.test(line), false, line);
});

test('the sample person reads through the same shape', () => {
  const view: SleepView = sample.sleep;
  assert.equal(view.weekly.length, 18);
  assert.equal(view.weekLabels.length, 4);
});
