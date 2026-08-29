/**
 * Shared integrity rules for Understanding drafts.
 * Confidence is evidence quality. Stance is what the evidence supports.
 * Copy names counts, never an unsupported percent or score.
 */

export type Strength = 'emerging' | 'moderate' | 'strong' | 'very-strong';

export type PatternStance = 'insufficient' | 'early' | 'mixed' | 'watching' | 'steady' | 'changing';
export type GuidanceOutcome = 'none' | 'watch' | 'reassure' | 'understand' | 'consider';
export type EvidenceOrigin = 'device' | 'checkin' | 'context';

export const CONFIDENCE_LABEL: Record<Strength, string> = {
  emerging: 'still learning',
  moderate: 'fairly confident',
  strong: 'confident',
  'very-strong': 'very confident',
};

export function strengthForEvidenceQuality(confidence: number): Strength {
  if (confidence < 0.3) return 'emerging';
  if (confidence < 0.6) return 'moderate';
  if (confidence < 0.85) return 'strong';
  return 'very-strong';
}

/**
 * Early and mixed states stay honest: lots of data does not upgrade an
 * unfinished picture into a settled one. Settled stances use sample size
 * alone, so a well evidenced usual picture can be confident without a
 * "problem" rate to inflate it.
 */
export function strengthForStance(confidence: number, stance: PatternStance): Strength {
  if (stance === 'insufficient' || stance === 'early') return 'emerging';
  const bySample = strengthForEvidenceQuality(confidence);
  if (stance === 'mixed' && (bySample === 'very-strong' || bySample === 'strong')) {
    return 'moderate';
  }
  return bySample;
}

export function volumeStance(args: {
  sampleCount: number;
  minSample: number;
  notableCount: number;
}): PatternStance {
  if (args.sampleCount <= 0) return 'insufficient';
  if (args.sampleCount < args.minSample) return 'early';
  if (args.notableCount <= 0) return 'steady';
  const share = args.notableCount / args.sampleCount;
  if (share < 0.05) return 'steady';
  if (share < 0.15) return 'watching';
  return 'changing';
}

export function cycleStance(args: {
  cyclesDetected: number;
  cyclesWithSufficientData: number;
  cyclesConfirming: number;
  minCycles: number;
}): PatternStance {
  if (args.cyclesDetected <= 0) return 'insufficient';
  if (args.cyclesWithSufficientData < args.minCycles) return 'early';
  if (args.cyclesConfirming === 0) return 'mixed';
  const rate = args.cyclesConfirming / args.cyclesWithSufficientData;
  if (rate < 0.5) return 'mixed';
  return 'changing';
}

export function outcomeForStance(stance: PatternStance, strength: Strength): GuidanceOutcome {
  if (stance === 'insufficient' || stance === 'early') return 'none';
  if (stance === 'mixed' || stance === 'watching') return 'watch';
  if (stance === 'steady') return 'reassure';
  const actionable = strength === 'strong' || strength === 'very-strong';
  if (stance === 'changing' && actionable) return 'consider';
  if (stance === 'changing') return 'understand';
  return 'none';
}

export function countShareCopy(notable: number, total: number, unit: string): string {
  const unitWord = total === 1 ? unit : `${unit}s`;
  if (notable <= 0) {
    return `None of these ${total} ${unitWord} sat apart from your usual.`;
  }
  return `${notable} of ${total} ${unitWord}`;
}

export function changeFromNotableCount(
  notable: number,
  total: number,
  unit: string
): { changeDetected: boolean; changeSummary: string | null } {
  if (total <= 0 || notable <= 0) {
    return { changeDetected: false, changeSummary: null };
  }
  const share = notable / total;
  if (share < 0.05) {
    return { changeDetected: false, changeSummary: null };
  }
  return {
    changeDetected: true,
    changeSummary: `${countShareCopy(notable, total, unit)} sat apart from your usual.`,
  };
}

export function evidenceSummary(
  count: number,
  strength: Strength,
  origin: EvidenceOrigin = 'device'
): string {
  if (origin === 'context') {
    return 'This comes from what you shared, not a device measurement.';
  }
  if (count <= 0) {
    return "There isn't a reading on this yet. Ciatta will look as more arrives.";
  }
  if (origin === 'checkin') {
    const checkIns = count === 1 ? '1 check in' : `${count} check ins`;
    if (count < 8 || strength === 'emerging' || strength === 'moderate') {
      return `Ciatta has ${checkIns} you reported. That is not enough yet to see a clear pattern.`;
    }
    return `This is grounded in ${checkIns} you reported.`;
  }
  const readings = count === 1 ? '1 reading' : `${count} readings`;
  if (count < 8 || strength === 'emerging' || strength === 'moderate') {
    return `Ciatta has ${readings} to work with. That is not enough yet to see a clear pattern.`;
  }
  return `This is grounded in ${readings} Ciatta has already seen.`;
}

export function stillLearningForStance(stance: PatternStance, watching: string): string[] {
  if (stance === 'early' || stance === 'insufficient') {
    return ['Ciatta is still gathering enough to see a usual pattern.'];
  }
  if (stance === 'mixed') {
    return ['This has shown up in some stretches and not others.'];
  }
  if (stance === 'watching') {
    return [watching];
  }
  if (stance === 'steady') {
    return ['Nothing here is asking for a change.'];
  }
  return [watching];
}

export function qualitativeConfidenceFill(label: string | null | undefined): number {
  const raw = (label ?? '').toLowerCase();
  if (raw.includes('very confident')) return 90;
  if (raw.includes('fairly confident')) return 50;
  if (raw.includes('still learning')) return 22;
  if (raw.includes('confident')) return 72;
  return 40;
}
