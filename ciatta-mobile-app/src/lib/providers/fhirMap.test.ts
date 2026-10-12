import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { codeableName, effectiveDay, interpretation, isRetracted, mapBundle, mapResource, quantity } from './fhirMap';

const obs = (over: Record<string, unknown> = {}) => ({
  resourceType: 'Observation',
  id: 'o1',
  status: 'final',
  code: { text: 'Thyroid stimulating hormone' },
  effectiveDateTime: '2026-03-14T07:41:00Z',
  valueQuantity: { value: 4.2, unit: 'mIU/L' },
  ...over,
});

// ── A value without its unit is not a value ──────────────────────────

test('a quantity needs both a number and a unit', () => {
  assert.equal(quantity({ value: 4.2, unit: 'mIU/L' }), '4.2 mIU/L');
  assert.equal(quantity({ value: 4.2 }), null);
  assert.equal(quantity({ unit: 'mIU/L' }), null);
  assert.equal(quantity(null), null);
});

test('a lab result with no unit is dropped rather than shown bare', () => {
  // 4.2 is a thyroid result, a potassium level or a white cell count
  // depending on the unit. A bare number invites a wrong comparison.
  assert.equal(mapResource(obs({ valueQuantity: { value: 4.2 } }))?.value, null);
});

test('the unit may come from code when unit is absent', () => {
  assert.equal(quantity({ value: 7, code: 'mg/dL' }), '7 mg/dL');
});

// ── Nothing is interpreted here ──────────────────────────────────────

test('high and low come from the lab, never from comparing to a range', () => {
  assert.equal(interpretation([{ coding: [{ code: 'H' }] }]), 'high');
  assert.equal(interpretation([{ coding: [{ code: 'LL' }] }]), 'low');
  assert.equal(interpretation([{ coding: [{ code: 'A' }] }]), 'abnormal');
});

test('an unrecognised interpretation code is null, not a guess', () => {
  assert.equal(interpretation([{ coding: [{ code: 'ZZ' }] }]), null);
  assert.equal(interpretation(undefined), null);
});

test('a value far outside a sent range is still unflagged when the lab did not flag it', () => {
  const r = mapResource(obs({ valueQuantity: { value: 900, unit: 'mIU/L' }, referenceRange: [{ high: { value: 4 } }] }));
  assert.equal(r?.flag, null, 'comparing a value to a range is a clinical judgement, not a parse');
});

// ── Names are the provider's words ───────────────────────────────────

test('text wins over a coding display, because text is what the lab chose', () => {
  assert.equal(codeableName({ text: 'TSH', coding: [{ display: 'Thyrotropin' }] }), 'TSH');
  assert.equal(codeableName({ coding: [{ display: 'Thyrotropin' }] }), 'Thyrotropin');
  assert.equal(codeableName({ coding: [{ code: '3016-3' }] }), null, 'a bare code is not a name');
});

// ── Dates ────────────────────────────────────────────────────────────

test('the day is taken from whichever field the resource type uses', () => {
  assert.equal(effectiveDay({ effectiveDateTime: '2026-03-14T07:41:00Z' }), '2026-03-14');
  assert.equal(effectiveDay({ onsetDateTime: '2024-01-02' }), '2024-01-02');
  assert.equal(effectiveDay({ authoredOn: '2025-06-30T12:00:00Z' }), '2025-06-30');
  assert.equal(effectiveDay({ effectivePeriod: { start: '2023-09-09T00:00:00Z' } }), '2023-09-09');
});

test('no date stays null rather than becoming today', () => {
  assert.equal(effectiveDay({}), null);
  assert.equal(mapResource(obs({ effectiveDateTime: undefined, issued: undefined }))?.effectiveOn, null);
});

// ── What is and is not a record ──────────────────────────────────────

test('a resource with no id is skipped, since a re sync would duplicate it', () => {
  assert.equal(mapResource(obs({ id: undefined })), null);
});

test('a resource with no readable name is skipped', () => {
  assert.equal(mapResource(obs({ code: { coding: [{ code: '3016-3' }] } })), null);
});

test('a resource type Ciatta does not hold is skipped, not coerced', () => {
  assert.equal(mapResource({ resourceType: 'Encounter', id: 'e1', code: { text: 'Visit' } }), null);
});

test('the id carries its type, so two resources numbered 1 do not collide', () => {
  assert.equal(mapResource(obs())?.sourceId, 'Observation/o1');
});

// ── Kinds ────────────────────────────────────────────────────────────

test('a vital sign is a vital, read from its category rather than its name', () => {
  const r = mapResource(obs({ category: [{ coding: [{ code: 'vital-signs' }] }], code: { text: 'Heart rate' } }));
  assert.equal(r?.kind, 'vital');
  assert.equal(mapResource(obs())?.kind, 'lab');
});

test('each resource type lands on its own kind with its own name field', () => {
  assert.equal(mapResource({ resourceType: 'Condition', id: 'c', code: { text: 'Endometriosis' } })?.kind, 'condition');
  const med = mapResource({ resourceType: 'MedicationRequest', id: 'm', medicationCodeableConcept: { text: 'Naproxen' } });
  assert.equal(med?.kind, 'medication');
  assert.equal(med?.name, 'Naproxen');
  const shot = mapResource({ resourceType: 'Immunization', id: 'i', vaccineCode: { text: 'Influenza' } });
  assert.equal(shot?.kind, 'immunization');
  assert.equal(shot?.name, 'Influenza');
});

// ── Status is carried, not hidden ────────────────────────────────────

test('a preliminary result keeps its status rather than passing as final', () => {
  assert.equal(mapResource(obs({ status: 'preliminary' }))?.status, 'preliminary');
  assert.equal(mapResource(obs({ status: 'amended' }))?.status, 'amended');
});

test('a retracted result is recognisable, so it is never shown as though it stood', () => {
  const r = mapResource(obs({ status: 'entered-in-error' }))!;
  assert.ok(isRetracted(r));
  assert.ok(!isRetracted(mapResource(obs())!));
});

// ── Whole bundles ────────────────────────────────────────────────────

test('a bundle keeps what it can read and counts what it could not', () => {
  const out = mapBundle({ entry: [{ resource: obs() }, { resource: { resourceType: 'Encounter', id: 'e' } }, {}] });
  assert.equal(out.records.length, 1);
  assert.equal(out.skipped, 2, 'a sync that silently dropped half her chart should be visible somewhere');
});

test('junk in place of a bundle gives nothing rather than throwing', () => {
  for (const junk of [null, undefined, 'bundle', 42, []]) {
    assert.deepEqual(mapBundle(junk), { records: [], skipped: 0 });
  }
});

// ── The deployed copy may not drift ──────────────────────────────────

test('the edge function copy of the mapper is identical to this one', () => {
  // An edge function deploys only its own directory, so the mapper exists
  // twice. Two copies of the file that decides what a lab value means is
  // exactly the kind of duplication that goes wrong quietly.
  const here = readFileSync(new URL('./fhirMap.ts', import.meta.url), 'utf8');
  const deployed = readFileSync(
    new URL('../../../supabase/functions/provider-connect/fhirMap.ts', import.meta.url),
    'utf8',
  );
  const body = (text: string) => text.slice(text.indexOf('export type ClinicalKind'));
  assert.equal(body(deployed), body(here), 'the deployed mapper has drifted from the tested one');
});
