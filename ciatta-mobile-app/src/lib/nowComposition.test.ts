import { assertEquals } from 'jsr:@std/assert@1';
import { composeNow, SLEEP_BASELINE_MIN_NIGHTS, type NowUnderstanding } from './nowComposition.ts';
import type { Domain, Strength } from './types.ts';

function row(partial: Partial<NowUnderstanding> & { domain: Domain }): NowUnderstanding {
  return {
    strength: 'moderate' as Strength,
    narrative: 'You average about 7h 0m of sleep a night. About 20% of your nights fall noticeably short of that.',
    observations_count: 20,
    first_observed: '2026-08-01T00:00:00.000Z',
    last_updated: '2026-09-01T00:00:00.000Z',
    guidance: null,
    ...partial,
  };
}

Deno.test('composeNow: skip source with no nights is Building', () => {
  const now = composeNow({
    sleepNightCount: 0,
    hasHealthObservations: false,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(now.kind, 'building');
  assertEquals(now.change, null);
  assertEquals(now.pattern, null);
  assertEquals(now.action, null);
  assertEquals(now.buildingHas?.includes('does not have connected sleep'), true);
});

Deno.test('composeNow: nights below engine baseline stay Building', () => {
  const now = composeNow({
    sleepNightCount: SLEEP_BASELINE_MIN_NIGHTS - 1,
    hasHealthObservations: true,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: 'Last night you slept 6h 0m.',
    userNote: null,
  });
  assertEquals(now.kind, 'building');
  assertEquals(now.quietMessage, null);
});

Deno.test('composeNow: enough nights and no engine row is Quiet, not a fabricated Change', () => {
  const now = composeNow({
    sleepNightCount: SLEEP_BASELINE_MIN_NIGHTS,
    hasHealthObservations: true,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: 'Last night you slept 7h 0m.',
    userNote: null,
  });
  assertEquals(now.kind, 'quiet');
  assertEquals(now.change, null);
  assertEquals(now.action, null);
});

Deno.test('composeNow: sleep row is Surfaced Change and never promotes a Relationship to Pattern', () => {
  const now = composeNow({
    sleepNightCount: 20,
    hasHealthObservations: true,
    understandings: [row({ domain: 'sleep' })],
    relationships: [{ from_domain: 'cycle', to_domain: 'mood' }],
    lastNightSleepLabel: 'Last night you slept 5h 0m.',
    userNote: null,
  });
  assertEquals(now.kind, 'surfaced');
  assertEquals(now.pattern, null);
  assertEquals(now.change?.statement.includes('sleep'), true);
  assertEquals(now.context?.interpretation.includes('association'), true);
  assertEquals(now.action, null);
});

Deno.test('composeNow: Action only when existing Guidance eligibility is true', () => {
  const now = composeNow({
    sleepNightCount: 30,
    hasHealthObservations: true,
    understandings: [
      row({
        domain: 'sleep',
        strength: 'strong',
        guidance:
          'This is a consistent pattern in your sleep. If it continues, it may be worth discussing with a clinician.',
      }),
    ],
    relationships: [],
    lastNightSleepLabel: 'Last night you slept 4h 40m.',
    userNote: 'Felt low last night.',
  });
  assertEquals(now.action?.careEligible, true);
  assertEquals(now.pattern, null);
  assertEquals(now.userNote, 'Felt low last night.');
});

Deno.test('composeNow: moderate strength with no guidance omits Action', () => {
  const now = composeNow({
    sleepNightCount: 20,
    hasHealthObservations: true,
    understandings: [row({ domain: 'sleep', strength: 'moderate', guidance: null })],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(now.action, null);
});
