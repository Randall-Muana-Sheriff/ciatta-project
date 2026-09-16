import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';
import {
  type FoldableSample,
  foldDay,
  sampleToObservation,
  type QuantitySample,
  type WorkoutSample,
} from './healthSamples';

const STEPS = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierStepCount')!;
const TEMP = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierAppleSleepingWristTemperature')!;
const HEART_RATE = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierHeartRate')!;
const ACTIVE_ENERGY = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierActiveEnergyBurned')!;
const EXERCISE_TIME = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierAppleExerciseTime')!;

function quantity(spec = STEPS, startIso: string, endIso: string, value: number, uuid?: string): FoldableSample {
  const sample: QuantitySample = { uuid, startDate: new Date(startIso), endDate: new Date(endIso), value };
  return { kind: 'quantity', spec, sample };
}

function sleepSegment(startIso: string, endIso: string, value: number, uuid?: string): FoldableSample {
  return {
    kind: 'sleep',
    sample: { uuid, startDate: new Date(startIso), endDate: new Date(endIso), value },
  };
}

function workout(startIso: string, endIso: string, activityType: string, uuid?: string): FoldableSample {
  const sample: WorkoutSample = { uuid, startDate: new Date(startIso), endDate: new Date(endIso), workoutActivityType: activityType };
  return { kind: 'workout', sample };
}

test('steps sum across a day, and two days are kept separate', () => {
  const days = foldDay([
    quantity(STEPS, '2026-06-01T08:00:00', '2026-06-01T08:01:00', 1000),
    quantity(STEPS, '2026-06-01T13:00:00', '2026-06-01T13:01:00', 2500),
    quantity(STEPS, '2026-06-02T08:00:00', '2026-06-02T08:01:00', 700),
  ]);
  assert.equal(days['2026-06-01'].steps, 3500);
  assert.equal(days['2026-06-02'].steps, 700);
});

test('a sleep night spanning midnight is counted on the wake day, stages sum, and time in bed differs from sleep hours', () => {
  const days = foldDay([
    // In bed just before midnight; this segment itself spans midnight, so
    // it is counted on the wake day like the rest of the night.
    sleepSegment('2026-06-01T23:55:00', '2026-06-02T00:05:00', 0),
    // Core sleep.
    sleepSegment('2026-06-02T00:05:00', '2026-06-02T02:05:00', 3),
    // Deep sleep.
    sleepSegment('2026-06-02T02:05:00', '2026-06-02T03:05:00', 4),
    // A short waking.
    sleepSegment('2026-06-02T03:05:00', '2026-06-02T03:15:00', 2),
    // REM sleep, ending the night.
    sleepSegment('2026-06-02T03:15:00', '2026-06-02T05:15:00', 5),
  ]);

  // The whole night is attributed to the wake day, not the day it started.
  assert.equal('2026-06-01' in days, false);
  const day = days['2026-06-02'];
  assert.ok(day);
  assert.equal(day.stage_light, 120); // 2 hours of core, called light in the Day model
  assert.equal(day.stage_deep, 60);
  assert.equal(day.stage_rem, 120);
  assert.equal(day.stage_awake, 10);
  // Sleep hours excludes the in bed and awake minutes; time in bed is the
  // whole span, so the two are distinct.
  assert.equal(day.sleep_hours, (120 + 60 + 120) / 60);
  assert.equal(day.time_in_bed, (10 + 120 + 60 + 10 + 120) / 60);
  assert.notEqual(day.time_in_bed, day.sleep_hours);
});

test('a workout is mapped with type, minutes and intensity', () => {
  const days = foldDay([workout('2026-06-01T07:00:00', '2026-06-01T07:40:00', 'HKWorkoutActivityTypeRunning')]);
  const day = days['2026-06-01'];
  assert.ok(day.workouts);
  assert.equal(day.workouts!.length, 1);
  assert.deepEqual(day.workouts![0], { type: 'Run', minutes: 40, intensity: 'Moderate' });
});

test('active minutes come from exercise time alone; active energy stays kilocalories, never minutes', () => {
  const days = foldDay([
    // 400 kcal is not a duration, and must never be added into a minutes
    // field even though both metrics share a day.
    quantity(ACTIVE_ENERGY, '2026-06-01T07:00:00', '2026-06-01T07:01:00', 400),
    quantity(EXERCISE_TIME, '2026-06-01T07:00:00', '2026-06-01T07:01:00', 30),
  ]);
  assert.equal(days['2026-06-01'].active_minutes, 30);

  // Active energy has no dayField at all: it is real data, kept only as an
  // observation, in its own unit.
  assert.equal(ACTIVE_ENERGY.dayField, undefined);
  assert.equal(ACTIVE_ENERGY.unit, 'kcal');
  const obs = sampleToObservation(ACTIVE_ENERGY, {
    startDate: new Date('2026-06-01T07:00:00'),
    endDate: new Date('2026-06-01T07:01:00'),
    value: 400,
  });
  assert.equal(obs.unit, 'kcal');
  assert.equal(obs.value, 400);
});

