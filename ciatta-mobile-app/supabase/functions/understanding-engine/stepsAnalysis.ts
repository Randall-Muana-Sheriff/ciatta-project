/**
 * Pure steps analysis: no Deno/Supabase imports, same testing approach as
 * cycleAnalysis.ts and sleepAnalysis.ts. Two things live here:
 *
 * 1. A standalone 'recovery' Understanding — filed as recovery rather than
 *    energy specifically so it can cleanly relate *to* energy/mood via a
 *    Relationship the same way cycle and sleep do (filing it under
 *    'energy' would make a steps -> energy Relationship a nonsensical
 *    energy -> energy self-reference). Purely descriptive: there's no
 *    alternative hypothesis to confirm, so confidence scales with sample
 *    size alone. The copy is deliberately about steps, never about how the
 *    user feels — "how much you moved" is what's actually measured, not
 *    "your energy level," and conflating the two would be exactly the kind
 *    of overclaim this engine has avoided everywhere else.
 *
 * 2. A recovery -> {energy, mood} Relationship, built on the shared
 *    dailyMetricRatingRelationship primitive (steps sum same-day entries;
 *    HRV's version of this same pattern averages them instead, which is
 *    why aggregation stays per-module and only the classification/
 *    comparison logic is shared).
 */
import type { Strength } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';
import {
  median,
  analyzeDailyMetricRatingRelationship,
  buildDailyMetricRatingDiscovery,
  type DailyMetricDay,
  type DailyMetricRatingRelationshipResult,
  type DailyMetricDiscoveryDraft,
} from './dailyMetricRatingRelationship.ts';
import { readingsEvidenceSummary, type UnderstandingFacets } from './understandingFacets.ts';
import {
  changeFromNotableCount,
  CONFIDENCE_LABEL,
  stillLearningForStance,
  strengthForStance,
  volumeStance,
  type PatternStance,
} from './intelligenceIntegrity.ts';

export interface StepsObservation {
  id: string;
  recordedAt: string;
  count: number;
}

const BASELINE_MIN_DAYS = 14;
// A day counts as "low activity" if it falls well below this person's own
// median — a relative threshold, not a fixed step count, since a
// meaningful "low" day for someone who averages 3,000 steps looks nothing
// like one for someone who averages 15,000.
const LOW_ACTIVITY_RATIO = 0.5;
const CONFIDENCE_SAMPLE_CAP = 30;

export function dailyStepTotals(observations: StepsObservation[]): Map<string, DailyMetricDay> {
  const byDay = new Map<string, DailyMetricDay>();
  for (const obs of observations) {
    const key = new Date(obs.recordedAt).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { value: 0, ids: [] };
    entry.value += obs.count;
    entry.ids.push(obs.id);
    byDay.set(key, entry);
  }
  return byDay;
}

export interface StepsUnderstandingResult {
  totalDays: number;
  avgSteps: number;
  medianSteps: number;
  lowActivityDays: number;
  lowActivityRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeSteps(observations: StepsObservation[]): StepsUnderstandingResult {
  const byDay = dailyStepTotals(observations);
  const days = [...byDay.values()];
  const totalDays = days.length;

  const observationIds = days.flatMap((d) => d.ids);
  if (totalDays < BASELINE_MIN_DAYS) {
    return {
      totalDays,
      avgSteps: 0,
      medianSteps: 0,
      lowActivityDays: 0,
      lowActivityRate: 0,
      confidence: Math.min(1, totalDays / CONFIDENCE_SAMPLE_CAP),
      eligible: false,
      observationIds,
    };
  }

  const totals = days.map((d) => d.value);
  const baseline = median(totals);
  const avgSteps = totals.reduce((a, b) => a + b, 0) / totalDays;
  const lowActivityDays = totals.filter((t) => t < baseline * LOW_ACTIVITY_RATIO).length;

  return {
    totalDays,
    avgSteps,
    medianSteps: baseline,
    lowActivityDays,
    lowActivityRate: lowActivityDays / totalDays,
    confidence: Math.min(1, totalDays / CONFIDENCE_SAMPLE_CAP),
    eligible: true,
    observationIds,
  };
}

export interface StepsUnderstandingDraft extends UnderstandingFacets {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
  stillLearning: string[];
  stance: PatternStance;
}

export function buildStepsUnderstanding(
  result: StepsUnderstandingResult
): StepsUnderstandingDraft | null {
  const stance = volumeStance({
    sampleCount: result.totalDays,
    minSample: BASELINE_MIN_DAYS,
    notableCount: result.lowActivityDays,
  });
  if (stance === 'insufficient') return null;

  const strength = strengthForStance(result.confidence, stance);
  if (stance === 'early') {
    const seeing = `Ciatta has ${result.totalDays} days of movement so far. That is not enough yet to see your usual day.`;
    return {
      strength,
      narrative: seeing,
      seeing,
      confidenceLabel: CONFIDENCE_LABEL[strength],
      stillLearning: stillLearningForStance(stance, 'what your usual day of movement looks like'),
      stance,
      evidenceSummary: readingsEvidenceSummary(result.observationIds.length, strength),
      evidenceSignal: 'steps',
      baselineValue: null,
      baselineUnit: null,
      baselineWindowDays: result.totalDays,
      baselineSummary: null,
      changeDetected: false,
      changeSummary: null,
    };
  }

  const avgSteps = Math.round(result.avgSteps).toLocaleString('en-US');
  const medianSteps = Math.round(result.medianSteps).toLocaleString('en-US');
  const share =
    result.lowActivityDays <= 0
      ? null
      : `${result.lowActivityDays} of ${result.totalDays} days`;
  const seeing =
    stance === 'steady'
      ? `You average about ${avgSteps} steps a day. Recent days have been sitting close to that.`
      : `You average about ${avgSteps} steps a day. ${share} were notably less active than that.`;
  return {
    strength,
    narrative: seeing,
    seeing,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    stillLearning: stillLearningForStance(stance, 'whether quieter movement days keep showing up'),
    stance,
    evidenceSummary: readingsEvidenceSummary(result.observationIds.length, strength),
    evidenceSignal: 'steps',
    baselineValue: result.medianSteps,
    baselineUnit: 'count',
    baselineWindowDays: result.totalDays,
    baselineSummary: `Your usual day is about ${medianSteps} steps.`,
    ...changeFromNotableCount(result.lowActivityDays, result.totalDays, 'day'),
  };
}

export function analyzeStepsRatingRelationship(
  stepsObservations: StepsObservation[],
  ratingObservations: RatingObservation[]
): DailyMetricRatingRelationshipResult {
  return analyzeDailyMetricRatingRelationship(
    dailyStepTotals(stepsObservations),
    ratingObservations,
    BASELINE_MIN_DAYS,
    LOW_ACTIVITY_RATIO
  );
}

const STEPS_DISCOVERY_COPY = {
  lowDayLabel: 'low activity day',
  lowDayLabelPlural: 'low activity days',
  narrative: {
    energy: "Your energy tends to be lower the day after a low activity day.",
    mood: "Your mood tends to dip the day after a low activity day.",
  },
  suggestedNames: {
    energy: ['The Movement Effect', 'Activity Energy Link', 'The Rest Day Rebound'],
    mood: ['The Movement Mood Link', 'Motion and Mood', 'The Stillness Signal'],
  },
};

export function buildStepsRatingDiscovery(
  result: DailyMetricRatingRelationshipResult,
  toDomain: 'energy' | 'mood'
): DailyMetricDiscoveryDraft | null {
  return buildDailyMetricRatingDiscovery(result, STEPS_DISCOVERY_COPY, toDomain);
}
