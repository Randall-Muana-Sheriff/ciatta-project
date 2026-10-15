import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type LabResult,
  drawsFromLabs,
  labDraws,
  labHistory,
  labStatus,
  latestSummary,
  parseRange,
  rangePosition,
  readLabScan,
  testFromFields, groupByPanel, OTHER_RESULTS } from './labs';

const lab = (over: Partial<LabResult>): LabResult => ({
  id: 'x',
  name: 'Ferritin',
  value: 41,
  valueText: null,
  unit: 'ng/mL',
  low: 15,
  high: 150,
  rangeText: '15 to 150',
  flag: null,
  status: 'final',
  source: 'provider',
  lab: 'Quest Diagnostics',
  on: '2026-06-12',
  ...over,
});

test('the lab\'s own flag comes first, in the words patient portals use', () => {
  assert.deepEqual(labStatus(lab({ flag: 'HH', value: 9 })), { key: 'criticalHigh', label: 'Critically high', basis: 'Flagged by the lab' });
  assert.deepEqual(labStatus(lab({ flag: 'LL' })), { key: 'criticalLow', label: 'Critically low', basis: 'Flagged by the lab' });
  assert.deepEqual(labStatus(lab({ flag: 'A', value: null, valueText: 'Positive' })), { key: 'abnormal', label: 'Abnormal', basis: 'Flagged by the lab' });
  assert.equal(labStatus(lab({ flag: 'N', value: 400 })).key, 'inRange', 'a lab that says normal is believed over the arithmetic');
});

test('without a flag, the value is compared with the lab\'s printed range, and says so', () => {
  assert.deepEqual(labStatus(lab({ value: 12 })), { key: 'low', label: 'Low', basis: 'Compared with the lab\'s range' });
  assert.deepEqual(labStatus(lab({ value: 160 })), { key: 'high', label: 'High', basis: 'Compared with the lab\'s range' });
  assert.deepEqual(labStatus(lab({ value: 41 })), { key: 'inRange', label: 'In range', basis: 'Compared with the lab\'s range' });
  // Only one end printed: "<5".
  assert.equal(labStatus(lab({ value: 7, low: null, high: 5 })).key, 'high');
  assert.equal(labStatus(lab({ value: 3, low: null, high: 5 })).key, 'inRange');
});

test('no range and no flag is not judged', () => {
  assert.deepEqual(labStatus(lab({ low: null, high: null, rangeText: null })), { key: 'noRange', label: 'No range given', basis: null });
  assert.equal(labStatus(lab({ value: null, valueText: 'See note', low: null, high: null, rangeText: 'Negative' })).key, 'noRange');
});

test('printed ranges are read as the lab wrote them', () => {
  assert.deepEqual(parseRange('15 to 150'), { low: 15, high: 150 });
  assert.deepEqual(parseRange('15-150'), { low: 15, high: 150 });
  assert.deepEqual(parseRange('0.4 - 4.0'), { low: 0.4, high: 4 });
  assert.deepEqual(parseRange('<5'), { low: null, high: 5 });
  assert.deepEqual(parseRange('> 60'), { low: 60, high: null });
  assert.deepEqual(parseRange('Negative'), { low: null, high: null });
  assert.deepEqual(parseRange(null), { low: null, high: null });
});

test('where a value sits on the range bar, the range in the middle third', () => {
  assert.equal(rangePosition(lab({ value: 15 }))!.value, 1 / 3);
  assert.equal(rangePosition(lab({ value: 150 }))!.value, 2 / 3);
  assert.ok(rangePosition(lab({ value: 5 }))!.value < 1 / 3);
  assert.equal(rangePosition(lab({ value: 9999 }))!.value, 1, 'far outside stays on the bar');
  assert.equal(rangePosition(lab({ value: null })), null);
  assert.equal(rangePosition(lab({ low: null, high: null })), null);
});

test('results group into visits, newest first, each counting what is outside its range', () => {
  const draws = labDraws([
    lab({ id: 'a', on: '2026-06-12', value: 12 }),
    lab({ id: 'b', on: '2026-06-12', name: 'TSH', value: 2.3, low: 0.4, high: 4, unit: 'mIU/L' }),
    lab({ id: 'c', on: '2026-02-03', value: 41 }),
  ]);
  assert.deepEqual(draws.map((d) => [d.on, d.results.length, d.outside]), [['2026-06-12', 2, 1], ['2026-02-03', 1, 0]]);
  assert.equal(draws[0].lab, 'Quest Diagnostics');
});

test('a test\'s history is every result for it, oldest first, whatever case it was written in', () => {
  const h = labHistory([lab({ id: '1', on: '2026-06-12', value: 12 }), lab({ id: '2', on: '2026-02-03', name: 'FERRITIN', value: 41 }), lab({ id: '3', name: 'TSH' })], 'Ferritin');
  assert.deepEqual(h.map((r) => r.value), [41, 12]);
});

test('the summary of her latest labs', () => {
  const s = latestSummary([lab({ on: '2026-06-12', value: 12 }), lab({ on: '2026-06-12', name: 'TSH', value: 2 , low: 0.4, high: 4 }), lab({ on: '2026-01-01', value: 999 })]);
  assert.equal(s, '1 of 2 outside range in your latest labs, 12 Jun 2026');
  assert.equal(latestSummary([]), null);
});

