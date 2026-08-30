// Ciatta Knowledge — information established sufficiently for its
// intended purpose and permitted to be retained/reused. See spec §1.10
// and §2.1. KNOWLEDGE_MIN_REPRODUCED_RUNS is an explicit, configurable
// MVP provisional retention policy — NOT a fixed universal rule — per
// the approved amendment to docs/specs/ciatta-semantic-refactor-spec-v1.md.
import type { Strength } from './cycleAnalysis.ts';

export const KNOWLEDGE_MIN_REPRODUCED_RUNS = 2;
export const KNOWLEDGE_RETENTION_RULE_VERSION = 'mvp-2-run-v1';

const RETENTION_CONFIDENCE: Strength[] = ['strong', 'very-strong'];

export interface PriorFindingRun {
  confidenceTier: Strength;
  statement: string;
  contradicted: boolean;
}

export interface RetentionDecision {
  shouldRetain: boolean;
  reproducedRuns: number;
  runsRequired: number;
  ruleVersion: string;
}

/**
 * Retains only when BOTH: (a) the current run's own confidence
 * independently qualifies (strong-or-better) -- a currently-weak or
 * currently-contradicted signal never retains no matter how strong its
 * prior track record was, matching spec 1.10's revisability requirement
 * ("if supporting evidence weakens... Knowledge updates or withdraws,
 * never stays stale") -- AND (b) the current Finding plus its prior runs
 * together show >= KNOWLEDGE_MIN_REPRODUCED_RUNS consistent,
 * non-contradicted, strong-or-better-confidence occurrences. A single
 * strong Finding is never enough on its own -- most Findings should
 * never reach retention.
 */
export function evaluateRetention(
  currentConfidence: Strength,
  priorRuns: PriorFindingRun[]
): RetentionDecision {
  const qualifyingPriorRuns = priorRuns.filter(
    (r) => !r.contradicted && RETENTION_CONFIDENCE.includes(r.confidenceTier)
  ).length;
  const currentQualifies = RETENTION_CONFIDENCE.includes(currentConfidence);
  const reproducedRuns = qualifyingPriorRuns + (currentQualifies ? 1 : 0);

  return {
    shouldRetain: currentQualifies && reproducedRuns >= KNOWLEDGE_MIN_REPRODUCED_RUNS,
    reproducedRuns,
    runsRequired: KNOWLEDGE_MIN_REPRODUCED_RUNS,
    ruleVersion: KNOWLEDGE_RETENTION_RULE_VERSION,
  };
}
