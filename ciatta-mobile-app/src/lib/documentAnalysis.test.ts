import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractionFingerprint as serverFingerprint } from '../../supabase/functions/document-analysis/facts.ts';
import { docAnalysisHtml, documentUrgentLines, extractionFingerprint, readStoredDocAnalysis } from './documentAnalysis';

const analysis = { urgent: [], summary: 'A summary.', terms: [{ term: 'Impression', meaning: 'The conclusion.' }], findings: [], patterns: [], considerations: [], next_steps: [], questions: [] };

test('the app fingerprints a document exactly as the function does', () => {
  const x = { doc_type: 'imaging', report: { impression: 'Benign.', findings: 'A cyst.' }, date: '2026-09-02' };
  assert.equal(extractionFingerprint(x), serverFingerprint(x));
  assert.equal(extractionFingerprint({ date: '2026-09-02', report: { findings: 'A cyst.', impression: 'Benign.' }, doc_type: 'imaging' }), serverFingerprint(x));
});

test('the urgent banner shows the document’s own urgent words, and the analysis’s urgent items', () => {
  const x = { report: { impression: 'Urgent surgical consultation recommended. No other findings.' } };
  const lines = documentUrgentLines(x, { ...analysis, urgent: [{ item: 'Free fluid', reason: 'May need surgery.', action: 'urgent_care' }] });
  assert.match(lines[0], /The document says: Urgent surgical consultation recommended\./);
  assert.match(lines[1], /Free fluid\. May need surgery\. Seek urgent care\./);
  assert.deepEqual(documentUrgentLines({ report: { impression: 'Benign cyst.' } }, null), []);
});

test('a stored row is read only in shape', () => {
  assert.equal(readStoredDocAnalysis(null), null);
  assert.equal(readStoredDocAnalysis({ analysis, model: 'gpt-4o', created_at: '2026-10-15T00:00:00Z', facts_hash: 'h' })?.analysis.terms.length, 1);
});

test('the printed analysis carries the label', () => {
  assert.match(docAnalysisHtml('Ultrasound', '2026-09-02', { analysis, model: 'gpt-4o', createdAt: '2026-10-15T00:00:00Z', factsHash: 'h' }), /Not a diagnosis/);
});
