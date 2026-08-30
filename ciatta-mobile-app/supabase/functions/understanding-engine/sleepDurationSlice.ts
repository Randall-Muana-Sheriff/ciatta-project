// Orchestrator for the Stage 1 vertical slice: Observation -> Feature ->
// Baseline -> Change -> Relationship -> Pattern -> Evidence -> Finding ->
// Ciatta Knowledge -> Confidence/Safety -> Experience/Silence, for
// exactly the 'sleep' domain and the 'nightly_sleep_minutes' Feature.
// Explanation (Task 10) is deliberately NOT part of this chain -- it is
// generated on read from a persisted Finding, never computed here at
// write time; see explanation.ts's own header comment. Additive only:
// writes exclusively to
// these new Stage 1 tables: features, baselines, change_events, patterns,
// finding_evidence, findings, ciatta_knowledge. It never touches
// understandings/understanding_history/evidence/relationships.
//
// NOTE: Pattern (Task 6) IS evaluated here -- hasSupportedRelationship
// reflects a real evaluatePattern() call -- and, as of Task 17, a
// qualifying Pattern (energy checked first, then mood) is persisted to
// `patterns` and linked via `finding_evidence.pattern_id`.
// `finding_evidence.relationship_id` stays null: this pipeline computes
// its own ad hoc monthly relationship instances and never writes to or
// reads from the legacy `relationships` table. Called
// from index.ts's processUser() in a try/catch-isolated call site so a
// failure here can never break the legacy path.
//
// PROVISIONAL: `finding_evidence` here is an MVP shortcut ledger for this
// one slice, not the final Evidence Ledger architecture -- see
// findingEvidence.ts's own header note and
// docs/specs/ciatta-semantic-refactor-spec-v1.md §5 (Approval Checkpoint
// item 8, still open).
import { computeNightlySleepMinutesFeatures, type FeatureRecord } from './feature.ts';
import { computeNightlySleepBaseline, type BaselineRecord } from './baseline.ts';
import { evaluateChange, type ChangeEventRecord } from './changeEvent.ts';
import {
  evaluatePattern,
  patternConfidence,
  PATTERN_CONFIDENCE_RECURRENCE_CAP,
  type PatternEvaluation,
  type RelationshipInstance,
} from './patternEvaluation.ts';
import { assembleSleepDurationEvidenceContent, type FindingEvidenceContent } from './findingEvidence.ts';
import { produceSleepDurationFinding, type FindingDraft } from './finding.ts';
import { assessSafety, type SafetyTier } from './safety.ts';
// explanation.ts is deliberately NOT imported here: Explanation (Task 10)
// is generated on read, from a persisted Finding + its Evidence, never
// computed eagerly at write time -- see explanation.ts's own header
// comment and spec §1.13. This orchestrator only ever writes; a future
// read-path (a client query or a Task 14+ API) is what calls
// explainSleepDurationFinding(), not this file.
import { selectForExperience, type ExperienceOutcome } from './experienceSelection.ts';
import { evaluateRetention, type PriorFindingRun } from './ciattaKnowledge.ts';
import { analyzeSleepRatingRelationship, type SleepObservation } from './sleepAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

export interface SleepDurationPipelineResult {
  outcome: ExperienceOutcome;
  feature: FeatureRecord | null;
  baseline: BaselineRecord | null;
  change: ChangeEventRecord | null;
  evidence: FindingEvidenceContent | null;
  finding: FindingDraft | null;
  safetyTier: SafetyTier | null;
  hasSupportedRelationship: boolean;
  energyPattern: PatternEvaluation | null;
  moodPattern: PatternEvaluation | null;
}

/** Buckets sleep + rating observations by calendar month so
 * analyzeSleepRatingRelationship() can be evaluated once per independent
 * window — the minimum needed for Pattern's recurrence check to mean
 * anything (a single all-history run is one window, never enough to
 * demonstrate recurrence on its own). */
