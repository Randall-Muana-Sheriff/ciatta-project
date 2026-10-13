import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { categorySummary, summaryLines } from './categorySummary';

const NOW = new Date(2026, 9, 13, 12);
const iso = (daysAgo: number) => new Date(2026, 9, 13 - daysAgo, 9).toISOString();
const day = (daysAgo: number, digestion: string[]): Day =>
  ({ date: iso(daysAgo).slice(0, 10), digestion } as unknown as Day);

test('a category counts the days each item was logged, most days first', () => {
  const journal = [
    { at: iso(1), items: { mind: ['Brain fog', 'Headache'] } },
    { at: iso(2), items: { mind: ['Brain fog'] } },
    { at: iso(2), items: { mind: ['Brain fog'] } }, // same day twice is one day
    { at: iso(5), items: { mind: ['Anxiety'] } },
  ];
  const s = categorySummary('mind', { journal, days: [], episodes: [], now: NOW });
  assert.deepEqual(s.rows, [
    { item: 'Brain fog', days: 2 },
    // A tie keeps the order the chips have on the Log screen.
    { item: 'Headache', days: 1 },
    { item: 'Anxiety', days: 1 },
  ]);
});

test('only the last 30 days count', () => {
  const journal = [{ at: iso(31), items: { skin: ['Acne'] } }, { at: iso(29), items: { skin: ['Itching'] } }];
  assert.deepEqual(categorySummary('skin', { journal, days: [], episodes: [], now: NOW }).rows, [{ item: 'Itching', days: 1 }]);
});

test('at most four rows', () => {
  const journal = ['Acne', 'Oily skin', 'Dry skin', 'Itching', 'Hair shedding'].map((x, i) => ({ at: iso(i), items: { skin: [x] } }));
  assert.equal(categorySummary('skin', { journal, days: [], episodes: [], now: NOW }).rows.length, 4);
});

test('gut flags come from her days, and bowel movements are counted', () => {
  const days = [day(1, ['Bloating', 'Gas']), day(3, ['Bloating']), day(40, ['Reflux'])];
  const episodes = [{ date: iso(2), kinds: ['Bowel movement'] }, { date: iso(4), kinds: ['Bowel movement'] }];
  const s = categorySummary('gut', { journal: [], days, episodes, now: NOW });
  assert.deepEqual(s.rows, [{ item: 'Bloating', days: 2 }, { item: 'Gas', days: 1 }]);
  assert.equal(s.extra, '2 bowel movements logged');
});

test('body counts pain from her episodes as well as what she noted', () => {
  const s = categorySummary('body', {
    journal: [{ at: iso(1), items: { body: ['Fatigue'] } }],
    days: [],
    episodes: [{ date: iso(1), kinds: ['Pain'] }, { date: iso(6), kinds: ['Pain', 'Period'] }],
    now: NOW,
  });
  assert.deepEqual(s.rows, [{ item: 'Pain', days: 2 }, { item: 'Fatigue', days: 1 }]);
});

test('nothing logged reads as nothing, never as zeros', () => {
  const s = categorySummary('sexual', { journal: [], days: [], episodes: [], now: NOW });
  assert.deepEqual(s.rows, []);
  assert.equal(s.extra, undefined);
  assert.deepEqual(summaryLines(s), []);
});

test('lines read naturally, singular and plural', () => {
  assert.deepEqual(summaryLines({ rows: [{ item: 'Acne', days: 1 }, { item: 'Itching', days: 3 }] }), ['Acne, 1 day', 'Itching, 3 days']);
});

test('nutrition counts what she noted about food and drink', () => {
  const s = categorySummary('nutrition', {
    journal: [{ at: iso(1), items: { nutrition: ['Caffeine'] } }, { at: iso(2), items: { nutrition: ['Caffeine', 'Alcohol'] } }],
    days: [day(1, ['Bloating'])],
    episodes: [],
    now: NOW,
  });
  assert.deepEqual(s.rows, [{ item: 'Caffeine', days: 2 }, { item: 'Alcohol', days: 1 }]);
});
