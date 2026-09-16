import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUANTITY_SPECS } from './healthMetrics';
import {
  anchorKey,
  runHealthSync,
  type AnchorStore,
  type SyncPort,
  type SyncProgress,
} from './healthSync';

const STEPS = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierStepCount')!;
const USER_ID = 'user-1';

// ── Test doubles ─────────────────────────────────────────────────

function memoryAnchors(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  const sets: Array<{ key: string; anchor: string }> = [];
  const anchors: AnchorStore = {
    async get(key) {
      return store[key] ?? null;
    },
    async set(key, anchor) {
      store[key] = anchor;
      sets.push({ key, anchor });
    },
  };
  return { anchors, store, sets };
}

type QueryCall = { identifier: string; opts: { anchor?: string; limit: number; since?: Date } };

// A fake port. `responses` maps an identifier to the samples/anchor it
// should hand back; anything not listed answers with no samples. `failPost`
// names an identifier whose batch (any batch containing one of its
// observations) should fail once posted.
function fakePort(options: {
  responses?: Record<string, { samples: unknown[]; newAnchor: string }>;
  failMetric?: string;
} = {}) {
  const { responses = {}, failMetric } = options;
  const queryCalls: QueryCall[] = [];
  const posts: Array<{ observations: unknown[]; days: unknown[] }> = [];
  const port: SyncPort = {
    async query(identifier, opts) {
      queryCalls.push({ identifier, opts });
      return responses[identifier] ?? { samples: [], newAnchor: `anchor.${identifier}.empty` };
    },
    async post(batch) {
      if (
        failMetric &&
        batch.observations.some((o) => (o as { metric?: string }).metric === failMetric)
      ) {
        throw new Error('post failed');
      }
      posts.push(batch);
    },
  };
  return { port, queryCalls, posts };
}

function stepsSample(startIso: string, endIso: string, value: number, uuid: string) {
  return { uuid, startDate: new Date(startIso), endDate: new Date(endIso), value };
}

function manySteps(count: number) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const day = String(i % 28 + 1).padStart(2, '0');
    samples.push(
      stepsSample(`2026-01-${day}T08:00:00Z`, `2026-01-${day}T08:01:00Z`, 10, `steps-${i}`),
    );
  }
  return samples;
}

// ── Tests ────────────────────────────────────────────────────────

test('anchors advance only after a successful post; a failing post leaves the stored anchor unchanged', async () => {
  const { anchors, store } = memoryAnchors();
  const { port } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')],
        newAnchor: 'anchor.steps.2',
      },
    },
    failMetric: 'steps',
  });

  const result = await runHealthSync(USER_ID, { port, anchors, mode: 'incremental' });

  assert.equal(store[anchorKey(USER_ID, STEPS.identifier)], undefined);
  assert.ok(result.failed.includes(STEPS.identifier));
  const outcome = result.metrics.find((m) => m.identifier === STEPS.identifier)!;
  assert.equal(outcome.ok, false);
  assert.ok(outcome.error);
});

test('a successful post advances the anchor to the value the query returned', async () => {
  const { anchors, store } = memoryAnchors();
  const { port } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')],
        newAnchor: 'anchor.steps.2',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'incremental' });

  assert.equal(store[anchorKey(USER_ID, STEPS.identifier)], 'anchor.steps.2');
});

test('a second run over the same samples posts the same dedupe keys', async () => {
  const samples = [
    stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a'),
    stepsSample('2026-01-02T08:00:00Z', '2026-01-02T08:01:00Z', 700, 'b'),
  ];

  const run = async () => {
    const { anchors } = memoryAnchors();
    const { port, posts } = fakePort({
      responses: { [STEPS.identifier]: { samples, newAnchor: 'anchor.steps.x' } },
    });
    await runHealthSync(USER_ID, { port, anchors, mode: 'recovery' });
    return posts
      .flatMap((batch) => batch.observations as { dedupe_key: string }[])
      .map((o) => o.dedupe_key)
      .sort();
  };

  const first = await run();
  const second = await run();
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
});

test('600 observations for one metric produce three posts, and the anchor advances once at the end', async () => {
  const { anchors, sets } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [STEPS.identifier]: { samples: manySteps(600), newAnchor: 'anchor.steps.done' },
    },
  });

  const result = await runHealthSync(USER_ID, { port, anchors, mode: 'recovery' });

  const stepPosts = posts.filter((batch) =>
    batch.observations.some((o) => (o as { metric?: string }).metric === 'steps'),
  );
  assert.equal(stepPosts.length, 3);
  assert.deepEqual(
    stepPosts.map((b) => b.observations.length),
    [250, 250, 100],
  );
  const stepSets = sets.filter((s) => s.key === anchorKey(USER_ID, STEPS.identifier));
  assert.equal(stepSets.length, 1);
  assert.equal(stepSets[0].anchor, 'anchor.steps.done');
  assert.equal(result.observations >= 600, true);
});

test('recovery mode ignores a stored anchor and asks for 90 days', async () => {
  const stored = 'anchor.steps.stored';
  const { anchors } = memoryAnchors({ [anchorKey(USER_ID, STEPS.identifier)]: stored });

  const recoveryPort = fakePort();
  await runHealthSync(USER_ID, { port: recoveryPort.port, anchors, mode: 'recovery' });
  const recoveryCall = recoveryPort.queryCalls.find((c) => c.identifier === STEPS.identifier)!;
  assert.equal(recoveryCall.opts.anchor, undefined);
  assert.ok(recoveryCall.opts.since instanceof Date);
  const daysAgo = (Date.now() - recoveryCall.opts.since!.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(daysAgo - 90) < 1, `expected about 90 days back, got ${daysAgo}`);
});

test('incremental mode passes the stored anchor', async () => {
  const stored = 'anchor.steps.stored';
  const { anchors } = memoryAnchors({ [anchorKey(USER_ID, STEPS.identifier)]: stored });

  const incrementalPort = fakePort();
  await runHealthSync(USER_ID, { port: incrementalPort.port, anchors, mode: 'incremental' });
  const incrementalCall = incrementalPort.queryCalls.find((c) => c.identifier === STEPS.identifier)!;
  assert.equal(incrementalCall.opts.anchor, stored);
  assert.equal(incrementalCall.opts.since, undefined);
});

test('progress is reported per metric, and the counts add up', async () => {
  const { anchors } = memoryAnchors();
  const { port } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [
          stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a'),
          stepsSample('2026-01-02T08:00:00Z', '2026-01-02T08:01:00Z', 700, 'b'),
        ],
        newAnchor: 'anchor.steps.p',
      },
    },
  });

  const progress: SyncProgress[] = [];
  const result = await runHealthSync(USER_ID, {
    port,
    anchors,
    mode: 'recovery',
    onProgress: (p) => progress.push(p),
  });

  assert.ok(progress.length >= 12);
  assert.equal(progress.every((p) => p.total === progress.length), true);
  assert.equal(
    progress.reduce((sum, p) => sum + p.samples, 0),
    result.samples,
  );
  assert.equal(
    progress.reduce((sum, p) => sum + p.posted, 0),
    result.observations,
  );
});

test('a day foldDay left a field out of is posted with that field still absent', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')],
        newAnchor: 'anchor.steps.q',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'recovery' });

  const stepPost = posts.find((batch) =>
    batch.observations.some((o) => (o as { metric?: string }).metric === 'steps'),
  )!;
  assert.equal(stepPost.days.length, 1);
  const day = stepPost.days[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(day).sort(), ['day', 'steps']);
});
