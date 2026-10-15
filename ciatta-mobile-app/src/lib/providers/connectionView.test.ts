import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Connection } from '../../data/providers';
import { connectionLine, recordsSource, syncNote, updatedLine } from './connectionView';

const c = (over: Partial<Connection> = {}): Connection => ({
  id: 'c1',
  endpointName: 'Mercy Hospital',
  organization: 'Mercy Health',
  status: 'active',
  recordCount: 12,
  lastSyncedAt: null,
  lastError: null,
  ...over,
});

// Local times, so the day boundaries are the phone's, as she sees them.
const NOW = new Date(2026, 9, 14, 15, 0);
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h, 0).toISOString();

test('when it was last updated, in days she would say', () => {
  assert.equal(updatedLine(null, NOW), 'Not updated yet');
  assert.equal(updatedLine(at(2026, 9, 14, 1), NOW), 'Updated today');
  assert.equal(updatedLine(at(2026, 9, 13, 23), NOW), 'Updated yesterday');
  assert.equal(updatedLine(at(2026, 9, 11), NOW), 'Updated 3 days ago');
  assert.equal(updatedLine(at(2026, 9, 4), NOW), 'Updated 4 Oct 2026');
});

test('an expired connection asks to be connected again and says her records are kept', () => {
  const line = connectionLine(c({ status: 'expired' }), NOW);
  assert.match(line, /Needs connecting again/);
  assert.match(line, /kept/);
});

test('a connection that has sent nothing says so, rather than a count of zero', () => {
  assert.equal(connectionLine(c({ status: 'connected', recordCount: 0 }), NOW), 'Connected. Nothing has arrived yet.');
});

test('a working connection gives its count and when it was updated', () => {
  assert.equal(connectionLine(c({ recordCount: 1, lastSyncedAt: at(2026, 9, 14) }), NOW), '1 record. Updated today');
});

test('a scheduled update that did not finish is said in place of when', () => {
  const line = connectionLine(c({ lastError: 'The last update did not finish. Ciatta will try again.' }), NOW);
  assert.equal(line, '12 records. The last update did not finish. Ciatta will try again.');
});

test('Data Sources offers to connect when there is nothing', () => {
  assert.deepEqual(recordsSource([]), {
    status: 'Your hospital or clinic, through its portal',
    tone: 'suggested',
    connected: false,
    target: 'providerConnect',
  });
  assert.equal(recordsSource([c({ status: 'revoked' })]).target, 'providerConnect');
});

test('Data Sources says when one needs connecting again, and opens her providers', () => {
  const s = recordsSource([c({ status: 'expired' }), c({ id: 'c2' })]);
  assert.equal(s.status, 'Needs connecting again');
  assert.equal(s.target, 'chart');
});

test('Data Sources counts what she holds across providers', () => {
  assert.equal(recordsSource([c()]).status, '12 records from Mercy Health');
  assert.equal(recordsSource([c(), c({ id: 'c2', recordCount: 3 })]).status, '15 records from 2 providers');
  assert.equal(recordsSource([c({ status: 'connected', recordCount: 0 })]).target, 'chart');
});

test('a refresh that went through for everyone says nothing', () => {
  assert.equal(syncNote([]), null);
});

test('a refresh that failed names who, so the rest is known to have worked', () => {
  assert.equal(
    syncNote([{ name: 'Mercy Health', message: 'That connection has expired. You can connect again whenever you want.' }]),
    'Mercy Health: That connection has expired. You can connect again whenever you want.',
  );
  assert.equal(
    syncNote([
      { name: 'Mercy Health', message: 'x' },
      { name: 'Hope Clinic', message: 'y' },
    ]),
    'Mercy Health and Hope Clinic could not be updated just now.',
  );
});

test('no line here carries a dash or a hyphen', () => {
  const lines = [
    updatedLine(null, NOW),
    connectionLine(c({ status: 'expired' }), NOW),
    connectionLine(c({ status: 'connected', recordCount: 0 }), NOW),
    recordsSource([]).status,
    recordsSource([c({ status: 'expired' })]).status,
  ];
  for (const line of lines) assert.ok(!/[—–-]/.test(line), line);
});
