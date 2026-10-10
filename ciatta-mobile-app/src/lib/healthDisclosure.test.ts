import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  healthCategories,
  healthCategoryClause,
  healthDisclosureLines,
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

test('the three lines name every category and say what the data is for', () => {
  const lines = healthDisclosureLines();
  assert.equal(lines.length, 3, 'the disclosure is not three lines');
  const all = lines.join(' ');
  for (const c of healthCategories()) {
    assert.ok(all.toLowerCase().includes(c.toLowerCase()), `the disclosure dropped ${c}`);
  }
  assert.ok(/compares your week to your own usual/.test(all), 'it never says what the data is for');
});

test('no line narrates the sheet that follows it', () => {
  // The button says Connect Apple Health and Apple's own sheet arrives a
  // moment later to speak for itself.
  const all = healthDisclosureLines().join(' ');
  assert.ok(!/Apple asks/.test(all), 'the disclosure narrates the sheet that follows it');
});

test('each line is a line, with no dash of any kind', () => {
  for (const line of healthDisclosureLines()) {
    assert.ok(line.length > 0, 'an empty line');
    assert.ok(!line.includes('\n'), 'a line contains a break of its own');
    assert.ok(!/\s\s/.test(line), 'a missing clause left a double space');
    assert.equal(line.trim(), line, 'a line is padded');
    for (const dash of ['\u2014', '\u2013', '-']) {
      assert.ok(!line.includes(dash), `"${line}" contains ${dash}`);
    }
  }
});

test('no line claims anything about what a reading means', () => {
  // They render before a single sample has been read.
  const all = healthDisclosureLines().join(' ').toLowerCase();
  for (const claim of ['diagnos', 'detects', 'predicts', 'proves', 'means you', 'tells you whether']) {
    assert.ok(!all.includes(claim), `the disclosure claims a finding: ${claim}`);
  }
});
