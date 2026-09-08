import { Platform } from 'react-native';
import {
  isHealthDataAvailableAsync,
  requestAuthorization,
  queryQuantitySamplesWithAnchor,
  queryCategorySamplesWithAnchor,
  enableBackgroundDelivery,
  subscribeToChanges,
  getRequestStatusForAuthorization,
  CategoryValueSleepAnalysis,
  CategoryValueMenstrualFlow,
} from '@kingstinct/react-native-healthkit';
import { deleteAppleHealthObservationByHkUuid, insertObservationIfNew, type NewObservation } from './observations';
import { sampleDurationMinutes, sampleIso } from './healthKitDates';
import { buildMenstrualObservation, buildSleepSegmentObservation } from './healthKitNormalize';
import { asyncAnchorStore } from './healthKitAnchorStorage';
import { hasAnyAnchor, type HealthKitSyncReason } from './healthKitAnchors';
import { HK_LOG, runHealthKitSync, type HealthKitSyncTotals, type SyncTypeDeps } from './healthKitSyncEngine';
import { MANUAL_SYNC_BUDGET_MS, createAbortSignal } from './healthKitTimeout';
import { healthSyncUiKind, type HealthSyncUiKind } from './healthKitUi';

const CYCLE_HISTORY_DAYS = 365;

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMenstrualFlow',
] as const;

const OBSERVATION_TYPES = [
  'steps',
  'heart_rate',
  'resting_heart_rate',
  'hrv',
  'sleep_segment',
  'menstrual_flow',
] as const;

export async function isHealthKitAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export interface HealthKitConnectResult {
  granted: boolean;
  observationsSynced: number;
  reason?: 'unavailable' | 'permission-denied';
  uiKind?: HealthSyncUiKind;
  timedOut?: boolean;
  elapsedMs?: number;
}

function logDetail(error: unknown): unknown {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    return { message: e.message, code: e.code, details: e.details, hint: e.hint };
  }
  return String(error);
}

function sampleUuid(sample: { uuid?: string }): string | undefined {
  return typeof sample.uuid === 'string' ? sample.uuid : undefined;
}

function sleepStageLabel(value: CategoryValueSleepAnalysis): string {
  switch (value) {
    case CategoryValueSleepAnalysis.inBed:
      return 'in_bed';
    case CategoryValueSleepAnalysis.awake:
      return 'awake';
    case CategoryValueSleepAnalysis.asleepCore:
      return 'asleep_core';
    case CategoryValueSleepAnalysis.asleepDeep:
      return 'asleep_deep';
    case CategoryValueSleepAnalysis.asleepREM:
      return 'asleep_rem';
    default:
      return 'asleep';
  }
}

function menstrualFlowLabel(value: CategoryValueMenstrualFlow): string {
  switch (value) {
    case CategoryValueMenstrualFlow.light:
      return 'light';
    case CategoryValueMenstrualFlow.medium:
      return 'medium';
    case CategoryValueMenstrualFlow.heavy:
      return 'heavy';
    case CategoryValueMenstrualFlow.none:
      return 'none';
    default:
      return 'unspecified';
  }
}

function initialDateFilter(windowDays: number) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

function shouldAskForAuthorization(status: unknown): boolean {
  return status === 'shouldRequest' || status === 1;
}

async function requestReadAccessIfNeeded(reason: HealthKitSyncReason): Promise<boolean> {
  if (reason === 'background') return true;
  try {
    const status = await getRequestStatusForAuthorization({ toRead: [...READ_TYPES] });
    console.log(HK_LOG, 'HealthKit authorization request status', status);
    if (!shouldAskForAuthorization(status)) return true;
  } catch (e) {
    console.log(HK_LOG, 'HealthKit authorization request status unavailable', logDetail(e));
  }
  try {
    console.log(HK_LOG, 'HealthKit authorization request started', { types: READ_TYPES });
    const granted = await requestAuthorization({ toRead: READ_TYPES });
    console.log(HK_LOG, 'HealthKit authorization request completed', { granted });
    return granted;
  } catch (e) {
    console.error(HK_LOG, 'HealthKit authorization request completed', {
      granted: false,
      error: logDetail(e),
    });
    return false;
  }
}

async function enableDelivery(): Promise<void> {
  const hourly = new Set([
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  ]);
  for (const type of READ_TYPES) {
    try {
      await enableBackgroundDelivery(type, hourly.has(type) ? 2 : 1);
    } catch (e) {
      console.log(HK_LOG, 'background delivery enable failed', type, logDetail(e));
    }
  }
}

