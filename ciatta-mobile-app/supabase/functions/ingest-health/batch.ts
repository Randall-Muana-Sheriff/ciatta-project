// Pure validation and merge shape logic for a health ingest batch. No Deno
// or Supabase imports here on purpose: this file is plain TypeScript so a
// Node test can exercise it directly, while the edge function itself (Deno)
// imports it with a relative path.

export const MAX_OBSERVATIONS = 500;
export const MAX_DAYS = 120;

// Provenance a device sync is allowed to write. MEASURED is a direct sensor
// reading, RECORDED is something the device itself timestamped. DERIVED,
// INFERRED and RESEARCH are computed elsewhere and never come from a sync.
const ALLOWED_PROVENANCE = new Set(['MEASURED', 'RECORDED']);

export type IncomingObservation = {
  domain: string;
  metric: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  occurred_at: string;
  provenance: string;
  dedupe_key: string;
  metadata: Record<string, unknown>;
};

export type IncomingDay = {
  day: string;
  [field: string]: unknown;
};

export type Batch = {
  observations: IncomingObservation[];
  days: IncomingDay[];
};

export type ValidationResult = { ok: true; batch: Batch } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Checks the shape and caps of an incoming batch. Never trusts a user id
// from the body; the caller resolves that from the verified token
// separately and stamps it on every row this returns.
export function validateBatch(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: 'Invalid batch' };

  const { observations, days } = body;
  if (!Array.isArray(observations) || !Array.isArray(days)) return { ok: false, error: 'Invalid batch' };
  if (observations.length > MAX_OBSERVATIONS) return { ok: false, error: 'Too many observations in one batch' };
  if (days.length > MAX_DAYS) return { ok: false, error: 'Too many days in one batch' };

  for (const observation of observations) {
    if (!isPlainObject(observation)) return { ok: false, error: 'Invalid observation' };
    const provenance = observation.provenance;
    if (typeof provenance !== 'string' || !ALLOWED_PROVENANCE.has(provenance)) {
      return { ok: false, error: 'Observation provenance is not allowed' };
    }
    if (typeof observation.dedupe_key !== 'string' || observation.dedupe_key.length === 0) {
      return { ok: false, error: 'Invalid observation' };
    }
    // Mirrors the database check constraint (value is not null or value_text
    // is not null) so a malformed payload is rejected here with a 400,
    // rather than reaching the insert and raising a 500 from the constraint.
    if (observation.value == null && observation.value_text == null) {
      return { ok: false, error: 'Invalid observation' };
    }
  }

  for (const day of days) {
    if (!isPlainObject(day) || typeof day.day !== 'string' || day.day.length === 0) {
      return { ok: false, error: 'Invalid day' };
    }
  }

  return {
    ok: true,
    batch: { observations: observations as IncomingObservation[], days: days as IncomingDay[] },
  };
}

// Every field an incoming day row may carry, besides `day` itself (the
// conflict key) and the fields the caller stamps on it (user_id, source_id).
const DAY_FIELDS = [
  'sleep_hours',
  'stage_awake',
  'stage_rem',
  'stage_light',
  'stage_deep',
  'time_in_bed',
  'steps',
  'active_minutes',
  'workouts',
  'resting_hr',
  'hrv',
  // temp_deviation is deliberately absent: it is derived, a night's wrist
  // temperature minus her own median across the baseline window, and is
  // written only by the baselines function under the service role. A
  // device sync has no measurement of it, so it is never in this
  // allowlist even if a client payload carries it.
  //
  // energy, mood, stress, caffeine, alcohol, foods, digestion and note are
  // deliberately absent for the same reason: they are the columns she fills
  // in herself (20260916100100_daily_metrics_read_only.sql names exactly
  // this set). A device sync has no measurement of any of them, and a row
  // written here takes the table's default MEASURED provenance, so
  // accepting them would store something she said as something a sensor
  // read. When self reported check ins are built they get their own write
  // path, stamping REPORTED, rather than arriving on this endpoint.
] as const;

// Builds the row to upsert for one day: `day` plus only the keys the
// payload actually carried, plus the caller supplied identity fields. A key
// left out of the incoming day stays left out of this row too, so upserting
// it can never blank an existing value or write an empty list into a
// nullable column that was never mentioned. This is what lets a day
// carrying only steps leave sleep_hours and workouts exactly as they
// already are. Her own check in columns are not merged here at all: they
// are off the allowlist above, so this path cannot touch them either way.
export function buildDayRow(day: IncomingDay, extra: { user_id: string; source_id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = { day: day.day, ...extra };
  for (const field of DAY_FIELDS) {
    if (field in day && day[field] !== undefined) row[field] = day[field];
  }
  return row;
}

// Every field an incoming observation may carry. A caller can still send
// other keys on the wire (origin_table, origin_id, id, data_quality,
// created_at, updated_at, ...) since validateBatch only checks shape, not
// an allowlist; this is what keeps them out of the insert. origin_table and
// origin_id in particular record which database trigger materialised a row
// (Slice 3's evidence trail from a finding back to the measurement behind
// it), and a client able to forge them makes that trail unreliable.
const OBSERVATION_FIELDS = [
  'domain',
  'metric',
  'value',
  'value_text',
  'unit',
  'occurred_at',
  'provenance',
  'dedupe_key',
  'metadata',
] as const;

export function buildObservationRow(
  observation: IncomingObservation,
  extra: { user_id: string; source_id: string }
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...extra };
  for (const field of OBSERVATION_FIELDS) {
    row[field] = observation[field];
  }
  return row;
}
