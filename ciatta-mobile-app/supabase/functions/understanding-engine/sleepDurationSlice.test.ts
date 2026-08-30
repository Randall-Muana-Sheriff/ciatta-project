import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { buildSleepDurationPipelineResult, checkAlternativeExplanation, runSleepDurationSlice } from './sleepDurationSlice.ts';
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

// Minimal fake Supabase client covering only the chain shapes
// runSleepDurationSlice actually calls: .from(table).upsert(x, opts).select(c).single(),
// .from(table).select(c).eq().eq().eq().order().limit().maybeSingle(), and
// .from('ciatta_knowledge').upsert(x, opts) (awaited directly, no .select()).
// Every chain method returns the same stateless object except the
// terminal methods, which resolve -- including upsert() itself, which
// must return `chain` (not resolve directly) so a subsequent
// .select('id').single() call still works, mirroring real supabase-js
// chain semantics.
function createFakeSupabase(recordedTables: string[], opts: { failInserts?: boolean } = {}) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () =>
      opts.failInserts
        ? Promise.resolve({ data: null, error: new Error('simulated insert failure') })
        : Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: () => chain,
  };
  return {
    from(table: string) {
      recordedTables.push(table);
      return chain;
    },
  };
}

function twentyNightsAt400(): SleepObservation[] {
  return Array.from({ length: 20 }, (_, i) => {
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
}

Deno.test('runSleepDurationSlice: writes only to the permitted Stage 1 tables, never a legacy table', async () => {
  const recordedTables: string[] = [];
  const supabase = createFakeSupabase(recordedTables);

  await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));

  const permitted = new Set([
    'features',
    'baselines',
    'change_events',
    'finding_evidence',
    'findings',
    'ciatta_knowledge',
  ]);
  const forbidden = ['understandings', 'understanding_history', 'evidence', 'relationships', 'discoveries'];

  for (const table of recordedTables) {
    assertEquals(permitted.has(table), true, `unexpected table touched: ${table}`);
  }
  for (const table of forbidden) {
    assertEquals(recordedTables.includes(table), false, `must never touch legacy table: ${table}`);
  }
  // Confirms the fixture actually reached the full write path, not just
  // an early-return branch -- findings is only reached once evidence and
  // a finding both exist.
  assertEquals(recordedTables.includes('findings'), true);
});

Deno.test('runSleepDurationSlice: a failed write is never swallowed internally -- it propagates to the caller', async () => {
  const recordedTables: string[] = [];
  const supabase = createFakeSupabase(recordedTables, { failInserts: true });

  let threw = false;
  try {
    await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));
  } catch {
    threw = true;
  }
  // This function must NOT catch its own errors -- index.ts's try/catch
  // around the call site is what provides legacy-path isolation, per this
  // file's own docstring ("Errors are the caller's ... responsibility to
  // isolate via try/catch -- this function does not swallow them
  // itself"). If this function silently swallowed errors instead, that
  // isolation guarantee would be untested and could silently break.
  assertEquals(threw, true);
});

// Builds one calendar month's worth of nights + next-day energy ratings
// that genuinely qualifies as a confirming window for
// analyzeSleepRatingRelationship (sleepAnalysis.ts): 20 nights (well over
// the BASELINE_MIN_NIGHTS=14 floor), alternating 450min (normal) / 250min
// (short) so the in-month median lands at 350 and the short-night cutoff
// (median - SHORT_NIGHT_THRESHOLD_MINUTES=45 = 305) cleanly separates the
// two groups (10 each, both over MIN_NIGHTS_PER_GROUP=5). Each night's
// rating is recorded the following calendar day: 4 after a normal night,
// 2 after a short one, giving a ratingDelta of 2 -- comfortably over
// MIN_RATING_DROP=0.5. Days 3..22 are used (never the first or last few
// days of the month) so nightKey()'s endTime-minus-12h bucketing and the
// next-day rating date never cross a month boundary.
function monthFixture(year: number, month: number): { sleepObs: SleepObservation[]; energyObs: RatingObservation[] } {
  const mm = String(month).padStart(2, '0');
  const sleepObs: SleepObservation[] = [];
  const energyObs: RatingObservation[] = [];

  for (let i = 0; i < 20; i++) {
    const day = 3 + i;
    const nextDay = day + 1;
    const dd = String(day).padStart(2, '0');
    const nextDd = String(nextDay).padStart(2, '0');
    const isNormal = i % 2 === 0;
    const minutes = isNormal ? 450 : 250;
    const rating = isNormal ? 4 : 2;

    sleepObs.push({
      id: `sleep-${year}-${mm}-${i}`,
      type: 'sleep_segment',
      startTime: `${year}-${mm}-${dd}T12:00:00Z`,
      endTime: `${year}-${mm}-${dd}T20:00:00Z`,
      durationMinutes: minutes,
      stage: 'asleep',
    });

    energyObs.push({
      id: `energy-${year}-${mm}-${i}`,
      recordedAt: `${year}-${mm}-${nextDd}T12:00:00Z`,
      rating,
    });
  }

  return { sleepObs, energyObs };
}

