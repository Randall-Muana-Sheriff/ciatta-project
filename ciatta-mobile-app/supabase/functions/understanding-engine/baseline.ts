// Baseline — an individual's reference representation for a Feature,
// from an appropriate comparison window. See spec §1.4. Stage 1's
// calculation is deliberately identical to sleepAnalysis.ts's own
// `median(nights)` baseline — this file persists and versions it instead
// of recomputing it inline every run.
import { median } from './dailyMetricRatingRelationship.ts';
import type { FeatureRecord } from './feature.ts';

export const BASELINE_CALCULATION_VERSION = 'median-nightly-sleep-v1';
// Matches sleepAnalysis.ts's own BASELINE_MIN_NIGHTS exactly — the two
// must not silently drift apart while both pipelines run side by side.
export const BASELINE_MIN_SAMPLE = 14;

export interface BaselineRecord {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  value: number;
  windowStart: string;
  windowEnd: string;
  sampleSize: number;
  eligible: boolean;
  calculationVersion: string;
}

export function computeNightlySleepBaseline(features: FeatureRecord[]): BaselineRecord {
  const sorted = [...features].sort((a, b) => a.windowEnd.localeCompare(b.windowEnd));
  const sampleSize = sorted.length;
  const eligible = sampleSize >= BASELINE_MIN_SAMPLE;
  const value = eligible ? median(sorted.map((f) => f.value)) : 0;

  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value,
    windowStart: sorted[0]?.windowEnd ?? '',
    windowEnd: sorted[sorted.length - 1]?.windowEnd ?? '',
    sampleSize,
    eligible,
    calculationVersion: BASELINE_CALCULATION_VERSION,
  };
}
