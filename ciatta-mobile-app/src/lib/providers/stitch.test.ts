import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stitchOutcome } from './stitch';

test('widget.complete closes the sheet', () => {
  assert.deepEqual(stitchOutcome({ event_type: 'widget.complete', data: [] }), { kind: 'complete' });
});

test('a connection made is counted, never named', () => {
  assert.deepEqual(stitchOutcome({ event_type: 'patient.connection_success', data: { org_connection_id: 'x' } }), { kind: 'connected' });
});

test('a failed connection says nothing was shared', () => {
  assert.deepEqual(stitchOutcome({ event_type: 'patient.connection_failed', data: { error: 'invalid_grant' } }), {
    kind: 'failed',
    message: 'That provider did not connect. Nothing was shared.',
  });
});

test('anything else, or nothing readable, is ignored', () => {
  assert.equal(stitchOutcome({ event_type: 'search.query' }), null);
  assert.equal(stitchOutcome(null), null);
  assert.equal(stitchOutcome('widget.complete'), null);
});
