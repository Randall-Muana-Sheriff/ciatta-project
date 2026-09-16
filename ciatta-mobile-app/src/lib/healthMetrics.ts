// Which Apple Health metrics we read, and how each one folds into one row
// per day in public.daily_metrics. Pure data and pure helpers: no device
// calls, no network, no database. Device code that reads real HealthKit
// samples lives elsewhere and adapts its samples to the shapes here.

// ── The day row ──────────────────────────────────────────────────

// The numeric fields of a day, each nullable in storage: a metric Apple
// Health had no sample for is left out of a row, never filled with a zero.
export type DayNumbers = {
  sleep_hours: number;
  stage_awake: number;
  stage_rem: number;
  stage_light: number;
  stage_deep: number;
  time_in_bed: number;
  steps: number;
  active_minutes: number;
  resting_hr: number;
  hrv: number;
  temp_deviation: number;
  energy: number;
  mood: number;
  stress: number;
  caffeine: number;
  alcohol: number;
};

export type Workout = { type: string; minutes: number; intensity: 'Low' | 'Moderate' | 'High' };

// One row of public.daily_metrics. Every field but `day` is left out
// entirely when we have nothing to say about it that day.
export type DailyRow = Partial<DayNumbers> & {
  day: string;
  workouts?: Workout[];
  foods?: string[];
  digestion?: string[];
  note?: string;
};

// ── Quantity metrics ─────────────────────────────────────────────

export type MetricSpec = {
  identifier: string;
  metric: string;
  domain: string;
  unit: string;
  fold: 'sum' | 'mean' | 'min' | 'last';
  dayField?: keyof DayNumbers;
};

export const QUANTITY_SPECS: readonly MetricSpec[] = [
  { identifier: 'HKQuantityTypeIdentifierStepCount', metric: 'steps', domain: 'activity', unit: 'count', fold: 'sum', dayField: 'steps' },
  { identifier: 'HKQuantityTypeIdentifierAppleExerciseTime', metric: 'exercise_time', domain: 'activity', unit: 'min', fold: 'sum', dayField: 'active_minutes' },
  { identifier: 'HKQuantityTypeIdentifierRestingHeartRate', metric: 'resting_heart_rate', domain: 'vitals', unit: 'count/min', fold: 'mean', dayField: 'resting_hr' },
  { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', metric: 'hrv', domain: 'vitals', unit: 'ms', fold: 'mean', dayField: 'hrv' },
  { identifier: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature', metric: 'wrist_temperature', domain: 'vitals', unit: 'degC', fold: 'mean', dayField: 'temp_deviation' },
  { identifier: 'HKQuantityTypeIdentifierBasalBodyTemperature', metric: 'basal_body_temperature', domain: 'vitals', unit: 'degC', fold: 'mean', dayField: 'temp_deviation' },
  // Observations only: no row in daily_metrics carries these on its own.
  // Active energy is kilocalories, not a duration, so it never folds into
  // active_minutes; it is kept only as its own observation, in kcal.
  { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned', metric: 'active_energy', domain: 'activity', unit: 'kcal', fold: 'sum' },
  { identifier: 'HKQuantityTypeIdentifierHeartRate', metric: 'heart_rate', domain: 'vitals', unit: 'count/min', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRespiratoryRate', metric: 'respiratory_rate', domain: 'vitals', unit: 'count/min', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierOxygenSaturation', metric: 'oxygen_saturation', domain: 'vitals', unit: '%', fold: 'mean' },
];

// ── Sleep ────────────────────────────────────────────────────────

export type SleepSpec = { identifier: string; metric: string; domain: string };

export const SLEEP_SPEC: SleepSpec = {
  identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
  metric: 'sleep_analysis',
  domain: 'sleep',
};

// HealthKit's sleep analysis category values, unchanged from the earlier
// mapping: 0 is time in bed without a stage, 1 (and anything unexpected)
// falls back to plain asleep, 2 to 5 are the tracked stages.
export function sleepStageLabel(value: number): string {
  switch (value) {
    case 0:
      return 'in_bed';
    case 2:
      return 'awake';
    case 3:
      return 'asleep_core';
    case 4:
      return 'asleep_deep';
    case 5:
      return 'asleep_rem';
    default:
      return 'asleep';
  }
}

// ── Workouts ─────────────────────────────────────────────────────

export type WorkoutSpec = { identifier: string; metric: string; domain: string };

export const WORKOUT_SPEC: WorkoutSpec = {
  identifier: 'HKWorkoutTypeIdentifier',
  metric: 'workout',
  domain: 'activity',
};

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  HKWorkoutActivityTypeRunning: 'Run',
  HKWorkoutActivityTypeWalking: 'Walk',
  HKWorkoutActivityTypeHiking: 'Hike',
  HKWorkoutActivityTypeCycling: 'Cycle',
  HKWorkoutActivityTypeSwimming: 'Swim',
  HKWorkoutActivityTypeYoga: 'Yoga',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'Strength',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'Strength',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'HIIT',
  HKWorkoutActivityTypeCoreTraining: 'Core',
  HKWorkoutActivityTypeElliptical: 'Elliptical',
  HKWorkoutActivityTypeRowing: 'Row',
  HKWorkoutActivityTypeDance: 'Dance',
  HKWorkoutActivityTypePilates: 'Pilates',
};

export function workoutTypeLabel(activityType: string): string {
  return WORKOUT_TYPE_LABELS[activityType] ?? 'Other';
}

// HealthKit carries no notion of intensity, so it is read off average heart
// rate when the sample has one. Without a heart rate, Moderate is the
// unclaimed middle ground rather than a guess at either extreme.
export function workoutIntensity(averageHeartRate: number | null | undefined): 'Low' | 'Moderate' | 'High' {
  if (averageHeartRate == null) return 'Moderate';
  if (averageHeartRate < 120) return 'Low';
  if (averageHeartRate < 150) return 'Moderate';
  return 'High';
}

// A workout's duration, preferring the quantity HealthKit reports over the
// span between start and end (the two can differ, for example when a
// workout was paused).
export function workoutDurationMinutes(
  duration: { unit?: string; quantity?: number } | undefined,
  startDate: Date,
  endDate: Date
): number {
  if (duration && typeof duration.quantity === 'number') {
    const unit = duration.unit ?? 's';
    if (unit === 's' || unit === 'sec' || unit === 'second') return duration.quantity / 60;
    if (unit === 'min' || unit === 'minute') return duration.quantity;
    if (unit === 'hr' || unit === 'hour') return duration.quantity * 60;
    return duration.quantity;
  }
  return (endDate.getTime() - startDate.getTime()) / 60000;
}
