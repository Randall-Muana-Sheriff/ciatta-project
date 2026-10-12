import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WHAT_HAPPENED } from '../data/cycleLog';
import { QUICK_TABS, quickTab, readDaysAgo, readFlow, readingLine, readKinds, readQuick } from './quickLog';

test('reads the kinds her words name', () => {
  assert.deepEqual(readKinds('Period started yesterday, heavy'), ['Period']);
  assert.deepEqual(readKinds('cramping all morning'), ['Pain']);
  assert.deepEqual(readKinds('Period started and cramping since'), ['Period', 'Pain']);
  assert.deepEqual(readKinds('bloated and nauseous'), ['Symptoms']);
  assert.deepEqual(readKinds('constipated for two days'), ['Bowel movement']);
});

test('reads nothing from a sentence that names nothing', () => {
  assert.deepEqual(readKinds('A long day at work'), []);
  assert.deepEqual(readKinds('   '), []);
});

// The vocabulary has to be the record's, or a quick log would create kinds
// the rest of the app cannot read back.
test('every kind it can produce is one the record already uses', () => {
  const produced = new Set(
    [
      'period bleeding',
      'spotting',
      'pain and cramps',
      'nausea headache bloating',
      'bowel movement diarrhea',
    ].flatMap(readKinds),
  );
  for (const k of produced) assert.ok((WHAT_HAPPENED as readonly string[]).includes(k), `${k} is not a known kind`);
});

test('flow only when she said it', () => {
  assert.equal(readFlow('Period started, very heavy'), 'Very heavy');
  assert.equal(readFlow('heavy today'), 'Heavy');
  assert.equal(readFlow('barely anything'), 'Light');
  // No adjective means no flow. Not Moderate.
  assert.equal(readFlow('Period started'), null);
});

test('reads a day back only when she named one', () => {
  assert.equal(readDaysAgo('started yesterday'), 1);
  assert.equal(readDaysAgo('3 days ago'), 3);
  assert.equal(readDaysAgo('last week'), 7);
  assert.equal(readDaysAgo('this morning'), 0);
  // Out of range is not a date.
  assert.equal(readDaysAgo('90 days ago'), 0);
});

test('the line shows back everything that would be stored', () => {
  const r = readQuick('Period started yesterday, heavy, cramping after a long flight');
  assert.deepEqual(r.kinds, ['Period', 'Pain']);
  assert.ok(r.context.includes('Travel'));
  assert.equal(r.flow, 'Heavy');
  assert.equal(r.daysAgo, 1);
  const line = readingLine(r) as string;
  for (const part of ['Period', 'Pain', 'Travel', 'Heavy flow', 'yesterday']) assert.ok(line.includes(part), part);
});

test('nothing recognised draws no line', () => {
  assert.equal(readingLine(readQuick('A quiet one')), null);
  assert.equal(readingLine(readQuick('')), null);
});

test('every tab has an example and a way into the full screen', () => {
  assert.equal(QUICK_TABS.length, 3);
  for (const t of QUICK_TABS) {
    assert.ok(t.example.length > 10, `${t.key} needs a real example sentence`);
    assert.ok(t.detail && t.detailLabel);
  }
  assert.equal(quickTab('day').detail, 'dailyLog');
  // An unknown key still returns a tab rather than undefined.
  assert.equal(quickTab('cycle').key, 'cycle');
});
