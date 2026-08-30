// Feature — a reproducible value calculated from one or more
// Observations. See docs/specs/ciatta-semantic-refactor-spec-v1.md §1.2.
// This is Stage 1's only Feature: nightly sleep duration. Reuses
// sleepAnalysis.ts's own night-bucketing (nightKey, isAsleepStage,
// nightlySleepMinutes) rather than re-deriving it, so this Feature's
// nights line up exactly with what the legacy analyzeSleep() already
// computes — only observation-level traceability is new here.
import { nightKey, isAsleepStage, nightlySleepMinutes, type SleepObservation } from './sleepAnalysis.ts';

export const FEATURE_CALCULATION_VERSION = 'nightly-sleep-minutes-v1';

export interface FeatureRecord {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  value: number;
  windowStart: string;
  windowEnd: string;
  observationIds: string[];
  calculationVersion: string;
}

/** One Feature record per night present in `observations` — pure,
 * reproducible, no I/O. Mirrors nightlySleepMinutes()'s own filtering
 * exactly (segments only, excluding in_bed/awake stages) so the value
 * and the observationIds it cites always agree. */
export function computeNightlySleepMinutesFeatures(
  observations: SleepObservation[]
): FeatureRecord[] {
  const byNight = nightlySleepMinutes(observations);
  const idsByNight = new Map<string, string[]>();

  for (const obs of observations) {
    if (obs.type === 'sleep_segment' && !isAsleepStage(obs.stage)) continue;
    const key = nightKey(obs.endTime);
    const ids = idsByNight.get(key) ?? [];
    ids.push(obs.id);
    idsByNight.set(key, ids);
  }

  return [...byNight.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([night, minutes]) => ({
      domain: 'sleep' as const,
      featureType: 'nightly_sleep_minutes' as const,
      value: minutes,
      windowStart: night,
      windowEnd: night,
      observationIds: idsByNight.get(night) ?? [],
      calculationVersion: FEATURE_CALCULATION_VERSION,
    }));
}
