import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { healthDisclosureLines } from './healthDisclosure';
import { QUANTITY_SPECS } from './healthMetrics';

// ── The claim, checked ────────────────────────────────────────────────

// The library's own list of every quantity type HealthKit exposes. Read from
// the package rather than copied, so the assertion is against what the
// library offers today and not against a snapshot of it.
const GENERATED =
  'node_modules/@kingstinct/react-native-healthkit/lib/typescript/generated/healthkit.generated.d.ts';

function everyQuantityIdentifier(): string[] {
  const source = readFileSync(GENERATED, 'utf8');
  const found = source.match(/'HKQuantityTypeIdentifier[A-Za-z0-9]+'/g) ?? [];
  return [...new Set(found.map((q) => q.slice(1, -1)))].sort();
}

test('the screen says every health metric, and every means every', () => {
  // This is what licenses the word. If someone narrows QUANTITY_SPECS, or a
  // library update adds a type, the copy becomes a claim Ciatta does not
  // honour and this fails. Add the type to the specs, or change the copy.
  const offered = everyQuantityIdentifier();
  const specced = new Set(QUANTITY_SPECS.map((s) => s.identifier));
  const missing = offered.filter((identifier) => !specced.has(identifier));

  assert.ok(offered.length > 100, `only found ${offered.length} identifiers, so the list was not read properly`);
  assert.deepEqual(missing, [], `the screen claims every metric and these are not read: ${missing.slice(0, 5).join(', ')}`);
});

test('no spec reads a type the library does not offer', () => {
  // The same check the other way. A stale identifier is a query that can only
  // fail, counted as a metric Ciatta reads.
  const offered = new Set(everyQuantityIdentifier());
  const unknown = QUANTITY_SPECS.map((s) => s.identifier).filter((i) => !offered.has(i));
  assert.deepEqual(unknown, [], `these are not HealthKit quantity types: ${unknown.join(', ')}`);
});

// ── What she actually reads ───────────────────────────────────────────

test('the disclosure is twenty words', () => {
  // Asserted because it is the whole brief. Copy grows a clause at a time,
  // and the next clause is always the reasonable one.
  const words = healthDisclosureLines().join(' ').split(/\s+/).filter(Boolean);
  assert.equal(words.length, 20, `the disclosure is ${words.length} words`);
});

test('the disclosure says what is read and what it is for', () => {
  // Short is not the only requirement. Dropping either half would hit the
  // word count and lose the point.
  const all = healthDisclosureLines().join(' ');
  assert.ok(/every health metric/.test(all), 'it never says how much is read');
  assert.ok(/compares your week to your own usual/.test(all), 'it never says what the data is for');
  assert.ok(/never to anybody else/.test(all), 'it never says the comparison is to her alone');
});

test('each line is a line, with no dash of any kind', () => {
  for (const line of healthDisclosureLines()) {
    assert.ok(line.length > 0, 'an empty line');
    assert.ok(!line.includes('\n'), 'a line contains a break of its own');
    assert.ok(!/\s\s/.test(line), 'a missing clause left a double space');
    assert.equal(line.trim(), line, 'a line is padded');
    for (const dash of ['—', '–', '-']) {
      assert.ok(!line.includes(dash), `"${line}" contains ${dash}`);
    }
  }
});

test('nothing narrates the sheet or claims a finding', () => {
  // It renders before a single sample has been read, and Apple's sheet
  // arrives a moment later to describe itself.
  const all = healthDisclosureLines().join(' ').toLowerCase();
  for (const claim of ['apple asks', 'diagnos', 'detects', 'predicts', 'proves', 'means you']) {
    assert.ok(!all.includes(claim), `the disclosure says too much: ${claim}`);
  }
});
