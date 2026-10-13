import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { JournalView } from '../data/rows';
import { recordEntries, recordTitle } from './recordEntries';

const pdf = { id: 'f1', kind: 'document' as const, name: 'Bloods March.pdf', uri: 'file:///b.pdf', addedAt: '2026-10-12T09:00:00Z' };
const photo = { id: 'f2', kind: 'photo' as const, name: 'Photo 12 Oct', uri: 'file:///p.jpg', addedAt: '2026-10-12T09:00:00Z' };

const view = (items: JournalView['months'][number]['items']): JournalView => ({ count: items.length, since: '', months: [{ month: 'October 2026', items }] });
const item = (over: Partial<JournalView['months'][number]['items'][number]>) => ({
  text: '', date: '12 Oct', tag: 'Notes', kind: 'Notes' as const, usedInInsight: false, attachments: [], ...over,
});

test('only entries filed to records are listed', () => {
  const list = recordEntries(view([item({ text: 'Bloated', category: 'gut' }), item({ text: 'Iron results from Dr Lee', filed: 'records' })]));
  assert.deepEqual(list.map((r) => r.title), ['Iron results from Dr Lee']);
});

test('a record names its files and says when', () => {
  const [r] = recordEntries(view([item({ text: 'Iron results', filed: 'records', attachments: [pdf, photo] })]));
  assert.equal(r.sub, '12 Oct · 1 photo and 1 document, kept on this phone');
});

test('a record with no words is named after its first file', () => {
  assert.equal(recordTitle('', [pdf]), 'Bloods March.pdf');
});

test('a long note is cut at a word, first line only', () => {
  assert.equal(recordTitle('Ultrasound report from the clinic on Tuesday morning\nsecond line', []), 'Ultrasound report from the clinic on');
});

test('nothing at all reads as a record', () => {
  assert.equal(recordTitle('   ', []), 'Record');
});

test('no filed entries is an empty list', () => {
  assert.deepEqual(recordEntries({ count: 0, since: 'No entries yet', months: [] }), []);
});
