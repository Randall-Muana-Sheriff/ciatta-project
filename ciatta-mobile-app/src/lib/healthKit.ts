// Reads Apple Health on the device and hands it to the sync loop in
// healthSync.ts through the SyncPort seam. Nothing here is unit tested and
// nothing here should need to be: every rule this file has to obey (fold
// only what was measured, advance an anchor only after its post succeeds,
// keep one account's anchors away from another's) lives in healthSync.ts
// and is proven there against a fake port. This file is only the adapter
// from real HealthKit shapes to the plain ones healthSamples.ts expects,
// plus the real network post.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  isHealthDataAvailableAsync,
  queryCategorySamplesWithAnchor,
  queryQuantitySamplesWithAnchor,
  queryWorkoutSamplesWithAnchor,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import type { CategoryTypeIdentifier, ObjectTypeIdentifier, QuantityTypeIdentifier } from '@kingstinct/react-native-healthkit';

import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';
import type { CategorySample, QuantitySample, WorkoutSample } from './healthSamples';
import type { AnchorStore, SyncPort } from './healthSync';
import { supabase } from './supabase';

const READ_TYPES: ObjectTypeIdentifier[] = [
  ...QUANTITY_SPECS.map((spec) => spec.identifier as QuantityTypeIdentifier),
  SLEEP_SPEC.identifier as CategoryTypeIdentifier,
  WorkoutTypeIdentifier,
];

export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export async function requestHealthPermission(): Promise<{ granted: boolean; reason?: string }> {
  if (!(await isHealthAvailable())) {
    return { granted: false, reason: 'Health data is not available on this device.' };
  }
  try {
    const granted = await requestAuthorization({ toRead: READ_TYPES });
    return granted ? { granted: true } : { granted: false, reason: 'Permission was not granted.' };
  } catch {
    return { granted: false, reason: 'Permission was not granted.' };
  }
}

// A HealthKit workout's activity type comes back as a number whose reverse
// mapping (WorkoutActivityType[37] === 'running') gives the lower camel
// name; healthMetrics.ts's labels key on Apple's own string identifier
// (HKWorkoutActivityTypeRunning), so this bridges the two. An activity type
// this build doesn't recognize falls back to Other rather than throwing.
function workoutActivityTypeIdentifier(activityType: number): string {
  const name = (WorkoutActivityType as unknown as Record<number, string>)[activityType];
  if (!name) return 'HKWorkoutActivityTypeOther';
  return `HKWorkoutActivityType${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

// HealthKit carries no per workout intensity of its own; healthMetrics.ts
// derives one from average heart rate over the workout, when there is one.
// Reading it is a second call per workout, so a workout that fails to
// answer it is treated the same as one that never had a heart rate sample:
// no intensity, not a guessed one.
async function averageHeartRateFor(workout: {
  getStatistic?: (identifier: string, unit?: string) => Promise<{ averageQuantity?: { quantity: number } } | undefined>;
}): Promise<number | null> {
  if (!workout.getStatistic) return null;
  try {
    const stats = await workout.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
    return stats?.averageQuantity?.quantity ?? null;
  } catch {
    return null;
  }
}

type QueryOpts = { anchor?: string; limit: number; since?: Date };

function dateFilter(opts: QueryOpts) {
  return opts.since ? { filter: { date: { startDate: opts.since, endDate: new Date() } } } : {};
}

async function queryQuantity(identifier: string, opts: QueryOpts): Promise<{ samples: unknown[]; newAnchor: string }> {
  const spec = QUANTITY_SPECS.find((s) => s.identifier === identifier);
  const result = await queryQuantitySamplesWithAnchor(identifier as QuantityTypeIdentifier, {
    limit: opts.limit,
    unit: spec?.unit,
    ...(opts.anchor ? { anchor: opts.anchor } : {}),
    ...dateFilter(opts),
  });
  const samples: QuantitySample[] = result.samples.map((sample) => ({
    uuid: sample.uuid,
    startDate: sample.startDate,
    endDate: sample.endDate,
    value: sample.quantity,
  }));
  return { samples, newAnchor: result.newAnchor };
}

async function querySleep(opts: QueryOpts): Promise<{ samples: unknown[]; newAnchor: string }> {
  const result = await queryCategorySamplesWithAnchor(SLEEP_SPEC.identifier as CategoryTypeIdentifier, {
    limit: opts.limit,
    ...(opts.anchor ? { anchor: opts.anchor } : {}),
    ...dateFilter(opts),
  });
  const samples: CategorySample[] = result.samples.map((sample) => ({
    uuid: sample.uuid,
    startDate: sample.startDate,
    endDate: sample.endDate,
    value: sample.value as number,
  }));
  return { samples, newAnchor: result.newAnchor };
}

async function queryWorkouts(opts: QueryOpts): Promise<{ samples: unknown[]; newAnchor: string }> {
  const result = await queryWorkoutSamplesWithAnchor({
    limit: opts.limit,
    ...(opts.anchor ? { anchor: opts.anchor } : {}),
    ...dateFilter(opts),
  });
  const samples: WorkoutSample[] = await Promise.all(
    result.workouts.map(async (workout) => ({
      uuid: workout.uuid,
      startDate: workout.startDate,
      endDate: workout.endDate,
      workoutActivityType: workoutActivityTypeIdentifier(workout.workoutActivityType as unknown as number),
      duration: workout.duration,
      averageHeartRate: await averageHeartRateFor(workout as never),
    })),
  );
  return { samples, newAnchor: result.newAnchor };
}

// The real SyncPort: HealthKit on the read side, the ingest-health edge
// function on the write side. The caller's session supplies the bearer
// token; this file never reads or sends a user id itself.
export const healthKitPort: SyncPort = {
  query(identifier, opts) {
    if (identifier === WORKOUT_SPEC.identifier) return queryWorkouts(opts);
    if (identifier === SLEEP_SPEC.identifier) return querySleep(opts);
    return queryQuantity(identifier, opts);
  },
  async post(batch) {
    const { data, error } = await supabase.functions.invoke('ingest-health', { body: batch });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};

// The AsyncStorage backed anchor store. runHealthSync already builds each
// key with anchorKey(userId, identifier) before calling get or set, so this
// is a plain pass through to storage; the account boundary is baked into
// the key it is handed, not decided here.
export const healthKitAnchors: AnchorStore = {
  // A real AsyncStorage failure here must not be swallowed into "no
  // anchor": that reads to runHealthSync as a fresh start and triggers a
  // full RECOVERY_WINDOW_DAYS re-read every single incremental sync, with
  // nothing recorded anywhere to show it happened. Re-reading is safe (the
  // dedupe key on every observation makes a repeat harmless), so no data is
  // lost, but the repeated full sync is an invisible cost in battery and
  // bandwidth. Letting the failure throw here means healthSync.ts's own
  // try/catch around anchors.get records it as a failed metric instead.
  async get(key) {
    return await AsyncStorage.getItem(key);
  },
  async set(key, anchor) {
    await AsyncStorage.setItem(key, anchor);
  },
};
