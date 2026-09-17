import assert from 'node:assert/strict';
import { test } from 'node:test';

import { METRIC_CONCEPTS, SYMPTOM_TERMS, UNIT_CONCEPTS, seedTermsFor } from '../lib/conceptMap';
import { SYMPTOMS } from './cycleLog';

test('every metric concept carries a system, a code, a display and a term', () => {
  for (const c of METRIC_CONCEPTS) {
    assert.ok(c.system.length > 0, 'system');
    assert.ok(c.code.length > 0, `code for ${c.display}`);
    assert.ok(c.display.length > 0, 'display');
    assert.ok(c.term.length > 0, `term for ${c.display}`);
  }
});

test('all eight metric concepts are present, and each domain the baselines function computes has at least one', () => {
  assert.equal(METRIC_CONCEPTS.length, 8, 'the metric count is pinned, not implied');
  const domains = METRIC_CONCEPTS.map((c) => c.domain);
  for (const needed of ['sleep', 'activity', 'vitals']) {
    assert.ok(domains.includes(needed), `${needed} has at least one concept`);
  }
  const displays = METRIC_CONCEPTS.map((c) => c.display.toLowerCase());
  assert.ok(displays.some((d) => d.includes('heart rate')), 'resting heart rate is mapped');
  assert.ok(displays.some((d) => d.includes('step')), 'steps are mapped');
});

// Only `display` is scanned here. `code` legitimately contains a hyphen
// (LOINC identifiers like `8867-4`, and UMLS's own delimiter inside long
// common names such as `Heart rate --resting` show up in `term`), and
// `term` is a search string handed to UMLS, not copy that can reach her.
// `display` is the one field of these that renders in the app, so it is
// the one held to the no dash rule.
test('no metric or unit display carries a hyphen, because these strings can reach her', () => {
  for (const c of [...METRIC_CONCEPTS, ...UNIT_CONCEPTS]) {
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

test('seedTermsFor exposes the unit concepts too, each as a ucum term', () => {
  const units = seedTermsFor('unit');
  assert.equal(units.length, 8);
  for (const u of UNIT_CONCEPTS) {
    assert.equal(u.system, 'ucum', `${u.display} is not ucum`);
  }
});

// SYMPTOM_TERMS exists to describe exactly what she chose, never a
// paraphrase of it. That guarantee held only because someone read both
// arrays side by side once. This test makes it hold on its own: if a
// symptom is ever added to, removed from, or reworded in the logging
// screen's SYMPTOMS array without a matching, deliberate decision here,
// this fails loudly instead of quietly leaving the new phrase unmapped.
// Omitting a term is a legitimate choice, the way 'Other' is deliberately
// left out below; drifting out of sync unnoticed is not.
test('SYMPTOM_TERMS names exactly the logging screen\'s symptoms, minus the deliberately unmapped Other', () => {
  const expected = SYMPTOMS.filter((s) => s !== 'Other');
  assert.deepEqual(
    SYMPTOM_TERMS.map((t) => t.term),
    expected,
    'SYMPTOM_TERMS has drifted from SYMPTOMS in src/data/cycleLog.ts: a symptom was added, removed, or reworded there ' +
      'without a matching decision here about whether it can be mapped'
  );
});
