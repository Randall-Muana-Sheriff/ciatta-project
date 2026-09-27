import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QUANTITY_SPECS } from './healthMetrics';
import {
  anchorKey,
  portFor,
  runHealthSync,
  syncWindow,
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

test('recovery mode ignores a stored anchor and asks for 90 whole days', async () => {
  const stored = 'anchor.steps.stored';
  const { anchors } = memoryAnchors({ [anchorKey(USER_ID, STEPS.identifier)]: stored });

  const recoveryPort = fakePort();
  await runHealthSync(USER_ID, { port: recoveryPort.port, anchors, mode: 'recovery', now: new Date(2026, 8, 27, 15, 20) });
  const recoveryCall = recoveryPort.queryCalls.find((c) => c.identifier === STEPS.identifier)!;
  assert.equal(recoveryCall.opts.anchor, undefined);
  // Ninety days ending 27 September begin on 30 June, and the read starts
  // the evening before so that first night is whole.
  assert.deepEqual(recoveryCall.opts.since, new Date(2026, 5, 29, 18, 0));
});

test('refresh mode ignores a stored anchor and asks for the last week', async () => {
  const stored = 'anchor.steps.stored';
  const { anchors } = memoryAnchors({ [anchorKey(USER_ID, STEPS.identifier)]: stored });

  const refreshPort = fakePort();
  await runHealthSync(USER_ID, { port: refreshPort.port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 15, 20) });
  const call = refreshPort.queryCalls.find((c) => c.identifier === STEPS.identifier)!;
  assert.equal(call.opts.anchor, undefined);
  assert.deepEqual(call.opts.since, new Date(2026, 8, 20, 18, 0));
  const window = syncWindow(7, new Date(2026, 8, 27, 15, 20));
  assert.deepEqual(window.since, new Date(2026, 8, 20, 18, 0));
  assert.equal(window.firstDay, '2026-09-21');
  assert.equal(window.lastDay, '2026-09-27');
  assert.deepEqual(window.days, ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
});

test('the part of a day the read picked up before its first whole day is never written as the day', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [
          // The evening before the window: read, because the night is, but
          // only the tail of that day's steps.
          stepsSample('2026-09-20T19:00:00', '2026-09-20T19:01:00', 300, 'eve'),
          stepsSample('2026-09-21T09:00:00', '2026-09-21T09:01:00', 900, 'first'),
        ],
        newAnchor: 'anchor.steps.w',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 15, 20) });

  const stepPost = posts.find((batch) => batch.observations.some((o) => (o as { metric?: string }).metric === 'steps'))!;
  // Both readings are kept as observations; only the whole day gets a row.
  assert.equal(stepPost.observations.length, 2);
  assert.deepEqual(stepPost.days, [{ day: '2026-09-21', steps: 900 }]);
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

  await runHealthSync(USER_ID, { port, anchors, mode: 'recovery', now: new Date(2026, 0, 5, 12, 0) });

  const stepPost = posts.find((batch) =>
    batch.observations.some((o) => (o as { metric?: string }).metric === 'steps'),
  )!;
  assert.equal(stepPost.days.length, 1);
  const day = stepPost.days[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(day).sort(), ['day', 'steps']);
});

const SLEEP_IDENTIFIER = 'HKCategoryTypeIdentifierSleepAnalysis';
const NO_NIGHT = { sleep_hours: null, time_in_bed: null, stage_awake: null, stage_rem: null, stage_light: null, stage_deep: null };

function sleepSample(startIso: string, endIso: string, value: number, uuid: string) {
  return { uuid, startDate: new Date(startIso), endDate: new Date(endIso), value };
}

test('a pass that read sleep tells her record which days in the window hold no night', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [SLEEP_IDENTIFIER]: {
        samples: [sleepSample('2026-09-24T23:00:00', '2026-09-25T06:00:00', 1, 'night')],
        newAnchor: 'anchor.sleep.a',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 15, 20) });

  const days = posts.flatMap((batch) => batch.days) as Array<Record<string, unknown>>;
  assert.deepEqual(days.map((d) => d.day).sort(), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  assert.deepEqual(days.find((d) => d.day === '2026-09-25'), { day: '2026-09-25', sleep_hours: 7, time_in_bed: 7 });
  for (const day of days.filter((d) => d.day !== '2026-09-25')) {
    assert.deepEqual(day, { day: day.day, ...NO_NIGHT });
  }
});

test('a pass that read no sleep at all clears nothing: access taken away looks the same', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-09-25T09:00:00', '2026-09-25T09:01:00', 900, 'a')],
        newAnchor: 'anchor.steps.b',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 15, 20) });

  const days = posts.flatMap((batch) => batch.days) as Array<Record<string, unknown>>;
  assert.deepEqual(days, [{ day: '2026-09-25', steps: 900 }]);
});

