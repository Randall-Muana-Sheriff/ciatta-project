// Finding — a specific supported statement produced from a defined
// Evidence set. See spec §1.9. Reuses cycleAnalysis.ts's own
// strengthForConfidence() for the confidence tier — same ladder, same
// meaning, no parallel scale invented for this new stage.
import { strengthForConfidence, type Strength } from './cycleAnalysis.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

// Matches sleepAnalysis.ts's own CONFIDENCE_SAMPLE_CAP_UNDERSTANDING.
export const FINDING_CONFIDENCE_SAMPLE_CAP = 30;

export interface FindingDraft {
  domain: 'sleep';
  featureType: 'nightly_sleep_minutes';
  statement: string;
  confidenceTier: Strength;
}

/**
 * Produces a Finding only when Evidence is sufficient — the caller has
 * already confirmed assembleSleepDurationEvidenceContent() didn't return
 * null. This function only ever describes what IS supported; when
 * evidence fails sufficiency, it returns null and the caller is
 * responsible for treating that as silence ("no finding"), never a
 * downgraded guess.
 */
export function produceSleepDurationFinding(
  evidence: FindingEvidenceContent,
  sampleSize: number,
  change: ChangeEventRecord | null
): FindingDraft | null {
  if (!evidence.sufficiencyVerdict) return null;

  const confidenceTier = strengthForConfidence(Math.min(1, sampleSize / FINDING_CONFIDENCE_SAMPLE_CAP));

  const statement =
    change && change.isMeaningful
      ? `Your nightly sleep has been running about ${Math.abs(Math.round(change.deviation))} minutes ${
          change.direction === 'down' ? 'below' : 'above'
        } your usual.`
      : 'Your nightly sleep has been close to your usual over this period.';

  return { domain: 'sleep', featureType: 'nightly_sleep_minutes', statement, confidenceTier };
}