test('temperature is averaged, and a negative deviation is preserved', () => {
  const days = foldDay([
    quantity(TEMP, '2026-06-01T02:00:00', '2026-06-01T02:01:00', -0.1),
    quantity(TEMP, '2026-06-01T04:00:00', '2026-06-01T04:01:00', -0.3),
  ]);
  assert.equal(days['2026-06-01'].temp_deviation, -0.2);
});

test('a metric with no samples produces no key at all, and never an empty workouts list', () => {
  const days = foldDay([quantity(STEPS, '2026-06-01T08:00:00', '2026-06-01T08:01:00', 500)]);
  const day = days['2026-06-01'];
  assert.equal('workouts' in day, false);
  assert.equal('hrv' in day, false);
  assert.equal('sleep_hours' in day, false);
  assert.notDeepEqual(day.workouts, []);
});

test('an empty sample list produces no days at all', () => {
  assert.deepEqual(foldDay([]), {});
});

test('the same sample produces the same dedupe key, and different samples do not collide', () => {
  const sampleA: QuantitySample = { uuid: 'abc-1', startDate: new Date('2026-06-01T08:00:00'), endDate: new Date('2026-06-01T08:01:00'), value: 1000 };
  const obsA1 = sampleToObservation(STEPS, sampleA);
  const obsA2 = sampleToObservation(STEPS, { ...sampleA });
  assert.equal(obsA1.dedupe_key, obsA2.dedupe_key);

  const sampleB: QuantitySample = { uuid: 'abc-2', startDate: new Date('2026-06-01T09:00:00'), endDate: new Date('2026-06-01T09:01:00'), value: 400 };
  const obsB = sampleToObservation(STEPS, sampleB);
  assert.notEqual(obsA1.dedupe_key, obsB.dedupe_key);

  // No uuid: falls back to the start time, so the same reading twice still
  // produces the same key.
  const noUuid: QuantitySample = { startDate: new Date('2026-06-01T10:00:00'), endDate: new Date('2026-06-01T10:01:00'), value: 200 };
  const obsC1 = sampleToObservation(STEPS, noUuid);
  const obsC2 = sampleToObservation(STEPS, { ...noUuid });
  assert.equal(obsC1.dedupe_key, obsC2.dedupe_key);
});

test('an observation always carries a numeric value or text, never neither', () => {
  const quantityObs = sampleToObservation(HEART_RATE, {
    uuid: 'q1',
    startDate: new Date('2026-06-01T08:00:00'),
    endDate: new Date('2026-06-01T08:01:00'),
    value: 62,
  });
  assert.notEqual(quantityObs.value, null);

  const sleepObs = sampleToObservation(SLEEP_SPEC, {
    uuid: 's1',
    startDate: new Date('2026-06-01T23:00:00'),
    endDate: new Date('2026-06-02T00:00:00'),
    value: 4,
  });
  assert.equal(sleepObs.value, null);
  assert.notEqual(sleepObs.value_text, null);

  const workoutObs = sampleToObservation(WORKOUT_SPEC, {
    uuid: 'w1',
    startDate: new Date('2026-06-01T07:00:00'),
    endDate: new Date('2026-06-01T07:30:00'),
    workoutActivityType: 'HKWorkoutActivityTypeWalking',
  });
  assert.notEqual(workoutObs.value, null);
  assert.notEqual(workoutObs.value_text, null);

  for (const obs of [quantityObs, sleepObs, workoutObs]) {
    assert.ok(obs.value !== null || obs.value_text !== null);
  }
});

test('dedupe key is namespaced by metric so two metrics on the same sample time never collide', () => {
  const at = { startDate: new Date('2026-06-01T08:00:00'), endDate: new Date('2026-06-01T08:01:00') };
  const steps = sampleToObservation(STEPS, { ...at, value: 100 });
  const heartRate = sampleToObservation(HEART_RATE, { ...at, value: 60 });
  assert.notEqual(steps.dedupe_key, heartRate.dedupe_key);
});
