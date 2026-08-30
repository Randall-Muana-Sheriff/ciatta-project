import { assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { produceSleepDurationFinding, FINDING_CONFIDENCE_SAMPLE_CAP } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

function evidenceContent(overrides: Partial<FindingEvidenceContent> = {}): FindingEvidenceContent {
  return {
    qualityFlags: [],
    contradictoryEvidence: null,
    alternativeExplanations: [],
    uncertainty: null,
    scientificBasis: 'personal baseline comparison (median of prior nights)',
    permittedLanguage: ['average', 'typical', 'over time'],
    prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
    sufficiencyVerdict: true,
    version: 'sleep-slice-v1',
    ...overrides,
  };
}

Deno.test('produceSleepDurationFinding: null when evidence sufficiency verdict is false', () => {
  const result = produceSleepDurationFinding(evidenceContent({ sufficiencyVerdict: false }), 30, null);
  assertEquals(result, null);
});

Deno.test('produceSleepDurationFinding: no meaningful change produces a steady-state statement', () => {
  const result = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, null);
  assertMatch(result!.statement, /close to your usual/);
});

Deno.test('produceSleepDurationFinding: a meaningful downward change is named with direction and magnitude', () => {
  const change: ChangeEventRecord = {
    observedValue: 300,
    baselineValue: 400,
    deviation: -100,
    direction: 'down',
    thresholdUsed: 45,
    isMeaningful: true,
  };
  const result = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, change);
  assertMatch(result!.statement, /100 minutes below your usual/);
});

Deno.test('produceSleepDurationFinding: confidence tier scales with sample size', () => {
  const low = produceSleepDurationFinding(evidenceContent(), 3, null);
  const high = produceSleepDurationFinding(evidenceContent(), FINDING_CONFIDENCE_SAMPLE_CAP, null);
  assertEquals(low!.confidenceTier, 'emerging');
  assertEquals(high!.confidenceTier, 'very-strong');
});
