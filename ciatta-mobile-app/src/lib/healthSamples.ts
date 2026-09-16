// Turns Apple Health samples into observations, and into one row per day.
// Pure functions only: the sample shapes below are what device code adapts
// a real HealthKit sample into, not the HealthKit types themselves.

import { isoDay } from '../data/cycleLog';
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
    return {
      domain: spec.domain,
      metric: spec.metric,
      value: minutes,
      value_text: workoutTypeLabel(workout.workoutActivityType),
      unit: 'min',
      occurred_at: toIso(workout.endDate),
      provenance: 'MEASURED',
      dedupe_key: dedupeKey(spec.metric, workout),
      metadata: { intensity: workoutIntensity(workout.averageHeartRate) },
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

type SleepMinutes = {
  sleep_hours: number;
  time_in_bed: number;
  stage_awake: number;
  stage_rem: number;
  stage_light: number;
  stage_deep: number;
};

// Groups samples by local calendar day and folds each metric into the
// field its spec names. A day that had no sample for a metric never gets
// that key: it stays entirely absent, not zero and not an empty list.
export function foldDay(samples: readonly FoldableSample[]): Record<string, Partial<DailyRow>> {
  const numeric: Record<string, Partial<Record<keyof DayNumbers, NumericAccumulator>>> = {};
  const sleep: Record<string, SleepMinutes> = {};
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
      // A night's sleep is counted on the day it ended: the wake day.
      const day = isoDay(sample.endDate);
      const bucket = (sleep[day] ??= {
        sleep_hours: 0,
        time_in_bed: 0,
        stage_awake: 0,
        stage_rem: 0,
        stage_light: 0,
        stage_deep: 0,
      });
      const minutes = (sample.endDate.getTime() - sample.startDate.getTime()) / 60000;
      const stage = sleepStageLabel(sample.value);
      bucket.time_in_bed += minutes;
      if (stage === 'awake') bucket.stage_awake += minutes;
      else if (stage === 'asleep_deep') {
        bucket.stage_deep += minutes;
        bucket.sleep_hours += minutes;
      } else if (stage === 'asleep_rem') {
        bucket.stage_rem += minutes;
        bucket.sleep_hours += minutes;
      } else if (stage === 'asleep_core') {
        bucket.stage_light += minutes;
        bucket.sleep_hours += minutes;
      } else if (stage === 'asleep') {
        bucket.sleep_hours += minutes;
      }
      // 'in_bed' contributes only to time_in_bed, already added above.
      continue;
    }

    const { sample } = item;
    const day = isoDay(sample.startDate);
    (workouts[day] ??= []).push({
      type: workoutTypeLabel(sample.workoutActivityType),
      minutes: workoutDurationMinutes(sample.duration, sample.startDate, sample.endDate),
      intensity: workoutIntensity(sample.averageHeartRate),
    });
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

  for (const [day, minutes] of Object.entries(sleep)) {
    const row = rowFor(day);
    row.sleep_hours = minutes.sleep_hours / 60;
    row.time_in_bed = minutes.time_in_bed / 60;
    row.stage_awake = minutes.stage_awake;
    row.stage_rem = minutes.stage_rem;
    row.stage_light = minutes.stage_light;
    row.stage_deep = minutes.stage_deep;
  }

  for (const [day, list] of Object.entries(workouts)) {
    rowFor(day).workouts = list;
  }

  return days;
}
