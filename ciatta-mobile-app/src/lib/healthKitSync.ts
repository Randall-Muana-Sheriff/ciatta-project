import type { CategorySpec, QuantitySpec } from './healthKitMap';
import {
  QUERY_CONCURRENCY,
  categoryToObservation,
  quantityToObservation,
  workoutToObservation,
  type CategorySampleLike,
  type HealthKitNewObservation,
  type QuantitySampleLike,
  type WorkoutSampleLike,
} from './healthKitObservations';
import {
  elapsedMs,
  emptyHealthKitTelemetry,
  logHealthKitTelemetry,
  markHealthKitStage,
  type HealthKitSyncTelemetry,
  type HealthKitSyncTrigger,
} from './healthKitTelemetry';

export { chunk, WRITE_BATCH_SIZE, QUERY_CONCURRENCY } from './healthKitObservations';
export { emptyHealthKitTelemetry } from './healthKitTelemetry';
export type { HealthKitSyncTelemetry, HealthKitSyncTrigger };

const SYNC_WINDOW_HOURS = 24 * 30;
const CYCLE_HISTORY_DAYS = 365;
const WORKOUT_IDENTIFIER = 'HKWorkoutTypeIdentifier';

export type HealthKitSyncMode = 'recovery' | 'incremental';

export type HealthKitAnchorStore = {
  get: (identifier: string) => Promise<string | null>;
  set: (identifier: string, anchor: string) => Promise<void>;
};

export type AnchoredQueryOptions = {
  anchor?: string;
  filter?: { date?: { startDate: Date; endDate: Date } };
  limit: number;
  unit?: string;
};

export type HealthKitSyncPort = {
  quantitySpecs: readonly QuantitySpec[];
  categorySpecs: readonly CategorySpec[];
  queryQuantity: (
    identifier: string,
    opts: AnchoredQueryOptions
  ) => Promise<{
    samples: readonly QuantitySampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  queryCategory: (
    identifier: string,
    opts: AnchoredQueryOptions
  ) => Promise<{
    samples: readonly CategorySampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  queryWorkouts: (opts: AnchoredQueryOptions) => Promise<{
    workouts: readonly WorkoutSampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  }>;
  write: (rows: HealthKitNewObservation[]) => Promise<void>;
  enqueueIntelligence?: () => Promise<void>;
};

export type HealthKitSyncProgress = {
  phase: 'query' | 'normalize' | 'write';
  samplesFetched: number;
  samplesWritten: number;
  typesDone: number;
  typesTotal: number;
};

export type HealthKitSyncResult = {
  observationsSynced: number;
  telemetry: HealthKitSyncTelemetry;
};

function dateFilterFor(window: 'recent' | 'cycle', endDate: Date) {
  const startDate =
    window === 'cycle'
      ? new Date(endDate.getTime() - CYCLE_HISTORY_DAYS * 24 * 60 * 60 * 1000)
      : new Date(endDate.getTime() - SYNC_WINDOW_HOURS * 60 * 60 * 1000);
  return { date: { startDate, endDate } };
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => worker())
  );
  return out;
}

function selectedByIdentifier<T extends { identifier: string }>(
  items: readonly T[],
  identifiers: readonly string[] | undefined
): readonly T[] {
  if (!identifiers || identifiers.length === 0) return items;
  const allow = new Set(identifiers);
  return items.filter((item) => allow.has(item.identifier));
}

