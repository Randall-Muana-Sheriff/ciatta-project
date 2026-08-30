import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeNightlySleepMinutesFeatures, FEATURE_CALCULATION_VERSION } from './feature.ts';
import type { SleepObservation } from './sleepAnalysis.ts';

Deno.test('computeNightlySleepMinutesFeatures: one night, one segment', () => {
  const obs: SleepObservation[] = [
    {
      id: 'obs-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T06:00:00Z',
      durationMinutes: 420,
      stage: 'asleep',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 1);
  assertEquals(features[0].value, 420);
  assertEquals(features[0].domain, 'sleep');
  assertEquals(features[0].featureType, 'nightly_sleep_minutes');
  assertEquals(features[0].observationIds, ['obs-1']);
  assertEquals(features[0].calculationVersion, FEATURE_CALCULATION_VERSION);
});

Deno.test('computeNightlySleepMinutesFeatures: excludes in_bed/awake segments from both value and observationIds', () => {
  const obs: SleepObservation[] = [
    {
      id: 'asleep-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T05:00:00Z',
      durationMinutes: 360,
      stage: 'asleep',
    },
    {
      id: 'awake-1',
      type: 'sleep_segment',
      startTime: '2026-08-02T05:00:00Z',
      endTime: '2026-08-02T05:30:00Z',
      durationMinutes: 30,
      stage: 'awake',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 1);
  assertEquals(features[0].value, 360);
  assertEquals(features[0].observationIds, ['asleep-1']);
});

Deno.test('computeNightlySleepMinutesFeatures: two separate nights produce two Features', () => {
  const obs: SleepObservation[] = [
    {
      id: 'night-1',
      type: 'sleep_segment',
      startTime: '2026-08-01T23:00:00Z',
      endTime: '2026-08-02T06:00:00Z',
      durationMinutes: 420,
      stage: 'asleep',
    },
    {
      id: 'night-2',
      type: 'sleep_segment',
      startTime: '2026-08-02T23:00:00Z',
      endTime: '2026-08-03T05:30:00Z',
      durationMinutes: 390,
      stage: 'asleep',
    },
  ];
  const features = computeNightlySleepMinutesFeatures(obs);
  assertEquals(features.length, 2);
});