Deno.test('runSleepDurationSlice: writes a patterns row and links it when a Pattern qualifies', async () => {
  const recordedTables: string[] = [];
  const upserted: Record<string, unknown>[] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: (payload: unknown) => {
      upserted.push(payload as Record<string, unknown>);
      return chain;
    },
  };
  const supabase = {
    from(table: string) {
      recordedTables.push(table);
      return chain;
    },
  };

  // 4 independently confirming calendar months (May-Aug 2026) so
  // evaluatePattern's true qualifying minimum (recurrenceCount >= 4, i.e.
  // stability-under-removal, not just the raw >=3 recurrence bar) is
  // genuinely met, and checkAlternativeExplanation's >=2-confirming-window
  // floor clears comfortably too.
  const months = [
    monthFixture(2026, 5),
    monthFixture(2026, 6),
    monthFixture(2026, 7),
    monthFixture(2026, 8),
  ];
  const sleepObs = months.flatMap((m) => m.sleepObs);
  const energyObs = months.flatMap((m) => m.energyObs);

  await runSleepDurationSlice(supabase, 'user-1', sleepObs, energyObs, [], new Date('2026-08-25'));

  assertEquals(recordedTables.includes('patterns'), true);
  const patternsWrite = upserted.find((p) => 'pattern_type' in p);
  assertEquals(patternsWrite?.to_domain, 'energy');
  assertEquals(patternsWrite?.recurrence_count, 4);
  assertEquals(patternsWrite?.stable_under_removal, true);
  // recurrenceCount=4 -> min(1, 4/PATTERN_CONFIDENCE_RECURRENCE_CAP=8) = 0.5
  // -> strengthForConfidence(0.5) = 'moderate' -> 'fairly confident'. Both
  // values must come from the one patternConfidence() call -- this pins
  // the numeric/label pair actually written, not just that some pattern
  // was persisted.
  assertEquals(patternsWrite?.confidence, 0.5);
  assertEquals(patternsWrite?.confidence_label, 'fairly confident');
  const evidenceWrite = upserted.find((p) => 'sufficiency_verdict' in p);
  assertEquals(evidenceWrite?.pattern_id, 'fake-id');
});

Deno.test('runSleepDurationSlice: re-running with the same data upserts (not duplicates) every write', async () => {
  const upsertCalls: string[] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: (_payload: unknown, opts: unknown) => {
      upsertCalls.push(JSON.stringify(opts));
      return chain;
    },
  };
  const supabase = { from: () => chain };

  const obs = twentyNightsAt400();
  await runSleepDurationSlice(supabase, 'user-1', obs, [], [], new Date('2026-07-21'));
  await runSleepDurationSlice(supabase, 'user-1', obs, [], [], new Date('2026-07-21'));

  // Every write must go through upsert with an onConflict target -- a
  // plain, unconditional insert would duplicate on the second run.
  assertEquals(upsertCalls.length > 0, true);
  for (const opts of upsertCalls) {
    assertEquals(opts.includes('onConflict'), true, `upsert call missing onConflict: ${opts}`);
  }
});

Deno.test('runSleepDurationSlice: a failed prior-findings read is never silently treated as "no prior runs"', async () => {
  const chain: Record<string, (...args: unknown[]) => unknown> = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    select: () => chain,
    insert: () => chain,
    single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: new Error('simulated read failure') }),
    upsert: () => chain,
  };
  const supabase = { from: () => chain };

  let threw = false;
  try {
    await runSleepDurationSlice(supabase, 'user-1', twentyNightsAt400(), [], [], new Date('2026-07-21'));
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
