import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  QUANTITY_SPECS,
  SLEEP_SPEC,
  WORKOUT_SPEC,
  sleepStageLabel,
  workoutDurationMinutes,
  workoutIntensity,
  workoutTypeLabel,
} from './healthMetrics';
import { EXTRA_QUANTITY_SPECS } from './healthMetricsAll';

function specFor(identifier: string) {
  const spec = QUANTITY_SPECS.find((s) => s.identifier === identifier);
  assert.ok(spec, `expected a spec for ${identifier}`);
  return spec!;
}

test('steps sums into the steps day field', () => {
  const spec = specFor('HKQuantityTypeIdentifierStepCount');
  assert.equal(spec.fold, 'sum');
  assert.equal(spec.dayField, 'steps');
});

test('active minutes comes from exercise time alone', () => {
  const exercise = specFor('HKQuantityTypeIdentifierAppleExerciseTime');
  assert.equal(exercise.fold, 'sum');
  assert.equal(exercise.dayField, 'active_minutes');
});

test('active energy is kept only as an observation, in kilocalories, never folded into a minutes field', () => {
  const energy = specFor('HKQuantityTypeIdentifierActiveEnergyBurned');
  assert.equal(energy.unit, 'kcal');
  assert.equal(energy.dayField, undefined);
});

