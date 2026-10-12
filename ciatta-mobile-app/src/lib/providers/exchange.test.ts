import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  exchangeBody,
  failureLine,
  FETCH_ORDER,
  isFailure,
  needsRefresh,
  readTokens,
  refreshBody,
  resourceQuery,
} from '../../../supabase/functions/provider-connect/exchange.ts';

const NOW = new Date('2026-10-11T12:00:00.000Z');

// ── Reading what the provider sent ───────────────────────────────────

test('a good response becomes tokens with an absolute expiry', () => {
  const t = readTokens({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, patient: 'p1', scope: 'a b' }, NOW);
  assert.ok(!isFailure(t));
  if (isFailure(t)) return;
  assert.equal(t.accessToken, 'at');
  assert.equal(t.refreshToken, 'rt');
  assert.equal(t.expiresAt, '2026-10-11T13:00:00.000Z');
  assert.equal(t.patientId, 'p1');
  assert.deepEqual(t.grantedScopes, ['a', 'b']);
});

test('an error response is a failure, not a token', () => {
  const t = readTokens({ error: 'invalid_grant', error_description: 'Code expired' }, NOW);
  assert.ok(isFailure(t));
  assert.equal(isFailure(t) && t.detail, 'Code expired');
});

test('a response with no access token is refused rather than half believed', () => {
  assert.ok(isFailure(readTokens({ refresh_token: 'rt' }, NOW)));
  assert.ok(isFailure(readTokens({ access_token: '   ' }, NOW)));
});

test('junk is a failure, never a crash', () => {
  for (const junk of [null, undefined, 'token', 7]) assert.ok(isFailure(readTokens(junk, NOW)));
});

test('an absent or absurd expires_in falls back to the SMART default', () => {
  for (const bad of [undefined, 0, -5, 99999999]) {
    const t = readTokens({ access_token: 'at', expires_in: bad }, NOW);
    assert.equal(isFailure(t) ? null : t.expiresAt, '2026-10-11T13:00:00.000Z', String(bad));
  }
});

test('no refresh token is null, not an empty string pretending to be one', () => {
  const t = readTokens({ access_token: 'at' }, NOW);
  assert.equal(isFailure(t) ? 'fail' : t.refreshToken, null);
});

// ── PKCE ─────────────────────────────────────────────────────────────

test('the verifier appears in the exchange and the exchange alone', () => {
  const body = exchangeBody('code1', 'ciatta://cb', 'client1', 'verifier1');
  const p = new URLSearchParams(body);
  assert.equal(p.get('grant_type'), 'authorization_code');
  assert.equal(p.get('code_verifier'), 'verifier1');
  assert.ok(!body.includes('client_secret'), 'a public client has no secret to send');
});

test('a refresh sends no verifier and no secret', () => {
  const p = new URLSearchParams(refreshBody('rt', 'client1'));
  assert.equal(p.get('grant_type'), 'refresh_token');
  assert.equal(p.get('code_verifier'), null);
  assert.equal(p.get('client_secret'), null);
});

// ── Querying her chart and nobody else's ─────────────────────────────

test('every query is scoped to her patient id', () => {
  for (const type of FETCH_ORDER) {
    const url = resourceQuery('https://fhir.org/R4/', type, 'patient-9');
    assert.ok(url.includes('patient=patient-9'), `${type} is not scoped to a patient`);
  }
});

test('observations are narrowed to labs and vitals', () => {
  // Unnarrowed, a long record returns tens of thousands of rows.
  const url = resourceQuery('https://fhir.org/R4', 'Observation', 'p');
  assert.ok(url.includes('category=laboratory%2Cvital-signs'), url);
  assert.ok(!resourceQuery('https://fhir.org/R4', 'Condition', 'p').includes('category='));
});

test('a trailing slash on the base does not become a double slash', () => {
  assert.ok(resourceQuery('https://fhir.org/R4///', 'Condition', 'p').startsWith('https://fhir.org/R4/Condition?'));
});

// ── Refreshing before it fails, not after ────────────────────────────

test('a token inside its last minute is refreshed first', () => {
  assert.equal(needsRefresh('2026-10-11T12:00:30.000Z', NOW), true);
  assert.equal(needsRefresh('2026-10-11T13:00:00.000Z', NOW), false);
});

test('a missing or unreadable expiry is treated as expired', () => {
  assert.equal(needsRefresh(null, NOW), true);
  assert.equal(needsRefresh('whenever', NOW), true);
});

// ── What she reads ───────────────────────────────────────────────────

test('every failure says nothing was shared, and leaks no protocol words', () => {
  for (const reason of ['provider_error', 'no_access_token', 'malformed'] as const) {
    const line = failureLine({ reason, detail: 'invalid_grant' });
    assert.ok(line.includes('Nothing was shared'), line);
    assert.ok(!line.includes('_'), line);
    assert.ok(!/[—–]/.test(line), line);
  }
});
