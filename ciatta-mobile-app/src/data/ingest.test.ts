// The batch validator and merge builder live beside the edge function (a
// Deno file imports them with a relative path), but they are plain
// TypeScript with no Deno or Supabase imports, so this suite exercises them
// directly under node:test.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDayRow, MAX_DAYS, MAX_OBSERVATIONS, validateBatch, type IncomingObservation } from '../../supabase/functions/ingest-health/batch';

function observation(overrides: Partial<IncomingObservation> = {}): IncomingObservation {
  return {
    domain: 'activity',
    metric: 'steps',
    value: 100,
    value_text: null,
    unit: 'count',
    occurred_at: '2026-06-01T08:00:00.000Z',
    provenance: 'MEASURED',
    dedupe_key: 'healthkit:steps:1',
    metadata: {},
    ...overrides,
  };
}

test('rejects a batch with more observations than the cap', () => {
  const observations = Array.from({ length: MAX_OBSERVATIONS + 1 }, (_, i) => observation({ dedupe_key: `k${i}` }));
  const result = validateBatch({ observations, days: [] });
  assert.equal(result.ok, false);
});

test('rejects a batch with more days than the cap', () => {
  const days = Array.from({ length: MAX_DAYS + 1 }, (_, i) => ({ day: `2026 01 ${i}`, steps: 1 }));
  const result = validateBatch({ observations: [], days });
  assert.equal(result.ok, false);
});

test('accepts a batch right at the caps', () => {
  const observations = Array.from({ length: MAX_OBSERVATIONS }, (_, i) => observation({ dedupe_key: `k${i}` }));
  const days = Array.from({ length: MAX_DAYS }, (_, i) => ({ day: `2026 01 ${i}`, steps: 1 }));
  const result = validateBatch({ observations, days });
  assert.equal(result.ok, true);
});

test('rejects a DERIVED observation', () => {
  const result = validateBatch({ observations: [observation({ provenance: 'DERIVED' })], days: [] });
  assert.equal(result.ok, false);
});

test('rejects INFERRED and RESEARCH too, but accepts MEASURED and RECORDED', () => {
  assert.equal(validateBatch({ observations: [observation({ provenance: 'INFERRED' })], days: [] }).ok, false);
  assert.equal(validateBatch({ observations: [observation({ provenance: 'RESEARCH' })], days: [] }).ok, false);
  assert.equal(validateBatch({ observations: [observation({ provenance: 'MEASURED' })], days: [] }).ok, true);
  assert.equal(validateBatch({ observations: [observation({ provenance: 'RECORDED' })], days: [] }).ok, true);
});

test('accepts a valid batch of observations and days', () => {
  const result = validateBatch({
    observations: [observation()],
    days: [{ day: '2026-06-01', steps: 3500 }],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.batch.observations.length, 1);
    assert.equal(result.batch.days.length, 1);
  }
});

test('buildDayRow includes only the keys present in the incoming day', () => {
  const row = buildDayRow({ day: '2026-06-01', steps: 3500 }, { user_id: 'u1', source_id: 's1' });
  assert.deepEqual(row, { day: '2026-06-01', user_id: 'u1', source_id: 's1', steps: 3500 });
});

test('buildDayRow never writes sleep_hours when the incoming day did not carry it', () => {
  const row = buildDayRow({ day: '2026-06-01', steps: 3500 }, { user_id: 'u1', source_id: 's1' });
  assert.equal('sleep_hours' in row, false);
});

test('buildDayRow omits absent list columns rather than defaulting them to empty lists', () => {
  const row = buildDayRow({ day: '2026-06-01', steps: 3500 }, { user_id: 'u1', source_id: 's1' });
  assert.equal('workouts' in row, false);
  assert.equal('foods' in row, false);
  assert.equal('digestion' in row, false);
});

test('buildDayRow carries a list column through when it is present, even an empty one', () => {
  const row = buildDayRow({ day: '2026-06-01', foods: [] }, { user_id: 'u1', source_id: 's1' });
  assert.deepEqual(row.foods, []);
});
