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
  assert.deepEqual(f.gut, ['Bloating']);
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
  const plan = planSave({ text: '', selected: 'gut', tapped: ['Bowel movement', 'Gas'], files: [] })!;
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

// Final review: words that read as one thing but mean another must not
// become a period, a gut flag, or a pain episode on her record.
test('bleeding that is not a period is not a period', () => {
  assert.equal(readCategories('bleeding after sex').cycle, undefined);
  assert.deepEqual(readCategories('bleeding after sex').sexual, ['Bleeding after sex']);
  assert.equal(readCategories('nose bleeding this morning').cycle, undefined);
  assert.equal(readCategories('bleeding gums').cycle, undefined);
  assert.deepEqual(readCategories('started bleeding today').cycle, ['Period']);
});

test('period cramps are pain, not a gut flag', () => {
  const plan = planSave({ text: 'Period started yesterday, heavy, cramping since the morning', selected: 'cycle', tapped: [], files: [] })!;
  assert.deepEqual(plan.episode?.kinds, ['Period', 'Pain']);
  assert.equal(plan.daily, null);
  // Cramping with nothing about a period is still read as gut.
  assert.deepEqual(readCategories('cramping after lunch, bloated').gut, ['Bloating', 'Cramping']);
});

test('everyday phrases do not become symptoms', () => {
  for (const s of ['run down', 'wind down after work', 'gas station coffee', 'loose jeans', 'on the pill', 'period leaked']) {
    const f = readCategories(s);
    assert.equal(f.mind?.includes('Low mood') ?? false, false, s);
    assert.equal(f.gut?.includes('Gas') ?? false, false, s);
    assert.equal(f.gut?.includes('Loose') ?? false, false, s);
    assert.equal(f.context?.includes('Took medication') ?? false, false, s);
    assert.equal(f.sexual?.includes('Leaking') ?? false, false, s);
    assert.equal(f.context?.includes('Exercised') ?? false, false, s);
  }
  assert.deepEqual(readCategories('feeling down today').mind, ['Low mood']);
  assert.deepEqual(readCategories('went for a run').context, ['Exercised']);
  assert.deepEqual(readCategories('very gassy').gut, ['Gas']);
  // A loose stool is a bowel movement too, which is true.
  assert.deepEqual(readCategories('loose stool').gut, ['Loose', 'Bowel movement']);
  assert.deepEqual(readCategories('leaking when I sneeze').sexual, ['Leaking']);
});

test('a specific pain chip does not also become a generic pain episode', () => {
  assert.equal(readCategories('sore throat').body, undefined);
  assert.deepEqual(readCategories('sore breasts').body, ['Breast tenderness']);
  assert.deepEqual(readCategories('joint pain in my knees').body, ['Joint pain']);
  assert.deepEqual(readCategories('joint pain and a sore lower back').body, ['Pain', 'Joint pain']);
});

test('something she says she does not have is not recorded', () => {
  assert.deepEqual(readCategories('no pain today'), {});
  assert.deepEqual(readCategories('not bloated at all'), {});
  assert.deepEqual(readCategories('no bloating but very foggy'), { mind: ['Brain fog'] });
});

test('a file is kept where she can see it again, even beside gut flags', () => {
  const file = { id: 'f', kind: 'photo' as const, name: 'Photo at 9:00 AM', uri: 'file:///p.jpg', addedAt: '2026-10-12T09:00:00Z' };
  const plan = planSave({ text: '', selected: 'gut', tapped: ['Bloating'], files: [file] })!;
  assert.deepEqual(plan.daily?.digestion, ['Bloating']);
  assert.equal(plan.journal?.category, 'gut');
  assert.equal(plan.wordsGoTo, 'journal');
});

test('cramps logged under Cycle or Body are pain, even without the word period', () => {
  for (const selected of ['cycle', 'body'] as const) {
    const plan = planSave({ text: 'bad cramps all day', selected, tapped: [], files: [] })!;
    assert.deepEqual(plan.episode?.kinds, ['Pain'], selected);
    assert.equal(plan.daily, null, selected);
  }
});

test('a retry after a failed save never repeats a step that already landed', async () => {
  const { runSave } = await import('./quickLog');
  const calls: string[] = [];
  let journalFails = true;
  const steps = {
    daily: async () => void calls.push('daily'),
    journal: async () => {
      calls.push('journal');
      if (journalFails) throw new Error('offline');
    },
    episode: () => void calls.push('episode'),
  };
  const done = new Set<string>();
  await assert.rejects(runSave(steps, done));
  // The episode waits for the server writes, so a failure adds nothing local.
  assert.deepEqual(calls, ['daily', 'journal']);
  journalFails = false;
  await runSave(steps, done);
  assert.deepEqual(calls, ['daily', 'journal', 'journal', 'episode']);
});

// Nutrition and gut are two things: food and goals, and gut health.
test('food and drink read into Nutrition, gut symptoms into Gut', () => {
  const f = readCategories('two coffees and a glass of wine, skipped lunch, bloated after dinner');
  assert.deepEqual(f.nutrition, ['Caffeine', 'Alcohol', 'Skipped a meal']);
  assert.deepEqual(f.gut, ['Bloating']);
  assert.deepEqual(readCategories('late dinner again').nutrition, ['Ate late']);
});

test('nutrition items are kept as a journal entry under Nutrition, gut flags on the day', () => {
  const plan = planSave({ text: 'coffee and bloated', selected: 'nutrition', tapped: [], files: [] })!;
  assert.deepEqual(plan.journal?.items.nutrition, ['Caffeine']);
  assert.equal(plan.journal?.category, 'nutrition');
  assert.deepEqual(plan.daily?.digestion, ['Bloating']);
});

test('damp or mould at home is hers to report, under Context', () => {
  assert.deepEqual(readCategories('the flat is damp again, mould behind the wardrobe').context, ['Damp or mould at home']);
  assert.deepEqual(readCategories('mildew in the bathroom').context, ['Damp or mould at home']);
});
