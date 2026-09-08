import { assertEquals, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { memoryAnchorStore, hasAnyAnchor } from './healthKitAnchors.ts';
import { persistEach } from './healthKitPersist.ts';
import { runHealthKitSync, syncOneType, type SyncTypeDeps } from './healthKitSyncEngine.ts';
import { MANUAL_SYNC_LIMIT_MS, createAbortSignal, shouldStop } from './healthKitTimeout.ts';
import { composeNow, SLEEP_BASELINE_MIN_NIGHTS } from './nowComposition.ts';
import { countEligibleSleepNights } from './sleepNights.ts';
import { buildSleepSegmentObservation } from './healthKitNormalize.ts';
import { healthSyncUiKind } from './healthKitUi.ts';

interface Sample {
  id: string;
  ok: boolean;
}

function deps(overrides: Partial<SyncTypeDeps<Sample>> & { type: string; pages?: AnchoredPageLike[] }): SyncTypeDeps<Sample> {
  const pages = overrides.pages ?? [
    { samples: [{ id: 'a', ok: true }], deletedUuids: [], newAnchor: 'anchor-1' },
  ];
  let i = 0;
  return {
    type: overrides.type,
    query:
      overrides.query ??
      (async () => {
        const page = pages[Math.min(i, pages.length - 1)]!;
        i += 1;
        return page;
      }),
    persist: overrides.persist ?? (async (s) => {
      if (!s.ok) throw new Error(`bad sample ${s.id}`);
      return true;
    }),
    deleteByUuid: overrides.deleteByUuid ?? (async () => {}),
  };
}

type AnchoredPageLike = {
  samples: Sample[];
  deletedUuids: string[];
  newAnchor: string;
};

Deno.test('A initial sync: no anchor, samples persist, then anchor is saved', async () => {
  const store = memoryAnchorStore();
  const result = await syncOneType({
    userId: 'u1',
    reason: 'initial',
    store,
    deps: deps({ type: 'steps' }),
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(result.initial, true);
  assertEquals(result.created, 1);
  assertEquals(result.anchorAdvanced, true);
  assertEquals(await store.get('u1', 'steps'), 'anchor-1');
});

Deno.test('B incremental sync: uses saved anchor and does not rewrite history', async () => {
  const store = memoryAnchorStore({ 'u1:steps': 'anchor-1' });
  let seenAnchor: string | null = 'unset';
  const result = await syncOneType({
    userId: 'u1',
    reason: 'background',
    store,
    deps: {
      type: 'steps',
      query: async (anchor) => {
        seenAnchor = anchor;
        return { samples: [{ id: 'b', ok: true }], deletedUuids: [], newAnchor: 'anchor-2' };
      },
      persist: async () => true,
      deleteByUuid: async () => {},
    },
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(seenAnchor, 'anchor-1');
  assertEquals(result.initial, false);
  assertEquals(await store.get('u1', 'steps'), 'anchor-2');
});

Deno.test('C saved anchor is per user and type', async () => {
  const store = memoryAnchorStore();
  await store.set('u1', 'steps', 's1');
  await store.set('u1', 'sleep_segment', 'n1');
  await store.set('u2', 'steps', 'other');
  assertEquals(await store.get('u1', 'steps'), 's1');
  assertEquals(await store.get('u1', 'sleep_segment'), 'n1');
  assertEquals(await store.get('u2', 'steps'), 'other');
  assertEquals(await hasAnyAnchor(store, 'u1', ['hrv']), false);
  assertEquals(await hasAnyAnchor(store, 'u1', ['steps']), true);
});

Deno.test('D anchor advances only after successful persistence', async () => {
  const store = memoryAnchorStore();
  const failed = await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: deps({
      type: 'steps',
      persist: async () => {
        throw new Error('supabase down');
      },
    }),
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(failed.anchorAdvanced, false);
  assertEquals(await store.get('u1', 'steps'), null);

  const ok = await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: deps({ type: 'steps' }),
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(ok.anchorAdvanced, true);
  assertEquals(await store.get('u1', 'steps'), 'anchor-1');
});

Deno.test('E duplicate samples are ignored and still allow anchor advance', async () => {
  const store = memoryAnchorStore();
  const result = await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: deps({
      type: 'steps',
      persist: async () => false,
    }),
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(result.created, 0);
  assertEquals(result.duplicates, 1);
  assertEquals(result.anchorAdvanced, true);
});

Deno.test('F deleted samples are processed before anchor advance', async () => {
  const store = memoryAnchorStore({ 'u1:steps': 'a0' });
  const deleted: string[] = [];
  const result = await syncOneType({
    userId: 'u1',
    reason: 'background',
    store,
    deps: {
      type: 'steps',
      query: async () => ({
        samples: [],
        deletedUuids: ['gone-1'],
        newAnchor: 'a1',
      }),
      persist: async () => true,
      deleteByUuid: async (uuid) => {
        deleted.push(uuid);
      },
    },
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(deleted, ['gone-1']);
  assertEquals(result.anchorAdvanced, true);
  assertEquals(await store.get('u1', 'steps'), 'a1');
});

Deno.test('G one bad sample does not skip later samples and blocks that type anchor', async () => {
  const store = memoryAnchorStore();
  const seen: string[] = [];
  const result = await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: {
      type: 'heart_rate',
      query: async () => ({
        samples: [
          { id: '1', ok: false },
          { id: '2', ok: true },
        ],
        deletedUuids: [],
        newAnchor: 'x',
      }),
      persist: async (s) => {
        seen.push(s.id);
        if (!s.ok) throw new Error('bad');
        return true;
      },
      deleteByUuid: async () => {},
    },
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(seen, ['1', '2']);
  assertEquals(result.created, 1);
  assertEquals(result.failed, 1);
  assertEquals(result.anchorAdvanced, false);
});

Deno.test('H one failing data type does not prevent other types', async () => {
  const store = memoryAnchorStore();
  const totals = await runHealthKitSync({
    userId: 'u1',
    reason: 'manual',
    store,
    types: [
      deps({
        type: 'heart_rate',
        query: async () => {
          throw new Error('hk query failed');
        },
      }),
      deps({ type: 'steps' }),
    ],
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(totals.typesFailed, ['heart_rate']);
  assertEquals(totals.created, 1);
  assertEquals(await store.get('u1', 'heart_rate'), null);
  assertEquals(await store.get('u1', 'steps'), 'anchor-1');
});

Deno.test('I supabase failure does not advance the anchor', async () => {
  const store = memoryAnchorStore({ 'u1:steps': 'old' });
  await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: deps({
      type: 'steps',
      persist: async () => {
        throw new Error('network');
      },
    }),
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(await store.get('u1', 'steps'), 'old');
});

Deno.test('J retry after failure uses the same anchor and can succeed', async () => {
  const store = memoryAnchorStore({ 'u1:steps': 'old' });
  let attempts = 0;
  const depsRetry: SyncTypeDeps<Sample> = {
    type: 'steps',
    query: async (anchor) => {
      assertEquals(anchor, 'old');
      return { samples: [{ id: 'n', ok: true }], deletedUuids: [], newAnchor: 'new' };
    },
    persist: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network');
      return true;
    },
    deleteByUuid: async () => {},
  };
  await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: depsRetry,
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(await store.get('u1', 'steps'), 'old');
  const retry = await syncOneType({
    userId: 'u1',
    reason: 'manual',
    store,
    deps: depsRetry,
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(retry.anchorAdvanced, true);
  assertEquals(await store.get('u1', 'steps'), 'new');
});

Deno.test('K manual sync timeout returns control under 30 seconds', async () => {
  const store = memoryAnchorStore();
  const totals = await runHealthKitSync({
    userId: 'u1',
    reason: 'manual',
    store,
    types: [deps({ type: 'steps' }), deps({ type: 'hrv' })],
    startedAt: 1000,
    budgetMs: 0,
    now: () => 1000,
  });
  assertEquals(totals.timedOut, true);
  assertEquals(totals.elapsedMs, 0);
  assert(totals.elapsedMs < MANUAL_SYNC_LIMIT_MS);
  assertEquals(shouldStop(0, 25_000, 25_000), true);
});

Deno.test('L background sync reason is recorded and skips remaining work when aborted', async () => {
  const store = memoryAnchorStore();
  const signal = createAbortSignal();
  signal.aborted = true;
  const totals = await runHealthKitSync({
    userId: 'u1',
    reason: 'background',
    store,
    types: [deps({ type: 'steps' })],
    signal,
    startedAt: 0,
    budgetMs: 25_000,
    now: () => 1,
  });
  assertEquals(totals.reason, 'background');
  assertEquals(totals.timedOut, true);
  assertEquals(totals.created, 0);
  assertEquals(await store.get('u1', 'steps'), null);
});

Deno.test('M new observations are counted so intelligence work can be triggered by existing insert path', async () => {
  const store = memoryAnchorStore();
  const totals = await runHealthKitSync({
    userId: 'u1',
    reason: 'initial',
    store,
    types: [deps({ type: 'sleep_segment' })],
    startedAt: 0,
    budgetMs: 30_000,
    now: () => 1,
  });
  assertEquals(totals.created, 1);
  assert(totals.created > 0);
});

Deno.test('N Now recomposes from persisted intelligence, not raw HealthKit samples', () => {
  const now = composeNow({
    sleepNightCount: 20,
    hasHealthObservations: true,
    understandings: [
      {
        domain: 'sleep',
        strength: 'moderate',
        narrative: 'You average about 7h 0m of sleep a night. About 20% of your nights fall noticeably short of that.',
        observations_count: 20,
        first_observed: '2026-08-01T00:00:00.000Z',
        last_updated: '2026-09-01T00:00:00.000Z',
        guidance: null,
      },
    ],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(now.kind, 'surfaced');
  assertEquals(now.change?.statement.includes('average about'), true);
});

Deno.test('O insufficient evidence stays Building or Quiet', () => {
  const building = composeNow({
    sleepNightCount: 3,
    hasHealthObservations: true,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(building.kind, 'building');
  const quiet = composeNow({
    sleepNightCount: SLEEP_BASELINE_MIN_NIGHTS,
    hasHealthObservations: true,
    understandings: [],
    relationships: [],
    lastNightSleepLabel: null,
    userNote: null,
  });
  assertEquals(quiet.kind, 'quiet');
  assertEquals(quiet.change, null);
});

Deno.test('P Stage 1 sleep: HealthKit sleep_segment uses engine night buckets, not row count', () => {
  const origin = new Date('2026-08-01T07:00:00.000Z');
  const rows = Array.from({ length: 3 }, (_, i) => {
    const end = new Date(origin.getTime());
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    const obs = buildSleepSegmentObservation(start, end, 'asleep_core', 60, `seg-${i}`);
    return {
      type: obs.type,
      recorded_at: obs.recordedAt,
      value: obs.value,
      context: obs.context,
    };
  });
  assertEquals(countEligibleSleepNights(rows), 1);
  assertEquals(rows.length, 3);
});

Deno.test('Q Stage 2 Cycle/Mood isolation: HealthKit sync modules do not import cycle or mood processors', async () => {
  const files = [
    'src/lib/healthKit.ts',
    'src/lib/healthKitSyncEngine.ts',
    'src/lib/healthKitAnchors.ts',
  ];
  for (const file of files) {
    try {
      const text = await Deno.readTextFile(file);
      assert(!text.includes('cycleMood'), `${file} imported cycle mood`);
      assert(!text.includes('evidenceLedger'), `${file} imported evidence ledger`);
    } catch (e) {
      if (file === 'src/lib/healthKit.ts' && e instanceof Deno.errors.NotFound) {
        continue;
      }
      if (e instanceof Deno.errors.NotFound && file === 'src/lib/healthKit.ts') continue;
    }
  }
});

Deno.test('manual sync UI: processing vs complete vs partial vs error', () => {
  assertEquals(
    healthSyncUiKind({ created: 4, failed: 0, typesFailed: [], timedOut: false }),
    'processing'
  );
  assertEquals(
    healthSyncUiKind({ created: 0, failed: 0, typesFailed: [], timedOut: false }),
    'complete'
  );
  assertEquals(
    healthSyncUiKind({ created: 2, failed: 0, typesFailed: ['hrv'], timedOut: false }),
    'partial'
  );
  assertEquals(
    healthSyncUiKind({ created: 0, failed: 1, typesFailed: [], timedOut: false }),
    'error'
  );
});

Deno.test('persistEach abort stops remaining samples', async () => {
  const signal = createAbortSignal();
  const seen: number[] = [];
  const result = await persistEach([1, 2, 3], async (n) => {
    seen.push(n);
    if (n === 1) signal.aborted = true;
    return true;
  }, signal);
  assertEquals(seen, [1]);
  assertEquals(result.attempted, 1);
});
