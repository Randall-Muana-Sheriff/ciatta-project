export type UnderstandingStrength = 'very-strong' | 'strong' | 'moderate' | 'emerging';

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
};

export function readingsEvidenceSummary(count: number, strength: UnderstandingStrength): string {
  if (count <= 0) {
    return "There isn't a reading on this yet. Ciatta will look as more arrives.";
  }
  const readings = count === 1 ? '1 reading' : `${count} readings`;
  if (count < 8 || strength === 'emerging' || strength === 'moderate') {
    return `Ciatta has ${readings} to work with. That is not enough yet to see a clear pattern.`;
  }
  return `This is grounded in ${readings} Ciatta has already seen.`;
}

export function changeFromNotableRate(
  rate: number
): Pick<UnderstandingFacets, 'changeDetected' | 'changeSummary'> {
  if (rate < 0.05) {
    return { changeDetected: false, changeSummary: null };
  }
  const pct = Math.round(rate * 100);
  return {
    changeDetected: true,
    changeSummary: `About ${pct}% of recent days sit apart from your usual baseline.`,
  };
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
