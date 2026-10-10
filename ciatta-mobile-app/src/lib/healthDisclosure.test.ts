import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  healthCategories,
  healthCategoryClause,
  healthDisclosureParagraph,
  overstatedCategories,
  requestedTypes,
  unnamedCategories,
} from './healthDisclosure';
import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';

// ── The drift guard, which is the reason this file exists ─────────────

test('every kind of data Ciatta asks for is covered by a category she is shown', () => {
  // The failure this prevents: someone adds a metric under a new domain, the
  // permission request asks for something the sentence does not cover, and
  // nothing anywhere complains. If this fails, name the category.
  assert.deepEqual(
    unnamedCategories(),
    [],
    'Ciatta requests these domains and the screen does not name them. Add them to CATEGORY_NAMES.',
  );
});

test('the sentence does not claim a kind of data Ciatta never asks for', () => {
  // The same failure the other way round, and the kind a reader cannot check.
  assert.deepEqual(
    overstatedCategories(),
    [],
    'the screen names these and Ciatta never requests them. Remove the name or request the type.',
  );
});

test('the requested list is exactly the specs the permission request is built from', () => {
  // requestedTypes has to stay the set READ_TYPES in healthKit.ts composes,
  // or the guards above guard the wrong thing. healthKit.ts imports the
  // native module and cannot be loaded here, so the shared source is
  // asserted instead.
  assert.deepEqual(requestedTypes().map((t) => t.identifier), [
    ...QUANTITY_SPECS.map((s) => s.identifier),
    SLEEP_SPEC.identifier,
    WORKOUT_SPEC.identifier,
  ]);
});

// ── What she actually reads ───────────────────────────────────────────

test('the categories are words rather than internal domains', () => {
  const categories = healthCategories();
  assert.ok(categories.length > 0);
  for (const c of categories) {
    assert.ok(c.length > 0);
    assert.ok(!['activity', 'vitals'].includes(c), `"${c}" is the internal domain, not a word she uses`);
  }
});

test('the clause lists every category and reads as a sentence would', () => {
  const clause = healthCategoryClause();
  for (const c of healthCategories()) {
    assert.ok(clause.includes(c), `the clause dropped ${c}`);
  }
  assert.ok(clause.includes(' and '), 'the categories were run together with no conjunction');
});

test('the paragraph names every category and says what they are for', () => {
  const p = healthDisclosureParagraph();
  assert.ok(p.includes(healthCategoryClause()), 'the paragraph does not name the categories');
  assert.ok(/compare a week to your own usual/.test(p), 'the paragraph does not say what the data is for');
});

test('the paragraph is one sentence and does not describe the sheet that follows', () => {
  // The button says Continue to Apple Health and Apple's own sheet arrives a
  // moment later to speak for itself. Describing it here is a sentence she
  // reads once and never needs again.
  const p = healthDisclosureParagraph();
  assert.equal(p.split('. ').length, 1, 'the paragraph grew a second sentence');
  assert.ok(!/Apple asks/.test(p), 'the paragraph narrates the sheet that follows it');
});

test('the paragraph is one paragraph and holds no dash of any kind', () => {
  const p = healthDisclosureParagraph();
  assert.ok(!p.includes('\n'), 'the prose was broken into lines');
  assert.ok(!/\s\s/.test(p), 'a missing clause left a double space');
  for (const dash of ['—', '–', '-']) {
    assert.ok(!p.includes(dash), `the paragraph contains ${dash}`);
  }
});

test('the paragraph claims nothing about what a reading means', () => {
  // It renders before a single sample has been read, so a sentence about
  // what any of this reveals would be a finding with nothing to find it in.
  const p = healthDisclosureParagraph().toLowerCase();
  for (const claim of ['diagnos', 'detects', 'predicts', 'proves', 'means you', 'tells you whether']) {
    assert.ok(!p.includes(claim), `the paragraph claims a finding: ${claim}`);
  }
});