test('only sleep is ever cleared: a day with no steps read keeps the steps it has', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-09-25T09:00:00', '2026-09-25T09:01:00', 900, 'a')],
        newAnchor: 'anchor.steps.c',
      },
      [SLEEP_IDENTIFIER]: {
        samples: [sleepSample('2026-09-24T23:00:00', '2026-09-25T06:00:00', 1, 'night')],
        newAnchor: 'anchor.sleep.c',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 15, 20) });

  const days = posts.flatMap((batch) => batch.days) as Array<Record<string, unknown>>;
  assert.equal(days.some((d) => 'steps' in d && d.steps == null), false);
});

test('an evening in bed belongs to a night that has not ended, and is not written as tomorrow', async () => {
  const { anchors } = memoryAnchors();
  const { port, posts } = fakePort({
    responses: {
      [SLEEP_IDENTIFIER]: {
        samples: [
          sleepSample('2026-09-26T23:00:00', '2026-09-27T06:00:00', 1, 'last-night'),
          sleepSample('2026-09-27T18:30:00', '2026-09-27T19:30:00', 1, 'this-evening'),
        ],
        newAnchor: 'anchor.sleep.d',
      },
    },
  });

  await runHealthSync(USER_ID, { port, anchors, mode: 'refresh', now: new Date(2026, 8, 27, 20, 0) });

  const posted = posts.flatMap((batch) => batch.days) as Array<Record<string, unknown>>;
  assert.equal(posted.some((d) => d.day === '2026-09-28'), false);
  assert.deepEqual(posted.find((d) => d.day === '2026-09-27'), { day: '2026-09-27', sleep_hours: 7, time_in_bed: 7 });
  // Both stretches are still kept as observations.
  assert.equal(posts.flatMap((batch) => batch.observations).length, 2);
});

// ── Fix round 1: the anchor store itself can fail ───────────────────

const RESTING_HR = QUANTITY_SPECS.find((s) => s.identifier === 'HKQuantityTypeIdentifierRestingHeartRate')!;

test('a storage failure setting the anchor does not abort the run: the metric is marked failed, and later metrics are still attempted', async () => {
  const { anchors, store } = memoryAnchors();
  const failingKey = anchorKey(USER_ID, STEPS.identifier);
  const throwingAnchors: AnchorStore = {
    get: anchors.get,
    async set(key, anchor) {
      if (key === failingKey) throw new Error('disk full');
      await anchors.set(key, anchor);
    },
  };
  const { port } = fakePort({
    responses: {
      [STEPS.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')],
        newAnchor: 'anchor.steps.new',
      },
      [RESTING_HR.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 58, 'b')],
        newAnchor: 'anchor.rhr.new',
      },
    },
  });

  const result = await runHealthSync(USER_ID, { port, anchors: throwingAnchors, mode: 'recovery' });

  // The whole run completed: every spec got an outcome, not just the ones
  // before the one whose anchor write failed.
  assert.equal(result.metrics.length, 12);
  assert.ok(result.failed.includes(STEPS.identifier));
  assert.equal(store[failingKey], undefined);

  const stepsOutcome = result.metrics.find((m) => m.identifier === STEPS.identifier)!;
  assert.equal(stepsOutcome.ok, false);
  assert.ok(stepsOutcome.error);
  assert.equal(stepsOutcome.posted, 1);

  // A metric that comes later in the spec list was still queried and posted.
  const rhrOutcome = result.metrics.find((m) => m.identifier === RESTING_HR.identifier)!;
  assert.equal(rhrOutcome.ok, true);
  assert.equal(store[anchorKey(USER_ID, RESTING_HR.identifier)], 'anchor.rhr.new');
});

test('a storage failure reading the anchor does not abort the run', async () => {
  const { anchors, store } = memoryAnchors();
  const failingKey = anchorKey(USER_ID, STEPS.identifier);
  const throwingAnchors: AnchorStore = {
    async get(key) {
      if (key === failingKey) throw new Error('read failed');
      return anchors.get(key);
    },
    set: anchors.set,
  };
  const { port } = fakePort({
    responses: {
      [RESTING_HR.identifier]: {
        samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 58, 'b')],
        newAnchor: 'anchor.rhr.new',
      },
    },
  });

  const result = await runHealthSync(USER_ID, { port, anchors: throwingAnchors, mode: 'incremental' });

  assert.equal(result.metrics.length, 12);
  assert.ok(result.failed.includes(STEPS.identifier));
  const stepsOutcome = result.metrics.find((m) => m.identifier === STEPS.identifier)!;
  assert.equal(stepsOutcome.ok, false);
  assert.ok(stepsOutcome.error);

  const rhrOutcome = result.metrics.find((m) => m.identifier === RESTING_HR.identifier)!;
  assert.equal(rhrOutcome.ok, true);
  assert.equal(store[anchorKey(USER_ID, RESTING_HR.identifier)], 'anchor.rhr.new');
});

// ── Fix round 1: the partial batch failure the anchor rule protects ──

