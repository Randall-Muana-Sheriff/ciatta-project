import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHUNK_PAGES, chunkRanges, mergeChunks } from '../../supabase/functions/_shared/chunks.ts';

const t = (name: string, panel: string | null = null) => ({ name, value: 1, value_text: null, unit: null, range: null, flag: null, panel });

test('a short report is read in one go', () => {
  assert.deepEqual(chunkRanges(3), [{ first: 1, last: 3 }]);
  assert.equal(CHUNK_PAGES, 8);
});

test('a long report is read eight pages at a time, every page once', () => {
  assert.deepEqual(chunkRanges(20), [
    { first: 1, last: 8 },
    { first: 9, last: 16 },
    { first: 17, last: 20 },
  ]);
  assert.deepEqual(chunkRanges(0), []);
});

test('chunks merge in page order, with the first report details any chunk found', () => {
  const merged = mergeChunks(
    [
      { first: 9, last: 12, parsed: { not_lab: false, collected_on: null, lab: 'Quest', ordering_clinician: null, specimen: 'Serum', unreadable_pages: [], tests: [t('TSH', 'Thyroid')] } },
      { first: 1, last: 8, parsed: { not_lab: false, collected_on: '2026-06-12', lab: null, ordering_clinician: 'Dr Rivera', specimen: null, unreadable_pages: [2], tests: [t('Hemoglobin', 'CBC')] } },
    ],
    12,
  );
  assert.equal(merged.collected_on, '2026-06-12');
  assert.equal(merged.lab, 'Quest');
  assert.equal(merged.ordering_clinician, 'Dr Rivera');
  assert.equal(merged.specimen, 'Serum');
  assert.deepEqual((merged.tests as { name: string }[]).map((x) => x.name), ['Hemoglobin', 'TSH']);
  assert.deepEqual(merged.unreadable_pages, [2]);
  assert.equal(merged.pages, 12);
  assert.equal(merged.not_lab, false);
});

test('a page number a chunk reports is counted from the start of the whole report', () => {
  const merged = mergeChunks([{ first: 9, last: 16, parsed: { not_lab: false, unreadable_pages: [3, 40], tests: [t('TSH')] } }], 16);
  assert.deepEqual(merged.unreadable_pages, [11], 'page 3 of the second chunk is page 11; a page beyond the chunk is dropped');
});

test('a chunk that could not be read marks all its pages unreadable, and the rest still arrive', () => {
  const merged = mergeChunks(
    [
      { first: 1, last: 8, parsed: { not_lab: false, tests: [t('Hemoglobin')] } },
      { first: 9, last: 10, parsed: null },
    ],
    10,
  );
  assert.deepEqual(merged.unreadable_pages, [9, 10]);
  assert.equal((merged.tests as unknown[]).length, 1);
});

test('it is not a lab report only when no chunk found a lab report', () => {
  assert.equal(mergeChunks([{ first: 1, last: 1, parsed: { not_lab: true, tests: [] } }], 1).not_lab, true);
  assert.equal(
    mergeChunks(
      [
        { first: 1, last: 8, parsed: { not_lab: true, tests: [] } },
        { first: 9, last: 9, parsed: { not_lab: false, tests: [t('TSH')] } },
      ],
      9,
    ).not_lab,
    false,
  );
});

test('a report whose pieces show different collection days says so', () => {
  const merged = mergeChunks(
    [
      { first: 1, last: 8, parsed: { not_lab: false, collected_on: '2026-06-12', multiple_dates: false, tests: [t('TSH')] } },
      { first: 9, last: 9, parsed: { not_lab: false, collected_on: '2025-11-03', multiple_dates: false, tests: [t('TSH')] } },
    ],
    9,
  );
  assert.equal(merged.multiple_dates, true);
  assert.equal(mergeChunks([{ first: 1, last: 2, parsed: { not_lab: false, collected_on: '2026-06-12', multiple_dates: true, tests: [] } }], 2).multiple_dates, true, 'one piece can say it holds several days');
  assert.equal(mergeChunks([{ first: 1, last: 2, parsed: { not_lab: false, collected_on: '2026-06-12', multiple_dates: false, tests: [] } }], 2).multiple_dates, false);
});
