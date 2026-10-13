import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WHAT_HAPPENED } from '../data/cycleLog';
import { planSave, readCategories, readDaysAgo, readFlow, readingLine, readKinds, readQuick } from './quickLog';

test('reads the kinds her words name', () => {
  assert.deepEqual(readKinds('Period started yesterday, heavy'), ['Period']);
  assert.deepEqual(readKinds('cramping all morning'), ['Pain']);
  assert.deepEqual(readKinds('Period started and cramping since'), ['Period', 'Pain']);
  // Symptoms are no longer an episode kind from a sentence: they are read
  // into their own categories instead.
  assert.deepEqual(readKinds('bloated and nauseous'), []);
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

test('one sentence is read into every category it names', () => {
  const f = readCategories('Period started, bloated after lunch, foggy all afternoon, breakout on my chin');
  assert.deepEqual(f.cycle, ['Period']);
  assert.deepEqual(f.nutrition, ['Bloating']);
  assert.deepEqual(f.mind, ['Brain fog']);
  assert.deepEqual(f.skin, ['Acne']);
});

test('the line groups what was recognised by category', () => {
  const r = readQuick('Period started yesterday, heavy, foggy');
  const line = readingLine(r.found, r.flow, r.daysAgo) as string;
  assert.equal(line, 'Cycle: Period, Heavy flow, yesterday · Mind: Brain fog');
});

test('nothing recognised draws no line', () => {
  const r = readQuick('A quiet one');
  assert.equal(readingLine(r.found, r.flow, r.daysAgo), null);
});

test('several categories save each part once, and her words once', () => {
  const plan = planSave({ text: 'Period started, bloated, foggy', selected: 'cycle', tapped: [], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Period']);
  assert.deepEqual(plan.daily?.digestion, ['Bloating']);
  assert.deepEqual(plan.journal?.items.mind, ['Brain fog']);
  // Words go to the journal entry, the one place that holds them all.
  assert.equal(plan.wordsGoTo, 'journal');
});

test('unrecognised words under a category are kept, in that category', () => {
  const plan = planSave({ text: 'long day', selected: 'mind', tapped: [], files: [] })!;
  assert.equal(plan.episode, null);
  assert.equal(plan.daily, null);
  assert.equal(plan.journal?.category, 'mind');
  assert.equal(plan.journal?.kind, 'Symptoms');
  assert.equal(plan.wordsGoTo, 'journal');
});

test('unrecognised words under Cycle stay a cycle entry, as before', () => {
  const plan = planSave({ text: 'felt off today', selected: 'cycle', tapped: [], files: [] })!;
  assert.ok(plan.episode);
  assert.equal(plan.journal, null);
  assert.equal(plan.wordsGoTo, 'episode');
});

test('tapped chips count as hers, in the category she tapped them in', () => {
  const plan = planSave({ text: '', selected: 'skin', tapped: ['Acne'], files: [] })!;
  assert.deepEqual(plan.journal?.items.skin, ['Acne']);
});

test('a bowel movement is saved as the episode kind the record reads', () => {
  const plan = planSave({ text: '', selected: 'nutrition', tapped: ['Bowel movement', 'Gas'], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Bowel movement']);
  assert.deepEqual(plan.daily?.digestion, ['Gas']);
});

test('pain is an episode, so the body map still sees it', () => {
  const plan = planSave({ text: 'sharp pain in my lower back', selected: 'body', tapped: [], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Pain']);
});

test('a file on its own is kept with an entry', () => {
  const file = { id: 'f', kind: 'document' as const, name: 'labs.pdf', uri: 'file:///labs.pdf', addedAt: '2026-10-12T09:00:00Z' };
  const plan = planSave({ text: '', selected: 'note', tapped: [], files: [file] })!;
  assert.equal(plan.wordsGoTo, 'journal');
});

test('nothing at all plans nothing', () => {
  assert.equal(planSave({ text: '  ', selected: 'mind', tapped: [], files: [] }), null);
});

test('every item it reads is a chip of the category it lands in', async () => {
  const { category } = await import('./logCategories');
  const f = readCategories(
    'period spotting pain bloated reflux gas constipated diarrhea pooped nauseous headache migraine foggy forgetful ' +
      'dizzy anxious irritable acne oily hair shedding dry skin itchy pain with sex dryness urgency leaking slept badly ' +
      'flight ibuprofen vitamin hot flashes night sweats tired',
  );
  for (const [key, items] of Object.entries(f)) {
    for (const item of items ?? []) assert.ok(category(key as never).quick.includes(item), `${item} not a ${key} chip`);
  }
});