function monthlyRelationshipInstances(
  sleepObservations: SleepObservation[],
  ratingObservations: RatingObservation[]
): RelationshipInstance[] {
  const months = new Set<string>();
  for (const obs of sleepObservations) months.add(obs.endTime.slice(0, 7));

  return [...months].sort().map((windowLabel) => {
    const monthSleep = sleepObservations.filter((o) => o.endTime.slice(0, 7) === windowLabel);
    const monthRatings = ratingObservations.filter((o) => o.recordedAt.slice(0, 7) === windowLabel);
    const result = analyzeSleepRatingRelationship(monthSleep, monthRatings);
    return { windowLabel, confirms: result.eligible && result.confirms };
  });
}

/**
 * A deliberately minimal, honest alternative-explanation check for this
 * one slice — NOT a full leave-one-out or statistical-outlier procedure.
 * It rules out only the single most literal reading of "the whole effect
 * is really just one especially strong month driving the average": if
 * only one month ever confirmed, that one month IS the entire case for
 * the relationship, so the alternative explanation cannot be ruled out.
 * Requiring at least two independently confirming months is the smallest
 * change that makes this a real check rather than "did anything confirm
 * at all" — which is already covered by evaluatePattern()'s own,
 * separate, stricter recurrence gate (a true minimum of 4 confirming
 * instances) and stability-under-removal check. This function's job is
 * narrower and only needs to not be trivially true. A more rigorous
 * check (e.g. holding while removing the single strongest confirming
 * month, weighted by rating-delta magnitude) is a real enhancement for a
 * later stage, not this vertical slice — see spec §1.7's "what it is
 * NOT": a Pattern from this check is still an MVP operational finding,
 * not a settled causal claim, regardless of how this function evolves.
 */
export function checkAlternativeExplanation(instances: RelationshipInstance[]): boolean {
  const confirming = instances.filter((i) => i.confirms);
  return confirming.length >= 2;
}

/** Pure decision core -- no I/O. See Task 13's test note for why this is
 * split from the async, Supabase-aware runSleepDurationSlice() below. */
export function buildSleepDurationPipelineResult(
  sleepObservations: SleepObservation[],
  energyObservations: RatingObservation[],
  moodObservations: RatingObservation[],
  _now: Date = new Date()
): SleepDurationPipelineResult {
  const features = computeNightlySleepMinutesFeatures(sleepObservations);
  const latestFeature = features[features.length - 1] ?? null;
  const baseline = computeNightlySleepBaseline(features);

  if (!latestFeature || !baseline.eligible) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline: baseline.eligible ? baseline : null,
      change: null,
      evidence: null,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
      energyPattern: null,
      moodPattern: null,
    };
  }

  const change = evaluateChange(latestFeature, baseline);
  const qualityFlags = features.length === 0 ? ['insufficient-data'] : [];
  const evidence = assembleSleepDurationEvidenceContent(baseline, qualityFlags);

  if (!evidence) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline,
      change,
      evidence: null,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
      energyPattern: null,
      moodPattern: null,
    };
  }

  const finding = produceSleepDurationFinding(evidence, baseline.sampleSize, change);

  if (!finding) {
    return {
      outcome: 'no_finding',
      feature: latestFeature,
      baseline,
      change,
      evidence,
      finding: null,
      safetyTier: null,
      hasSupportedRelationship: false,
      energyPattern: null,
      moodPattern: null,
    };
  }

  const energyInstances = monthlyRelationshipInstances(sleepObservations, energyObservations);
  const moodInstances = monthlyRelationshipInstances(sleepObservations, moodObservations);
  const energyPattern = evaluatePattern(energyInstances, checkAlternativeExplanation(energyInstances));
  const moodPattern = evaluatePattern(moodInstances, checkAlternativeExplanation(moodInstances));
  const hasSupportedRelationship = energyPattern.qualifies || moodPattern.qualifies;

  const safetyTier = assessSafety('sleep', finding.statement, evidence.prohibitedLanguage);

  const outcome = selectForExperience({
    hasFinding: true,
    confidenceTier: finding.confidenceTier,
    safetyTier,
    isMeaningfulChange: change?.isMeaningful ?? false,
  });

  return {
    outcome,
    feature: latestFeature,
    baseline,
    change,
    evidence,
    finding,
    safetyTier,
    hasSupportedRelationship,
    energyPattern,
    moodPattern,
  };
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface SleepDurationSliceResult {
  outcome: ExperienceOutcome;
  findingId?: string;
  knowledgeRetained?: boolean;
}