test('what the model read off a report is checked before she sees it', () => {
  const read = readLabScan({
    not_lab: false,
    collected_on: '2026-06-12',
    lab: 'Quest Diagnostics',
    tests: [
      { name: 'Ferritin', value: 12, value_text: null, unit: 'ng/mL', range: '15 to 150', flag: 'L' },
      { name: 'Hepatitis B surface antigen', value: null, value_text: 'Non reactive', unit: null, range: 'Non reactive', flag: null },
      { name: '', value: 3, value_text: null, unit: 'x', range: null, flag: null },
      { name: 'Glucose', value: null, value_text: null, unit: 'mg/dL', range: '70 to 99', flag: null },
      { name: 'Sodium', value: 140, value_text: null, unit: 'mmol/L', range: '135-145', flag: 'Q' },
    ],
  });
  assert.equal(read.lab, 'Quest Diagnostics');
  assert.equal(read.on, '2026-06-12');
  assert.deepEqual(read.tests.map((t) => t.name), ['Ferritin', 'Hepatitis B surface antigen', 'Sodium']);
  assert.deepEqual(read.tests[0], { name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150', flag: 'L', panel: null });
  assert.equal(read.tests[2].flag, null, 'a flag that is not an HL7 code is dropped');
  assert.equal(read.notLab, false);
  assert.equal(readLabScan({ not_lab: true, tests: [] }).notLab, true);
  assert.equal(readLabScan('nonsense').tests.length, 0);
});

test('a line she edited is read back as a result, a number when it is one', () => {
  assert.deepEqual(testFromFields({ name: ' Ferritin ', value: '12', unit: 'ng/mL', range: '15 to 150', flag: 'L' }), {
    name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150', flag: 'L', panel: null,
  });
  assert.deepEqual(testFromFields({ name: 'HBsAg', value: 'Non reactive', unit: '', range: 'Non reactive', flag: null }), {
    name: 'HBsAg', value: null, valueText: 'Non reactive', unit: null, low: null, high: null, rangeText: 'Non reactive', flag: null, panel: null,
  });
  assert.equal(testFromFields({ name: '', value: '3', unit: '', range: '', flag: null }), null);
  assert.equal(testFromFields({ name: 'TSH', value: ' ', unit: '', range: '', flag: null }), null);
});

test('her labs as the visits insights and the body read, newest first, numbers with both ends of a range only', () => {
  const draws = drawsFromLabs([
    lab({ id: '1', on: '2026-02-03', value: 34 }),
    lab({ id: '2', on: '2026-06-12', value: 12 }),
    lab({ id: '3', on: '2026-06-12', name: 'HBsAg', value: null, valueText: 'Negative', low: null, high: null }),
    lab({ id: '4', on: '2026-06-12', name: 'LDL', value: 90, low: null, high: 100 }),
  ]);
  assert.deepEqual(draws, [
    { date: '12 Jun 2026', lab: 'Quest Diagnostics', results: [{ name: 'Ferritin', value: '12 ng/mL', range: '15 to 150', status: 'Low' }] },
    { date: '3 Feb 2026', lab: 'Quest Diagnostics', results: [{ name: 'Ferritin', value: '34 ng/mL', range: '15 to 150', status: 'In' }] },
  ]);
});

test('a report says which panel each test is printed under, and what else the page printed', () => {
  const read = readLabScan({
    not_lab: false,
    collected_on: '2026-06-12',
    lab: 'Quest Diagnostics',
    ordering_clinician: ' Dr A Rivera ',
    specimen: 'Serum',
    pages: 3,
    unreadable_pages: [3, 0, 'x', 9, 3],
    tests: [
      { name: 'Hemoglobin', value: 11.2, value_text: null, unit: 'g/dL', range: '12.0 to 15.5', flag: 'L', panel: 'Complete Blood Count' },
      { name: 'TSH', value: 2.1, value_text: null, unit: 'mIU/L', range: '0.4 to 4.0', flag: null, panel: '  ' },
    ],
  });
  assert.equal(read.orderingClinician, 'Dr A Rivera');
  assert.equal(read.specimen, 'Serum');
  assert.equal(read.pages, 3);
  assert.deepEqual(read.unreadablePages, [3], 'only page numbers that exist on the report, each once');
  assert.equal(read.tests[0].panel, 'Complete Blood Count');
  assert.equal(read.tests[1].panel, null);
});

test('a report with no page count keeps any positive page numbers it names', () => {
  const read = readLabScan({ not_lab: false, unreadable_pages: [2, -1, 1.5], tests: [] });
  assert.equal(read.pages, null);
  assert.deepEqual(read.unreadablePages, [2]);
});

test('a long report keeps every result it read', () => {
  const tests = Array.from({ length: 150 }, (_, n) => ({ name: `Test ${n}`, value: n, value_text: null, unit: null, range: null, flag: null, panel: null }));
  assert.equal(readLabScan({ not_lab: false, tests }).tests.length, 150);
});

test('a line she edited keeps its panel', () => {
  assert.equal(testFromFields({ name: 'TSH', value: '2', unit: '', range: '', flag: null, panel: ' Thyroid ' })?.panel, 'Thyroid');
  assert.equal(testFromFields({ name: 'TSH', value: '2', unit: '', range: '', flag: null })?.panel, null);
});

test('the review groups lines under their printed panel, in the order printed, with the rest last', () => {
  const lines = [
    { id: 'a', panel: 'Complete Blood Count' },
    { id: 'b', panel: null },
    { id: 'c', panel: 'Thyroid' },
    { id: 'd', panel: 'Complete Blood Count' },
  ];
  assert.deepEqual(groupByPanel(lines), [
    { title: 'Complete Blood Count', items: [lines[0], lines[3]] },
    { title: 'Thyroid', items: [lines[2]] },
    { title: OTHER_RESULTS, items: [lines[1]] },
  ]);
  assert.deepEqual(groupByPanel([]), []);
});
