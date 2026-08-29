import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isHealthDataAvailableAsync,
  requestAuthorization,
  queryQuantitySamplesWithAnchor,
  queryCategorySamplesWithAnchor,
  queryWorkoutSamplesWithAnchor,
  WorkoutTypeIdentifier,
  areObjectTypesAvailableAsync,
  enableBackgroundDelivery,
  configureBackgroundTypes,
  subscribeToChanges,
  UpdateFrequency,
} from '@kingstinct/react-native-healthkit';
import type {
  CategoryTypeIdentifier,
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
  SampleTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { insertObservations } from './observations';
import { CATEGORY_SPECS, QUANTITY_SPECS } from './healthKitMap';
import { createBackgroundDeliveryQueue } from './healthKitBackground';
import {
  runHealthKitSync,
  type HealthKitAnchorStore,
  type HealthKitSyncMode,
  type HealthKitSyncProgress,
} from './healthKitSync';
import type { HealthKitSyncTrigger } from './healthKitTelemetry';
import { QUERY_CONCURRENCY } from './healthKitObservations';

export const HEALTHKIT_READ_TYPES: ObjectTypeIdentifier[] = [
  ...QUANTITY_SPECS.map((spec) => spec.identifier as QuantityTypeIdentifier),
  ...CATEGORY_SPECS.map((spec) => spec.identifier as CategoryTypeIdentifier),
  WorkoutTypeIdentifier,
];

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
  telemetry?: import('./healthKitTelemetry').HealthKitSyncTelemetry;
  reason?: 'unavailable' | 'permission-denied';
}

async function readableHealthKitTypes(): Promise<ObjectTypeIdentifier[]> {
  try {
    const available = await areObjectTypesAvailableAsync([...HEALTHKIT_READ_TYPES]);
    const readable = HEALTHKIT_READ_TYPES.filter((type) => available[type]);
    return readable.length > 0 ? readable : [...HEALTHKIT_READ_TYPES];
  } catch {
    return [...HEALTHKIT_READ_TYPES];
  }
}

async function requestHealthKitRead(): Promise<HealthKitConnectResult> {
  const available = await isHealthKitAvailable();
  if (!available) {
    return { granted: false, observationsSynced: 0, reason: 'unavailable' };
  }

  let granted: boolean;
  try {
    granted = await requestAuthorization({ toRead: await readableHealthKitTypes() });
  } catch {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  if (!granted) {
    return { granted: false, observationsSynced: 0, reason: 'permission-denied' };
  }

  return { granted: true, observationsSynced: 0 };
}

export async function connectHealthKit(
  userId: string,
  onProgress?: (progress: HealthKitSyncProgress) => void
): Promise<HealthKitConnectResult> {
  const permission = await requestHealthKitRead();
  if (!permission.granted) {
    console.log('[healthkit] not granted', permission.reason);
    return permission;
  }
  await startHealthKitBackgroundDelivery(userId);
  const result = await syncHealthKitData(userId, onProgress, {
    mode: 'recovery',
    trigger: 'manual',
  });
  console.log('[healthkit] sync complete', {
    observationsSynced: result.observationsSynced,
    telemetry: result.telemetry,
  });
  return { granted: true, ...result };
}

export async function requestHealthKitPermission(): Promise<HealthKitConnectResult> {
  return requestHealthKitRead();
}

function anchorsForUser(userId: string): HealthKitAnchorStore {
  const key = (identifier: string) => `hk-query-anchor:${userId}:${identifier}`;
  return {
    async get(identifier) {
      try {
        return await AsyncStorage.getItem(key(identifier));
      } catch {
        return null;
      }
    },
    async set(identifier, anchor) {
      await AsyncStorage.setItem(key(identifier), anchor);
    },
  };
}

let syncChain: Promise<unknown> = Promise.resolve();

function withHealthKitSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn);
  syncChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function syncHealthKitData(
  userId: string,
  onProgress?: (progress: HealthKitSyncProgress) => void,
  options?: {
    mode?: HealthKitSyncMode;
    trigger?: HealthKitSyncTrigger;
    identifiers?: readonly string[];
    backgroundEventAt?: number;
  }
) {
  return withHealthKitSyncLock(() =>
    runHealthKitSync(userId, {
      anchors: anchorsForUser(userId),
      queryConcurrency: QUERY_CONCURRENCY,
      onProgress,
      mode: options?.mode ?? 'recovery',
      trigger: options?.trigger ?? 'manual',
      identifiers: options?.identifiers,
      backgroundEventAt: options?.backgroundEventAt,
      port: {
        quantitySpecs: QUANTITY_SPECS,
        categorySpecs: CATEGORY_SPECS,
        queryQuantity: async (identifier, opts) => {
          const result = await queryQuantitySamplesWithAnchor(
            identifier as QuantityTypeIdentifier,
            {
              limit: opts.limit,
              unit: opts.unit,
              ...(opts.anchor ? { anchor: opts.anchor } : {}),
              ...(opts.filter ? { filter: opts.filter } : {}),
            }
          );
          return {
            samples: result.samples as never,
            deletedSamples: result.deletedSamples,
            newAnchor: result.newAnchor,
          };
        },
        queryCategory: async (identifier, opts) => {
          const result = await queryCategorySamplesWithAnchor(
            identifier as CategoryTypeIdentifier,
            {
              limit: opts.limit,
              ...(opts.anchor ? { anchor: opts.anchor } : {}),
              ...(opts.filter ? { filter: opts.filter } : {}),
            }
          );
          return {
            samples: result.samples as never,
            deletedSamples: result.deletedSamples,
            newAnchor: result.newAnchor,
          };
        },
        queryWorkouts: async (opts) => {
          const result = await queryWorkoutSamplesWithAnchor({
            limit: opts.limit,
            ...(opts.anchor ? { anchor: opts.anchor } : {}),
            ...(opts.filter ? { filter: opts.filter } : {}),
          });
          return {
            workouts: result.workouts as never,
            deletedSamples: result.deletedSamples,
            newAnchor: result.newAnchor,
          };
        },
        write: (rows) => insertObservations(userId, rows),
        enqueueIntelligence: async () => {
          console.log('[healthkit] intelligence enqueued');
        },
      },
    })
  );
}

