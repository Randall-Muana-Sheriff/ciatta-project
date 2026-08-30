// Evidence (new, later-pipeline sense) — information judged sufficiently
// valid and relevant to support a specific Finding. See spec §1.8. This
// module produces only the ledger CONTENT (quality, provenance reasoning,
// language boundaries, sufficiency verdict) — the caller
// (sleepDurationSlice.ts) attaches the actual foreign-key ids
// (feature/baseline/change_event/relationship/pattern) once those rows
// have real database ids, keeping this function pure and independently
// testable.
//
// PROVISIONAL: this module's flat FindingEvidenceContent shape is an MVP
// shortcut for one vertical slice, not the final Evidence Ledger
// architecture. A dedicated Evidence Ledger design remains an open
// architecture decision (see docs/specs/ciatta-semantic-refactor-spec-v1.md
// §5, Approval Checkpoint item 8) and must be revisited before broader
// implementation or cutover — do not extend this module as if it were
// permanent, and do not let other modules depend on its exact field
// layout beyond the FindingEvidenceContent type itself.
import type { BaselineRecord } from './baseline.ts';

export const EVIDENCE_LEDGER_VERSION = 'sleep-slice-v1';

export interface FindingEvidenceContent {
  qualityFlags: string[];
  contradictoryEvidence: string | null;
  alternativeExplanations: string[];
  uncertainty: string | null;
  scientificBasis: string | null;
  permittedLanguage: string[];
  prohibitedLanguage: string[];
  sufficiencyVerdict: boolean;
  version: string;
}

/**
 * Sufficiency gate: an eligible Baseline and clean quality flags are the
 * floor. With no Baseline there is nothing to compare against, so there
 * is no Evidence, and therefore no Finding — this returns null rather
 * than a degraded guess.
 */
export function assembleSleepDurationEvidenceContent(
  baseline: BaselineRecord,
  qualityFlags: string[]
): FindingEvidenceContent | null {
  if (!baseline.eligible) return null;
  if (qualityFlags.includes('insufficient-data')) return null;

  return {
    qualityFlags,
    contradictoryEvidence: null,
    alternativeExplanations: [],
    uncertainty: baseline.sampleSize < 30 ? 'limited sample size' : null,
    scientificBasis: 'personal baseline comparison (median of prior nights)',
    permittedLanguage: ['average', 'typical', 'over time'],
    prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
    sufficiencyVerdict: true,
    version: EVIDENCE_LEDGER_VERSION,
  };
}
