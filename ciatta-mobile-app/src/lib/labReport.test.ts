import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LabResult } from './labs';
import { countLine, reportPanels, reportResults } from './labReport';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'TSH',
  value: 2,
  valueText: null,
  unit: null,
  low: 0.4,
  high: 4,
  rangeText: '0.4 to 4.0',
  flag: null,
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  documentId: 'doc1',
  panel: null,
  ...over,
});

test('a report opens on its own results; a provider draw on the same day keeps its own', () => {
  const labs = [
    r({ id: 'a', documentId: 'doc1' }),
    r({ id: 'b', documentId: 'doc2' }),
    r({ id: 'c', documentId: null, source: 'provider' }),
    r({ id: 'd', documentId: null, source: 'provider', on: '2026-06-13' }),
  ];
  assert.deepEqual(reportResults(labs, { documentId: 'doc1', on: '2026-06-12', lab: 'Quest' }).map((x) => x.id), ['a']);
  assert.deepEqual(reportResults(labs, { documentId: null, on: '2026-06-12', lab: 'Quest' }).map((x) => x.id), ['c']);
});

test('the count line says what is high, low, in range and without a range, leaving out what is none', () => {
  const rs = [
    r({ value: 5 }),
    r({ value: 9 }),
    r({ value: 0.1 }),
    r({ value: 2 }),
    r({ value: 1, low: null, high: null, rangeText: null }),
    r({ value: 1, flag: 'HH' }),
  ];
  assert.equal(countLine(rs), '3 high, 1 low, 1 in range, 1 with no range given');
  assert.equal(countLine([r({ value: 2 })]), '1 in range');
  assert.equal(countLine([r({ value: null, valueText: 'Positive', flag: 'A' })]), '1 abnormal');
});

test('panels keep their printed order, and results outside range come first in each', () => {
  const rs = [
    r({ id: 'h', name: 'Hemoglobin', panel: 'CBC', value: 13, low: 12, high: 15.5 }),
    r({ id: 't', name: 'TSH', panel: 'Thyroid' }),
    r({ id: 'w', name: 'WBC', panel: 'CBC', value: 2, low: 4, high: 11 }),
  ];
  assert.deepEqual(reportPanels(rs).map((p) => [p.title, p.items.map((x) => x.id)]), [
    ['CBC', ['w', 'h']],
    ['Thyroid', ['t']],
  ]);
});

test('in Records, a report and a provider draw from the same lab on the same day stay two draws', async () => {
  const { labDraws } = await import('./labs');
  const draws = labDraws([r({ id: 'a', documentId: 'doc1' }), r({ id: 'c', documentId: null, source: 'provider' })]);
  assert.equal(draws.length, 2);
});
