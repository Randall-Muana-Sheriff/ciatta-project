import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { assembleSleepDurationEvidenceContent, EVIDENCE_LEDGER_VERSION } from './findingEvidence.ts';
import type { BaselineRecord } from './baseline.ts';

function baseline(overrides: Partial<BaselineRecord> = {}): BaselineRecord {
  return {
    domain: 'sleep',
    featureType: 'nightly_sleep_minutes',
    value: 400,
    windowStart: '2026-08-01',
    windowEnd: '2026-08-19',
    sampleSize: 14,
    eligible: true,
    calculationVersion: 'median-nightly-sleep-v1',
    ...overrides,
  };
}

Deno.test('assembleSleepDurationEvidenceContent: null when baseline is ineligible', () => {
  assertEquals(assembleSleepDurationEvidenceContent(baseline({ eligible: false }), []), null);
});

Deno.test('assembleSleepDurationEvidenceContent: null when quality flags include insufficient-data', () => {
  assertEquals(assembleSleepDurationEvidenceContent(baseline(), ['insufficient-data']), null);
});

Deno.test('assembleSleepDurationEvidenceContent: passes with an eligible baseline and clean quality', () => {
  const content = assembleSleepDurationEvidenceContent(baseline(), []);
  assertEquals(content?.sufficiencyVerdict, true);
  assertEquals(content?.version, EVIDENCE_LEDGER_VERSION);
  assertEquals(content?.prohibitedLanguage.includes('diagnosis'), true);
});

Deno.test('assembleSleepDurationEvidenceContent: flags limited sample size below 30 nights', () => {
  const content = assembleSleepDurationEvidenceContent(baseline({ sampleSize: 14 }), []);
  assertEquals(content?.uncertainty, 'limited sample size');
});

Deno.test('assembleSleepDurationEvidenceContent: no uncertainty note at or above 30 nights', () => {
  const content = assembleSleepDurationEvidenceContent(baseline({ sampleSize: 30 }), []);
  assertEquals(content?.uncertainty, null);
});
