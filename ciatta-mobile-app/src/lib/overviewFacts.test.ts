import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overviewFacts } from './overviewFacts';

const NOW = new Date(2026, 9, 14, 9);
const stats = [
  { icon: 'person', tone: 'coral', label: 'Age', value: '28 years', sub: 'Born Apr 14, 1996' },
  { icon: 'ruler', tone: 'coral', label: 'Height', value: '5′ 8″', sub: '173 cm' },
  { icon: 'drop', tone: 'coral', label: 'Blood Type', value: 'A+' },
  { icon: 'shield', tone: 'lavender', label: 'Insurance', value: 'Anthem', sub: 'PPO' },
];

test('six facts, in a fixed order, at the top of her overview', () => {
  const facts = overviewFacts({ stats, weight: { value: '64.2 kg', note: 'Yesterday' }, lastPeriod: new Date(2026, 9, 12), now: NOW });
  assert.deepEqual(facts.map((f) => f.label), ['Age', 'Height', 'Weight', 'Blood Type', 'Insurance', 'Last period']);
  assert.deepEqual(facts[2], { key: 'weight', label: 'Weight', value: '64.2 kg', sub: 'Yesterday', icon: 'body' });
  assert.deepEqual(facts[5], { key: 'period', label: 'Last period', value: '12 Oct', sub: 'Cycle day 3', icon: 'calendar' });
  assert.equal(facts[0].value, '28 years');
});

test('what Ciatta does not have reads as not added, never invented', () => {
  const facts = overviewFacts({ stats: [], weight: null, lastPeriod: null, now: NOW });
  assert.equal(facts.length, 6);
  for (const f of facts) assert.equal(f.value, null, f.label);
});
