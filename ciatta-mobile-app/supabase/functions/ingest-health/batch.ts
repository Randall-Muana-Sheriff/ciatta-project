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
  'temp_deviation',
  'energy',
  'mood',
  'stress',
  'caffeine',
  'alcohol',
  'foods',
  'digestion',
  'note',
] as const;

// Builds the row to upsert for one day: `day` plus only the keys the
// payload actually carried, plus the caller supplied identity fields. A key
// left out of the incoming day stays left out of this row too, so upserting
// it can never blank an existing value or write an empty list into a
// nullable column that was never mentioned. This is what lets a day
// carrying only steps leave sleep_hours, workouts, foods and digestion
// exactly as they already are.
export function buildDayRow(day: IncomingDay, extra: { user_id: string; source_id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = { day: day.day, ...extra };
  for (const field of DAY_FIELDS) {
    if (field in day && day[field] !== undefined) row[field] = day[field];
  }
  return row;
}
