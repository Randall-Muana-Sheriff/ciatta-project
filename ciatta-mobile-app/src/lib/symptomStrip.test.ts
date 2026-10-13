import assert from 'node:assert/strict';
import { test } from 'node:test';

import { symptomStrip, together } from './symptomStrip';

const NOW = new Date(2026, 9, 14, 12);
const seen = new Map<string, Map<string, number | null>>([
  ['Bloating', new Map<string, number | null>([['2026-10-14', 6], ['2026-10-12', null], ['2026-09-20', 3]])],
  ['Headache', new Map<string, number | null>([['2026-10-14', 4], ['2026-10-13', 5]])],
  ['Acne', new Map<string, number | null>([['2026-06-01', null]])],
]);

test('seven days: weekday columns ending today, symptoms logged in the window, most days first', () => {
  const v = symptomStrip(seen, '7', NOW);
  assert.deepEqual(v.labels, ['T', 'F', 'S', 'S', 'M', 'T', 'W']);
  assert.equal(v.cols.length, 7);
  assert.deepEqual(v.rows.map((r) => r.name), ['Bloating', 'Headache']);
  const b = v.rows[0];
  assert.equal(b.severity, 6, 'the latest rating she gave');
  assert.deepEqual(b.cells.slice(-3), [{ severity: null }, null, { severity: 6 }]);
});

test('twenty eight days a day at a time; three months a week at a time', () => {
  assert.equal(symptomStrip(seen, '28', NOW).cols.length, 28);
  const q = symptomStrip(seen, '90', NOW);
  assert.equal(q.cols.length, 13);
  assert.deepEqual(q.rows.map((r) => r.name), ['Bloating', 'Headache']);
  assert.equal(q.rows[0].cells.filter(Boolean).length, 2, 'the week of 20 Sep, and this week');
});

test('compare: days two symptoms were logged together', () => {
  const v = symptomStrip(seen, '7', NOW);
  assert.equal(together(v, 'Bloating', 'Headache'), 'Bloating and Headache were logged together on 1 of 7 days.');
});
