import assert from 'node:assert/strict';
import { test } from 'node:test';

import { medsView } from './medsView';

const NOW = new Date(2026, 9, 14, 9);
const log = (m: number, d: number, category: string, items: Record<string, string[]>, text = '') => ({
  at: new Date(2026, m, d, 9).toISOString(),
  category,
  items,
  text,
});

const view = medsView({
  reported: { conditions: [], surgeries: [], medications: ['Levothyroxine'], supplements: ['Magnesium'] },
  logs: [
    log(9, 13, 'meds', { meds: ['Levothyroxine', 'Took medication'] }),
    log(9, 12, 'meds', { meds: ['Levothyroxine', 'Missed a dose'] }, 'forgot this morning'),
    log(9, 2, 'meds', { meds: ['Started a new medication'] }, 'started ibuprofen for cramps'),
    log(9, 11, 'supplements', { supplements: ['Magnesium', 'Took supplement'] }),
    log(8, 1, 'supplements', { supplements: ['Stopped a supplement'] }, 'stopped iron'),
    log(9, 10, 'gut', { gut: ['Bloating'] }),
  ],
  now: NOW,
});

test('medications and supplements are listed apart, with the last day each was logged', () => {
  assert.deepEqual(view.medications, [{ name: 'Levothyroxine', last: '13 Oct', days: 2 }]);
  assert.deepEqual(view.supplements, [{ name: 'Magnesium', last: '11 Oct', days: 1 }]);
});

test('the last 30 days, counted by what she logged', () => {
  assert.deepEqual(view.month, [
    { label: 'Took medication', days: 1 },
    { label: 'Missed a dose', days: 1 },
    { label: 'Started a new medication', days: 1 },
    { label: 'Took supplement', days: 1 },
  ]);
});

test('changes she logged, newest first, in her words', () => {
  assert.deepEqual(view.changes, [
    { label: 'Started a new medication', on: '2 Oct', words: 'started ibuprofen for cramps' },
    { label: 'Stopped a supplement', on: '1 Sep', words: 'stopped iron' },
  ]);
});

test('nothing named and nothing logged is empty', () => {
  const v = medsView({ reported: null, logs: [], now: NOW });
  assert.deepEqual([v.medications, v.supplements, v.month, v.changes], [[], [], [], []]);
});
