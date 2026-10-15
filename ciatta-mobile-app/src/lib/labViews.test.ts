import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cycleWindows } from './cycleModel';
import { chosenRange, cycleDayAt, cycleLine, isCycleHormone, phaseRangeLine, phaseRanges } from './labCycle';
import { changeSinceLast, type LabResult, labHistory, testKey } from './labs';
import { labSystem, reportSystems } from './labSystems';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'TSH',
  value: 2,
  valueText: null,
  unit: 'mIU/L',
  low: 0.4,
  high: 4,
  rangeText: '0.4 to 4.0',
  flag: null,
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  ...over,
});

// ── Test identity ────────────────────────────────────────────────────

test('the same test spelled differently by two labs is one test', () => {
  assert.equal(testKey('Hemoglobin A1c'), testKey('HbA1c'));
  assert.equal(testKey(' HEMOGLOBIN  A1C '), testKey('A1C'));
  assert.equal(testKey('Vitamin D, 25 Hydroxy'), testKey('25 hydroxy vitamin D'));
  assert.equal(testKey('TSH'), testKey('Thyroid Stimulating Hormone'));
  assert.notEqual(testKey('Free T4'), testKey('TSH'));
});

test('a test history gathers every spelling of it, oldest first', () => {
  const h = labHistory([r({ name: 'HbA1c', on: '2026-06-01', value: 5.9 }), r({ name: 'Hemoglobin A1c', on: '2026-01-01', value: 5.6 })], 'A1C');
  assert.deepEqual(h.map((x) => x.value), [5.6, 5.9]);
});

// ── Change since last ────────────────────────────────────────────────

test('the change since the previous result, in words', () => {
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 59, on: '2026-06-12' })]), 'Up 18% since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 40, on: '2026-06-12' })]), 'Down 20% since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50, on: '2026-03-03' }), r({ value: 50, on: '2026-06-12' })]), 'No change since 3 Mar 2026');
  assert.equal(changeSinceLast([r({ value: 50 })]), 'No earlier result');
});

test('results in different units are never compared', () => {
  assert.equal(changeSinceLast([r({ value: 100, unit: 'mg/dL' }), r({ value: 5.5, unit: 'mmol/L', on: '2026-07-01' })]), 'Earlier result in a different unit');
});

test('results in words are not compared', () => {
  assert.equal(changeSinceLast([r({ value: null, valueText: 'Negative' }), r({ value: null, valueText: 'Positive', on: '2026-07-01' })]), 'No earlier result');
});

// ── Body systems ─────────────────────────────────────────────────────

test('each test goes to one body system by an explicit table', () => {
  assert.equal(labSystem('Ferritin'), 'Circulatory');
  assert.equal(labSystem('Hemoglobin'), 'Circulatory');
  assert.equal(labSystem('HbA1c'), 'Metabolic');
  assert.equal(labSystem('TSH'), 'Metabolic');
  assert.equal(labSystem('ALT'), 'Digestive');
  assert.equal(labSystem('Creatinine'), 'Urinary');
  assert.equal(labSystem('Estradiol'), 'Reproductive');
  assert.equal(labSystem('C Reactive Protein'), 'Immune');
  assert.equal(labSystem('Calcium'), 'Musculoskeletal');
  assert.equal(labSystem('Something Unusual'), null);
});

test('a report lights the systems it touches, flags the ones with results outside range, and keeps the rest under Whole Body', () => {
  const rs = [r({ name: 'Ferritin', value: 8, low: 15, high: 150, rangeText: '15 to 150' }), r({ name: 'TSH' }), r({ name: 'Mystery marker' })];
  const out = reportSystems(rs);
  assert.deepEqual(out.systems.map((s) => [s.system, s.flagged, s.results.length]), [
    ['Circulatory', true, 1],
    ['Metabolic', false, 1],
  ]);
  assert.deepEqual(out.whole.map((x) => x.name), ['Mystery marker']);
});

// ── Cycle ────────────────────────────────────────────────────────────

const windows = cycleWindows([new Date(2026, 4, 20), new Date(2026, 5, 17)]);

test('the cycle hormones are the ones whose ranges depend on the cycle', () => {
  for (const n of ['Estradiol', 'Progesterone', 'LH', 'FSH', 'Prolactin', 'Testosterone, Total']) assert.ok(isCycleHormone(n), n);
  assert.equal(isCycleHormone('TSH'), false);
});

test('the cycle day at a draw is counted from the period before it', () => {
  const at = cycleDayAt('2026-06-19', windows, 28);
  assert.equal(at?.day, 3);
  assert.equal(at?.phase, 'During period');
  assert.equal(at?.likely, 'Menstrual');
  assert.equal(cycleLine(at), 'Cycle day 3, during period');
});

test('with no period logged in the 45 days before a draw, the cycle day is not known', () => {
  assert.equal(cycleDayAt('2026-09-30', windows, 28), null);
  assert.equal(cycleDayAt('2026-04-01', windows, 28), null, 'before her first logged period');
  assert.equal(cycleLine(null), 'Cycle day at this test is not known. Log your periods to see it.');
});

test('a range printed by phase is split into its phases', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Ovulation 85.8 to 498; Luteal 43.8 to 211\nPostmenopausal <54.7');
  assert.deepEqual(ranges.map((p) => [p.phase, p.low, p.high]), [
    ['Follicular', 12.5, 166],
    ['Ovulation', 85.8, 498],
    ['Luteal', 43.8, 211],
    ['Postmenopausal', null, 54.7],
  ]);
  assert.deepEqual(phaseRanges('12.5 to 166'), [], 'one plain range is not phase ranges');
  assert.deepEqual(phaseRanges(null), []);
});

test('the range for her likely phase is the one chosen, and none when the phase is not known', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Luteal 43.8 to 211');
  assert.equal(chosenRange(ranges, 'Luteal')?.phase, 'Luteal');
  assert.equal(chosenRange(ranges, 'Menstrual')?.phase, 'Follicular', 'menstrual days are early follicular');
  assert.equal(chosenRange(ranges, null), null);
  assert.equal(chosenRange(ranges, 'Ovulatory'), null, 'no printed ovulation range, so none is chosen');
});

test('the phase range line names the likely one and still shows every printed range', () => {
  const ranges = phaseRanges('Follicular 12.5 to 166 / Luteal 43.8 to 211');
  assert.equal(phaseRangeLine(ranges, ranges[1], 'Likely luteal'), 'Likely luteal: Luteal range 43.8 to 211. All printed: Follicular 12.5 to 166, Luteal 43.8 to 211');
  assert.equal(phaseRangeLine(ranges, null, null), 'Printed by phase: Follicular 12.5 to 166, Luteal 43.8 to 211');
  assert.equal(phaseRangeLine([], null, null), '');
});
