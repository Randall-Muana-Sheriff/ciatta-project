// Turns Apple Health samples into observations, and into one row per day.
// Pure functions only: the sample shapes below are what device code adapts
// a real HealthKit sample into, not the HealthKit types themselves.

import { addDays, isoDay } from '../data/cycleLog';
import {
  type DailyRow,
  type DayNumbers,
  type MetricSpec,
  type SleepSpec,
  type Workout,
  type WorkoutSpec,
  SLEEP_SPEC,
  WORKOUT_SPEC,
  sleepStageLabel,
  workoutDurationMinutes,
  workoutIntensity,
  workoutTypeLabel,
} from './healthMetrics';

// The database requires value or value_text to be non null; never emit a
// row with both null.
export type NewObservation = {
  domain: string;
  metric: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  occurred_at: string;
  provenance: 'MEASURED';
  dedupe_key: string;
  metadata: Record<string, unknown>;
};

export type QuantitySample = {
  uuid?: string;
  startDate: Date;
  endDate: Date;
  value: number;
};

export type CategorySample = {
  uuid?: string;
  startDate: Date;
  endDate: Date;
  // The raw HealthKit category value, read with sleepStageLabel for sleep.
  value: number;
};

export type WorkoutSample = {
  uuid?: string;
  startDate: Date;
  endDate: Date;
  workoutActivityType: string;
  duration?: { unit?: string; quantity?: number };
  averageHeartRate?: number | null;
};

// One flat list of samples, each tagged with what it is, is what a sync
// pass hands to foldDay after reading every metric it cares about.
export type FoldableSample =
  | { kind: 'quantity'; spec: MetricSpec; sample: QuantitySample }
  | { kind: 'sleep'; sample: CategorySample }
  | { kind: 'workout'; sample: WorkoutSample };

function toIso(date: Date): string {
  return date.toISOString();
}

function dedupeKey(metric: string, sample: { uuid?: string; startDate: Date }): string {
  return `healthkit:${metric}:${sample.uuid ?? toIso(sample.startDate)}`;
}

// Turns one sample into the observation row for it. The same sample read
// twice (same uuid, or the same start time when a sample carries no uuid)
// always produces the same dedupe_key, so a re-sync updates rather than
// duplicating.
export function sampleToObservation(
  spec: MetricSpec | SleepSpec | WorkoutSpec,
  sample: QuantitySample | CategorySample | WorkoutSample
): NewObservation {
  if (spec.identifier === WORKOUT_SPEC.identifier) {
    const workout = sample as WorkoutSample;
    const minutes = workoutDurationMinutes(workout.duration, workout.startDate, workout.endDate);
    const intensity = workoutIntensity(workout.averageHeartRate);
    return {
      domain: spec.domain,
      metric: spec.metric,
      value: minutes,
      value_text: workoutTypeLabel(workout.workoutActivityType),
      unit: 'min',
      occurred_at: toIso(workout.endDate),
      provenance: 'MEASURED',
      dedupe_key: dedupeKey(spec.metric, workout),
      // Absent, not defaulted, when nothing about effort was measured.
      metadata: intensity == null ? {} : { intensity },
    };
  }

  if (spec.identifier === SLEEP_SPEC.identifier) {
    const segment = sample as CategorySample;
    return {
      domain: spec.domain,
      metric: spec.metric,
      value: null,
      value_text: sleepStageLabel(segment.value),
      unit: null,
      occurred_at: toIso(segment.endDate),
      provenance: 'MEASURED',
      dedupe_key: dedupeKey(spec.metric, segment),
      metadata: {},
    };
  }

  const quantitySpec = spec as MetricSpec;
  const quantity = sample as QuantitySample;
  return {
    domain: quantitySpec.domain,
    metric: quantitySpec.metric,
    value: quantity.value,
    value_text: null,
    unit: quantitySpec.unit,
    occurred_at: toIso(quantity.endDate),
    provenance: 'MEASURED',
    dedupe_key: dedupeKey(quantitySpec.metric, quantity),
    metadata: {},
  };
}

type NumericEntry = { value: number; at: number };
type NumericAccumulator = { fold: MetricSpec['fold']; entries: NumericEntry[] };

function foldValues(fold: MetricSpec['fold'], entries: NumericEntry[]): number {
  switch (fold) {
    case 'sum':
      return entries.reduce((total, entry) => total + entry.value, 0);
    case 'mean':
      return entries.reduce((total, entry) => total + entry.value, 0) / entries.length;
    case 'min':
      return Math.min(...entries.map((entry) => entry.value));
    case 'last':
      return [...entries].sort((a, b) => a.at - b.at)[entries.length - 1].value;
  }
}

// A stretch of time, as two instants in milliseconds.
type Span = [number, number];

// One night, kept as the stretches each sample covered and not as running
// totals. Apple Health holds a night more than once: the phone writes one
// long "in bed" stretch, a watch writes the stages inside it, and a sleep
// app may write the same hours again. Adding durations counts every minute
// once per source; the stretches are merged first, so a minute is counted
// once however many samples cover it.
type SleepNight = {
  // Every sample, whatever it says: she was in bed for all of it.
  inBed: Span[];
  asleep: Span[];
  awake: Span[];
  rem: Span[];
  light: Span[];
  deep: Span[];
  // True once a sample with an actual stage classification (awake, core,
  // deep, rem) lands that night. Sleep trackers that are not an Apple Watch
  // commonly report only the generic unstaged "asleep" category, in which
  // case this stays false and the four stage fields are never written: they
  // would otherwise read as a measured zero for a stage nothing ever tested.
  hasStagedSample: boolean;
};

