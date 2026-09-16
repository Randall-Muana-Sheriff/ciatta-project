// The sync loop that carries what Apple Health reports into observations
// and daily rows, then posts them to the ingest-health edge function.
//
// Pure and platform free: no HealthKit call, no React Native import, no
// network call lives here. `SyncPort` is the seam a device layer (see
// healthKit.ts) implements for real, and a test implements with a fake, so
// this file's behaviour is provable without a phone.
import type { DailyRow, MetricSpec, SleepSpec, WorkoutSpec } from './healthMetrics';
import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';
import type { CategorySample, FoldableSample, NewObservation, QuantitySample, WorkoutSample } from './healthSamples';
import { foldDay, sampleToObservation } from './healthSamples';

// ── The seam ─────────────────────────────────────────────────────

// What a sync pass reads and writes, with no mention of HealthKit or
// Supabase: a test hands this a fake, the device layer hands it the real
// thing. `samples` are whatever the underlying query returned; this file
// already knows, from which identifier it asked for, how to read them.
export type SyncPort = {
  query(
    identifier: string,
    opts: { anchor?: string; limit: number; since?: Date },
  ): Promise<{ samples: unknown[]; newAnchor: string }>;
  post(batch: { observations: NewObservation[]; days: DailyRow[] }): Promise<void>;
};

// Where each metric's anchor was left off. Backed by AsyncStorage on the
// device; a plain in memory object in tests.
export type AnchorStore = {
  get(key: string): Promise<string | null>;
  set(key: string, anchor: string): Promise<void>;
};

// Keyed per account, deliberately. A device wide key once let one account's
// queued data go out under whoever was signed in next; naming the account
// in the key itself makes that impossible to repeat.
export function anchorKey(userId: string, identifier: string): string {
  return `hk-anchor.v1.${userId}.${identifier}`;
}

export type SyncMode = 'recovery' | 'incremental';

export type SyncProgress = {
  identifier: string;
  metric: string;
  samples: number;
  observations: number;
  posted: number;
  index: number;
  total: number;
};

export type MetricOutcome = {
  identifier: string;
  metric: string;
  samples: number;
  observations: number;
  posted: number;
  ok: boolean;
  error?: string;
};

export type SyncResult = {
  // Observations actually accepted by a successful post, summed across every metric.
  observations: number;
  // Samples read from every metric, whether or not their post went through.
  samples: number;
  metrics: MetricOutcome[];
  // Identifiers whose anchor did not advance this run, so the caller can
  // decide whether to retry, warn, or just let the next run pick them up.
  failed: string[];
};

// ── What we read ─────────────────────────────────────────────────

type AnySpec = MetricSpec | SleepSpec | WorkoutSpec;
type SpecKind = 'quantity' | 'sleep' | 'workout';

const SYNC_SPECS: readonly { kind: SpecKind; spec: AnySpec }[] = [
  ...QUANTITY_SPECS.map((spec) => ({ kind: 'quantity' as const, spec: spec as AnySpec })),
  { kind: 'sleep' as const, spec: SLEEP_SPEC as AnySpec },
  { kind: 'workout' as const, spec: WORKOUT_SPEC as AnySpec },
];

// How far back a recovery sync reaches when there is no anchor to trust yet.
export const RECOVERY_WINDOW_DAYS = 90;

// The most observations one post carries. Well under the edge function's
// own cap of 500, so a single sync never leans on that ceiling.
export const BATCH_SIZE = 250;

function toFoldable(kind: SpecKind, spec: AnySpec, raw: unknown): FoldableSample {
  if (kind === 'quantity') return { kind: 'quantity', spec: spec as MetricSpec, sample: raw as QuantitySample };
  if (kind === 'sleep') return { kind: 'sleep', sample: raw as CategorySample };
  return { kind: 'workout', sample: raw as WorkoutSample };
}

function toObservation(kind: SpecKind, spec: AnySpec, raw: unknown): NewObservation {
  if (kind === 'quantity') return sampleToObservation(spec as MetricSpec, raw as QuantitySample);
  if (kind === 'sleep') return sampleToObservation(spec, raw as CategorySample);
  return sampleToObservation(spec, raw as WorkoutSample);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── The loop ─────────────────────────────────────────────────────

// Reads every metric this app cares about, folds what it read into
// observations and days, and posts them. Each metric's anchor moves only
// once its own post has gone through: a batch that fails leaves the anchor
// exactly where it was, so the next run re-reads (and, thanks to a stable
// dedupe key on every observation and a day upsert that only ever touches
// the keys present, harmlessly re-sends) the samples that never made it.
export async function runHealthSync(
  userId: string,
  deps: {
    port: SyncPort;
    anchors: AnchorStore;
    onProgress?: (progress: SyncProgress) => void;
    mode: SyncMode;
  },
): Promise<SyncResult> {
  const { port, anchors, onProgress, mode } = deps;
  const since = mode === 'recovery' ? new Date(Date.now() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000) : undefined;

  const metrics: MetricOutcome[] = [];
  const failed: string[] = [];
  let totalSamples = 0;
  let totalPosted = 0;

  for (let i = 0; i < SYNC_SPECS.length; i++) {
    const { kind, spec } = SYNC_SPECS[i];
    const key = anchorKey(userId, spec.identifier);

    const opts: { anchor?: string; limit: number; since?: Date } = { limit: 0 };
    if (mode === 'recovery') {
      opts.since = since;
    } else {
      const stored = await anchors.get(key);
      if (stored) opts.anchor = stored;
    }

    let queried: { samples: unknown[]; newAnchor: string };
    try {
      queried = await port.query(spec.identifier, opts);
    } catch (error) {
      const outcome: MetricOutcome = {
        identifier: spec.identifier,
        metric: spec.metric,
        samples: 0,
        observations: 0,
        posted: 0,
        ok: false,
        error: describeError(error),
      };
      metrics.push(outcome);
      failed.push(spec.identifier);
      onProgress?.({ ...outcome, index: i + 1, total: SYNC_SPECS.length });
      continue;
    }

    const rawSamples = queried.samples;
    totalSamples += rawSamples.length;
    const observations = rawSamples.map((raw) => toObservation(kind, spec, raw));
    // foldDay's output is passed through untouched below: a field it left
    // out for a day never gets reintroduced, not even as a zero.
    const days = Object.values(foldDay(rawSamples.map((raw) => toFoldable(kind, spec, raw)))) as DailyRow[];

    const batches = chunk(observations, BATCH_SIZE);
    let posted = 0;
    let ok = true;
    let error: string | undefined;

    for (let b = 0; b < batches.length; b++) {
      const isLastBatch = b === batches.length - 1;
      try {
        await port.post({ observations: batches[b], days: isLastBatch ? days : [] });
        posted += batches[b].length;
      } catch (e) {
        ok = false;
        error = describeError(e);
        break;
      }
    }

    if (ok) {
      await anchors.set(key, queried.newAnchor);
    } else {
      failed.push(spec.identifier);
    }

    totalPosted += posted;
    const outcome: MetricOutcome = {
      identifier: spec.identifier,
      metric: spec.metric,
      samples: rawSamples.length,
      observations: observations.length,
      posted,
      ok,
      error,
    };
    metrics.push(outcome);
    onProgress?.({ ...outcome, index: i + 1, total: SYNC_SPECS.length });
  }

  return { observations: totalPosted, samples: totalSamples, metrics, failed };
}
