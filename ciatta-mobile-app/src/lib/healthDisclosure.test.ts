import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  disclosedCount,
  healthDisclosure,
  overstatedTypes,
  requestedTypes,
  undisclosedTypes,
} from './healthDisclosure';
import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';

// ── The drift guard, which is the reason this file exists ─────────────

test('every type Ciatta asks Apple Health for is described on the screen', () => {
  // The failure this prevents: someone adds a metric to QUANTITY_SPECS, the
  // permission request asks for one more thing than the connect screen admits
  // to, and nothing anywhere complains. If this test fails, write the copy.
  assert.deepEqual(
    undisclosedTypes(),
    [],
    'Ciatta requests these and the screen does not mention them. Add copy to healthDisclosure.',
  );
});

test('the screen does not list anything Ciatta never asks for', () => {
  // The same failure the other way round. A disclosure that overstates is
  // still a disclosure that is wrong, and it is the kind a reader cannot
  // check.
  assert.deepEqual(
    overstatedTypes(),
    [],
    'the screen describes these and Ciatta never requests them. Remove the copy or request the type.',
  );
});

test('the requested list is exactly the specs the permission request is built from', () => {
  // requestedTypes has to stay the same set READ_TYPES in healthKit.ts
  // composes, or the guard above guards the wrong thing. healthKit.ts imports
  // the native module and cannot be loaded here, so the shared source is
  // asserted instead.
  const expected = [
    ...QUANTITY_SPECS.map((s) => s.identifier),
    SLEEP_SPEC.identifier,
    WORKOUT_SPEC.identifier,
  ];
  assert.deepEqual(requestedTypes().map((t) => t.identifier), expected);
});

// ── What she actually sees ────────────────────────────────────────────

test('every row has a name and a description, and no internal identifier reaches her', () => {
  for (const group of healthDisclosure()) {
    assert.ok(group.title.length > 0, 'a group rendered with no title');
    assert.ok(group.items.length > 0, 'an empty group rendered');
    for (const item of group.items) {
      assert.ok(item.label.length > 0, `${item.identifier} has no label`);
      assert.ok(item.detail.length > 0, `${item.identifier} has no detail`);
      assert.ok(!/^HK/.test(item.label), `${item.identifier} shows its HealthKit name`);
      assert.ok(!/^HK/.test(item.detail), `${item.identifier} shows its HealthKit name`);
    }
  }
});

test('the count on screen is the number of things she is agreeing to share', () => {
  assert.equal(disclosedCount(), requestedTypes().length);
  assert.ok(disclosedCount() > 0);
});

test('no dash of any kind reaches the screen', () => {
  // The copy rule. Compound words are separate words here: heart rate, not
  // heart-rate.
  for (const group of healthDisclosure()) {
    for (const text of [group.title, ...group.items.flatMap((i) => [i.label, i.detail])]) {
      for (const dash of ['—', '–', '-']) {
        assert.ok(!text.includes(dash), `"${text}" contains ${dash}`);
      }
    }
  }
});

test('nothing on the screen claims a reading means something', () => {
  // The screen is a list of what is collected, shown before any sample has
  // been read. A line saying what a number reveals would be a finding, and
  // there is nothing yet to find it in.
  for (const group of healthDisclosure()) {
    for (const item of group.items) {
      const detail = item.detail.toLowerCase();
      for (const claim of ['diagnos', 'detects', 'predicts', 'proves', 'indicates that you', 'means you']) {
        assert.ok(!detail.includes(claim), `"${item.label}" claims a finding: ${claim}`);
      }
    }
  }
});
