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
  getBloodTypeAsync,
  getDateOfBirthAsync,
  isHealthDataAvailableAsync,
  queryCategorySamplesWithAnchor,
  queryQuantitySamplesWithAnchor,
  queryWorkoutSamplesWithAnchor,
  getRequestStatusForAuthorization,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import type { CategoryTypeIdentifier, ObjectTypeIdentifier, QuantityTypeIdentifier } from '@kingstinct/react-native-healthkit';

import { CATEGORY_SPECS } from './healthCategories';
import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';
import type { CategorySample, QuantitySample, WorkoutSample } from './healthSamples';
import type { AnchorStore, SyncPort } from './healthSync';
import { supabase } from './supabase';

// Her date of birth and blood type, for the facts on her Profile overview.
const CHARACTERISTIC_TYPES: ObjectTypeIdentifier[] = ['HKCharacteristicTypeIdentifierDateOfBirth', 'HKCharacteristicTypeIdentifierBloodType'];

const READ_TYPES: ObjectTypeIdentifier[] = [
  ...CHARACTERISTIC_TYPES,
  ...QUANTITY_SPECS.map((spec) => spec.identifier as QuantityTypeIdentifier),
  SLEEP_SPEC.identifier as CategoryTypeIdentifier,
  WorkoutTypeIdentifier,
  ...CATEGORY_SPECS.map((spec) => spec.identifier as CategoryTypeIdentifier),
];

export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

// Whether tapping Connect will actually raise Apple's sheet.
//
// iOS shows that sheet once per type per install. Once she has answered it,
// requestAuthorization resolves immediately and nothing appears on screen, so
// a woman who refused the first time taps Connect and watches nothing happen.
// HealthKit will not say whether she allowed or refused a read type, by
// design, so this cannot report which she chose. It can only say whether
// there is still a question to put to her, and that is enough to stop the
// screen from promising a sheet that will not come.
export async function healthPermissionWillAsk(): Promise<boolean> {
  if (!(await isHealthAvailable())) return false;
  try {
    // 1 is shouldRequest. 0 is unknown and 2 is unnecessary, and both mean
    // no sheet. Unknown is treated as no sheet rather than yes, because
    // promising one that does not arrive is the failure being fixed.
    return (await getRequestStatusForAuthorization({ toRead: READ_TYPES })) === 1;
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

// Her date of birth and blood type as Apple Health holds them. Read without
// asking: HealthKit never says whether reading was refused, it just has
// nothing to give, so a refusal and an empty field both come back as null.
export async function readCharacteristics(): Promise<{ dateOfBirth: Date | null; bloodType: number | null }> {
  if (!(await isHealthAvailable())) return { dateOfBirth: null, bloodType: null };
  const [dob, blood] = await Promise.all([getDateOfBirthAsync().catch(() => undefined), getBloodTypeAsync().catch(() => 0)]);
  return { dateOfBirth: dob ?? null, bloodType: blood ? Number(blood) : null };
}

// Asks for just those two, then reads them. Apple's sheet appears only the
// first time; after that this reads what she allowed.
export async function askForCharacteristics(): Promise<{ dateOfBirth: Date | null; bloodType: number | null }> {
  if (!(await isHealthAvailable())) return { dateOfBirth: null, bloodType: null };
  try {
    await requestAuthorization({ toRead: CHARACTERISTIC_TYPES });
  } catch {
    // Not granted; whatever can be read is still read below.
  }
  return readCharacteristics();
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
    unit: sample.unit,
  }));
  return { samples, newAnchor: result.newAnchor };
}

// Any category type, sleep included. Sleep differs only in what is done
// with the value afterwards, not in how it is read.
async function queryCategory(identifier: string, opts: QueryOpts): Promise<{ samples: unknown[]; newAnchor: string }> {
  const result = await queryCategorySamplesWithAnchor(identifier as CategoryTypeIdentifier, {
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
      // HealthKit's own names for these. All four were being dropped.
      distance: workout.totalDistance,
      energyBurned: workout.totalEnergyBurned,
      swimmingStrokes: workout.totalSwimmingStrokeCount,
      flightsClimbed: workout.totalFlightsClimbed,
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
    if (identifier.startsWith('HKCategoryTypeIdentifier')) return queryCategory(identifier, opts);
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
