import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { evaluateChange, CHANGE_THRESHOLD_MINUTES } from './changeEvent.ts';
import type { FeatureRecord } from './feature.ts';
import type { BaselineRecord } from './baseline.ts';

function feature(value: number): FeatureRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: '2026-08-20',
    windowEnd: '2026-08-20',
    observationIds: [],
    calculationVersion: 'nightly-sleep-minutes-v1',
  };
}

function baseline(value: number, eligible = true): BaselineRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: '2026-08-01',
    windowEnd: '2026-08-19',
    sampleSize: 14,
    eligible,
    calculationVersion: 'median-nightly-sleep-v1',
  };
}

Deno.test('evaluateChange: returns null when baseline is ineligible', () => {
  assertEquals(evaluateChange(feature(300), baseline(400, false)), null);
});

Deno.test('evaluateChange: deviation below threshold is not meaningful', () => {
  const change = evaluateChange(feature(380), baseline(400));
  assertEquals(change?.isMeaningful, false);
  assertEquals(change?.direction, 'down');
  assertEquals(change?.thresholdUsed, CHANGE_THRESHOLD_MINUTES);
});

Deno.test('evaluateChange: deviation at or above threshold is meaningful', () => {
  const change = evaluateChange(feature(300), baseline(400));
  assertEquals(change?.isMeaningful, true);
  assertEquals(change?.deviation, -100);
  assertEquals(change?.direction, 'down');
});
