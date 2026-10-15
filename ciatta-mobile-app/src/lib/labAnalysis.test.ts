import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fingerprint, pickEarlier } from '../../supabase/functions/lab-analysis/facts.ts';
import { testKey as serverKey } from '../../supabase/functions/lab-analysis/keys.ts';
import { analysisHtml, analysisStale, criticalResults, readStoredAnalysis, reportFingerprint, urgentLines } from './labAnalysis';
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

test('the app fingerprints a report exactly as the function does, from the same earlier rows in the same order', () => {
  const report = [r({}), r({ name: 'Hemoglobin', value: 11.2, unit: 'g/dL' })];
  // Newest first, as both sides query them: seven earlier ferritins, two on
  // one day, so which five are kept depends on the order alone.
  const earlier = [30, 29, 28, 27, 26, 25, 24].map((v, i) => r({ value: v, on: `2026-0${Math.max(1, 5 - Math.floor(i / 2))}-01`, documentId: 'doc0' }));
  const rows = earlier.map((x) => ({ name: x.name, value: x.value, value_text: x.valueText, unit: x.unit, on: x.on }));
  const server = fingerprint([
    ...report.map((x) => ({ name: x.name, value: x.value, value_text: x.valueText, unit: x.unit, on: x.on })),
    ...pickEarlier(rows, new Set(report.map((x) => serverKey(x.name)))).flatMap((e) => e.results.map((res) => ({ name: e.name, ...res }))),
  ]);
  assert.equal(reportFingerprint(report, earlier), server);
});

test('a stored analysis is out of date once a newer earlier result for the same test arrives, and not for one beyond the five', () => {
  const report = [r({})];
  const earlier = [22, 21, 20, 19, 18].map((v, i) => r({ value: v, on: `2026-0${5 - i}-01`, documentId: 'doc0' }));
  const stored = { analysis, model: 'gpt-4o', createdAt: '2026-06-13T00:00:00Z', factsHash: reportFingerprint(report, earlier) };
  assert.equal(analysisStale(stored, report, earlier), false);
  assert.equal(analysisStale(stored, report, [...earlier, r({ value: 5, on: '2025-01-01', documentId: 'doc9' })]), false, 'a sixth, older result changes nothing');
  assert.equal(analysisStale(stored, report, [r({ value: 30, on: '2026-06-01', documentId: 'doc9' }), ...earlier]), true);
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

test('the urgent banner always lists every critical result from the lab, whatever the analysis says', () => {
  const results = [r({ name: 'Hemoglobin', value: 6.1, unit: 'g/dL', flag: 'LL' }), r({ name: 'Potassium', value: 6.8, unit: 'mmol/L', flag: 'HH' })];
  const lines = urgentLines(results, {
    ...analysis,
    urgent: [
      { test: 'Hemoglobin', value: '6.1 g/dL', reason: 'Very low hemoglobin can mean significant blood loss.', action: 'urgent_care' },
      { test: 'Ferritin', value: '8 ng/mL', reason: 'Iron stores are very low.', action: 'contact_today' },
    ],
  });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /Hemoglobin 6\.1 g\/dL.*Very low hemoglobin.*Seek urgent care/);
  assert.match(lines[1], /Potassium 6\.8 mmol\/L was flagged as critical by the lab\. Contact your clinician today\./);
  assert.match(lines[2], /Ferritin/);
  assert.equal(urgentLines([r({ flag: 'L' })], null).length, 0);
  assert.equal(urgentLines(results, null).length, 2, 'with no analysis, the lab flags alone');
});
