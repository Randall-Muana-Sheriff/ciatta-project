import assert from 'node:assert/strict';
import { test } from 'node:test';

import { symptomsView } from './symptomsView';

const NOW = new Date(2026, 9, 14, 9);
const at = (m: number, d: number) => new Date(2026, m, d, 12);
const sig = (date: Date, symptoms: string[], severity: number | null = null, kinds: string[] = ['Symptoms']) => ({
  date,
  episode: { kinds, symptoms, severity },
});
const log = (date: Date, category: string, items: Record<string, string[]>) => ({ at: date.toISOString(), category, items });

const view = symptomsView({
  signals: [
    sig(at(9, 10), ['Bloating', 'Fatigue'], 6),
    sig(at(9, 11), ['Bloating'], 3),
    sig(at(9, 11), ['Bloating'], 8),
    sig(at(8, 1), ['Bloating'], null),
    sig(at(9, 12), [], 7, ['Pain']),
  ],
  logs: [
    log(at(9, 12), 'mind', { mind: ['Brain fog'] }),
    log(at(9, 13), 'gut', { gut: ['Bloating'] }),
    log(at(9, 13), 'meds', { meds: ['Took medication'] }),
    log(at(3, 1), 'mind', { mind: ['Migraine'] }),
  ],
  days: [{ date: '2026-10-09', digestion: ['Reflux'] }],
  now: NOW,
});

test('each symptom counted by the days she logged it in the last 90, most first', () => {
  assert.deepEqual(view.list.map((s) => [s.name, s.days]), [
    ['Bloating', 4],
    ['Fatigue', 1],
    ['Pain', 1],
    ['Brain fog', 1],
    ['Reflux', 1],
  ]);
});

test('each carries its group, last day, worst rating, and how it compares with the month before', () => {
  const b = view.list[0];
  assert.equal(b.group, 'Gut');
  assert.equal(b.last, '13 Oct');
  assert.equal(b.worst, 8);
  assert.equal(b.versus, 'More often than the 30 days before');
  assert.equal(view.list.find((s) => s.name === 'Brain fog')!.group, 'Mind');
  assert.equal(view.list.find((s) => s.name === 'Pain')!.group, 'Body');
  assert.equal(view.list.find((s) => s.name === 'Brain fog')!.worst, null);
});

test('medicines and anything older than 90 days are not symptoms here', () => {
  assert.equal(view.list.some((s) => s.name === 'Took medication'), false);
  assert.equal(view.list.some((s) => s.name === 'Migraine'), false);
});

test('groups to filter by are only the ones she has', () => {
  assert.deepEqual(view.groups, ['All', 'Gut', 'Body', 'Mind']);
});

test('a twelve week grid for the most logged, newest week last', () => {
  assert.equal(view.weeks.length, 12);
  const bloating = view.grid.find((r) => r.name === 'Bloating')!;
  assert.equal(bloating.counts.length, 12);
  assert.equal(bloating.counts.reduce((a, b) => a + b, 0), 4);
  assert.ok(view.grid.length <= 5);
});

test('nothing logged is an empty view, not zeros', () => {
  const empty = symptomsView({ signals: [], logs: [], days: [], now: NOW });
  assert.deepEqual(empty.list, []);
  assert.deepEqual(empty.groups, ['All']);
  assert.deepEqual(empty.grid, []);
});
