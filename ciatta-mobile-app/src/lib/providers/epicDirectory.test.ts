import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isSandbox, parseEndpointBundle, SANDBOX, SMART_TEST } from './epicDirectory';

const bundle = (entry: unknown[]) => ({ resourceType: 'Bundle', entry });
const ep = (over: Record<string, unknown>) => ({
  resource: { resourceType: 'Endpoint', status: 'active', name: 'A Clinic', address: 'https://a.org/FHIR/R4', ...over },
});

test('a bundle that is not one gives nothing rather than throwing', () => {
  for (const junk of [null, undefined, {}, [], 'bundle', { entry: 'no' }]) {
    assert.deepEqual(parseEndpointBundle(junk, 'epic', 'MyChart'), []);
  }
});

test('a good entry becomes an endpoint', () => {
  const [e] = parseEndpointBundle(bundle([ep({ id: 'x1', name: "St Luke's Boise" })]), 'epic', 'MyChart');
  assert.equal(e.name, "St Luke's Boise");
  assert.equal(e.fhirBaseUrl, 'https://a.org/FHIR/R4');
  assert.equal(e.vendor, 'epic');
  assert.equal(e.portalName, 'MyChart');
});

test('an entry with no name or no address is dropped, never patched', () => {
  const out = parseEndpointBundle(
    bundle([ep({ name: '   ' }), ep({ address: undefined }), ep({ name: 'Real', address: 'https://b.org' })]),
    'epic',
    null,
  );
  assert.deepEqual(out.map((e) => e.name), ['Real']);
});

test('an inactive endpoint is dropped, since it would send her to a login that cannot work', () => {
  const out = parseEndpointBundle(bundle([ep({ status: 'off' }), ep({ name: 'Live', address: 'https://c.org' })]), 'epic', null);
  assert.deepEqual(out.map((e) => e.name), ['Live']);
});

test('a plain http endpoint is refused outright', () => {
  // Her health data would cross the wire in clear text. There is no
  // version of that worth connecting to.
  const out = parseEndpointBundle(bundle([ep({ address: 'http://insecure.org/FHIR' })]), 'epic', null);
  assert.deepEqual(out, []);
});

test('the organization is read from either place Epic puts it', () => {
  const newer = parseEndpointBundle(
    bundle([ep({ managingOrganization: { display: "St Luke's" } })]),
    'epic',
    null,
  );
  assert.equal(newer[0].organization, "St Luke's");

  const older = parseEndpointBundle(
    bundle([ep({ contained: [{ resourceType: 'Organization', name: "St Luke's" }] })]),
    'epic',
    null,
  );
  assert.equal(older[0].organization, "St Luke's");
});

test('an organization that repeats the endpoint name is not a parent', () => {
  // Otherwise the results show a heading with one row that says the same
  // thing as the heading.
  const out = parseEndpointBundle(
    bundle([ep({ name: 'Mayo Clinic', managingOrganization: { display: 'MAYO CLINIC' } })]),
    'epic',
    null,
  );
  assert.equal(out[0].organization, null);
});

test('the same base listed twice appears once', () => {
  const out = parseEndpointBundle(
    bundle([ep({ name: 'Same', address: 'https://a.org/FHIR/' }), ep({ name: 'Same', address: 'https://a.org/FHIR' })]),
    'epic',
    null,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].fhirBaseUrl, 'https://a.org/FHIR');
});

test('the sandbox is a real endpoint and says it is test data', () => {
  assert.ok(SANDBOX.fhirBaseUrl.startsWith('https://fhir.epic.com/'));
  assert.ok(SANDBOX.name.toLowerCase().includes('test data'));
  assert.ok(isSandbox(SANDBOX));
  assert.ok(!isSandbox({ ...SANDBOX, id: 'other' }));
});

test('the SMART test server is a test server, said plainly', () => {
  assert.equal(isSandbox(SMART_TEST), true);
  assert.match(SMART_TEST.name, /test data only/);
  assert.match(SMART_TEST.fhirBaseUrl, /^https:\/\/launch\.smarthealthit\.org\/v\/r4\/sim\/[A-Za-z0-9_]+\/fhir$/);
});

test('the SMART test server signs in the test patient without a password', () => {
  const segment = SMART_TEST.fhirBaseUrl.split('/sim/')[1].replace('/fhir', '');
  const launch = JSON.parse(Buffer.from(segment, 'base64url').toString());
  // Standalone patient launch, a patient chosen, login and consent skipped.
  assert.equal(launch[0], 3);
  assert.ok(launch[1]);
  assert.equal(launch[4], 1);
  assert.equal(launch[5], 1);
});
