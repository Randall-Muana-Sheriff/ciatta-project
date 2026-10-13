import assert from 'node:assert/strict';
import { test } from 'node:test';

import { todayInsight } from './todayInsight';

test('her lead insight leads, and opens its evidence', () => {
  const t = todayInsight({ leadId: 'rhrHigh', leadText: 'Your resting heart rate has been above your usual for 6 days.', fallback: 'x' });
  assert.deepEqual(t, { text: 'Your resting heart rate has been above your usual for 6 days.', evidence: 'rhrHigh' });
});

test('with nothing found yet, the card says what Ciatta is doing rather than disappearing', () => {
  const t = todayInsight({ leadId: null, leadText: 'opening line', fallback: 'Ciatta is watching one possible pattern, and will show it when it has happened often enough to be sure.' });
  assert.equal(t.evidence, null);
  assert.match(t.text, /^Ciatta is watching one possible pattern/);
});
