import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay, shortDate } from '../data/cycleLog';
import { lensFor, safetyNotes } from './cycleLens';
import { cycleWindows, regularity } from './cycleModel';
import type { CycleProfile } from './cycleProfile';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
// Completed lengths oldest first; the current cycle started 11 days ago.
function windowsOf(lengths: number[]) {
  let ago = 11;
  const starts = [day(ago)];
  for (const l of [...lengths].reverse()) {
    ago += l;
    starts.unshift(day(ago));
  }
  return cycleWindows(starts);
}
function lens(profile: Partial<CycleProfile>, windows = windowsOf([34, 26, 41, 30])) {
  const p: CycleProfile = { situations: [], setupDone: true, ...profile };
  return lensFor({ profile: p, windows, regularity: regularity(windows, p), now: NOW });
}

test('irregular endometriosis: days since period, length dots, endometriosis pain questions', () => {
  const l = lens({ situations: ['Endometriosis', 'Irregular'] });
  assert.deepEqual(l.header, { value: 'Day 12', label: 'Since your last period' });
  assert.deepEqual(l.secondary, { value: '41 days', label: 'Longest gap' });
  assert.equal(l.chart, 'lengthDots');
  assert.equal(l.predicts, false);
  assert.equal(l.painSplit, true);
  assert.ok(l.contexts.includes('Pain with bowel movements'));
  assert.ok(l.kinds.includes('Bowel movement'));
  assert.ok(l.symptoms.includes('Positive ovulation test'));
});

test('regular steady cycles show the day and a likely next period', () => {
  const l = lens({ situations: ['Regular'] }, windowsOf([28, 29, 30]));
  assert.deepEqual(l.header, { value: 'Day 12', label: 'Current cycle' });
  assert.deepEqual(l.secondary, { value: '28 to 30 days', label: 'Recent range' });
  assert.equal(l.predicts, true);
  assert.match(l.notes[0], /next period may start around/);
});

test('recent range ignores cycles older than the last six', () => {
  const l = lens({ situations: ['Regular'] }, windowsOf([50, 28, 29, 30, 28, 29, 30]));
  assert.equal(l.predicts, true);
  assert.deepEqual(l.secondary, { value: '28 to 30 days', label: 'Recent range' });
});

test('postpartum shows weeks since birth and no predictions', () => {
  const l = lens({ situations: ['Postpartum'], birthDate: isoDay(day(98)), breastfeeding: true }, []);
  assert.deepEqual(l.header, { value: 'Week 14', label: 'Since birth' });
  assert.deepEqual(l.secondary, { value: 'None yet', label: 'Periods since birth' });
  assert.equal(l.chart, 'postpartumTimeline');
  assert.ok(l.kinds.includes('Postpartum bleeding'));
  assert.ok(l.symptoms.includes('Low mood'));
  assert.equal(l.empty, false);
});

test('postpartum predicts once post birth cycles are steady, from post birth cycles only', () => {
  // Starts 228, 168, 98, 70, 41 and 11 days ago; the birth was 100 days ago,
  // so only the 28, 29 and 30 day cycles count. All six would give a median of 30.
  const l = lens({ situations: ['Postpartum'], birthDate: isoDay(day(100)) }, windowsOf([60, 70, 28, 29, 30]));
  assert.deepEqual(l.header, { value: 'Week 14', label: 'Since birth' });
  assert.equal(l.predicts, true);
  assert.deepEqual(l.lengths, [28, 29, 30]);
  assert.ok(l.notes.includes(`Your cycles usually run about 29 days, so your next period may start around ${shortDate(addDays(day(11), 29))}.`));
  assert.ok(!l.notes.some((n) => /no next period date/.test(n)));
});

test('perimenopause under a month since the last period says so', () => {
  const l = lens({ situations: ['Perimenopause'], lastPeriod: isoDay(day(10)) }, []);
  assert.deepEqual(l.header, { value: 'Under a month', label: 'Since your last period' });
  assert.equal(l.monthsSince, 0);
});

test('perimenopause counts months since the last period', () => {
  const l = lens({ situations: ['Perimenopause'], lastPeriod: isoDay(day(95)) }, []);
  assert.deepEqual(l.header, { value: '3 months', label: 'Since your last period' });
  assert.equal(l.chart, 'monthsSince');
  assert.equal(l.monthsSince, 3);
  assert.ok(l.symptoms.includes('Hot flashes'));
});

test('hormonal contraception adds its bleed types and drops ovulation', () => {
  const l = lens({ situations: ['Hormonal contraception'], contraception: 'Pill' });
  assert.ok(l.kinds.includes('Withdrawal bleed'));
  assert.ok(l.kinds.includes('Breakthrough bleeding'));
  assert.ok(l.kinds.includes('Period'));
  assert.ok(!l.contexts.includes('Ovulation'));
  assert.ok(l.contexts.includes('Missed pill'));
  assert.ok(!l.symptoms.includes('Positive ovulation test'));
});

test('no periods right now tracks symptoms by month', () => {
  assert.deepEqual(lens({ situations: ['No periods right now'] }).header, { value: 'No periods', label: 'Tracking symptoms by month' });
});

test('nothing logged and nothing set shows an empty state', () => {
  const l = lens({ setupDone: false }, []);
  assert.equal(l.empty, true);
  assert.equal(l.header.value, 'No period logged yet');
});

test('endometriosis during perimenopause merges both lenses', () => {
  const l = lens({ situations: ['Endometriosis', 'Perimenopause'], lastPeriod: isoDay(day(95)) }, []);
  assert.equal(l.header.label, 'Since your last period');
  assert.ok(l.contexts.includes('Pain during sex'));
  assert.ok(l.symptoms.includes('Night sweats'));
  assert.equal(l.painSplit, true);
});

test('options have no duplicates and Other stays last', () => {
  const l = lens({ situations: ['PCOS / PMOS', 'Perimenopause', 'Endometriosis'] });
  assert.equal(new Set(l.symptoms).size, l.symptoms.length);
  assert.equal(l.symptoms[l.symptoms.length - 1], 'Other');
  assert.equal(new Set(l.contexts).size, l.contexts.length);
});

test('safety notes appear only when triggered', () => {
  const none: CycleProfile = { situations: [], setupDone: true };
  assert.deepEqual(safetyNotes({ kinds: ['Period'], flow: 'Heavy', bowelFlags: [] }, none), []);
  assert.match(safetyNotes({ kinds: ['Period'], flow: 'Very heavy', bowelFlags: [] }, none)[0], /Soaking through/);
  assert.match(
    safetyNotes({ kinds: ['Postpartum bleeding'], flow: 'Heavy', bowelFlags: [] }, { ...none, situations: ['Postpartum'] })[0],
    /urgent care/,
  );
  assert.match(safetyNotes({ kinds: ['Bowel movement'], flow: null, bowelFlags: ['Blood'] }, none)[0], /Blood in your stool/);
});
