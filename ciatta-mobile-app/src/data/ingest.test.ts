// The batch validator and merge builder live beside the edge function (a
// Deno file imports them with a relative path), but they are plain
// TypeScript with no Deno or Supabase imports, so this suite exercises them
// directly under node:test.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildDayRow,
  buildObservationRow,
  MAX_DAYS,
  MAX_OBSERVATIONS,
  validateBatch,
  type IncomingObservation,
} from '../../supabase/functions/ingest-health/batch';

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
  // workouts, not foods: foods and digestion are hers to fill in and no
  // longer arrive on this endpoint at all, so workouts is the only list
  // column a device sync still writes.
  const row = buildDayRow({ day: '2026-06-01', workouts: [] }, { user_id: 'u1', source_id: 's1' });
  assert.deepEqual(row.workouts, []);
});

test('buildDayRow drops temp_deviation even when a device payload carries it: it is derived by the baselines function, not device sync', () => {
  const row = buildDayRow(
    { day: '2026-06-01', steps: 3500, temp_deviation: 0.4 },
    { user_id: 'u1', source_id: 's1' }
  );
  assert.equal('temp_deviation' in row, false);
  assert.equal(row.steps, 3500);
});

test('buildDayRow drops the fields she fills in herself: a device sync has no measurement of stress or a note', () => {
  const row = buildDayRow(
    { day: '2026-06-01', steps: 3500, sleep_hours: 7.5, stress: 4, note: 'a rough one' },
    { user_id: 'u1', source_id: 's1' }
  );
  assert.equal('stress' in row, false);
  assert.equal('note' in row, false);
  assert.equal(row.steps, 3500);
  assert.equal(row.sleep_hours, 7.5);
});

test('rejects an observation with both value and value_text null', () => {
  const result = validateBatch({
    observations: [observation({ value: null, value_text: null })],
    days: [],
  });
  assert.equal(result.ok, false);
});

test('accepts an observation with value_text set and value null', () => {
  const result = validateBatch({
    observations: [observation({ value: null, value_text: 'spotting' })],
    days: [],
  });
  assert.equal(result.ok, true);
});

test('buildObservationRow drops any key not on the allowlist, even ones that look like server owned columns', () => {
  const row = buildObservationRow(
    observation({
      // Not part of IncomingObservation, but a hostile or buggy caller can
      // still send these on the wire; the cast mirrors what validateBatch
      // hands back at runtime.
      ...({ origin_table: 'episodes', origin_id: 'e1', id: 'forged-id', data_quality: 'low' } as unknown as Partial<IncomingObservation>),
    }),
    { user_id: 'u1', source_id: 's1' }
  );
  assert.equal('origin_table' in row, false);
  assert.equal('origin_id' in row, false);
  assert.equal('id' in row, false);
  assert.equal('data_quality' in row, false);
});

test('buildObservationRow keeps every permitted key', () => {
  const row = buildObservationRow(observation(), { user_id: 'u1', source_id: 's1' });
  assert.deepEqual(row, {
    user_id: 'u1',
    source_id: 's1',
    domain: 'activity',
    metric: 'steps',
    value: 100,
    value_text: null,
    unit: 'count',
    occurred_at: '2026-06-01T08:00:00.000Z',
    provenance: 'MEASURED',
    dedupe_key: 'healthkit:steps:1',
    metadata: {},
  });
});
