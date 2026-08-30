// Pattern — a Relationship or Change demonstrating sufficient recurrence,
// temporal consistency, persistence/stability, adequate data, and a
// checked alternative explanation. See spec §1.7 and §0. Deliberately
// domain-agnostic and reusable: this file knows nothing about sleep,
// energy, or mood specifically — callers translate their own domain data
// into RelationshipInstance[] first.
//
// PATTERN_MIN_RECURRING_WINDOWS is an explicit, configurable MVP
// operational hypothesis — NOT a universal scientific rule — per the
// approved amendment to docs/specs/ciatta-semantic-refactor-spec-v1.md.
// It is meant to be revisited once real usage data exists, not treated as
// settled science.
import { strengthForConfidence, type Strength } from './cycleAnalysis.ts';
import { CONFIDENCE_LABEL } from './decay.ts';

export const PATTERN_MIN_RECURRING_WINDOWS = 3;
export const PATTERN_THRESHOLD_VERSION = 'mvp-recurrence-3-v1';

export interface RelationshipInstance {
  windowLabel: string;
  confirms: boolean;
}

export interface PatternEvaluation {
  qualifies: boolean;
  recurrenceCount: number;
  windowCountRequired: number;
  stableUnderRemoval: boolean;
  alternativeExplanationChecked: boolean;
  alternativeExplanationRuledOut: boolean;
  thresholdVersion: string;
}

/**
 * Never promotes from correlation alone: requires the relationship to
 * confirm across >= PATTERN_MIN_RECURRING_WINDOWS independent windows,
 * remain at or above that same bar if any single confirming window is
 * removed (a coarse but real stability check), and an alternative
 * explanation to have been actively checked and ruled out by the caller.
 * Any one criterion failing means no Pattern — the caller keeps whatever
 * Relationship/Change it already had.
 */
export function evaluatePattern(
  instances: RelationshipInstance[],
  alternativeExplanationRuledOut: boolean
): PatternEvaluation {
  const recurrenceCount = instances.filter((i) => i.confirms).length;
  const meetsRecurrence = recurrenceCount >= PATTERN_MIN_RECURRING_WINDOWS;
  // The true qualifying minimum is one MORE than PATTERN_MIN_RECURRING_
  // WINDOWS: removing the single strongest confirming window must still
  // leave the count at or above the raw recurrence bar, or the "stable
  // under removal" check would be vacuous (always true whenever
  // meetsRecurrence is true, checking nothing of its own). At exactly
  // PATTERN_MIN_RECURRING_WINDOWS confirming instances, removing one
  // drops below the bar, so stability correctly fails there.
  const stableUnderRemoval = recurrenceCount - 1 >= PATTERN_MIN_RECURRING_WINDOWS;

  const qualifies = meetsRecurrence && stableUnderRemoval && alternativeExplanationRuledOut;

  return {
    qualifies,
    recurrenceCount,
    windowCountRequired: PATTERN_MIN_RECURRING_WINDOWS,
    stableUnderRemoval,
    alternativeExplanationChecked: true,
    alternativeExplanationRuledOut,
    thresholdVersion: PATTERN_THRESHOLD_VERSION,
  };
}

// Pattern confidence -- derived only when a Pattern already qualifies
// (evaluatePattern's own gate, unchanged). Reuses the same
// strengthForConfidence()/CONFIDENCE_LABEL machinery every other stage
// uses, scaled against how far recurrenceCount clears the true
// qualifying minimum -- PATTERN_CONFIDENCE_RECURRENCE_CAP is an explicit,
// configurable MVP hypothesis for that scaling, NOT a universal
// scientific rule, same status as PATTERN_MIN_RECURRING_WINDOWS itself.
export const PATTERN_CONFIDENCE_RECURRENCE_CAP = 8;

export interface PatternConfidence {
  value: number;
  tier: Strength;
  label: string;
}

/**
 * The single source of truth for a Pattern's confidence -- both the
 * numeric `value` and its derived `tier`/`label` come from this one
 * calculation. A caller that needs the numeric confidence (e.g. to store
 * alongside the label) MUST read `.value` from this function's result,
 * never re-derive `Math.min(1, recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP)`
 * separately -- two independent copies of the same formula would risk
 * silently diverging if either one's shape ever changes, producing a
 * stored numeric/label pair that disagree with each other.
 */
export function patternConfidence(recurrenceCount: number): PatternConfidence {
  const value = Math.min(1, recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP);
  const tier = strengthForConfidence(value);
  return { value, tier, label: CONFIDENCE_LABEL[tier] };
}
