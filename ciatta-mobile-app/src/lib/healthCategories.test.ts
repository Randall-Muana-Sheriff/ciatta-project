import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CATEGORY_SPECS } from './healthCategories';
import { QUANTITY_SPECS, SLEEP_SPEC } from './healthMetrics';

const GENERATED =
  'node_modules/@kingstinct/react-native-healthkit/lib/typescript/generated/healthkit.generated.d.ts';

function everyCategoryIdentifier(): string[] {
  const source = readFileSync(GENERATED, 'utf8');
  const found = source.match(/'HKCategoryTypeIdentifier[A-Za-z0-9]+'/g) ?? [];
  return [...new Set(found.map((q) => q.slice(1, -1)))].sort();
}

// ── The women's health types, named one by one ───────────────────────

test("the permission covers every women's health category, by name", () => {
  // Named rather than counted, because these are the point of the app. A
  // refactor that quietly dropped menstrual flow would still leave sixty
  // eight category types requested and every other test passing.
  const REQUIRED = [
    'HKCategoryTypeIdentifierMenstrualFlow',
    'HKCategoryTypeIdentifierCervicalMucusQuality',
    'HKCategoryTypeIdentifierOvulationTestResult',
    'HKCategoryTypeIdentifierPregnancy',
    'HKCategoryTypeIdentifierPregnancyTestResult',
    'HKCategoryTypeIdentifierProgesteroneTestResult',
    'HKCategoryTypeIdentifierLactation',
    'HKCategoryTypeIdentifierContraceptive',
    'HKCategoryTypeIdentifierIntermenstrualBleeding',
    'HKCategoryTypeIdentifierIrregularMenstrualCycles',
    'HKCategoryTypeIdentifierInfrequentMenstrualCycles',
    'HKCategoryTypeIdentifierProlongedMenstrualPeriods',
    'HKCategoryTypeIdentifierPersistentIntermenstrualBleeding',
  ];
  const specced = new Set(CATEGORY_SPECS.map((s) => s.identifier));
  const missing = REQUIRED.filter((r) => !specced.has(r));
  assert.deepEqual(missing, [], `Ciatta does not ask for: ${missing.join(', ')}`);
});

test("the women's health types are filed as reproductive, not as symptoms", () => {
  // The domain is what the record groups on later. Menstrual flow filed
  // under symptoms would sit beside headache and nausea, which is the wrong
  // shelf for the thing this app is about.
  for (const metric of ['menstrual_flow', 'cervical_mucus_quality', 'ovulation_test_result', 'contraceptive', 'lactation']) {
    const spec = CATEGORY_SPECS.find((s) => s.metric === metric);
    assert.ok(spec, `${metric} is not requested at all`);
    assert.equal(spec.domain, 'reproductive', `${metric} is filed under ${spec.domain}`);
  }
});

// ── Everything else HealthKit offers ─────────────────────────────────

test('every category type the library offers is requested, except sleep', () => {
  // Sleep is excluded on purpose: it has its own spec and its own stage
  // folding, and requesting it twice would read it twice.
  const offered = everyCategoryIdentifier().filter((i) => i !== SLEEP_SPEC.identifier);
  const specced = new Set(CATEGORY_SPECS.map((s) => s.identifier));
  const missing = offered.filter((i) => !specced.has(i));
  assert.ok(offered.length > 50, `only found ${offered.length} category identifiers`);
  assert.deepEqual(missing, [], `not requested: ${missing.slice(0, 5).join(', ')}`);
});

test('sleep is not specced twice', () => {
  assert.ok(
    !CATEGORY_SPECS.some((s) => s.identifier === SLEEP_SPEC.identifier),
    'sleep would be read once as a category and once as sleep',
  );
});

test('no category metric name collides with a quantity metric name', () => {
  // A shared name merges two unrelated readings into one series.
  const quantity = new Set(QUANTITY_SPECS.map((s) => s.metric));
  const clashes = CATEGORY_SPECS.filter((s) => quantity.has(s.metric)).map((s) => s.metric);
  assert.deepEqual(clashes, [], `shared metric names: ${clashes.join(', ')}`);
});

test('category metric names are unique among themselves', () => {
  const names = CATEGORY_SPECS.map((s) => s.metric);
  assert.equal(new Set(names).size, names.length);
});

test('no category type claims a daily column', () => {
  // Category values are codes, not measurements. Averaging or summing one
  // into a day would produce a number that means nothing.
  for (const spec of CATEGORY_SPECS) {
    assert.ok(!('dayField' in spec), `${spec.metric} claims a daily column`);
  }
});