/**
 * Async, Supabase-aware wrapper: runs the pure pipeline above, then
 * writes to the Stage 1 tables only. Never writes to, reads for the
 * purpose of overwriting, or deletes from any legacy table. Errors are
 * the caller's (index.ts's) responsibility to isolate via try/catch --
 * this function does not swallow them itself, so tests can see real
 * failures.
 */
export async function runSleepDurationSlice(
  supabase: SupabaseClient,
  userId: string,
  sleepObservations: SleepObservation[],
  energyObservations: RatingObservation[],
  moodObservations: RatingObservation[],
  now: Date = new Date()
): Promise<SleepDurationSliceResult> {
  const result = buildSleepDurationPipelineResult(sleepObservations, energyObservations, moodObservations, now);

  if (!result.feature || !result.baseline) return { outcome: result.outcome };

  const { data: featureRow, error: featureError } = await supabase
    .from('features')
    .upsert(
      {
        user_id: userId,
        domain: result.feature.domain,
        feature_type: result.feature.featureType,
        value: result.feature.value,
        window_start: result.feature.windowStart,
        window_end: result.feature.windowEnd,
        observation_ids: result.feature.observationIds,
        calculation_version: result.feature.calculationVersion,
      },
      { onConflict: 'user_id,domain,feature_type,window_end' }
    )
    .select('id')
    .single();
  if (featureError) throw featureError;

  const { data: baselineRow, error: baselineError } = await supabase
    .from('baselines')
    .upsert(
      {
        user_id: userId,
        domain: result.baseline.domain,
        feature_type: result.baseline.featureType,
        value: result.baseline.value,
        window_start: result.baseline.windowStart,
        window_end: result.baseline.windowEnd,
        sample_size: result.baseline.sampleSize,
        eligible: result.baseline.eligible,
        calculation_version: result.baseline.calculationVersion,
      },
      { onConflict: 'user_id,domain,feature_type,window_end' }
    )
    .select('id')
    .single();
  if (baselineError) throw baselineError;

  if (!result.evidence || !result.finding || !result.safetyTier) {
    return { outcome: result.outcome };
  }

  let changeEventId: string | null = null;
  if (result.change) {
    const { data: changeRow, error: changeError } = await supabase
      .from('change_events')
      .upsert(
        {
          user_id: userId,
          domain: 'sleep',
          feature_type: 'nightly_sleep_minutes',
          feature_id: featureRow.id,
          baseline_id: baselineRow.id,
          observed_value: result.change.observedValue,
          baseline_value: result.change.baselineValue,
          deviation: result.change.deviation,
          direction: result.change.direction,
          threshold_used: result.change.thresholdUsed,
          is_meaningful: result.change.isMeaningful,
        },
        { onConflict: 'user_id,domain,feature_type,feature_id' }
      )
      .select('id')
      .single();
    if (changeError) throw changeError;
    changeEventId = changeRow.id;
  }

  let patternId: string | null = null;
  const qualifyingPattern = result.energyPattern?.qualifies
    ? { pattern: result.energyPattern, toDomain: 'energy' as const }
    : result.moodPattern?.qualifies
      ? { pattern: result.moodPattern, toDomain: 'mood' as const }
      : null;

  if (qualifyingPattern) {
    const confidence = patternConfidence(qualifyingPattern.pattern.recurrenceCount);
    const { data: patternRow, error: patternError } = await supabase
      .from('patterns')
      .upsert(
        {
          user_id: userId,
          domain: 'sleep',
          to_domain: qualifyingPattern.toDomain,
          pattern_type: 'sleep_duration_vs_rating',
          recurrence_count: qualifyingPattern.pattern.recurrenceCount,
          window_count_required: qualifyingPattern.pattern.windowCountRequired,
          stable_under_removal: qualifyingPattern.pattern.stableUnderRemoval,
          alternative_explanation_checked: qualifyingPattern.pattern.alternativeExplanationChecked,
          alternative_explanation_ruled_out: qualifyingPattern.pattern.alternativeExplanationRuledOut,
          confidence: Math.min(1, qualifyingPattern.pattern.recurrenceCount / PATTERN_CONFIDENCE_RECURRENCE_CAP),
          confidence_label: confidence.label,
          threshold_version: qualifyingPattern.pattern.thresholdVersion,
        },
        { onConflict: 'user_id,domain,to_domain,pattern_type' }
      )
      .select('id')
      .single();
    if (patternError) throw patternError;
    patternId = patternRow.id;
  }

  const { data: evidenceRow, error: evidenceError } = await supabase
    .from('finding_evidence')
    .upsert(
      {
        user_id: userId,
        domain: 'sleep',
        feature_ids: [featureRow.id],
        baseline_id: baselineRow.id,
        change_event_id: changeEventId,
        pattern_id: patternId,
        quality_flags: result.evidence.qualityFlags,
        contradictory_evidence: result.evidence.contradictoryEvidence,
        alternative_explanations: result.evidence.alternativeExplanations,
        uncertainty: result.evidence.uncertainty,
        scientific_basis: result.evidence.scientificBasis,
        permitted_language: result.evidence.permittedLanguage,
        prohibited_language: result.evidence.prohibitedLanguage,
        sufficiency_verdict: result.evidence.sufficiencyVerdict,
        version: result.evidence.version,
      },
      { onConflict: 'user_id,domain,baseline_id' }
    )
    .select('id')
    .single();
  if (evidenceError) throw evidenceError;

  // Prior runs MUST be read from `findings` (written on every run), never
  // from `ciatta_knowledge` itself. `ciatta_knowledge` is only ever
  // written a few lines below, gated on retention.shouldRetain -- sourcing
  // priorRuns from it would make the gate unsatisfiable forever (no row
  // exists to read until after the gate has already passed once, and it
  // can never pass without a prior row to read). Read BEFORE inserting
  // this run's own findings row, so this query only ever sees genuinely
  // prior runs, never the one this call is about to write.
  const { data: priorFindingRow } = await supabase
    .from('findings')
    .select('confidence_tier')
    .eq('user_id', userId)
    .eq('domain', 'sleep')
    .eq('feature_type', 'nightly_sleep_minutes')
    .order('produced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: findingRow, error: findingError } = await supabase
    .from('findings')
    .upsert(
      {
        user_id: userId,
        domain: 'sleep',
        feature_type: 'nightly_sleep_minutes',
        statement: result.finding.statement,
        evidence_id: evidenceRow.id,
        confidence_tier: result.finding.confidenceTier,
        safety_tier: result.safetyTier,
      },
      { onConflict: 'user_id,domain,feature_type,evidence_id' }
    )
    .select('id')
    .single();
  if (findingError) throw findingError;

  // `contradicted` always false here: this slice has no mechanism yet
  // for marking a prior run contradicted (that would require comparing
  // this run's Change/Finding against the prior one's, not just its
  // confidence tier) -- a known, deliberate MVP simplification, not a
  // silent omission. `statement` is unused by evaluateRetention itself,
  // kept empty rather than duplicating a query for a field nothing reads.
  const priorRuns: PriorFindingRun[] = priorFindingRow
    ? [{ confidenceTier: priorFindingRow.confidence_tier, statement: '', contradicted: false }]
    : [];
  const retention = evaluateRetention(result.finding.confidenceTier, priorRuns);

  if (retention.shouldRetain) {
    const { error: knowledgeError } = await supabase.from('ciatta_knowledge').upsert(
      {
        user_id: userId,
        domain: 'sleep',
        feature_type: 'nightly_sleep_minutes',
        statement: result.finding.statement,
        finding_ids: [findingRow.id],
        confidence_tier: result.finding.confidenceTier,
        safety_tier: result.safetyTier,
        retention_rule_version: retention.ruleVersion,
        last_reconfirmed_at: now.toISOString(),
      },
      { onConflict: 'user_id,domain,feature_type' }
    );
    if (knowledgeError) throw knowledgeError;
  }

  return { outcome: result.outcome, findingId: findingRow.id, knowledgeRetained: retention.shouldRetain };
}
