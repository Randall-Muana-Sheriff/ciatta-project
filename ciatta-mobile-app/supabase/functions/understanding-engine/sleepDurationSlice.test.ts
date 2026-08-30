import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildSleepDurationPipelineResult, checkAlternativeExplanation } from './sleepDurationSlice.ts';
import type { SleepObservation } from './sleepAnalysis.ts';
import type { RatingObservation } from './energyRelationship.ts';

function nightsOfObservations(count: number, minutesEach: number): SleepObservation[] {
  const obs: SleepObservation[] = [];
  for (let i = 0; i < count; i++) {
    const day = String(i + 1).padStart(2, '0');
    obs.push({
      id: `night-${i}`,
      type: 'sleep_segment',
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`, // overwritten below per-test where minutes matter
      durationMinutes: minutesEach,
      stage: 'asleep',
    });
  }
  return obs;
}

Deno.test('buildSleepDurationPipelineResult: too few nights -> no_finding, nothing else computed', () => {
  const result = buildSleepDurationPipelineResult(nightsOfObservations(5, 400), [], [], new Date('2026-07-06'));
  assertEquals(result.outcome, 'no_finding');
});

Deno.test('buildSleepDurationPipelineResult: enough nights but no meaningful change -> no_surfacing', () => {
  const obs: SleepObservation[] = Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      id: `night-${i}`,
      type: 'sleep_segment',
      startTime: `2026-07-${day}T23:00:00Z`,
      endTime: `2026-07-${day}T23:00:00Z`.replace('23:00', '06:00'),
      durationMinutes: 400,
      stage: 'asleep',
    };
  });
  const result = buildSleepDurationPipelineResult(obs, [], [], new Date('2026-07-21'));
  assertEquals(result.outcome, 'no_surfacing');
  assertEquals(result.finding?.statement.includes('close to your usual'), true);
});

Deno.test('checkAlternativeExplanation: zero confirming windows is never ruled out', () => {
  assertEquals(checkAlternativeExplanation([]), false);
  assertEquals(checkAlternativeExplanation([{ windowLabel: '2026-06', confirms: false }]), false);
});

Deno.test('checkAlternativeExplanation: exactly one confirming window is NOT enough -- one strong month could be driving the whole effect', () => {
  const instances = [
    { windowLabel: '2026-05', confirms: false },
    { windowLabel: '2026-06', confirms: true },
    { windowLabel: '2026-07', confirms: false },
  ];
  assertEquals(checkAlternativeExplanation(instances), false);
});

Deno.test('checkAlternativeExplanation: two or more independently confirming windows rules it out', () => {
  const instances = [
    { windowLabel: '2026-05', confirms: true },
    { windowLabel: '2026-06', confirms: false },
    { windowLabel: '2026-07', confirms: true },
  ];
  assertEquals(checkAlternativeExplanation(instances), true);
});
