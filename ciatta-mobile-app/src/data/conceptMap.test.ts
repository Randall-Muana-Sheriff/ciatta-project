import assert from 'node:assert/strict';
import { test } from 'node:test';

import { METRIC_CONCEPTS, SYMPTOM_TERMS, seedTermsFor } from '../lib/conceptMap';

test('every metric concept carries a system, a code, a display and a term', () => {
  for (const c of METRIC_CONCEPTS) {
    assert.ok(c.system.length > 0, 'system');
    assert.ok(c.code.length > 0, `code for ${c.display}`);
    assert.ok(c.display.length > 0, 'display');
    assert.ok(c.term.length > 0, `term for ${c.display}`);
  }
});

test('the five metrics the baselines function computes all have a concept', () => {
  const domains = METRIC_CONCEPTS.map((c) => c.domain);
  for (const needed of ['sleep', 'activity', 'vitals']) {
    assert.ok(domains.includes(needed), `${needed} has at least one concept`);
  }
  const displays = METRIC_CONCEPTS.map((c) => c.display.toLowerCase());
  assert.ok(displays.some((d) => d.includes('heart rate')), 'resting heart rate is mapped');
  assert.ok(displays.some((d) => d.includes('step')), 'steps are mapped');
});

test('no display carries a hyphen, because these strings can reach her', () => {
  for (const c of METRIC_CONCEPTS) {
    assert.doesNotMatch(c.display, /[-–—]/, `${c.display} carries a dash`);
  }
});

test('symptom terms are terms, never codes', () => {
  for (const s of SYMPTOM_TERMS) {
    assert.ok(s.term.length > 0);
    assert.doesNotMatch(s.term, /^\d+$/, 'a term is a phrase, not a numeric identifier');
  }
});

test('seedTermsFor returns the terms for one domain and nothing else', () => {
  const symptoms = seedTermsFor('symptom');
  assert.ok(symptoms.length > 0);
  for (const s of symptoms) assert.equal(s.domain, 'symptom');
});

test('seedTermsFor returns an empty list for a domain with no terms, not a guess', () => {
  assert.deepEqual(seedTermsFor('nothing_here'), []);
});
