import assert from 'node:assert/strict';
import { test } from 'node:test';

import { answerSave, checkIn, checkInPush, isLoggable } from '../../supabase/functions/_shared/checkIn.ts';
import { readLogResult } from '../../supabase/functions/log-read/read.ts';

const base = [
  { metric: 'resting_hr', low: 55, high: 66, sufficient: true },
  { metric: 'hrv', low: 40, high: 60, sufficient: true },
  { metric: 'sleep_hours', low: 6.5, high: 8.5, sufficient: true },
];
const calm = { resting_hr: 60, hrv: 50, sleep_hours: 7.5, temp_deviation: 0 };
const DAY = '2026-10-15';

test('no change from her usual, no question', () => {
  assert.equal(checkIn({ today: calm, baselines: base, conditions: [], answered: [], day: DAY }), null);
});

test('a resting heart rate above her usual leads, with the condition question', () => {
  const c = checkIn({ today: { ...calm, resting_hr: 72, hrv: 30 }, baselines: base, conditions: ['Endometriosis'], answered: [], day: DAY })!;
  assert.equal(c.signal, 'resting_hr');
  assert.equal(c.line, 'Your resting heart rate is higher than usual today.');
  assert.equal(c.question, 'How is your pelvic pain?');
  assert.deepEqual(c.answers, ['None', 'Mild', 'Strong']);
  assert.equal(c.key, `resting_hr:${DAY}`);
});

test('then HRV, then sleep, then skin temperature', () => {
  assert.equal(checkIn({ today: { ...calm, hrv: 30 }, baselines: base, conditions: [], answered: [], day: DAY })!.signal, 'hrv');
  assert.equal(checkIn({ today: { ...calm, sleep_hours: 5 }, baselines: base, conditions: [], answered: [], day: DAY })!.signal, 'sleep_hours');
  const t = checkIn({ today: { ...calm, temp_deviation: 0.6 }, baselines: base, conditions: [], answered: [], day: DAY })!;
  assert.equal(t.signal, 'temp_deviation');
  assert.equal(t.line, 'Your skin temperature is up from your usual.');
});

test('a baseline without enough history says nothing', () => {
  const thin = base.map((b) => ({ ...b, sufficient: false }));
  assert.equal(checkIn({ today: { ...calm, resting_hr: 90 }, baselines: thin, conditions: [], answered: [], day: DAY }), null);
});

test('without a pelvic condition, Ciatta asks about energy', () => {
  const c = checkIn({ today: { ...calm, sleep_hours: 5 }, baselines: base, conditions: ['Asthma'], answered: [], day: DAY })!;
  assert.equal(c.question, 'How is your energy?');
  assert.deepEqual(c.answers, ['Fine', 'Tired', 'Exhausted']);
});

test('adenomyosis, pelvic pain and heavy periods ask about pelvic pain too', () => {
  for (const cond of ['adenomyosis', 'Chronic pelvic pain', 'Heavy periods']) {
    assert.equal(checkIn({ today: { ...calm, hrv: 30 }, baselines: base, conditions: [cond], answered: [], day: DAY })!.question, 'How is your pelvic pain?');
  }
});

test('a question answered today does not come back', () => {
  assert.equal(checkIn({ today: { ...calm, hrv: 30 }, baselines: base, conditions: [], answered: [`hrv:${DAY}`], day: DAY }), null);
});

test('answers save the symptom, or a note when there is none', () => {
  const pelvic = checkIn({ today: { ...calm, hrv: 30 }, baselines: base, conditions: ['Endometriosis'], answered: [], day: DAY })!;
  assert.deepEqual(answerSave(pelvic, 'Mild'), { text: 'Check in: pelvic pain, mild.', tapped: ['Pelvic pain'] });
  assert.deepEqual(answerSave(pelvic, 'None'), { text: 'Check in: no pelvic pain.', tapped: [] });
  const energy = checkIn({ today: { ...calm, hrv: 30 }, baselines: base, conditions: [], answered: [], day: DAY })!;
  assert.deepEqual(answerSave(energy, 'Exhausted'), { text: 'Check in: energy, exhausted.', tapped: ['Fatigue'] });
  assert.deepEqual(answerSave(energy, 'Fine'), { text: 'Check in: energy, fine.', tapped: [] });
});

test('the push is private, once a day, and only when she wants check ins', () => {
  const tokens = ['ExponentPushToken[abc]', 'not a token'];
  const msgs = checkInPush(tokens, { allowed: true, lastSent: '2026-10-14', today: DAY });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].body, 'Ciatta has a quick question for you.');
  assert.deepEqual(msgs[0].data, { screen: 'today' });
  assert.equal(checkInPush(tokens, { allowed: true, lastSent: DAY, today: DAY }).length, 0);
  assert.equal(checkInPush(tokens, { allowed: false, lastSent: null, today: DAY }).length, 0);
});

test('a question or an urgent message is not something to log', () => {
  assert.equal(isLoggable('Had a dull ache since lunch and felt totally drained'), true);
  assert.equal(isLoggable('What stands out in my labs?'), false);
  assert.equal(isLoggable('   '), false);
});

test('the log reader keeps only words from the vocabulary, and clamps the day', () => {
  const vocab = ['Pain', 'Fatigue', 'Pelvic pain'];
  assert.deepEqual(readLogResult({ items: ['pain', 'Fatigue', 'Lupus', 7], daysAgo: 1 }, vocab), { items: ['Pain', 'Fatigue'], daysAgo: 1 });
  assert.deepEqual(readLogResult({ items: ['Pain', 'pain'], daysAgo: 40 }, vocab), { items: ['Pain'], daysAgo: 14 });
  assert.deepEqual(readLogResult({ items: 'Pain', daysAgo: -3 }, vocab), { items: [], daysAgo: 0 });
  assert.deepEqual(readLogResult(null, vocab), { items: [], daysAgo: 0 });
});
