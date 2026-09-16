import assert from 'node:assert/strict';
import { test } from 'node:test';

import { outcomeForConnectAttempt } from './connectSource';
import type { MetricOutcome, SyncResult } from './healthSync';

function outcome(ok: boolean, id: string): MetricOutcome {
  return { identifier: id, metric: id, samples: ok ? 3 : 0, observations: ok ? 3 : 0, posted: ok ? 3 : 0, ok, error: ok ? undefined : 'failed' };
}

function result(metrics: MetricOutcome[]): SyncResult {
  return {
    observations: metrics.reduce((n, m) => n + m.posted, 0),
    samples: metrics.reduce((n, m) => n + m.samples, 0),
    metrics,
    failed: metrics.filter((m) => !m.ok).map((m) => m.identifier),
  };
}

test('unavailable maps to unsupported, honestly, not as a failure', () => {
  const out = outcomeForConnectAttempt({ kind: 'unavailable' });
  assert.equal(out.status, 'unsupported');
  assert.match(out.message, /not available/);
});

test('refused permission maps to refused, without nagging', () => {
  const out = outcomeForConnectAttempt({ kind: 'refused' });
  assert.equal(out.status, 'refused');
  assert.match(out.message, /not given/);
});

test('every metric succeeding maps to active with no warning', () => {
  const out = outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(true, 'a'), outcome(true, 'b')]) });
  assert.equal(out.status, 'active');
  assert.doesNotMatch(out.message, /did not arrive/);
});

test('some metrics failing still maps to active, but says so, and promises no automatic retry that does not exist', () => {
  const out = outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(true, 'a'), outcome(false, 'b')]) });
  assert.equal(out.status, 'active');
  assert.match(out.message, /did not arrive/);
  assert.match(out.message, /try again/);
  assert.doesNotMatch(out.message, /tried again/, 'nothing retries automatically; only she can, from this screen');
});

test('every metric failing maps to error, not a false active, and promises no automatic retry that does not exist', () => {
  const out = outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(false, 'a'), outcome(false, 'b')]) });
  assert.equal(out.status, 'error');
  assert.match(out.message, /try again/);
  assert.doesNotMatch(out.message, /tried again/, 'nothing retries automatically; only she can, from this screen');
});

test('no user facing copy uses an em dash, en dash or hyphen', () => {
  const messages = [
    outcomeForConnectAttempt({ kind: 'unavailable' }).message,
    outcomeForConnectAttempt({ kind: 'refused' }).message,
    outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(true, 'a')]) }).message,
    outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(true, 'a'), outcome(false, 'b')]) }).message,
    outcomeForConnectAttempt({ kind: 'synced', result: result([outcome(false, 'a')]) }).message,
  ];
  for (const m of messages) assert.doesNotMatch(m, /[—–−‐‑‒-]/);
});