export async function catchUpHealthKitSync(userId: string) {
  return syncHealthKitData(userId, undefined, {
    mode: 'incremental',
    trigger: 'catch-up',
  });
}

let backgroundUserId: string | null = null;
let backgroundStarted = false;
const observerSubscriptions: Array<{ remove: () => void }> = [];
const backgroundEventsAt = new Map<string, number>();
const backgroundQueue = createBackgroundDeliveryQueue({
  debounceMs: 750,
  sync: async (identifiers) => {
    const userId = backgroundUserId;
    if (!userId) return;
    const eventAt = Math.min(
      ...identifiers.map((id) => backgroundEventsAt.get(id) ?? Date.now())
    );
    for (const id of identifiers) backgroundEventsAt.delete(id);
    console.log('[healthkit] stage background_event', { identifiers });
    await syncHealthKitData(userId, undefined, {
      mode: 'incremental',
      trigger: 'background',
      identifiers,
      backgroundEventAt: eventAt,
    });
  },
});

export async function startHealthKitBackgroundDelivery(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  backgroundUserId = userId;
  if (backgroundStarted) return;
  if (!(await isHealthKitAvailable())) return;

  backgroundStarted = true;
  const types = [...HEALTHKIT_READ_TYPES];

  try {
    await configureBackgroundTypes(types, UpdateFrequency.immediate);
  } catch (e) {
    console.log(
      '[healthkit] configureBackgroundTypes failed',
      e instanceof Error ? e.message : e
    );
  }

  for (const type of types) {
    try {
      await enableBackgroundDelivery(type, UpdateFrequency.immediate);
    } catch (e) {
      console.log(
        '[healthkit] enableBackgroundDelivery failed',
        type,
        e instanceof Error ? e.message : e
      );
    }
  }

  for (const type of types) {
    try {
      const sub = subscribeToChanges(type as SampleTypeIdentifier, ({ typeIdentifier, errorMessage }) => {
        if (errorMessage) {
          console.log('[healthkit] observer error', typeIdentifier, errorMessage);
          return;
        }
        if (!backgroundEventsAt.has(typeIdentifier)) {
          backgroundEventsAt.set(typeIdentifier, Date.now());
        }
        backgroundQueue.notify(typeIdentifier);
      });
      observerSubscriptions.push(sub);
    } catch (e) {
      console.log(
        '[healthkit] observer subscribe failed',
        type,
        e instanceof Error ? e.message : e
      );
    }
  }
}

export function stopHealthKitBackgroundDelivery(): void {
  backgroundUserId = null;
  backgroundStarted = false;
  backgroundEventsAt.clear();
  while (observerSubscriptions.length > 0) {
    observerSubscriptions.pop()?.remove();
  }
}
