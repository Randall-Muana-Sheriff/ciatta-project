// Explanation — a bounded account of supporting evidence, reasoning,
// uncertainty, and limitations, generated on read from a Finding + its
// Evidence — never independently persisted. Answers the 8-point model
// from docs/specs/ciatta-semantic-refactor-spec-v1.md §1.13. Reuses
// decay.ts's CONFIDENCE_LABEL so the confidence wording here is always
// identical to the label the client already displays elsewhere.
import type { FindingDraft } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';
import type { ChangeEventRecord } from './changeEvent.ts';
import { CONFIDENCE_LABEL } from './decay.ts';

export interface Explanation {
  whatCiattaNoticed: string;
  supportingEvidence: string;
  whatChanged: string;
  relevantContext: string;
  relationshipOrPattern: string;
  confidenceStatement: string;
  whatCiattaDoesNotKnow: string;
  whatThisDoesNotMean: string;
}

export function explainSleepDurationFinding(
  finding: FindingDraft,
  evidence: FindingEvidenceContent,
  baseline: BaselineRecord,
  change: ChangeEventRecord | null,
  hasSupportedRelationship: boolean
): Explanation {
  return {
    whatCiattaNoticed: finding.statement,
    supportingEvidence: `Based on ${baseline.sampleSize} nights of sleep data.`,
    whatChanged: change
      ? `${change.isMeaningful ? 'A meaningful' : 'No meaningful'} change from your ${Math.round(
          baseline.value
        )}-minute usual.`
      : 'Not enough recent data to assess change.',
    relevantContext: evidence.scientificBasis ?? 'Compared against your own history, not a population average.',
    relationshipOrPattern: hasSupportedRelationship
      ? 'Connected to a supported relationship with another domain.'
      : 'No supported relationship or pattern is part of this finding.',
    confidenceStatement: `Ciatta is ${CONFIDENCE_LABEL[finding.confidenceTier]} in this.`,
    whatCiattaDoesNotKnow: evidence.uncertainty ?? 'No specific limitation noted beyond normal measurement uncertainty.',
    whatThisDoesNotMean: 'This is not a diagnosis and does not indicate a sleep disorder.',
  };
}
