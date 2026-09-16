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

test('active energy and exercise time both sum into active minutes', () => {
  const energy = specFor('HKQuantityTypeIdentifierActiveEnergyBurned');
  const exercise = specFor('HKQuantityTypeIdentifierAppleExerciseTime');
  assert.equal(energy.fold, 'sum');
  assert.equal(energy.dayField, 'active_minutes');
  assert.equal(exercise.fold, 'sum');
  assert.equal(exercise.dayField, 'active_minutes');
});

test('resting heart rate and hrv average into their own day fields', () => {
  const resting = specFor('HKQuantityTypeIdentifierRestingHeartRate');
  const hrv = specFor('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
  assert.equal(resting.fold, 'mean');
  assert.equal(resting.dayField, 'resting_hr');
  assert.equal(hrv.fold, 'mean');
  assert.equal(hrv.dayField, 'hrv');
});

test('wrist and basal body temperature both average into temp deviation', () => {
  const wrist = specFor('HKQuantityTypeIdentifierAppleSleepingWristTemperature');
  const basal = specFor('HKQuantityTypeIdentifierBasalBodyTemperature');
  assert.equal(wrist.fold, 'mean');
  assert.equal(wrist.dayField, 'temp_deviation');
  assert.equal(basal.fold, 'mean');
  assert.equal(basal.dayField, 'temp_deviation');
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

test('workout intensity reads off average heart rate, defaulting to Moderate', () => {
  assert.equal(workoutIntensity(undefined), 'Moderate');
  assert.equal(workoutIntensity(null), 'Moderate');
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
