import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bristolGroup, gutIn, gutOut } from './gut';

const NOW = new Date(2026, 9, 14, 20); // Wed 14 Oct
const iso = (n: number) => {
  const d = new Date(2026, 9, 14 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const bm = (n: number, stool: number | null, over: Record<string, unknown> = {}) => ({
  date: iso(n), kinds: ['Bowel movement'], stool, bowelPain: null as string | null, bowelFlags: [] as string[], ...over,
});

test('the Bristol groups: 1 and 2 hard, 3 and 4 typical, 5 to 7 loose', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(bristolGroup), ['hard', 'hard', 'typical', 'typical', 'loose', 'loose', 'loose']);
});

test('out: each movement by day and type, the mix, how often, and what came with it', () => {
  const episodes = [
    bm(0, 4), bm(0, 3), bm(1, 6, { bowelPain: 'During', bowelFlags: ['Urgency'] }), bm(3, 2, { bowelFlags: ['Straining'] }),
    bm(10, null), bm(40, 7), // outside the 28 days
    { date: iso(2), kinds: ['Pain'], stool: null, bowelPain: null, bowelFlags: [] },
  ];
  const days = [{ date: iso(0), digestion: ['Bloating', 'Gas'] }, { date: iso(5), digestion: ['Bloating'] }];
  const v = gutOut({ episodes, days, now: NOW });
  assert.equal(v.days.length, 28);
  assert.equal(v.count, 5);
  assert.deepEqual(v.types[27], [4, 3], 'today, two movements');
  assert.deepEqual(v.counts.slice(-4), [1, 0, 1, 2]);
  assert.deepEqual(v.mix, { hard: 1, typical: 2, loose: 1, unrated: 1 });
  assert.equal(v.perDay, '1.3 a week');
  assert.equal(v.pain, 1);
  assert.deepEqual(v.flags, [{ name: 'Urgency', count: 1 }, { name: 'Straining', count: 1 }]);
  assert.equal(v.blood, 0);
  assert.deepEqual(v.symptoms, [{ name: 'Bloating', days: 2 }, { name: 'Gas', days: 1 }]);
});

test('how often reads as a day when it is daily, and blood is counted on its own', () => {
  const episodes = Array.from({ length: 28 }, (_, n) => bm(n, 4)).concat([bm(2, 5, { bowelFlags: ['Blood'] })]);
  const v = gutOut({ episodes, days: [], now: NOW });
  assert.equal(v.perDay, '1 a day');
  assert.equal(v.blood, 1);
  assert.equal(gutOut({ episodes: [], days: [], now: NOW }).count, 0);
});

test('in: when she ate, by weekday and window, meals a day, and when the last meal usually is', () => {
  const at = (n: number, h: number, m = 0) => new Date(2026, 9, 14 - n, h, m).toISOString();
  const meals = [
    { eatenAt: at(0, 8) }, { eatenAt: at(0, 13) }, { eatenAt: at(0, 20, 30) },
    { eatenAt: at(1, 12) }, { eatenAt: at(1, 21) },
    { eatenAt: at(40, 9) },
  ];
  const v = gutIn({ meals, now: NOW });
  assert.deepEqual(v.windows, ['6 to 11', '11 to 15', '15 to 19', '19 to 24']);
  assert.deepEqual(v.weekdays, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  // Wednesday is column 2, Tuesday column 1.
  assert.equal(v.grid[0][2], 1);
  assert.equal(v.grid[1][2], 1);
  assert.equal(v.grid[3][2], 1);
  assert.equal(v.grid[1][1], 1);
  assert.equal(v.grid[3][1], 1);
  assert.equal(v.count, 5);
  assert.equal(v.perDay, '2.5 a day');
  assert.equal(v.lastMeal, '8:45 pm');
});