export async function runHealthKitSync(
  _userId: string,
  deps: {
    port: HealthKitSyncPort;
    anchors: HealthKitAnchorStore;
    queryConcurrency?: number;
    onProgress?: (progress: HealthKitSyncProgress) => void;
    mode?: HealthKitSyncMode;
    trigger?: HealthKitSyncTrigger;
    identifiers?: readonly string[];
    backgroundEventAt?: number;
  }
): Promise<HealthKitSyncResult> {
  const started = Date.now();
  const mode: HealthKitSyncMode = deps.mode ?? 'recovery';
  const trigger: HealthKitSyncTrigger = deps.trigger ?? 'manual';
  const telemetry = emptyHealthKitTelemetry(trigger);
  if (trigger === 'background') {
    telemetry.backgroundEventMs = elapsedMs(deps.backgroundEventAt ?? started);
    markHealthKitStage(telemetry, 'background_event');
  }
  const { port, anchors } = deps;
  const concurrency = deps.queryConcurrency ?? QUERY_CONCURRENCY;
  const quantitySpecs = selectedByIdentifier(port.quantitySpecs, deps.identifiers);
  const categorySpecs = selectedByIdentifier(port.categorySpecs, deps.identifiers);
  const includeWorkouts =
    !deps.identifiers ||
    deps.identifiers.length === 0 ||
    deps.identifiers.includes(WORKOUT_IDENTIFIER);
  const typesTotal = quantitySpecs.length + categorySpecs.length + (includeWorkouts ? 1 : 0);
  const endDate = new Date();
  const pendingAnchors: { identifier: string; anchor: string }[] = [];
  const observations: HealthKitNewObservation[] = [];
  let typesDone = 0;
  let typesWithNewSamples = 0;
  let samplesDeleted = 0;
  const usedStoredAnchor: boolean[] = [];

  const report = (phase: HealthKitSyncProgress['phase'], samplesWritten = 0) => {
    deps.onProgress?.({
      phase,
      samplesFetched: telemetry.samplesFetched,
      samplesWritten,
      typesDone,
      typesTotal,
    });
  };

  const queryStarted = Date.now();

  const quantityResults = await mapPool(quantitySpecs, concurrency, async (spec) => {
    const stored = await anchors.get(spec.identifier);
    if (mode === 'incremental' && !stored) {
      return { spec, result: null, ok: false as const, skipped: true as const };
    }
    usedStoredAnchor.push(Boolean(stored));
    const opts: AnchoredQueryOptions = {
      limit: 0,
      unit: spec.unit,
      ...(stored
        ? { anchor: stored }
        : { filter: dateFilterFor(spec.window, endDate) }),
    };
    try {
      const result = await port.queryQuantity(spec.identifier, opts);
      return { spec, result, ok: true as const, skipped: false as const };
    } catch (e) {
      console.log('[healthkit] query failed', spec.type, e instanceof Error ? e.message : e);
      return { spec, result: null, ok: false as const, skipped: false as const };
    }
  });

  const categoryResults = await mapPool(categorySpecs, concurrency, async (spec) => {
    const stored = await anchors.get(spec.identifier);
    if (mode === 'incremental' && !stored) {
      return { spec, result: null, ok: false as const, skipped: true as const };
    }
    usedStoredAnchor.push(Boolean(stored));
    const opts: AnchoredQueryOptions = {
      limit: 0,
      ...(stored
        ? { anchor: stored }
        : { filter: dateFilterFor(spec.window, endDate) }),
    };
    try {
      const result = await port.queryCategory(spec.identifier, opts);
      return { spec, result, ok: true as const, skipped: false as const };
    } catch (e) {
      console.log('[healthkit] query failed', spec.type, e instanceof Error ? e.message : e);
      return { spec, result: null, ok: false as const, skipped: false as const };
    }
  });

  const workoutStored = includeWorkouts ? await anchors.get(WORKOUT_IDENTIFIER) : null;
  let workoutResult: {
    workouts: readonly WorkoutSampleLike[];
    deletedSamples: readonly unknown[];
    newAnchor: string;
  } | null = null;
  let workoutSkipped = !includeWorkouts;
  if (includeWorkouts && mode === 'incremental' && !workoutStored) {
    workoutSkipped = true;
  } else if (includeWorkouts) {
    usedStoredAnchor.push(Boolean(workoutStored));
    try {
      workoutResult = await port.queryWorkouts({
        limit: 0,
        ...(workoutStored
          ? { anchor: workoutStored }
          : { filter: dateFilterFor('recent', endDate) }),
      });
    } catch (e) {
      console.log('[healthkit] query failed', 'workout', e instanceof Error ? e.message : e);
    }
  }

  telemetry.healthKitQueryMs = elapsedMs(queryStarted);
  telemetry.typesQueried =
    quantityResults.filter((row) => !row.skipped).length +
    categoryResults.filter((row) => !row.skipped).length +
    (workoutSkipped ? 0 : 1);
  telemetry.incremental =
    mode === 'incremental' || (usedStoredAnchor.length > 0 && usedStoredAnchor.every(Boolean));

  const normalizeStarted = Date.now();
  for (const row of quantityResults) {
    typesDone += 1;
    if (row.skipped || !row.ok || !row.result) {
      report('query');
      continue;
    }
    telemetry.samplesFetched += row.result.samples.length;
    samplesDeleted += row.result.deletedSamples.length;
    if (row.result.samples.length > 0) typesWithNewSamples += 1;
    for (const sample of row.result.samples) {
      observations.push(quantityToObservation(row.spec, sample));
    }
    pendingAnchors.push({ identifier: row.spec.identifier, anchor: row.result.newAnchor });
    report('query');
  }
  for (const row of categoryResults) {
    typesDone += 1;
    if (row.skipped || !row.ok || !row.result) {
      report('query');
      continue;
    }
    telemetry.samplesFetched += row.result.samples.length;
    samplesDeleted += row.result.deletedSamples.length;
    if (row.result.samples.length > 0) typesWithNewSamples += 1;
    for (const sample of row.result.samples) {
      observations.push(categoryToObservation(row.spec, sample));
    }
    pendingAnchors.push({ identifier: row.spec.identifier, anchor: row.result.newAnchor });
    report('query');
  }
  if (includeWorkouts) typesDone += 1;
  if (workoutResult) {
    telemetry.samplesFetched += workoutResult.workouts.length;
    samplesDeleted += workoutResult.deletedSamples.length;
    if (workoutResult.workouts.length > 0) typesWithNewSamples += 1;
    for (const workout of workoutResult.workouts) {
      observations.push(workoutToObservation(workout));
    }
    pendingAnchors.push({ identifier: WORKOUT_IDENTIFIER, anchor: workoutResult.newAnchor });
  }
  report('normalize');
  telemetry.normalizationMs = elapsedMs(normalizeStarted);
  telemetry.samplesDeleted = samplesDeleted;
  telemetry.typesWithNewSamples = typesWithNewSamples;
  markHealthKitStage(telemetry, 'samples_fetched');

  const writeStarted = Date.now();
  report('write', 0);
  if (observations.length > 0) {
    await port.write(observations);
  }
  telemetry.databaseWriteMs = elapsedMs(writeStarted);
  markHealthKitStage(telemetry, 'database_write');

  const intelligenceStarted = Date.now();
  if (observations.length > 0 && port.enqueueIntelligence) {
    await port.enqueueIntelligence();
  }
  telemetry.intelligenceProcessingMs = elapsedMs(intelligenceStarted);
  markHealthKitStage(telemetry, 'intelligence_processing');

  for (const pending of pendingAnchors) {
    await anchors.set(pending.identifier, pending.anchor);
  }

  telemetry.totalMs = elapsedMs(started);
  markHealthKitStage(telemetry, 'completion');
  logHealthKitTelemetry(telemetry);

  return {
    observationsSynced: observations.length,
    telemetry,
  };
}
