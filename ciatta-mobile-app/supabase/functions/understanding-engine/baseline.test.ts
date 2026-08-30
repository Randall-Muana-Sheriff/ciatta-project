import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeNightlySleepBaseline, BASELINE_MIN_SAMPLE } from './baseline.ts';
import type { FeatureRecord } from './feature.ts';

function feature(windowEnd: string, value: number): FeatureRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: windowEnd,
    windowEnd,
    observationIds: [],
    calculationVersion: 'nightly-sleep-minutes-v1',
  };
}

Deno.test('computeNightlySleepBaseline: ineligible below BASELINE_MIN_SAMPLE', () => {
  const features = Array.from({ length: BASELINE_MIN_SAMPLE - 1 }, (_, i) =>
    feature(`2026-08-${String(i + 1).padStart(2, '0')}`, 400)
  );
  const baseline = computeNightlySleepBaseline(features);
  assertEquals(baseline.eligible, false);
  assertEquals(baseline.sampleSize, BASELINE_MIN_SAMPLE - 1);
});

Deno.test('computeNightlySleepBaseline: median of an eligible sample', () => {
  const values = [380, 400, 420, 390, 410, 405, 395, 415, 385, 400, 402, 398, 407, 393];
  assertEquals(values.length, BASELINE_MIN_SAMPLE);
  const features = values.map((v, i) => feature(`2026-08-${String(i + 1).padStart(2, '0')}`, v));
  const baseline = computeNightlySleepBaseline(features);
  assertEquals(baseline.eligible, true);
  assertEquals(baseline.sampleSize, BASELINE_MIN_SAMPLE);
  // Sorted: 380,385,390,393,395,398,400,400,402,405,407,410,415,420 (14
  // values, even count) -> median is the average of the two middle
  // values (index 6 and 7): (400 + 400) / 2 = 400.
  assertEquals(baseline.value, 400);
});
