import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupItems, LOG_VOCABULARY, mergeItems, offerLine, turnPlan, wantsDocuments } from './logOffer';

test('the vocabulary holds every log word once', () => {
  for (const w of ['Pain', 'Pelvic pain', 'Fatigue', 'Period', 'Spotting', 'Caffeine', 'Slept badly']) assert.ok(LOG_VOCABULARY.includes(w), w);
  assert.equal(new Set(LOG_VOCABULARY).size, LOG_VOCABULARY.length);
});

test('each word is filed under the category the record keeps it in', () => {
  assert.deepEqual(groupItems(['Period', 'Pain', 'Fatigue', 'Caffeine']), { cycle: ['Period'], body: ['Pain', 'Fatigue'], nutrition: ['Caffeine'] });
});

test('the offer names what was understood', () => {
  assert.equal(offerLine(['Pain', 'Fatigue']), 'I can add this to your timeline: Pain and Fatigue.');
  assert.equal(offerLine(['Pain', 'Fatigue', 'Bloating']), 'I can add this to your timeline: Pain, Fatigue and Bloating.');
  assert.equal(offerLine(['Pain']), 'I can add this to your timeline: Pain.');
});

test('what the model read and what the phone read are joined, once each', () => {
  assert.deepEqual(mergeItems(['Pain'], ['Pain', 'Fatigue']), ['Pain', 'Fatigue']);
  assert.deepEqual(mergeItems(null, ['Fatigue']), ['Fatigue']);
});

test('a statement with nothing Ciatta can answer becomes only an offer', () => {
  assert.deepEqual(turnPlan('decline', ['Pain']), { answer: false, offer: true });
  assert.deepEqual(turnPlan('labs', ['Pain']), { answer: true, offer: true });
  assert.deepEqual(turnPlan('decline', []), { answer: true, offer: false });
  assert.deepEqual(turnPlan('escalate', ['Pain']), { answer: true, offer: false });
});

test('asking for documents is recognised, saying something else is not', () => {
  for (const m of ['Show me my documents', 'what documents do I have?', 'Open my ultrasound report', 'Can I see the files I uploaded', 'my scans']) {
    assert.equal(wantsDocuments(m), true, m);
  }
  for (const m of ['Had a dull ache since lunch', 'What stands out in my labs?', 'How is my sleep']) assert.equal(wantsDocuments(m), false, m);
});
