// Change — difference from an appropriate personal reference (Baseline).
// See spec §1.5. CHANGE_THRESHOLD_MINUTES mirrors sleepAnalysis.ts's own
// SHORT_NIGHT_THRESHOLD_MINUTES exactly, documented here as this one
// Feature's provisional significance rule — not a universal claim about
// what counts as meaningful change for every Feature.
import type { FeatureRecord } from './feature.ts';
import type { BaselineRecord } from './baseline.ts';

export const CHANGE_THRESHOLD_MINUTES = 45;

export interface ChangeEventRecord {
  observedValue: number;
  baselineValue: number;
  deviation: number;
  direction: 'up' | 'down' | 'flat';
  thresholdUsed: number;
  isMeaningful: boolean;
}

/** Gate: no eligible Baseline, no Change — never falls back to comparing
 * against an ineligible/absent reference. */
export function evaluateChange(
  latestFeature: FeatureRecord,
  baseline: BaselineRecord
): ChangeEventRecord | null {
  if (!baseline.eligible) return null;

  const deviation = latestFeature.value - baseline.value;
  const direction: 'up' | 'down' | 'flat' = deviation > 0 ? 'up' : deviation < 0 ? 'down' : 'flat';
  const isMeaningful = Math.abs(deviation) >= CHANGE_THRESHOLD_MINUTES;

  return {
    observedValue: latestFeature.value,
    baselineValue: baseline.value,
    deviation,
    direction,
    thresholdUsed: CHANGE_THRESHOLD_MINUTES,
    isMeaningful,
  };
}
