import {
  changeFromNotableCount,
  evidenceSummary,
  type PatternStance,
  type Strength,
} from './intelligenceIntegrity.ts';

export type UnderstandingStrength = Strength;
export type { PatternStance };

export type UnderstandingFacets = {
  seeing: string;
  evidenceSummary: string;
  evidenceSignal: string | null;
  baselineValue: number | null;
  baselineUnit: string | null;
  baselineWindowDays: number | null;
  baselineSummary: string | null;
  changeDetected: boolean;
  changeSummary: string | null;
  stance?: PatternStance;
};

export function readingsEvidenceSummary(
  count: number,
  strength: UnderstandingStrength,
  origin: 'device' | 'checkin' | 'context' = 'device'
): string {
  return evidenceSummary(count, strength, origin);
}

export function changeFromNotableRate(
  rate: number,
  total = 20,
  unit = 'day'
): Pick<UnderstandingFacets, 'changeDetected' | 'changeSummary'> {
  if (rate < 0.05) {
    return { changeDetected: false, changeSummary: null };
  }
  const notable = Math.max(1, Math.round(rate * total));
  return changeFromNotableCount(notable, total, unit);
}

export function emptyFacets(seeing: string): UnderstandingFacets {
  return {
    seeing,
    evidenceSummary: readingsEvidenceSummary(0, 'emerging'),
    evidenceSignal: null,
    baselineValue: null,
    baselineUnit: null,
    baselineWindowDays: null,
    baselineSummary: null,
    changeDetected: false,
    changeSummary: null,
  };
}
