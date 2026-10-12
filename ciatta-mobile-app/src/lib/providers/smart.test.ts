import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Endpoint } from './directory';
import { authorizeUrl, failureLine, readCallback, SCOPES, type SmartConfig, smartConfigUrl } from './smart';

const endpoint: Endpoint = {
  id: '1',
  name: "St Luke's Boise",
  organization: "St Luke's",
  fhirBaseUrl: 'https://fhir.slhs.org/api/FHIR/R4',
  vendor: 'epic',
  portalName: 'MyChart',
};

const config: SmartConfig = {
  authorizationEndpoint: 'https://fhir.slhs.org/oauth2/authorize',
  tokenEndpoint: 'https://fhir.slhs.org/oauth2/token',
  scopesSupported: [...SCOPES, 'offline_access'],
};

const random = { verifier: 'v'.repeat(64), state: 'st4te', challenge: 'ch4llenge' };
const REDIRECT = 'ciatta://provider-callback';

const paramsOf = (url: string) => new URLSearchParams(url.slice(url.indexOf('?') + 1));

// ── The authorize request ────────────────────────────────────────────

test('the request carries everything SMART requires', () => {
  const p = paramsOf(authorizeUrl(endpoint, config, REDIRECT, 'client-1', random).url);
  assert.equal(p.get('response_type'), 'code');
  assert.equal(p.get('client_id'), 'client-1');
  assert.equal(p.get('redirect_uri'), REDIRECT);
  assert.equal(p.get('state'), 'st4te');
});

test('aud is the FHIR base, which is the field most often left out', () => {
  // Without aud the server rejects the request and its error does not say
  // why, so this is asserted rather than trusted.
  const p = paramsOf(authorizeUrl(endpoint, config, REDIRECT, 'c', random).url);
  assert.equal(p.get('aud'), 'https://fhir.slhs.org/api/FHIR/R4');
});

test('PKCE is sent as the challenge, and the verifier never is', () => {
  const req = authorizeUrl(endpoint, config, REDIRECT, 'c', random);
  const p = paramsOf(req.url);
  assert.equal(p.get('code_challenge'), 'ch4llenge');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.ok(!req.url.includes(random.verifier), 'the verifier must never leave the device in this request');
  assert.equal(req.verifier, random.verifier);
});

test('offline access is asked for only where the server offers it', () => {
  const withIt = paramsOf(authorizeUrl(endpoint, config, REDIRECT, 'c', random).url).get('scope') ?? '';
  assert.ok(withIt.includes('offline_access'));

  const without = { ...config, scopesSupported: [...SCOPES] };
  const got = paramsOf(authorizeUrl(endpoint, without, REDIRECT, 'c', random).url).get('scope') ?? '';
  assert.ok(!got.includes('offline_access'), 'asking for a scope the server does not offer fails the whole request');
});

test('an authorize endpoint that already has a query keeps it', () => {
  const odd = { ...config, authorizationEndpoint: 'https://x.org/authorize?tenant=7' };
  const url = authorizeUrl(endpoint, odd, REDIRECT, 'c', random).url;
  assert.ok(url.includes('tenant=7'), url);
  assert.ok(url.includes('&response_type=code'), url);
});

// ── What is asked for ────────────────────────────────────────────────

test('every scope is read only, so nothing can write to her chart', () => {
  for (const scope of SCOPES) {
    if (scope === 'openid' || scope === 'fhirUser' || scope === 'launch/patient') continue;
    assert.ok(scope.endsWith('.read'), `${scope} is not read only`);
    assert.ok(scope.startsWith('patient/'), `${scope} reaches past her own chart`);
  }
});

test('no client secret appears anywhere in the module', () => {
  // A phone cannot keep a secret. If one is ever added here it ships to
  // everyone who downloads the app.
  const source = readFileSync(new URL('./smart.ts', import.meta.url), 'utf8');
  assert.ok(!/client_secret/.test(source), 'a client secret has been added to a public client');
});

// ── The callback ─────────────────────────────────────────────────────

test('a good callback gives up its code', () => {
  const out = readCallback(`${REDIRECT}?code=abc123&state=st4te`, 'st4te');
  assert.deepEqual(out, { ok: true, code: 'abc123' });
});

test('a callback with the wrong state is refused before anything in it is believed', () => {
  const out = readCallback(`${REDIRECT}?code=abc123&state=somebody-elses`, 'st4te');
  assert.equal(out.ok, false);
  assert.equal(out.ok === false && out.reason, 'state_mismatch');
});

test('an error arriving with the wrong state is still a mismatch, not her refusal', () => {
  // Order matters: reporting this as "you declined" would be telling her
  // she did something she did not do.
  const out = readCallback(`${REDIRECT}?error=access_denied&state=wrong`, 'st4te');
  assert.equal(out.ok === false && out.reason, 'state_mismatch');
});

test('a refusal at the portal is reported as a refusal', () => {
  const out = readCallback(`${REDIRECT}?error=access_denied&error_description=User+said+no&state=st4te`, 'st4te');
  assert.equal(out.ok === false && out.reason, 'denied');
  assert.equal(out.ok === false && out.detail, 'User said no');
});

test('a callback with no code and no error is not treated as success', () => {
  assert.equal(readCallback(`${REDIRECT}?state=st4te`, 'st4te').ok, false);
});

test('an empty expected state never matches, so a stale callback cannot slip through', () => {
  assert.equal(readCallback(`${REDIRECT}?code=a&state=`, '').ok, false);
});

// ── What she reads ───────────────────────────────────────────────────

test('failure is said in her words, and always says nothing was shared', () => {
  for (const reason of ['denied', 'state_mismatch', 'no_code'] as const) {
    const line = failureLine(reason);
    assert.ok(!line.includes('_'), `${line} leaks a protocol word`);
    assert.ok(!/[—–]/.test(line), line);
  }
  assert.ok(failureLine('denied').includes('nothing was shared'));
  assert.ok(failureLine('no_code').includes('Nothing was shared'));
});

test('the well known document is found at the FHIR base, trailing slash or not', () => {
  assert.equal(smartConfigUrl(endpoint), 'https://fhir.slhs.org/api/FHIR/R4/.well-known/smart-configuration');
  assert.equal(
    smartConfigUrl({ ...endpoint, fhirBaseUrl: 'https://fhir.slhs.org/api/FHIR/R4///' }),
    'https://fhir.slhs.org/api/FHIR/R4/.well-known/smart-configuration',
  );
});