function quantityDeps(
  userId: string,
  observationType: string,
  hkType: (typeof READ_TYPES)[number],
  unit: string,
  windowDays: number,
  toObservation: (sample: {
    uuid?: string;
    quantity: number;
    startDate: Date | string;
    endDate: Date | string;
  }) => NewObservation
): SyncTypeDeps<{
  uuid?: string;
  quantity: number;
  startDate: Date | string;
  endDate: Date | string;
}> {
  return {
    type: observationType,
    query: async (anchor) => {
      const options: {
        limit: number;
        unit: string;
        anchor?: string;
        filter?: { date: { startDate: Date; endDate: Date } };
      } = { limit: 0, unit };
      if (anchor) options.anchor = anchor;
      else options.filter = { date: initialDateFilter(windowDays) };
      const page = await queryQuantitySamplesWithAnchor(hkType, options);
      return {
        samples: page.samples,
        deletedUuids: page.deletedSamples.map((d: { uuid: string }) => d.uuid),
        newAnchor: page.newAnchor,
      };
    },
    persist: (sample) => insertObservationIfNew(userId, toObservation(sample)),
    deleteByUuid: (uuid) => deleteAppleHealthObservationByHkUuid(userId, uuid),
  };
}

function categoryDeps(
  userId: string,
  observationType: string,
  hkType: (typeof READ_TYPES)[number],
  windowDays: number,
  toObservation: (sample: {
    uuid?: string;
    value: number;
    startDate: Date | string;
    endDate: Date | string;
    metadata?: unknown;
  }) => NewObservation
): SyncTypeDeps<{
  uuid?: string;
  value: number;
  startDate: Date | string;
  endDate: Date | string;
  metadata?: unknown;
}> {
  return {
    type: observationType,
    query: async (anchor) => {
      const options: {
        limit: number;
        anchor?: string;
        filter?: { date: { startDate: Date; endDate: Date } };
      } = { limit: 0 };
      if (anchor) options.anchor = anchor;
      else options.filter = { date: initialDateFilter(windowDays) };
      const page = await queryCategorySamplesWithAnchor(hkType, options);
      return {
        samples: page.samples,
        deletedUuids: page.deletedSamples.map((d: { uuid: string }) => d.uuid),
        newAnchor: page.newAnchor,
      };
    },
    persist: (sample) => insertObservationIfNew(userId, toObservation(sample)),
    deleteByUuid: (uuid) => deleteAppleHealthObservationByHkUuid(userId, uuid),
  };
}

function syncDeps(userId: string) {
  return [
    quantityDeps(userId, 'steps', 'HKQuantityTypeIdentifierStepCount', 'count', 30, (sample) => ({
      source: 'apple-health',
      type: 'steps',
      value: { count: sample.quantity },
      unit: 'count',
      recordedAt: sampleIso(sample.endDate),
      context: { startTime: sampleIso(sample.startDate), hkUuid: sampleUuid(sample) },
    })),
    quantityDeps(
      userId,
      'heart_rate',
      'HKQuantityTypeIdentifierHeartRate',
      'count/min',
      30,
      (sample) => ({
        source: 'apple-health',
        type: 'heart_rate',
        value: { bpm: sample.quantity },
        unit: 'bpm',
        recordedAt: sampleIso(sample.endDate),
        context: { hkUuid: sampleUuid(sample) },
      })
    ),
    categoryDeps(
      userId,
      'sleep_segment',
      'HKCategoryTypeIdentifierSleepAnalysis',
      30,
      (sample) =>
        buildSleepSegmentObservation(
          sample.startDate,
          sample.endDate,
          sleepStageLabel(sample.value as CategoryValueSleepAnalysis),
          sampleDurationMinutes(sample.startDate, sample.endDate),
          sampleUuid(sample)
        )
    ),
    quantityDeps(
      userId,
      'resting_heart_rate',
      'HKQuantityTypeIdentifierRestingHeartRate',
      'count/min',
      CYCLE_HISTORY_DAYS,
      (sample) => ({
        source: 'apple-health',
        type: 'resting_heart_rate',
        value: { bpm: sample.quantity },
        unit: 'bpm',
        recordedAt: sampleIso(sample.endDate),
        context: { hkUuid: sampleUuid(sample) },
      })
    ),
    categoryDeps(
      userId,
      'menstrual_flow',
      'HKCategoryTypeIdentifierMenstrualFlow',
      CYCLE_HISTORY_DAYS,
      (sample) =>
        buildMenstrualObservation(
          sample.startDate,
          menstrualFlowLabel(sample.value as CategoryValueMenstrualFlow),
          sample.metadata,
          sampleUuid(sample)
        )
    ),
    quantityDeps(
      userId,
      'hrv',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'ms',
      CYCLE_HISTORY_DAYS,
      (sample) => ({
        source: 'apple-health',
        type: 'hrv',
        value: { ms: sample.quantity },
        unit: 'ms',
        recordedAt: sampleIso(sample.endDate),
        context: { metric: 'sdnn', hkUuid: sampleUuid(sample) },
      })
    ),
  ];
}