test('resting heart rate and hrv average into their own day fields', () => {
  const resting = specFor('HKQuantityTypeIdentifierRestingHeartRate');
  const hrv = specFor('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
  assert.equal(resting.fold, 'mean');
  assert.equal(resting.dayField, 'resting_hr');
  assert.equal(hrv.fold, 'mean');
  assert.equal(hrv.dayField, 'hrv');
});

test('wrist and basal body temperature are observation only, in degrees, never folded into temp deviation', () => {
  // Both readings are absolute skin temperature, roughly 36 to 38 degrees.
  // temp_deviation is a nightly change from a personal baseline, a small
  // number around zero, so an absolute reading must never land there.
  const wrist = specFor('HKQuantityTypeIdentifierAppleSleepingWristTemperature');
  const basal = specFor('HKQuantityTypeIdentifierBasalBodyTemperature');
  assert.equal(wrist.fold, 'mean');
  assert.equal(wrist.dayField, undefined);
  assert.equal(wrist.unit, 'degC');
  assert.equal(basal.fold, 'mean');
  assert.equal(basal.dayField, undefined);
  assert.equal(basal.unit, 'degC');
});

test('heart rate, respiratory rate and oxygen saturation are observation only', () => {
  for (const id of [
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierRespiratoryRate',
    'HKQuantityTypeIdentifierOxygenSaturation',
  ]) {
    const spec = specFor(id);
    assert.equal(spec.dayField, undefined);
  }
});

test('every quantity spec identifier is unique', () => {
  const identifiers = QUANTITY_SPECS.map((s) => s.identifier);
  assert.equal(new Set(identifiers).size, identifiers.length);
});

test('sleep spec reads the sleep analysis category', () => {
  assert.equal(SLEEP_SPEC.identifier, 'HKCategoryTypeIdentifierSleepAnalysis');
});

test('sleep stage labels match the HealthKit vocabulary', () => {
  assert.equal(sleepStageLabel(0), 'in_bed');
  assert.equal(sleepStageLabel(2), 'awake');
  assert.equal(sleepStageLabel(3), 'asleep_core');
  assert.equal(sleepStageLabel(4), 'asleep_deep');
  assert.equal(sleepStageLabel(5), 'asleep_rem');
  assert.equal(sleepStageLabel(1), 'asleep');
  assert.equal(sleepStageLabel(99), 'asleep');
});

test('workout spec reads the workout type', () => {
  assert.equal(WORKOUT_SPEC.identifier, 'HKWorkoutTypeIdentifier');
});

test('workout type labels map known activity types and fall back to Other', () => {
  assert.equal(workoutTypeLabel('HKWorkoutActivityTypeRunning'), 'Run');
  assert.equal(workoutTypeLabel('HKWorkoutActivityTypeWalking'), 'Walk');
  assert.equal(workoutTypeLabel('HKWorkoutActivityTypeTraditionalStrengthTraining'), 'Strength');
  assert.equal(workoutTypeLabel('HKWorkoutActivityTypeHighIntensityIntervalTraining'), 'HIIT');
  assert.equal(workoutTypeLabel('HKWorkoutActivityTypeSomethingUnknown'), 'Other');
});

test('workout intensity is undefined with no average heart rate, never a guessed label', () => {
  // Nothing about effort was measured, so nothing is claimed.
  assert.equal(workoutIntensity(undefined), undefined);
  assert.equal(workoutIntensity(null), undefined);
});

test('workout intensity reads off average heart rate when one was measured', () => {
  assert.equal(workoutIntensity(100), 'Low');
  assert.equal(workoutIntensity(135), 'Moderate');
  assert.equal(workoutIntensity(165), 'High');
});

test('workout duration prefers the reported quantity over the date span', () => {
  const start = new Date('2026-01-01T08:00:00Z');
  const end = new Date('2026-01-01T09:00:00Z');
  assert.equal(workoutDurationMinutes({ unit: 's', quantity: 1800 }, start, end), 30);
  assert.equal(workoutDurationMinutes({ unit: 'min', quantity: 45 }, start, end), 45);
  assert.equal(workoutDurationMinutes({ unit: 'hr', quantity: 1.5 }, start, end), 90);
  assert.equal(workoutDurationMinutes(undefined, start, end), 60);
});

// ── Reading everything HealthKit offers ──────────────────────────────

test('no generated metric name collides with a hand checked one', () => {
  // The one mistake here that could not be undone. Two identifiers sharing a
  // metric name merge two different readings into one series, and the
  // observations already stored under the hand checked names are what would
  // be corrupted.
  const names = QUANTITY_SPECS.map((s) => s.metric);
  assert.equal(new Set(names).size, names.length, 'two specs share a metric name');
});

test('no two specs read the same HealthKit identifier', () => {
  const ids = QUANTITY_SPECS.map((s) => s.identifier);
  assert.equal(new Set(ids).size, ids.length, 'an identifier is specced twice');
});

test('the hand checked twelve keep their names, units and day folds', () => {
  // Regenerating the bulk list must never touch these. Each name below is a
  // key that observations are already stored against.
  for (const [metric, unit, dayField] of [
    ['steps', 'count', 'steps'],
    ['exercise_time', 'min', 'active_minutes'],
    ['resting_heart_rate', 'count/min', 'resting_hr'],
    ['hrv', 'ms', 'hrv'],
  ] as const) {
    const spec = QUANTITY_SPECS.find((s) => s.metric === metric);
    assert.ok(spec, `${metric} disappeared from the specs`);
    assert.equal(spec.unit, unit, `${metric} changed unit`);
    assert.equal(spec.dayField, dayField, `${metric} changed its daily column`);
  }
});

test('only the hand checked metrics fold into a daily row', () => {
  // A generated spec has no reviewed unit, so letting one write a column of
  // daily_metrics would put an unknown unit into a number Today reads.
  for (const spec of EXTRA_QUANTITY_SPECS) {
    assert.equal(spec.dayField, undefined, `${spec.metric} writes a daily column without a checked unit`);
  }
});

test('a generated spec names no unit, so HealthKit picks and the sample reports it', () => {
  for (const spec of EXTRA_QUANTITY_SPECS) {
    assert.equal(spec.unit, undefined, `${spec.metric} hard codes a unit nobody checked`);
  }
});

test('every spec has a domain the connect screen can name', () => {
  // The disclosure guard reads these. A domain invented here without a name
  // there fails that test, which is the point.
  for (const spec of QUANTITY_SPECS) {
    assert.ok(spec.domain.length > 0, `${spec.metric} has no domain`);
    assert.ok(/^[a-z]+$/.test(spec.domain), `${spec.metric} has an odd domain: ${spec.domain}`);
  }
});
