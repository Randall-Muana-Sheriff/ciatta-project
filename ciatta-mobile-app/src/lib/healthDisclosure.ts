// What Ciatta reads from Apple Health, in her words, on the screen that asks.
//
// Derived from the same specs READ_TYPES in healthKit.ts is built from, and
// that is the whole point of the file. A disclosure typed out by hand is a
// promise that drifts: the day someone adds a metric to QUANTITY_SPECS, the
// permission request asks for one more thing than the screen admits to, and
// nothing fails. Here, adding a metric without describing it fails a test.
//
// No pure data file imports the native module, so this one derives from
// healthMetrics rather than from READ_TYPES itself. The two share one source,
// and a test asserts the derivation covers it.

import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';

export type Disclosed = {
  identifier: string;
  // What she would call it.
  label: string;
  // What it is, and where it is useful. Never what it proves: a line here
  // that said resting heart rate reveals anything on its own would be the
  // screen making a claim before a single sample has been read.
  detail: string;
};

export type DisclosureGroup = { title: string; items: Disclosed[] };

// One entry per identifier Ciatta asks Apple Health for. Keyed by the
// identifier rather than the metric name, because the identifier is what the
// permission request carries.
const COPY: Record<string, { label: string; detail: string }> = {
  HKQuantityTypeIdentifierStepCount: {
    label: 'Steps',
    detail: 'How much you moved each day.',
  },
  HKQuantityTypeIdentifierAppleExerciseTime: {
    label: 'Exercise minutes',
    detail: 'The minutes Apple Health counts as exercise.',
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    label: 'Active energy',
    detail: 'The energy you burned moving, in calories.',
  },
  HKQuantityTypeIdentifierRestingHeartRate: {
    label: 'Resting heart rate',
    detail: 'Your heart rate at rest. It is one of the few numbers that moves with a cycle, with illness, and with a hard week.',
  },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: {
    label: 'Heart rate variability',
    detail: 'How much the spacing between beats varies. It tends to fall when your body is under load.',
  },
  HKQuantityTypeIdentifierHeartRate: {
    label: 'Heart rate',
    detail: 'Individual readings through the day, not only the resting one.',
  },
  HKQuantityTypeIdentifierRespiratoryRate: {
    label: 'Breathing rate',
    detail: 'Breaths per minute, mostly recorded while you sleep.',
  },
  HKQuantityTypeIdentifierOxygenSaturation: {
    label: 'Blood oxygen',
    detail: 'The percentage your watch records, when it records one.',
  },
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: {
    label: 'Wrist temperature',
    detail: 'Skin temperature while you sleep, in degrees.',
  },
  HKQuantityTypeIdentifierBasalBodyTemperature: {
    label: 'Basal body temperature',
    detail: 'A waking temperature, if you or a device record one.',
  },
  HKCategoryTypeIdentifierSleepAnalysis: {
    label: 'Sleep',
    detail: 'When you slept, how long, and the stages your device recorded.',
  },
  HKWorkoutTypeIdentifier: {
    label: 'Workouts',
    detail: 'The kind, the length, and the effort, for each workout you record.',
  },
};

const GROUP_TITLES: Record<string, string> = {
  activity: 'Movement',
  vitals: 'Heart and breathing',
  sleep: 'Sleep',
};

// The order the groups appear in, which is deliberate: movement is the
// easiest to recognise as your own, so it goes first.
const GROUP_ORDER = ['activity', 'vitals', 'sleep'];

// Every identifier Ciatta requests, paired with its domain. Sleep and
// workouts are separate specs rather than entries in QUANTITY_SPECS, so they
// are appended here in the same order READ_TYPES appends them.
export function requestedTypes(): { identifier: string; domain: string }[] {
  return [
    ...QUANTITY_SPECS.map((spec) => ({ identifier: spec.identifier, domain: spec.domain })),
    { identifier: SLEEP_SPEC.identifier, domain: SLEEP_SPEC.domain },
    { identifier: WORKOUT_SPEC.identifier, domain: WORKOUT_SPEC.domain },
  ];
}

// Identifiers Ciatta asks for that nobody has written copy for. Empty is the
// only acceptable value; a test asserts it.
export function undisclosedTypes(): string[] {
  return requestedTypes()
    .map((t) => t.identifier)
    .filter((identifier) => !COPY[identifier]);
}

// Copy for something Ciatta does not ask for. Also must be empty: a screen
// listing a metric the permission request never mentions is overstating what
// Ciatta collects, which is the same failure in the other direction.
export function overstatedTypes(): string[] {
  const asked = new Set(requestedTypes().map((t) => t.identifier));
  return Object.keys(COPY).filter((identifier) => !asked.has(identifier));
}

export function healthDisclosure(): DisclosureGroup[] {
  const byDomain = new Map<string, Disclosed[]>();
  for (const { identifier, domain } of requestedTypes()) {
    const copy = COPY[identifier];
    // An identifier with no copy is dropped rather than rendered as a blank
    // row or an internal name. The test above is what keeps that from being
    // a silent omission on her screen.
    if (!copy) continue;
    const items = byDomain.get(domain) ?? [];
    items.push({ identifier, label: copy.label, detail: copy.detail });
    byDomain.set(domain, items);
  }

  return GROUP_ORDER.filter((domain) => (byDomain.get(domain) ?? []).length > 0).map((domain) => ({
    title: GROUP_TITLES[domain] ?? domain,
    items: byDomain.get(domain) ?? [],
  }));
}

// How many separate things she is agreeing to share, for the one line on
// screen that says so. Counted rather than written down, for the same reason
// as everything else here.
export function disclosedCount(): number {
  return healthDisclosure().reduce((n, g) => n + g.items.length, 0);
}