let syncInFlight = false;
const observerSubs: { remove: () => void }[] = [];
let observerUserId: string | null = null;
let observerTimer: ReturnType<typeof setTimeout> | null = null;

export async function connectHealthKit(
  userId: string,
  opts?: { reason?: HealthKitSyncReason }
): Promise<HealthKitConnectResult> {
  const available = await isHealthKitAvailable();
  if (!available) {
    console.log(HK_LOG, 'sync completed', { reason: 'unavailable' });
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }

  const hadAnchors = await hasAnyAnchor(asyncAnchorStore, userId, [...OBSERVATION_TYPES]);
  const reason: HealthKitSyncReason =
    opts?.reason ?? (hadAnchors ? 'manual' : 'initial');

  const allowed = await requestReadAccessIfNeeded(reason);
  if (!allowed) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  await enableDelivery();

  const signal = createAbortSignal();
  const startedAt = Date.now();
  const budgetMs = reason === 'manual' || reason === 'initial' ? MANUAL_SYNC_BUDGET_MS : 15_000;
  const timeout = setTimeout(() => {
    signal.aborted = true;
  }, budgetMs);

  if (syncInFlight && reason === 'background') {
    console.log(HK_LOG, 'sync completed', { reason: 'background', skipped: 'in flight' });
    return { granted: true, observationsSynced: 0, uiKind: 'complete', elapsedMs: 0 };
  }

  syncInFlight = true;
  let totals: HealthKitSyncTotals;
  try {
    totals = await runHealthKitSync({
      userId,
      reason,
      store: asyncAnchorStore,
      types: syncDeps(userId),
      signal,
      startedAt,
      budgetMs,
    });
  } finally {
    clearTimeout(timeout);
    syncInFlight = false;
  }

  const uiKind = healthSyncUiKind(totals);
  return {
    granted: true,
    observationsSynced: totals.created,
    uiKind,
    timedOut: totals.timedOut,
    elapsedMs: totals.elapsedMs,
  };
}

export async function requestHealthKitPermission(): Promise<HealthKitConnectResult> {
  const available = await isHealthKitAvailable();
  if (!available) {
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }
  const allowed = await requestReadAccessIfNeeded('initial');
  if (!allowed) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }
  return { granted: true, observationsSynced: 0 };
}

export function stopHealthKitObservers(): void {
  if (observerTimer) {
    clearTimeout(observerTimer);
    observerTimer = null;
  }
  while (observerSubs.length > 0) {
    observerSubs.pop()?.remove();
  }
  observerUserId = null;
}

export function startHealthKitObservers(userId: string): void {
  if (Platform.OS !== 'ios') return;
  if (observerUserId === userId && observerSubs.length > 0) return;
  stopHealthKitObservers();
  observerUserId = userId;
  for (const type of READ_TYPES) {
    try {
      const sub = subscribeToChanges(type, () => {
        if (observerTimer) clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
          void connectHealthKit(userId, { reason: 'background' });
        }, 1500);
      }) as { remove?: () => void } | (() => void);
      observerSubs.push({
        remove: () => {
          if (typeof sub === 'function') sub();
          else sub.remove?.();
        },
      });
    } catch (e) {
      console.log(HK_LOG, 'observer subscribe failed', type, logDetail(e));
    }
  }
}

/** Kept for callers that still import a named ingest function. */
export async function syncHealthKitData(userId: string): Promise<number> {
  const result = await connectHealthKit(userId, { reason: 'manual' });
  return result.observationsSynced;
}
