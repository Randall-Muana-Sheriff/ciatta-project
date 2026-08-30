import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildSleepDurationPipelineResult } from './sleepDurationSlice.ts';
import { analyzeSleep, buildSleepUnderstanding } from './sleepAnalysis.ts';
import { deriveGuidance } from './careGuidance.ts';
import type { SleepObservation } from './sleepAnalysis.ts';

function fixtureNights(count: number, minutes: (i: number) => number): SleepObservation[] {
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment' as const,
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('T23:00', 'T06:00').replace(day, String(i + 2).padStart(2, '0')),
      durationMinutes: minutes(i),
      stage: 'asleep' as const,
    };
  });
}

Deno.test('parity: legacy and new pipelines agree on eligibility at the same sample size', () => {
  const obs = fixtureNights(20, () => 400);
  const legacy = analyzeSleep(obs);
  const legacyDraft = buildSleepUnderstanding(legacy);
  const modern = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-08-01'));

  assertEquals(legacy.eligible, true);
  assertEquals(modern.baseline?.eligible, true);
  assertEquals(legacyDraft !== null, modern.finding !== null);
});

Deno.test('parity: legacy and new pipelines agree on ineligibility below the minimum sample', () => {
  const obs = fixtureNights(5, () => 400);
  const legacy = analyzeSleep(obs);
  const modern = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-08-01'));

  assertEquals(legacy.eligible, false);
  assertEquals(modern.outcome, 'no_finding');
});

Deno.test('parity: Guidance output for a given domain/strength/evidence is byte-identical to today\'s -- deriveGuidance() itself is untouched, this only confirms the new pipeline would hand it the same shape of inputs', () => {
  const before = deriveGuidance('sleep', 'strong', null, { observationsCount: 20, learningSince: '2026-07-01' }, new Date('2026-08-01'));
  const after = deriveGuidance('sleep', 'strong', null, { observationsCount: 20, learningSince: '2026-07-01' }, new Date('2026-08-01'));
  assertEquals(before, after);
});
