/**
 * Pure mood analysis: no Deno/Supabase imports, same testing approach as
 * every other module here. Produces the last remaining standalone
 * Understanding — 'mood' has, until now, only ever been a Relationship
 * target (cycle -> mood, sleep -> mood, recovery -> mood), never described
 * on its own.
 *
 * Unlike sleep/steps/HRV, mood_rating is curiosity-sourced and gated by the
 * daily rotation (one of three domains asked per day), so it accumulates
 * far slower than device-synced data. Eligibility is sized by answer
 * count, not calendar days — there's no daily density to assume.
 */
import type { Strength } from './cycleAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';
import { readingsEvidenceSummary, type UnderstandingFacets } from './understandingFacets.ts';
import {
  changeFromNotableCount,
  CONFIDENCE_LABEL,
  stillLearningForStance,
  strengthForStance,
  volumeStance,
  type PatternStance,
} from './intelligenceIntegrity.ts';

const MIN_ANSWERS = 10;
const CONFIDENCE_SAMPLE_CAP = 20;
// Rating 1 is literally the "Low" option on the curiosity card's own
// answer scale, so this is a self-labeled threshold, not a computed one —
// no need for a relative baseline the way steps/HRV need one, since this
// scale has no per-person variation to normalize away.
const LOW_MOOD_RATING = 1;

export interface MoodUnderstandingResult {
  totalAnswers: number;
  lowMoodCount: number;
  lowMoodRate: number;
  confidence: number;
  eligible: boolean;
  observationIds: string[];
}

export function analyzeMood(observations: RatingObservation[]): MoodUnderstandingResult {
  const totalAnswers = observations.length;

  if (totalAnswers < MIN_ANSWERS) {
    return {
      totalAnswers,
      lowMoodCount: 0,
      lowMoodRate: 0,
      confidence: Math.min(1, totalAnswers / CONFIDENCE_SAMPLE_CAP),
      eligible: false,
      observationIds: observations.map((o) => o.id),
    };
  }

  const lowMoodCount = observations.filter((o) => o.rating === LOW_MOOD_RATING).length;

  return {
    totalAnswers,
    lowMoodCount,
    lowMoodRate: lowMoodCount / totalAnswers,
    confidence: Math.min(1, totalAnswers / CONFIDENCE_SAMPLE_CAP),
    eligible: true,
    observationIds: observations.map((o) => o.id),
  };
}

export interface MoodUnderstandingDraft extends UnderstandingFacets {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
  stillLearning: string[];
  stance: PatternStance;
}

export function buildMoodUnderstanding(
  result: MoodUnderstandingResult
): MoodUnderstandingDraft | null {
  const stance = volumeStance({
    sampleCount: result.totalAnswers,
    minSample: MIN_ANSWERS,
    notableCount: result.lowMoodCount,
  });
  if (stance === 'insufficient') return null;

  const strength = strengthForStance(result.confidence, stance);
  if (stance === 'early') {
    const seeing = `Ciatta has ${result.totalAnswers} mood check ins so far. That is not enough yet to see a usual picture.`;
    return {
      strength,
      narrative: seeing,
      seeing,
      confidenceLabel: CONFIDENCE_LABEL[strength],
      stillLearning: stillLearningForStance(stance, 'how your mood check ins usually sit'),
      stance,
      evidenceSummary: readingsEvidenceSummary(result.observationIds.length, strength, 'checkin'),
      evidenceSignal: 'mood_rating',
      baselineValue: null,
      baselineUnit: null,
      baselineWindowDays: null,
      baselineSummary: null,
      changeDetected: false,
      changeSummary: null,
    };
  }

  const seeing =
    result.lowMoodCount <= 0
      ? `You have not rated your mood as Low in ${result.totalAnswers} check ins.`
      : `You rated your mood as Low in ${result.lowMoodCount} of ${result.totalAnswers} check ins.`;
  return {
    strength,
    narrative: seeing,
    seeing,
    confidenceLabel: CONFIDENCE_LABEL[strength],
    stillLearning: stillLearningForStance(stance, 'what tends to sit beside these check ins'),
    stance,
    evidenceSummary: readingsEvidenceSummary(result.observationIds.length, strength, 'checkin'),
    evidenceSignal: 'mood_rating',
    baselineValue: result.lowMoodRate,
    baselineUnit: 'share',
    baselineWindowDays: null,
    baselineSummary:
      result.lowMoodCount <= 0
        ? `Low has not shown up in the mood check ins Ciatta has.`
        : `Low has shown up in ${result.lowMoodCount} of ${result.totalAnswers} mood check ins.`,
    ...changeFromNotableCount(result.lowMoodCount, result.totalAnswers, 'check in'),
  };
}