test('a partial batch failure leaves the anchor at its old value, and a retry re-reads from there and re-posts the same dedupe keys', async () => {
  const OLD_ANCHOR = 'anchor.steps.old';
  const { anchors, store } = memoryAnchors({ [anchorKey(USER_ID, STEPS.identifier)]: OLD_ANCHOR });
  const samples = manySteps(600);
  const queryCalls: Array<{ identifier: string; anchor?: string }> = [];

  let postCallCount = 0;
  let failSecondBatch = true;
  const firstPosts: Array<{ observations: unknown[]; days: unknown[] }> = [];

  const query = async (identifier: string, opts: { anchor?: string; limit: number; since?: Date }) => {
    queryCalls.push({ identifier, anchor: opts.anchor });
    return {
      samples: identifier === STEPS.identifier ? samples : [],
      newAnchor: 'anchor.steps.new',
    };
  };

  const firstPort: SyncPort = {
    query,
    async post(batch) {
      postCallCount += 1;
      const isSteps = batch.observations.some((o) => (o as { metric?: string }).metric === 'steps');
      if (failSecondBatch && isSteps && postCallCount === 2) {
        throw new Error('network dropped');
      }
      firstPosts.push(batch);
    },
  };

  const firstRun = await runHealthSync(USER_ID, { port: firstPort, anchors, mode: 'incremental' });
  const firstOutcome = firstRun.metrics.find((m) => m.identifier === STEPS.identifier)!;

  // Batch 1 of 3 landed durably; batch 2 threw; batch 3 was never attempted.
  assert.equal(firstOutcome.ok, false);
  assert.equal(firstOutcome.posted, 250);
  assert.equal(firstPosts.filter((b) => b.observations.some((o) => (o as { metric?: string }).metric === 'steps')).length, 1);
  // The anchor did not move: it is still the one this run started from.
  assert.equal(store[anchorKey(USER_ID, STEPS.identifier)], OLD_ANCHOR);

  // Retry: the next run re-reads from the same old anchor, and this time
  // every batch lands.
  failSecondBatch = false;
  postCallCount = 0;
  const secondPosts: Array<{ observations: unknown[]; days: unknown[] }> = [];
  const retryPort: SyncPort = {
    query,
    async post(batch) {
      secondPosts.push(batch);
    },
  };
  await runHealthSync(USER_ID, { port: retryPort, anchors, mode: 'incremental' });

  const stepsQueryCalls = queryCalls.filter((c) => c.identifier === STEPS.identifier);
  assert.equal(stepsQueryCalls.length, 2);
  assert.equal(stepsQueryCalls[0].anchor, OLD_ANCHOR);
  assert.equal(stepsQueryCalls[1].anchor, OLD_ANCHOR);
  assert.equal(store[anchorKey(USER_ID, STEPS.identifier)], 'anchor.steps.new');

  const firstKeys = firstPosts.flatMap((b) => b.observations as { dedupe_key: string }[]).map((o) => o.dedupe_key);
  const secondKeys = secondPosts
    .filter((b) => b.observations.some((o) => (o as { metric?: string }).metric === 'steps'))
    .flatMap((b) => b.observations as { dedupe_key: string }[])
    .map((o) => o.dedupe_key);
  assert.equal(secondKeys.length, 600);
  for (const key of firstKeys) assert.ok(secondKeys.includes(key));
});

// ── The account boundary during a read ──────────────────────────────

test('a read stops sending the moment someone else is signed in, and marks nothing as done', async () => {
  const { anchors, store } = memoryAnchors();
  const inner = fakePort({
    responses: {
      [STEPS.identifier]: { samples: manySteps(600), newAnchor: 'anchor.steps.z' },
    },
  });
  // Hers for the first post, somebody else's from the second.
  let asked = 0;
  const port = portFor(USER_ID, inner.port, async () => (asked++ === 0 ? USER_ID : 'user-2'));

  const result = await runHealthSync(USER_ID, { port, anchors, mode: 'incremental' });

  assert.equal(inner.posts.length, 1, 'only the post made while she was signed in went out');
  assert.deepEqual(result.failed, [STEPS.identifier]);
  assert.equal(store[anchorKey(USER_ID, STEPS.identifier)], undefined);
});

test('a read sends nothing at all once she has signed out', async () => {
  const { anchors } = memoryAnchors();
  const inner = fakePort({
    responses: {
      [STEPS.identifier]: { samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')], newAnchor: 'anchor.steps.y' },
    },
  });
  const port = portFor(USER_ID, inner.port, async () => null);

  const result = await runHealthSync(USER_ID, { port, anchors, mode: 'incremental' });

  assert.equal(inner.posts.length, 0);
  assert.deepEqual(result.failed, [STEPS.identifier]);
});

test('while she stays signed in the port is the port', async () => {
  const { anchors } = memoryAnchors();
  const inner = fakePort({
    responses: {
      [STEPS.identifier]: { samples: [stepsSample('2026-01-01T08:00:00Z', '2026-01-01T08:01:00Z', 500, 'a')], newAnchor: 'anchor.steps.x' },
    },
  });
  const port = portFor(USER_ID, inner.port, async () => USER_ID);

  const result = await runHealthSync(USER_ID, { port, anchors, mode: 'incremental' });

  assert.equal(inner.posts.length, 1);
  assert.deepEqual(result.failed, []);
  assert.equal(inner.queryCalls.length > 0, true);
});
