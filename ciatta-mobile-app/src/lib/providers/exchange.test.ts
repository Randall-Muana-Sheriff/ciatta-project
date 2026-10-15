import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  exchangeBody,
  failureLine,
  FETCH_ORDER,
  FETCH_PLAN,
  MAX_PAGES,
  nextPage,
  planFor,
  planQuery,
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

// ── The whole chart, in the shape Epic answers ───────────────────────

test('the plan reads every part of her chart Ciatta keeps', () => {
  const types = new Set(FETCH_PLAN.map((p) => p.type));
  for (const t of ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Observation', 'Immunization', 'Procedure', 'DiagnosticReport', 'DocumentReference', 'Encounter', 'Appointment', 'Device', 'FamilyMemberHistory', 'Goal', 'CarePlan', 'Coverage']) {
    assert.ok(types.has(t), t);
  }
});

test('every planned query is scoped to her patient id', () => {
  for (const p of FETCH_PLAN) assert.ok(planQuery('https://fhir.org/R4', p, 'patient-9').includes('patient=patient-9'), p.type);
});

test('conditions are read by each list Epic keeps them on', () => {
  const cats = FETCH_PLAN.filter((p) => p.type === 'Condition').map((p) => p.params?.category);
  assert.deepEqual(cats.sort(), ['encounter-diagnosis', 'health-concern', 'medical-history', 'problem-list-item']);
});

test('appointments, care plans and notes carry the category Epic requires', () => {
  const q = (type: string) => planQuery('https://fhir.org/R4', FETCH_PLAN.find((p) => p.type === type)!, 'p');
  assert.ok(q('Appointment').includes('service-category=appointment'));
  assert.ok(q('CarePlan').includes('category=38717003'));
  assert.ok(q('DocumentReference').includes('category=clinical-note'));
});

// ── Servers that are not Epic ────────────────────────────────────────

test('Epic is read by the plan Epic requires', () => {
  assert.deepEqual(planFor('epic'), FETCH_PLAN);
});

test('elsewhere, conditions are read once with no category, so untagged ones still arrive', () => {
  for (const vendor of ['cerner', 'athena', 'other']) {
    const conditions = planFor(vendor).filter((p) => p.type === 'Condition');
    assert.equal(conditions.length, 1, vendor);
    assert.equal(conditions[0].params, undefined, vendor);
  }
});

test('elsewhere, no type is narrowed to a category the server may not use', () => {
  for (const p of planFor('other')) assert.equal(p.params, undefined, p.type);
  assert.deepEqual(new Set(planFor('other').map((p) => p.type)), new Set(FETCH_PLAN.map((p) => p.type)));
});

// ── Reading past the first page ──────────────────────────────────────

const BASE = 'https://fhir.example.org/api/FHIR/R4';

test('the next page is followed when the server offers one on its own address', () => {
  const next = `${BASE}?_getpages=abc&_getpagesoffset=100`;
  assert.equal(nextPage({ link: [{ relation: 'self', url: BASE }, { relation: 'next', url: next }] }, BASE), next);
});

test('a last page, or something unreadable, ends the reading', () => {
  assert.equal(nextPage({ link: [{ relation: 'self', url: BASE }] }, BASE), null);
  assert.equal(nextPage({}, BASE), null);
  assert.equal(nextPage(null, BASE), null);
  assert.equal(nextPage({ link: [{ relation: 'next', url: 'not a url' }] }, BASE), null);
});

test('a next link to any other host is never followed, because her token would go with it', () => {
  assert.equal(nextPage({ link: [{ relation: 'next', url: 'https://elsewhere.example.com/R4?page=2' }] }, BASE), null);
  assert.equal(nextPage({ link: [{ relation: 'next', url: 'http://fhir.example.org/api/FHIR/R4?page=2' }] }, BASE), null);
});

test('reading stops at a bound, so a server that never ends cannot hold the sync', () => {
  assert.ok(MAX_PAGES >= 10 && MAX_PAGES <= 100);
});
