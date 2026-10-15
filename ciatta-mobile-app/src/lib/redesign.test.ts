import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MENU_ITEMS, menuFor, TAB_ORDER } from '../navigation';
import { type DaySeries, readingRows } from './dayPatterns';
import { searchHealth } from './healthSearch';

test('three places, in order', () => {
  assert.deepEqual(TAB_ORDER, ['today', 'myhealth', 'care']);
});

test('the corner menu lists Today, Health, Your care and Profile, marking where she is', () => {
  assert.deepEqual(MENU_ITEMS.map((m) => m.label), ['Today', 'Health', 'Your care', 'Profile']);
  const rows = menuFor('myhealth');
  assert.deepEqual(rows.map((r) => r.current), [false, true, false, false]);
  assert.equal(rows[3].go.kind, 'screen');
});

const series = (key: DaySeries['key'], label: string, unit: string, range: string): DaySeries => ({
  key, label, unit, range, values: [], count: 1, low: 0, high: 0,
});

test('every reading today, with her usual only where it is known', () => {
  const rows = readingRows(
    { series: [series('heart_rate', 'Heart Rate', 'bpm', '62 to 74 bpm'), series('hrv', 'HRV', 'ms', '38 to 51 ms')], nowHour: 12, wokeAt: null },
    { hrv: 47.6 },
  );
  assert.deepEqual(rows, [
    { key: 'heart_rate', label: 'Heart Rate', range: '62 to 74 bpm', usual: null },
    { key: 'hrv', label: 'HRV', range: '38 to 51 ms', usual: 'Usually 48 ms' },
  ]);
});

const index = {
  labs: [{ name: 'Ferritin' }, { name: 'Vitamin D, 25 hydroxy' }, { name: 'TSH' }],
  documents: [{ id: 'd1', title: 'Pelvic ultrasound', type: 'Imaging report' }],
  records: [{ name: 'Endometriosis' }],
};

test('a prefix of any word finds it, whatever the case', () => {
  assert.deepEqual(searchHealth('ferr', index).map((r) => r.title), ['Ferritin']);
  assert.deepEqual(searchHealth('HYDROXY', index).map((r) => r.title), ['Vitamin D, 25 hydroxy']);
  assert.deepEqual(searchHealth('ultra', index).map((r) => r.title), ['Pelvic ultrasound']);
  assert.deepEqual(searchHealth('imaging', index).map((r) => r.title), ['Pelvic ultrasound']);
});

test('each kind opens where it lives', () => {
  assert.deepEqual(searchHealth('ferritin', index)[0].open, { kind: 'lab', name: 'Ferritin' });
  assert.deepEqual(searchHealth('pelvic', index)[0].open, { kind: 'document', id: 'd1' });
  assert.deepEqual(searchHealth('endo', index)[0].open, { kind: 'screen', screen: 'chart' });
  assert.deepEqual(searchHealth('timeline', index)[0].open, { kind: 'screen', screen: 'journey' });
  assert.deepEqual(searchHealth('cycle', index)[0].open, { kind: 'screen', screen: 'cycle' });
  assert.deepEqual(searchHealth('body', index)[0].open, { kind: 'view', view: 'Body' });
});

test('an empty or one letter query finds nothing, and results stop at 20', () => {
  assert.deepEqual(searchHealth('', index), []);
  assert.deepEqual(searchHealth(' ', index), []);
  const many = { labs: Array.from({ length: 30 }, (_, i) => ({ name: `Panel ${i}` })), documents: [], records: [] };
  assert.equal(searchHealth('panel', many).length, 20);
});

test('a word in the middle does not match from inside a word', () => {
  assert.deepEqual(searchHealth('itin', index), []);
});
