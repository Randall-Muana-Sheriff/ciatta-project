import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint } from '../../supabase/functions/lab-analysis/facts.ts';
import { testKey as serverKey } from '../../supabase/functions/lab-analysis/keys.ts';
import { analysisHtml, analysisStale, criticalResults, readStoredAnalysis, reportFingerprint } from './labAnalysis';
import { type LabResult, testKey } from './labs';

const r = (over: Partial<LabResult>): LabResult => ({
  id: Math.random().toString(16).slice(2),
  name: 'Ferritin',
  value: 8,
  valueText: null,
  unit: 'ng/mL',
  low: 15,
  high: 150,
  rangeText: '15 to 150',
  flag: 'L',
  status: 'final',
  source: 'report',
  lab: 'Quest',
  on: '2026-06-12',
  documentId: 'doc1',
  panel: null,
  ...over,
});

const analysis = {
  urgent: [],
  summary: 'Your ferritin of 8 ng/mL is low.',
  findings: [],
  patterns: [],
  considerations: [],
  next_tests: [],
  questions: [],
};

test('the app and the function fold test names the same way', () => {
  for (const n of ['Hemoglobin A1c', 'HbA1c', 'Vitamin D, 25 Hydroxy', 'TSH', 'Free T4', 'Something New']) assert.equal(testKey(n), serverKey(n), n);
});

test('the app fingerprints a report exactly as the function does', () => {
  const report = [r({}), r({ name: 'Hemoglobin', value: 11.2, unit: 'g/dL' })];
  const earlier = r({ on: '2026-01-10', value: 22, documentId: 'doc0' });
  const server = fingerprint([
    ...report.map((x) => ({ name: x.name, value: x.value, value_text: x.valueText, unit: x.unit, on: x.on })),
    { name: earlier.name, value: earlier.value, value_text: earlier.valueText, unit: earlier.unit, on: earlier.on },
  ]);
  assert.equal(reportFingerprint(report, [...report, earlier]), server);
});

test('a stored analysis is out of date once an earlier result for the same test arrives', () => {
  const report = [r({})];
  const stored = { analysis, model: 'gpt-4o', createdAt: '2026-06-13T00:00:00Z', factsHash: reportFingerprint(report, report) };
  assert.equal(analysisStale(stored, report, report), false);
  assert.equal(analysisStale(stored, report, [...report, r({ on: '2026-02-01', value: 30, documentId: 'doc0' })]), true);
});

test('critical results come from the lab flags alone', () => {
  assert.deepEqual(criticalResults([r({ flag: 'LL', name: 'Hemoglobin' }), r({ flag: 'L' }), r({ flag: 'AA', name: 'Culture' })]).map((x) => x.name), ['Hemoglobin', 'Culture']);
});

test('a stored row is read only in shape', () => {
  assert.equal(readStoredAnalysis(null), null);
  assert.equal(readStoredAnalysis({ analysis: { summary: '' }, model: 'm', created_at: 'x', facts_hash: 'h' }), null);
  assert.equal(readStoredAnalysis({ analysis, model: 'gpt-4o', created_at: '2026-06-13T00:00:00Z', facts_hash: 'h' })?.model, 'gpt-4o');
});

test('the printed analysis carries the label and no dash or hyphen of its own', () => {
  const html = analysisHtml('Quest', '2026-06-12', { analysis, model: 'gpt-4o', createdAt: '2026-06-13T00:00:00Z', factsHash: 'h' });
  assert.match(html, /Not a diagnosis/);
  assert.ok(!/[—–]/.test(html));
});