// Minutes covered by at least one of the stretches.
function minutesCovered(spans: Span[]): number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reached = -Infinity;
  for (const [start, end] of sorted) {
    if (end <= reached) continue;
    total += end - Math.max(start, reached);
    reached = end;
  }
  return total / 60000;
}

// The hour a night's day turns over. A night belongs to the day she woke
// on, so a stretch that ends in the evening belongs to the night that is
// beginning, and counts toward tomorrow. Going by the calendar day a sample
// ended on split every night that began before midnight in two: a watch
// reports a night as dozens of short stretches, and the ones that ended
// before midnight landed on the day before.
export const NIGHT_TURNS_AT_HOUR = 18;

export function nightOf(end: Date): string {
  return isoDay(end.getHours() >= NIGHT_TURNS_AT_HOUR ? addDays(end, 1) : end);
}

// Groups samples by local calendar day and folds each metric into the
// field its spec names. A day that had no sample for a metric never gets
// that key: it stays entirely absent, not zero and not an empty list.
export function foldDay(samples: readonly FoldableSample[]): Record<string, Partial<DailyRow>> {
  const numeric: Record<string, Partial<Record<keyof DayNumbers, NumericAccumulator>>> = {};
  const sleep: Record<string, SleepNight> = {};
  const workouts: Record<string, Workout[]> = {};

  for (const item of samples) {
    if (item.kind === 'quantity') {
      const { spec, sample } = item;
      if (!spec.dayField) continue;
      const day = isoDay(sample.startDate);
      const byField = (numeric[day] ??= {});
      const accumulator = (byField[spec.dayField] ??= { fold: spec.fold, entries: [] });
      accumulator.entries.push({ value: sample.value, at: sample.startDate.getTime() });
      continue;
    }

    if (item.kind === 'sleep') {
      const { sample } = item;
      const night = (sleep[nightOf(sample.endDate)] ??= {
        inBed: [],
        asleep: [],
        awake: [],
        rem: [],
        light: [],
        deep: [],
        hasStagedSample: false,
      });
      const span: Span = [sample.startDate.getTime(), sample.endDate.getTime()];
      const stage = sleepStageLabel(sample.value);
      night.inBed.push(span);
      if (stage === 'awake') {
        night.awake.push(span);
        night.hasStagedSample = true;
      } else if (stage === 'asleep_deep') {
        night.deep.push(span);
        night.asleep.push(span);
        night.hasStagedSample = true;
      } else if (stage === 'asleep_rem') {
        night.rem.push(span);
        night.asleep.push(span);
        night.hasStagedSample = true;
      } else if (stage === 'asleep_core') {
        night.light.push(span);
        night.asleep.push(span);
        night.hasStagedSample = true;
      } else if (stage === 'asleep') {
        // The generic unstaged category: real sleep, but no stage claim.
        night.asleep.push(span);
      }
      // 'in_bed' says where she was, not whether she slept.
      continue;
    }

    const { sample } = item;
    const day = isoDay(sample.startDate);
    const intensity = workoutIntensity(sample.averageHeartRate);
    const entry: Workout = {
      type: workoutTypeLabel(sample.workoutActivityType),
      minutes: workoutDurationMinutes(sample.duration, sample.startDate, sample.endDate),
    };
    // Set the key only when a value came back: absent means absent, never
    // an emitted `intensity: undefined`.
    if (intensity != null) entry.intensity = intensity;
    (workouts[day] ??= []).push(entry);
  }

  const days: Record<string, Partial<DailyRow>> = {};
  const rowFor = (day: string): Record<string, unknown> => {
    const existing = days[day];
    if (existing) return existing as Record<string, unknown>;
    const created: Partial<DailyRow> = { day };
    days[day] = created;
    return created as Record<string, unknown>;
  };

  for (const [day, fields] of Object.entries(numeric)) {
    const row = rowFor(day);
    for (const [field, accumulator] of Object.entries(fields)) {
      if (!accumulator || accumulator.entries.length === 0) continue;
      row[field] = foldValues(accumulator.fold, accumulator.entries);
    }
  }

  for (const [day, night] of Object.entries(sleep)) {
    const inBed = minutesCovered(night.inBed);
    const asleep = minutesCovered(night.asleep);
    // A sample with no length measured nothing.
    if (inBed <= 0) continue;
    const row = rowFor(day);
    row.time_in_bed = inBed / 60;
    // Sleep is written only when something measured sleep. A phone with no
    // watch beside it records the hours she was in bed and nothing about
    // whether she slept, and that night was once stored as zero hours of
    // sleep: eighteen of one person's first thirty three nights. Unknown
    // stays absent.
    if (asleep > 0) row.sleep_hours = asleep / 60;
    // Stage keys are written together, only when at least one sample that
    // night actually classified a stage. A night with no staged sample never
    // gets these keys: sleep_hours and time_in_bed alone were measured.
    if (night.hasStagedSample) {
      row.stage_awake = minutesCovered(night.awake);
      row.stage_rem = minutesCovered(night.rem);
      row.stage_light = minutesCovered(night.light);
      row.stage_deep = minutesCovered(night.deep);
    }
  }

  for (const [day, list] of Object.entries(workouts)) {
    rowFor(day).workouts = list;
  }

  return days;
}
