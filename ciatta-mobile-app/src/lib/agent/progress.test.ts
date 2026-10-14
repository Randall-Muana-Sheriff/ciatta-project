import assert from 'node:assert/strict';
import { test } from 'node:test';

import { progressSteps, revealWords } from './progress';

test('the steps shown are the ones this answer actually took, ending on the check', () => {
  assert.deepEqual(
    progressSteps({ capability: 'labs', facts: [{ label: 'Ferritin', value: '12', from: 'measured' }], suggestions: [], text: '' }),
    ['Reading your question', 'Checking your labs', 'Checking every figure against your record'],
  );
  assert.deepEqual(
    progressSteps({
      capability: 'system',
      facts: [
        { label: 'Reproductive', value: 'Cycle day 22', from: 'reported' },
        { label: 'Reproductive', value: 'HRV 40 ms', from: 'measured' },
        { label: 'Reproductive, worth exploring', value: 'x', from: 'derived' },
      ],
      suggestions: [],
      text: '',
    }),
    ['Reading your question', 'Reading your logs', 'Reading your devices', 'Comparing with your usual', 'Checking every figure against your record'],
  );
  // Nothing to read from: it says it looked, and found too little.
  assert.deepEqual(progressSteps({ capability: 'record', facts: [], suggestions: [], text: '', abstained: 'no_data' }), [
    'Reading your question',
    'Looking through your record',
  ]);
  assert.deepEqual(progressSteps({ capability: 'escalate', facts: [], suggestions: [], text: '' }), ['Reading your question']);
});

test('the answer is revealed a few words at a time, ending on the whole text', () => {
  const text = 'One two three four five six seven.';
  assert.equal(revealWords(text, 0), '');
  assert.equal(revealWords(text, 3), 'One two three');
  assert.equal(revealWords(text, 99), text);
});
