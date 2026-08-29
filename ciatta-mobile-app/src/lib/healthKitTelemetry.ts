export type HealthKitSyncTrigger = 'manual' | 'background' | 'catch-up';

export type HealthKitTelemetryStageName =
  | 'background_event'
  | 'samples_fetched'
  | 'database_write'
  | 'intelligence_processing'
  | 'completion';

export type HealthKitSyncTelemetry = {
  trigger: HealthKitSyncTrigger;
  stages: HealthKitTelemetryStageName[];
  backgroundEventMs: number;
  healthKitQueryMs: number;
  samplesFetched: number;
  samplesDeleted: number;
  typesQueried: number;
  typesWithNewSamples: number;
  normalizationMs: number;
  databaseWriteMs: number;
  intelligenceProcessingMs: number;
  totalMs: number;
  incremental: boolean;
};

export function emptyHealthKitTelemetry(
  trigger: HealthKitSyncTrigger = 'manual'
): HealthKitSyncTelemetry {
  return {
    trigger,
    stages: [],
    backgroundEventMs: 0,
    healthKitQueryMs: 0,
    samplesFetched: 0,
    samplesDeleted: 0,
    typesQueried: 0,
    typesWithNewSamples: 0,
    normalizationMs: 0,
    databaseWriteMs: 0,
    intelligenceProcessingMs: 0,
    totalMs: 0,
    incremental: false,
  };
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

export function markHealthKitStage(
  telemetry: HealthKitSyncTelemetry,
  stage: HealthKitTelemetryStageName
): void {
  telemetry.stages.push(stage);
  console.log('[healthkit] stage', stage, {
    trigger: telemetry.trigger,
    samplesFetched: telemetry.samplesFetched,
    samplesDeleted: telemetry.samplesDeleted,
    typesQueried: telemetry.typesQueried,
  });
}

export function logHealthKitTelemetry(telemetry: HealthKitSyncTelemetry): void {
  console.log('[healthkit] telemetry', telemetry);
}
