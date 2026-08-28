import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  chunk,
  emptyHealthKitTelemetry,
  runHealthKitSync,
  type HealthKitSyncPort,
  type HealthKitAnchorStore,
} from './healthKitSync.ts';
import type { QuantitySpec } from './healthKitMap.ts';

function memoryAnchors(initial: Record<string, string> = {}): HealthKitAnchorStore {
  const data = { ...initial };
  return {
    async get(identifier: string) {
      return data[identifier] ?? null;
    },
    async set(identifier: string, anchor: string) {
      data[identifier] = anchor;
    },
  };
}

const stepsSpec: QuantitySpec = {
  identifier: 'HKQuantityTypeIdentifierStepCount',
  type: 'steps',
  unit: 'count',
  valueKey: 'count',
  window: 'recent',
};

Deno.test('chunk splits writes so the first import is batched instead of one row per request', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('empty telemetry starts at zero so a sync report cannot omit a stage', () => {
  const t = emptyHealthKitTelemetry();
  assertEquals(t.trigger, 'manual');
  assertEquals(t.stages, []);
  assertEquals(t.healthKitQueryMs, 0);
  assertEquals(t.samplesFetched, 0);
  assertEquals(t.normalizationMs, 0);
  assertEquals(t.databaseWriteMs, 0);
  assertEquals(t.intelligenceProcessingMs, 0);
  assertEquals(t.totalMs, 0);
});

Deno.test('the second sync passes stored HKQueryAnchors and does not refetch historical samples', async () => {
  const anchors = memoryAnchors();
  const requested: { identifier: string; anchor?: string }[] = [];
  let round = 0;
  const written: number[] = [];

  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async (identifier, opts) => {
      requested.push({ identifier, anchor: opts.anchor });
      round += 1;
      if (round === 1) {
        return {
          samples: [
            {
              uuid: 'hk-1',
              quantity: 12,
              startDate: new Date('2026-08-28T12:00:00Z'),
              endDate: new Date('2026-08-28T12:05:00Z'),
            },
          ],
          deletedSamples: [],
          newAnchor: 'anchor-v1',
        };
      }
      assertEquals(opts.anchor, 'anchor-v1');
      return { samples: [], deletedSamples: [], newAnchor: 'anchor-v1' };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'cat' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'wo' }),
    write: async (rows) => {
      written.push(rows.length);
    },
  };

  const first = await runHealthKitSync('user-1', { port, anchors });
  const second = await runHealthKitSync('user-1', { port, anchors });

  assertEquals(first.telemetry.samplesFetched, 1);
  assertEquals(first.observationsSynced, 1);
  assertEquals(first.telemetry.incremental, false);
  assertEquals(written, [1]);

  assertEquals(second.telemetry.samplesFetched, 0);
  assertEquals(second.observationsSynced, 0);
  assertEquals(second.telemetry.incremental, true);
  assertEquals(requested[1]?.anchor, 'anchor-v1');
  assertEquals(written.length, 1);
});

Deno.test('first historical sync uses a date window when no anchor exists', async () => {
  let sawDateFilter = false;
  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async (_id, opts) => {
      sawDateFilter = Boolean(opts.filter?.date?.startDate && opts.filter?.date?.endDate);
      assertEquals(opts.anchor, undefined);
      return { samples: [], deletedSamples: [], newAnchor: 'a0' };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'c' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'w' }),
    write: async () => {},
  };
  await runHealthKitSync('user-1', { port, anchors: memoryAnchors() });
  assert(sawDateFilter);
});

Deno.test('incremental sync never uses a date window and skips types without a stored anchor', async () => {
  let queried = 0;
  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async () => {
      queried += 1;
      return { samples: [], deletedSamples: [], newAnchor: 'should-not-run' };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'c' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'w' }),
    write: async () => {
      throw new Error('incremental with no anchors must not write');
    },
  };
  const result = await runHealthKitSync('user-1', {
    port,
    anchors: memoryAnchors(),
    mode: 'incremental',
    trigger: 'background',
  });
  assertEquals(queried, 0);
  assertEquals(result.telemetry.incremental, true);
  assertEquals(result.telemetry.trigger, 'background');
  assertEquals(result.observationsSynced, 0);
});

Deno.test('incremental catch-up uses the stored HKQueryAnchor and does not refetch history', async () => {
  const requested: { identifier: string; anchor?: string; filter?: unknown }[] = [];
  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async (identifier, opts) => {
      requested.push({ identifier, anchor: opts.anchor, filter: opts.filter });
      return {
        samples: [
          {
            uuid: 'hk-2',
            quantity: 40,
            startDate: new Date('2026-08-28T13:00:00Z'),
            endDate: new Date('2026-08-28T13:05:00Z'),
          },
        ],
        deletedSamples: [{ uuid: 'gone' }],
        newAnchor: 'anchor-v2',
      };
    },
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'c' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'w' }),
    write: async () => {},
  };
  const result = await runHealthKitSync('user-1', {
    port,
    anchors: memoryAnchors({ HKQuantityTypeIdentifierStepCount: 'anchor-v1' }),
    mode: 'incremental',
    trigger: 'catch-up',
    identifiers: ['HKQuantityTypeIdentifierStepCount'],
  });
  assertEquals(requested.length, 1);
  assertEquals(requested[0]?.anchor, 'anchor-v1');
  assertEquals(requested[0]?.filter, undefined);
  assertEquals(result.telemetry.samplesFetched, 1);
  assertEquals(result.telemetry.samplesDeleted, 1);
  assertEquals(result.telemetry.incremental, true);
  assertEquals(result.telemetry.trigger, 'catch-up');
});

Deno.test('background delivery records event, fetch, write, intelligence, and completion stages', async () => {
  const intelligence: string[] = [];
  const port: HealthKitSyncPort = {
    quantitySpecs: [stepsSpec],
    categorySpecs: [],
    queryQuantity: async () => ({
      samples: [
        {
          uuid: 'hk-3',
          quantity: 8,
          startDate: new Date('2026-08-28T14:00:00Z'),
          endDate: new Date('2026-08-28T14:05:00Z'),
        },
      ],
      deletedSamples: [],
      newAnchor: 'a3',
    }),
    queryCategory: async () => ({ samples: [], deletedSamples: [], newAnchor: 'c' }),
    queryWorkouts: async () => ({ workouts: [], deletedSamples: [], newAnchor: 'w' }),
    write: async (rows) => {
      assertEquals(rows.length, 1);
      assertEquals(rows[0]?.sourceSampleId, 'hk-3');
    },
    enqueueIntelligence: async () => {
      intelligence.push('enqueued');
    },
  };
  const result = await runHealthKitSync('user-1', {
    port,
    anchors: memoryAnchors({ HKQuantityTypeIdentifierStepCount: 'a2' }),
    mode: 'incremental',
    trigger: 'background',
    identifiers: ['HKQuantityTypeIdentifierStepCount'],
  });
  assertEquals(intelligence, ['enqueued']);
  assertEquals(result.telemetry.stages, [
    'background_event',
    'samples_fetched',
    'database_write',
    'intelligence_processing',
    'completion',
  ]);
  assert(result.telemetry.intelligenceProcessingMs >= 0);
});
