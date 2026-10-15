import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import {
  basicAuth,
  connectionEndpointKey,
  exportFailureLine,
  externalIdLooksValid,
  jsonlLinks,
  providerLabel,
  readNdjson,
  rowsFrom,
  verifyWebhook,
} from '../../../supabase/functions/fasten-webhook/fasten.ts';

const RAW = Buffer.from('a test signing secret, 32 bytes!').toString('base64');
const SECRET = `whsec_${RAW}`;
const NOW = new Date('2026-10-15T12:00:00Z');
const ts = String(Math.floor(NOW.getTime() / 1000));

function sign(id: string, timestamp: string, body: string, raw = RAW) {
  const mac = createHmac('sha256', Buffer.from(raw, 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${mac}`;
}

const headers = (id: string, timestamp: string, signature: string) =>
  new Headers({ 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signature });

test('a correctly signed webhook verifies', async () => {
  const body = '{"type":"webhook.test"}';
  assert.equal(await verifyWebhook(body, headers('msg_1', ts, sign('msg_1', ts, body)), SECRET, NOW), true);
});

test('the secret works without its whsec_ prefix', async () => {
  const body = '{}';
  assert.equal(await verifyWebhook(body, headers('m', ts, sign('m', ts, body)), RAW, NOW), true);
});

test('one matching signature among several verifies, as rotation sends both', async () => {
  const body = '{}';
  const sig = `v1,bm90IGl0 ${sign('m', ts, body)}`;
  assert.equal(await verifyWebhook(body, headers('m', ts, sig), SECRET, NOW), true);
});

test('a changed body does not verify', async () => {
  const sig = sign('m', ts, '{"a":1}');
  assert.equal(await verifyWebhook('{"a":2}', headers('m', ts, sig), SECRET, NOW), false);
});

test('a different secret does not verify', async () => {
  const other = Buffer.from('some other secret entirely......').toString('base64');
  const sig = sign('m', ts, '{}', other);
  assert.equal(await verifyWebhook('{}', headers('m', ts, sig), SECRET, NOW), false);
});

test('a changed id does not verify', async () => {
  const sig = sign('m', ts, '{}');
  assert.equal(await verifyWebhook('{}', headers('n', ts, sig), SECRET, NOW), false);
});

test('a timestamp more than five minutes old or ahead does not verify', async () => {
  const old = String(Number(ts) - 301);
  const ahead = String(Number(ts) + 301);
  assert.equal(await verifyWebhook('{}', headers('m', old, sign('m', old, '{}')), SECRET, NOW), false);
  assert.equal(await verifyWebhook('{}', headers('m', ahead, sign('m', ahead, '{}')), SECRET, NOW), false);
});

test('missing headers or an empty secret do not verify', async () => {
  const sig = sign('m', ts, '{}');
  assert.equal(await verifyWebhook('{}', new Headers({ 'webhook-id': 'm', 'webhook-timestamp': ts }), SECRET, NOW), false);
  assert.equal(await verifyWebhook('{}', new Headers({ 'webhook-signature': sig, 'webhook-timestamp': ts }), SECRET, NOW), false);
  assert.equal(await verifyWebhook('{}', headers('m', ts, sig), '', NOW), false);
  assert.equal(await verifyWebhook('{}', headers('m', 'soon', sig), SECRET, NOW), false);
});

test('NDJSON lines are read, blank lines ignored, and a broken line counted', () => {
  const text = '{"resourceType":"Condition","id":"a"}\n\n  \nnot json\n{"resourceType":"Observation","id":"b"}\r\n[1,2]\n';
  const out = readNdjson(text);
  assert.deepEqual(out.resources.map((r: any) => r.id), ['a', 'b']);
  assert.equal(out.malformed, 2);
});

test('only jsonl download links are taken, deprecated single link as fallback', () => {
  assert.deepEqual(
    jsonlLinks({ download_links: [{ url: 'https://api.connect.fastenhealth.com/v1/x/1.jsonl', export_type: 'jsonl' }, { url: 'https://api.connect.fastenhealth.com/v1/x/2.pdf', export_type: 'pdf' }] }),
    ['https://api.connect.fastenhealth.com/v1/x/1.jsonl'],
  );
  assert.deepEqual(jsonlLinks({ download_link: { url: 'https://api.connect.fastenhealth.com/v1/x/old.jsonl', export_type: 'jsonl' } }), ['https://api.connect.fastenhealth.com/v1/x/old.jsonl']);
  assert.deepEqual(jsonlLinks({}), []);
  assert.deepEqual(jsonlLinks({ download_links: [{ url: 'http://insecure/1.jsonl', export_type: 'jsonl' }] }), []);
});

test('download links must be on Fasten', () => {
  assert.deepEqual(jsonlLinks({ download_links: [{ url: 'https://evil.example/1.jsonl', export_type: 'jsonl' }] }), []);
  assert.deepEqual(
    jsonlLinks({ download_links: [{ url: 'https://api.connect.fastenhealth.com/v1/bridge/fhir/ehi-export/t/download/f.jsonl', export_type: 'jsonl' }] }),
    ['https://api.connect.fastenhealth.com/v1/bridge/fhir/ehi-export/t/download/f.jsonl'],
  );
});

test('a failure reason becomes a plain sentence with no hyphen', () => {
  assert.equal(exportFailureLine('tefca_no_documents_found'), 'Your provider did not share any records.');
  assert.equal(exportFailureLine('anything_else'), 'Ciatta could not get your records from this provider. Try connecting again later.');
  assert.equal(exportFailureLine(undefined), 'Ciatta could not get your records from this provider. Try connecting again later.');
});

test('the provider name comes from the catalog, else a plain fallback', () => {
  assert.equal(providerLabel({ data: { name: 'Foo Clinic' } }), 'Foo Clinic');
  assert.equal(providerLabel({ name: 'Bar Health' }), 'Bar Health');
  assert.equal(providerLabel({ data: { name: '  ' } }), 'Your provider');
  assert.equal(providerLabel(null), 'Your provider');
});

test('a Fasten connection key never collides with a SMART server address', () => {
  assert.equal(connectionEndpointKey({ endpoint_id: 'e1', org_connection_id: 'o1' }), 'fasten:e1');
  assert.equal(connectionEndpointKey({ org_connection_id: 'o1' }), 'fasten:o1');
});

test('basic auth is public id colon private key, base64', () => {
  assert.equal(basicAuth('public_test_a', 'private_test_b'), `Basic ${Buffer.from('public_test_a:private_test_b').toString('base64')}`);
});

test('an external id is the long random token the start action issues', () => {
  assert.equal(externalIdLooksValid('a'.repeat(43)), true);
  assert.equal(externalIdLooksValid('short'), false);
  assert.equal(externalIdLooksValid(undefined), false);
  assert.equal(externalIdLooksValid('x'.repeat(43) + ' '), false);
});

const condition = { resourceType: 'Condition', id: 'c1', code: { text: 'Endometriosis' }, recordedDate: '2025-03-02' };
const lab = {
  resourceType: 'Observation',
  id: 'o1',
  status: 'final',
  category: [{ coding: [{ code: 'laboratory' }] }],
  code: { text: 'Ferritin' },
  effectiveDateTime: '2025-04-01T09:00:00Z',
  valueQuantity: { value: 12, unit: 'ng/mL' },
  referenceRange: [{ low: { value: 15 }, high: { value: 150 } }],
};

test('resources become clinical record rows and lab rows for her connection', () => {
  const out = rowsFrom([condition, lab, { resourceType: 'Patient', id: 'p' }], 'u1', 'conn1', 'Foo Clinic');
  assert.deepEqual(out.records.map((r) => [r.user_id, r.connection_id, r.source_id, r.kind]), [
    ['u1', 'conn1', 'Condition/c1', 'condition'],
    ['u1', 'conn1', 'Observation/o1', 'lab'],
  ]);
  assert.equal(out.labs.length, 1);
  assert.deepEqual(
    {
      source: out.labs[0].source,
      source_ref: out.labs[0].source_ref,
      connection_id: out.labs[0].connection_id,
      provider: out.labs[0].provider,
      value: out.labs[0].value,
      occurred_at: out.labs[0].occurred_at,
    },
    { source: 'provider', source_ref: 'conn1:Observation/o1', connection_id: 'conn1', provider: 'Foo Clinic', value: 12, occurred_at: '2025-04-01T12:00:00Z' },
  );
  assert.equal(out.skipped, 1);
});

test('the same resource twice in one export is one row, the later kept', () => {
  const amended = { ...lab, status: 'amended', valueQuantity: { value: 14, unit: 'ng/mL' } };
  const out = rowsFrom([lab, condition, amended], 'u1', 'conn1', 'Foo Clinic');
  assert.equal(out.records.filter((r) => r.source_id === 'Observation/o1').length, 1);
  assert.equal(out.records.find((r) => r.source_id === 'Observation/o1')!.status, 'amended');
  assert.equal(out.labs.length, 1);
  assert.equal(out.labs[0].value, 14);
});

test('the end to end host is accepted only when named', () => {
  const event = { download_links: [{ url: 'http://127.0.0.1:9911/v1/x/1.jsonl', export_type: 'jsonl' }] };
  assert.deepEqual(jsonlLinks(event), []);
  assert.deepEqual(jsonlLinks(event, '127.0.0.1:9911'), ['http://127.0.0.1:9911/v1/x/1.jsonl']);
  assert.deepEqual(jsonlLinks(event, '127.0.0.1:9999'), []);
});
