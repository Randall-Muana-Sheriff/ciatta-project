import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { persistEach } from './healthKitPersist.ts';
import { sampleDurationMinutes, sampleIso } from './healthKitDates.ts';
import {
  buildMenstrualObservation,
  buildSleepSegmentObservation,
  insertedCount,
  menstrualFlowContext,
} from './healthKitNormalize.ts';
import { countEligibleSleepNights } from './sleepNights.ts';
import { composeNow, SLEEP_BASELINE_MIN_NIGHTS } from './nowComposition.ts';

Deno.test('persistEach: a failure on one sample does not skip later samples', async () => {
  const seen: number[] = [];
  const result = await persistEach([1, 2, 3], async (n) => {
    seen.push(n);
    if (n === 1) throw new Error('duplicate or rls');
    return n === 2;
  });
  assertEquals(seen, [1, 2, 3]);
  assertEquals(result.attempted, 3);
  assertEquals(result.created, 1);
  assertEquals(result.failed, 1);
  assertEquals(result.skipped, 1);
  assertEquals(result.errors, ['duplicate or rls']);
});

Deno.test('persistEach: returning false is a duplicate, not an insert', async () => {
  let first = true;
  const result = await persistEach(['same', 'same', 'new'], async () => {
    if (first) {
      first = false;
      return true;
    }
    return false;
  });
  assertEquals(result.attempted, 3);
  assertEquals(result.created, 1);
  assertEquals(result.skipped, 2);
  assertEquals(result.failed, 0);
  assertEquals(insertedCount([result]), 1);
});

Deno.test('persistEach: empty list is a no-op', async () => {
  const result = await persistEach([], async () => true);
  assertEquals(result, { attempted: 0, created: 0, failed: 0, skipped: 0, errors: [] });
});

Deno.test('sampleIso: Date and ISO string both serialize', () => {
  const iso = '2026-08-30T07:15:00.000Z';
  assertEquals(sampleIso(iso), iso);
  assertEquals(sampleIso(new Date(iso)), iso);
});

Deno.test('sampleDurationMinutes: works when HealthKit dates are strings', () => {
  assertEquals(
    sampleDurationMinutes('2026-08-30T07:00:00.000Z', '2026-08-30T07:30:00.000Z'),
    30
  );
});

Deno.test('menstrual flow does not require sample.metadata', () => {
  assertEquals(menstrualFlowContext(undefined), { cycleStart: null });
  assertEquals(menstrualFlowContext(null), { cycleStart: null });
  const obs = buildMenstrualObservation('2026-08-01T00:00:00.000Z', 'medium');
  assertEquals(obs.context.cycleStart, null);
  assertEquals(obs.recordedAt, '2026-08-01T00:00:00.000Z');
});

Deno.test('sleep_segment nights satisfy existing 14 night eligibility without a fabricated Change', () => {
  const origin = new Date('2026-08-01T07:00:00.000Z');
  const rows = Array.from({ length: SLEEP_BASELINE_MIN_NIGHTS }, (_, i) => {
    const end = new Date(origin.getTime() + i * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 8 * 60 * 60 * 1000);
    const obs = buildSleepSegmentObservation(start, end, 'asleep_core', 480);
    return {
      type: obs.type,
      recorded_at: obs.recordedAt,
      value: obs.value,
      context: obs.context,
    };
  });
  const nights = countEligibleSleepNights(rows);
  assertEquals(nights, SLEEP_BASELINE_MIN_NIGHTS);
  const now = composeNow({
    sleepNightCount: nights,
    hasHealthObservations: true,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(now.kind, 'quiet');
  assertEquals(now.change, null);
});

Deno.test('in_bed and awake HealthKit segments do not count as nights', () => {
  const origin = new Date('2026-08-01T07:00:00.000Z');
  const rows = ['in_bed', 'awake', 'asleep_core'].map((stage, i) => {
    const end = new Date(origin.getTime() + i * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    const obs = buildSleepSegmentObservation(start, end, stage, 60);
    return {
      type: obs.type,
      recorded_at: obs.recordedAt,
      value: obs.value,
      context: obs.context,
    };
  });
  assertEquals(countEligibleSleepNights(rows), 1);
});
