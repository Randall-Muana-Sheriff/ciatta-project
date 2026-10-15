import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeDocumentChunks } from '../../supabase/functions/document-scan/merge.ts';

const visit = (extra: Record<string, unknown>) => ({
  not_medical: false,
  doc_type: 'visit',
  title: null,
  date: null,
  clinician: null,
  facility: null,
  multiple_dates: false,
  unreadable_pages: [],
  visit: { reason: null, diagnoses: [], medications_started: [], medications_stopped: [], medications_changed: [], procedures: [], follow_ups: [], instructions: [], allergies: [] },
  report: null,
  prescription: null,
  referral: null,
  insurance: null,
  other: null,
  ...extra,
});

test('a long visit summary merges its pieces: first details found, every list in page order', () => {
  const merged = mergeDocumentChunks(
    [
      { first: 9, last: 10, parsed: visit({ date: '2026-09-03', visit: { ...visit({}).visit, diagnoses: [{ name: 'B', status: 'new' }], instructions: ['two'] } }) },
      { first: 1, last: 8, parsed: visit({ date: '2026-09-02', clinician: 'Dr Rivera', visit: { ...visit({}).visit, diagnoses: [{ name: 'A', status: 'new' }], instructions: ['one'] } }) },
    ],
    10,
  ) as any;
  assert.equal(merged.date, '2026-09-02');
  assert.equal(merged.clinician, 'Dr Rivera');
  assert.deepEqual(merged.visit.diagnoses.map((d: any) => d.name), ['A', 'B']);
  assert.deepEqual(merged.visit.instructions, ['one', 'two']);
  assert.equal(merged.multiple_dates, true, 'two pieces gave two dates');
  assert.equal(merged.pages, 10);
});

test('the type is the one most pieces agree on, and a failed piece marks its pages', () => {
  const merged = mergeDocumentChunks(
    [
      { first: 1, last: 8, parsed: visit({}) },
      { first: 9, last: 16, parsed: visit({ doc_type: 'lab_report' }) },
      { first: 17, last: 24, parsed: visit({}) },
      { first: 25, last: 26, parsed: null },
    ],
    26,
  ) as any;
  assert.equal(merged.doc_type, 'visit');
  assert.deepEqual(merged.unreadable_pages, [25, 26]);
});

test('it is not medical only when no piece found anything medical', () => {
  assert.equal((mergeDocumentChunks([{ first: 1, last: 1, parsed: visit({ not_medical: true, doc_type: 'other' }) }], 1) as any).not_medical, true);
});
