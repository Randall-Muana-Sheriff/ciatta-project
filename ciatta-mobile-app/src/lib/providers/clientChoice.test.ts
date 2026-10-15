import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientFor } from './clientChoice';
import type { Endpoint } from './directory';
import { SANDBOX, SMART_TEST } from './epicDirectory';

const IDS = { production: 'prod-id', nonProduction: 'nonprod-id' };

const hospital: Endpoint = {
  id: 'mercy',
  name: 'Mercy Hospital',
  organization: 'Mercy Health',
  fhirBaseUrl: 'https://fhir.mercy.example/api/FHIR/R4',
  vendor: 'epic',
  portalName: 'MyChart',
};

test('a real hospital gets the production client id', () => {
  assert.equal(clientFor(hospital, IDS), 'prod-id');
});

test('the Epic sandbox and the SMART test server get the non production id', () => {
  assert.equal(clientFor(SANDBOX, IDS), 'nonprod-id');
  assert.equal(clientFor(SMART_TEST, IDS), 'nonprod-id');
});

test('a missing id is empty rather than the other one, so the sheet says it cannot connect', () => {
  assert.equal(clientFor(hospital, { production: '  ', nonProduction: 'nonprod-id' }), '');
});
