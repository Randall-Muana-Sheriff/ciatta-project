import assert from 'node:assert/strict';
import { test } from 'node:test';

import { privacyFacts } from './privacyFacts';

const base = { sources: [] as string[], providers: [] as string[], weatherOn: false, findingsOn: false };

test('the record is hers alone, and nothing is sold', () => {
  const facts = privacyFacts(base);
  assert.equal(facts[0].title, 'Your record');
  assert.match(facts[0].body, /only you/i);
  assert.ok(facts.some((f) => /not sold/i.test(f.body)));
});

test('each outside service is named only when it is in use', () => {
  const off = privacyFacts(base).map((f) => f.title);
  assert.ok(!off.includes('Weather around you'));
  assert.ok(!off.includes('Notifications'));
  const on = privacyFacts({ ...base, weatherOn: true, findingsOn: true, sources: ['Apple Health'], providers: ['St Mary\'s'] });
  assert.match(on.find((f) => f.title === 'Weather around you')!.body, /about 10 km/);
  assert.match(on.find((f) => f.title === 'Your devices')!.body, /Apple Health/);
  assert.match(on.find((f) => f.title === 'Your providers')!.body, /St Mary/);
  assert.ok(on.some((f) => f.title === 'Notifications'));
});

test('meal photos and shared summaries are explained', () => {
  const facts = privacyFacts(base);
  assert.match(facts.find((f) => f.title === 'Meal photos')!.body, /OpenAI/);
  assert.match(facts.find((f) => f.title === 'Lab reports')!.body, /OpenAI/);
  assert.match(facts.find((f) => f.title === 'Summaries you share')!.body, /on your phone/);
  assert.match(facts.find((f) => f.title === 'Files you attach')!.body, /this phone/);
});

test('nothing here carries a dash', () => {
  for (const f of privacyFacts({ ...base, weatherOn: true, findingsOn: true, sources: ['A'], providers: ['B'] })) {
    assert.ok(!/[-–—]/.test(f.title + f.body), f.title);
  }
});
