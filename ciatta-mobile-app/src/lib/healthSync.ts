// The sync loop that carries what Apple Health reports into observations
// and daily rows, then posts them to the ingest-health edge function.
//
// Pure and platform free: no HealthKit call, no React Native import, no
// network call lives here. `SyncPort` is the seam a device layer (see
// healthKit.ts) implements for real, and a test implements with a fake, so
// this file's behaviour is provable without a phone.
import { addDays, isoDay, startOfDay } from '../data/cycleLog';
import type { DailyRow, DayNumbers, MetricSpec, SleepSpec, WorkoutSpec } from './healthMetrics';
import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';
import type { CategorySample, FoldableSample, NewObservation, QuantitySample, WorkoutSample } from './healthSamples';
import { foldDay, NIGHT_TURNS_AT_HOUR, sampleToObservation } from './healthSamples';

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
  post(batch: { observations: NewObservation[]; days: PostedDay[] }): Promise<void>;
};

// A day as it is posted. A field left out is left as it is in her record;
// a field sent as null is cleared there. Only clearedNight below ever sends
// one.
export type PostedDay = Omit<DailyRow, keyof DayNumbers> & { [K in keyof DayNumbers]?: DayNumbers[K] | null };

// A port that sends only while the account it was made for is still the
// one signed in. A read takes a while, and the post goes out under
// whoever's session is current at that moment: if she signs out and
// someone else signs in on the same phone while one is under way, what is
// left of her read must not land in their record. Each post asks who is
// signed in first, and refuses when it is not her. A refused post is a
// failed one, so the anchor does not move and nothing is marked as done.
export function portFor(userId: string, port: SyncPort, signedIn: () => Promise<string | null>): SyncPort {
  return {
    query: (identifier, opts) => port.query(identifier, opts),
    async post(batch) {
      if ((await signedIn()) !== userId) throw new Error('The account changed while reading');
      await port.post(batch);
    },
  };
}

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

// recovery reads the last 90 days, refresh the last 7; both read whole days
// and write a row for each. incremental reads only what is new since the
// stored anchor, which is right for observations and wrong for a day's
// row: a sum over the new samples alone would replace the day's total. It
// is kept for the observations it can carry and is not what the app runs.
export type SyncMode = 'recovery' | 'refresh' | 'incremental';

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
// How far back the refresh on opening the app reaches. A week covers a
// phone left in a drawer over a holiday, and a watch that hands over its
// nights days late.
export const REFRESH_WINDOW_DAYS = 7;

// The whole days a windowed pass covers, ending today. The read starts the
// evening before the first of them, at the hour a night's day turns over,
// so the night she woke from on that first day is read whole. What the
// read picks up from before the first day is part of a day, and a part of
// a day is never written as the day.
export function syncWindow(days: number, now: Date): { since: Date; firstDay: string; lastDay: string; days: string[] } {
  const first = addDays(startOfDay(now), -(days - 1));
  const since = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 1, NIGHT_TURNS_AT_HOUR);
  return { since, firstDay: isoDay(first), lastDay: isoDay(now), days: Array.from({ length: days }, (_, i) => isoDay(addDays(first, i))) };
}

// A day her record is told holds no night. Every field a night writes is
// cleared together, so nothing of an earlier reading of that night is left
// standing beside the absence of the rest.
function clearedNight(day: string): PostedDay {
  return { day, sleep_hours: null, time_in_bed: null, stage_awake: null, stage_rem: null, stage_light: null, stage_deep: null };
}

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
    // The moment the pass runs at. Only a test passes it.
    now?: Date;
  },
): Promise<SyncResult> {
  const { port, anchors, onProgress, mode } = deps;
  const window =
    mode === 'incremental'
      ? null
      : syncWindow(mode === 'recovery' ? RECOVERY_WINDOW_DAYS : REFRESH_WINDOW_DAYS, deps.now ?? new Date());

  const metrics: MetricOutcome[] = [];
  const failed: string[] = [];
  let totalSamples = 0;
  let totalPosted = 0;

  for (let i = 0; i < SYNC_SPECS.length; i++) {
    const { kind, spec } = SYNC_SPECS[i];
    const key = anchorKey(userId, spec.identifier);
    const index = i + 1;
    const total = SYNC_SPECS.length;

    // A storage failure (reading or writing an anchor) gets exactly the
    // same treatment as a failed post: this metric is marked failed and
    // recorded, and the loop moves on. Letting either throw out of this
    // function would abort the whole run, silently skipping every metric
    // later in SYNC_SPECS than the one that hit the failure, with no trace
    // of that in the result the caller gets back.
    const recordFailure = (
      error: unknown,
      counts: { samples?: number; observations?: number; posted?: number } = {},
    ) => {
      const outcome: MetricOutcome = {
        identifier: spec.identifier,
        metric: spec.metric,
        samples: counts.samples ?? 0,
        observations: counts.observations ?? 0,
        posted: counts.posted ?? 0,
        ok: false,
        error: describeError(error),
      };
      metrics.push(outcome);
      failed.push(spec.identifier);
      totalSamples += outcome.samples;
      totalPosted += outcome.posted;
      onProgress?.({ ...outcome, index, total });
    };

    const opts: { anchor?: string; limit: number; since?: Date } = { limit: 0 };
    if (window) {
      opts.since = window.since;
    } else {
      let stored: string | null;
      try {
        stored = await anchors.get(key);
      } catch (error) {
        recordFailure(error);
        continue;
      }
      if (stored) opts.anchor = stored;
    }

    let queried: { samples: unknown[]; newAnchor: string };
    try {
      queried = await port.query(spec.identifier, opts);
    } catch (error) {
      recordFailure(error);
      continue;
    }

    const rawSamples = queried.samples;
    const observations = rawSamples.map((raw) => toObservation(kind, spec, raw));
    // foldDay's output is passed through untouched below: a field it left
    // out for a day never gets reintroduced, not even as a zero.
    const folded = Object.values(foldDay(rawSamples.map((raw) => toFoldable(kind, spec, raw)))) as DailyRow[];
    // Whole days only. What was read from before the first day is part of
    // a day, and an evening's sleep belongs to a night that has not ended:
    // it is written tomorrow, when the read holds the whole of it.
    const days: PostedDay[] = window ? folded.filter((row) => row.day >= window.firstDay && row.day <= window.lastDay) : folded;
    // Sleep was read, so Apple Health is answering, and a day in the
    // window it holds no night for has none. Her record is told so: a night
    // an earlier build split at midnight left its first hour on the day
    // before, and nothing else would ever take it away. A read that came
    // back with no sleep at all clears nothing, because access taken away
    // looks exactly like that, and what she already gave stays hers.
    if (window && kind === 'sleep' && rawSamples.length > 0) {
      const held = new Set(days.map((row) => row.day));
      for (const day of window.days) if (!held.has(day)) days.push(clearedNight(day));
    }

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
      try {
        await anchors.set(key, queried.newAnchor);
      } catch (e) {
        // What already posted stays posted (dedupe keys make a retry
        // harmless); the anchor must not appear to have advanced, and the
        // run must not abort here either.
        ok = false;
        error = describeError(e);
      }
    }

    if (!ok) failed.push(spec.identifier);

    totalSamples += rawSamples.length;
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
    onProgress?.({ ...outcome, index, total });
  }

  return { observations: totalPosted, samples: totalSamples, metrics, failed };
}
