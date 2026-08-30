import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { explainSleepDurationFinding } from './explanation.ts';
import type { FindingDraft } from './finding.ts';
import type { FindingEvidenceContent } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';
import type { ChangeEventRecord } from './changeEvent.ts';

const finding: FindingDraft = {
  domain: 'sleep',
  featureType: 'nightly_sleep_minutes',
  statement: 'Your nightly sleep has been running about 100 minutes below your usual.',
  confidenceTier: 'very-strong',
};

const evidence: FindingEvidenceContent = {
  qualityFlags: [],
  contradictoryEvidence: null,
  alternativeExplanations: [],
  uncertainty: 'limited sample size',
  scientificBasis: 'personal baseline comparison (median of prior nights)',
  permittedLanguage: ['average', 'typical', 'over time'],
  prohibitedLanguage: ['diagnosis', 'disorder', 'abnormal'],
  sufficiencyVerdict: true,
  version: 'sleep-slice-v1',
};

const baseline: BaselineRecord = {
  domain: 'sleep',
  featureType: 'nightly_sleep_minutes',
  value: 400,
  windowStart: '2026-08-01',
  windowEnd: '2026-08-19',
  sampleSize: 14,
  eligible: true,
  calculationVersion: 'median-nightly-sleep-v1',
};

const change: ChangeEventRecord = {
  observedValue: 300,
  baselineValue: 400,
  deviation: -100,
  direction: 'down',
  thresholdUsed: 45,
  isMeaningful: true,
};

Deno.test('explainSleepDurationFinding: answers all eight points', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, change, false);
  assertEquals(explanation.whatCiattaNoticed, finding.statement);
  assertEquals(explanation.supportingEvidence, 'Based on 14 nights of sleep data.');
  assertEquals(explanation.whatChanged, 'A meaningful change from your 400-minute usual.');
  assertEquals(explanation.relevantContext, evidence.scientificBasis);
  assertEquals(explanation.relationshipOrPattern, 'No supported relationship or pattern is part of this finding.');
  assertEquals(explanation.confidenceStatement, 'Ciatta is very confident in this.');
  assertEquals(explanation.whatCiattaDoesNotKnow, 'limited sample size');
  assertEquals(explanation.whatThisDoesNotMean, 'This is not a diagnosis and does not indicate a sleep disorder.');
});

Deno.test('explainSleepDurationFinding: names a supported relationship when present', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, change, true);
  assertEquals(explanation.relationshipOrPattern, 'Connected to a supported relationship with another domain.');
});

Deno.test('explainSleepDurationFinding: no-change case states there was not enough recent data assessed', () => {
  const explanation = explainSleepDurationFinding(finding, evidence, baseline, null, false);
  assertEquals(explanation.whatChanged, 'Not enough recent data to assess change.');
});
