// Fasten Connect end to end, on this machine: the fasten-connect and
// fasten-webhook functions served locally, and a stand in for Fasten's API
// on port 9911 that the functions reach through host.docker.internal.
//
// Needs `supabase start`, and in another terminal:
//   supabase functions serve --env-file scripts/lab-analysis-e2e.env
//
// Run: npm run e2e:fasten. Prints each check and exits 1 if any failed.
// The test users it makes are deleted at the end.

import { execSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const PASSWORD = 'fasten-e2e-password-1';
// Must match scripts/lab-analysis-e2e.env.
const SECRET_RAW = Buffer.from('fasten e2e signing secret 32 byt').toString('base64');
const PUBLIC_ID = 'public_test_e2e';
const PRIVATE_KEY = 'private_test_e2e';
const PORT = 9911;
const HOST = `host.docker.internal:${PORT}`;

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

// ── The stand in for Fasten ─────────────────────────────────────────────

const NDJSON = [
  JSON.stringify({ resourceType: 'Patient', id: 'p1' }),
  JSON.stringify({ resourceType: 'Condition', id: 'c1', code: { text: 'Endometriosis' }, recordedDate: '2025-03-02' }),
  JSON.stringify({
    resourceType: 'Observation',
    id: 'o1',
    status: 'final',
    category: [{ coding: [{ code: 'laboratory' }] }],
    code: { text: 'Ferritin' },
    effectiveDateTime: '2025-04-01T09:00:00Z',
    valueQuantity: { value: 12, unit: 'ng/mL' },
    referenceRange: [{ low: { value: 15 }, high: { value: 150 } }],
  }),
  'not json',
  '',
].join('\n');

const expectedAuth = `Basic ${Buffer.from(`${PUBLIC_ID}:${PRIVATE_KEY}`).toString('base64')}`;
const seen = { exportAuth: '', exportBody: '', signedAuth: 'unset' as string | undefined };

const fake = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const u = new URL(req.url ?? '/', `http://${HOST}`);
    if (req.method === 'POST' && u.pathname === '/v1/bridge/fhir/ehi-export') {
      seen.exportAuth = String(req.headers.authorization ?? '');
      seen.exportBody = Buffer.concat(chunks).toString();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: { task_id: 'task-1' } }));
      return;
    }
    if (u.pathname === '/v1/bridge/catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: { name: 'Foo Clinic' } }));
      return;
    }
    if (u.pathname === '/v1/bridge/fhir/ehi-export/task-1/download/f.jsonl') {
      if (req.headers.authorization !== expectedAuth) return void res.writeHead(401).end();
      res.writeHead(302, { Location: `http://${HOST}/signed/f.jsonl` }).end();
      return;
    }
    if (u.pathname === '/signed/f.jsonl') {
      seen.signedAuth = req.headers.authorization;
      res.writeHead(200, { 'Content-Type': 'application/fhir+ndjson' }).end(NDJSON);
      return;
    }
    res.writeHead(404).end();
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────

async function user(tag: string): Promise<{ id: string; jwt: string }> {
  const email = `fasten-e2e-${tag}-${Date.now()}@example.com`;
  const made = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  }).then((r) => r.json());
  const session = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).then((r) => r.json());
  return { id: made.id, jwt: session.access_token };
}

async function start(jwt: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API}/functions/v1/fasten-connect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function webhook(type: string, data: unknown, opts: { id?: string; sign?: boolean; stale?: boolean } = {}) {
  const id = opts.id ?? `msg_${randomUUID()}`;
  const ts = String(Math.floor(Date.now() / 1000) - (opts.stale ? 600 : 0));
  const body = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
  const mac = createHmac('sha256', Buffer.from(SECRET_RAW, 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts };
  if (opts.sign !== false) headers['webhook-signature'] = `v1,${mac}`;
  const res = await fetch(`${API}/functions/v1/fasten-webhook`, { method: 'POST', headers, body });
  return { status: res.status, body: await res.json().catch(() => null), id };
}

async function rows(table: string, query: string, bearer = SERVICE) {
  const res = await fetch(`${API}/rest/v1/${table}?${query}`, {
    headers: { apikey: bearer === SERVICE ? SERVICE : ANON, Authorization: `Bearer ${bearer}` },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── The run ─────────────────────────────────────────────────────────────

await new Promise<void>((r) => fake.listen(PORT, '0.0.0.0', () => r()));
const a = await user('a');
const b = await user('b');

try {
  const unsigned = await start('not-a-jwt');
  check('start refuses a caller who is not signed in', unsigned.status === 401, String(unsigned.status));

  const s = await start(a.jwt);
  check('start issues an external id and the public id', s.status === 200 && /^[A-Za-z0-9_-]{43}$/.test(s.body?.externalId ?? '') && s.body?.publicId === PUBLIC_ID, JSON.stringify(s.body));
  const externalId: string = s.body?.externalId ?? '';

  const org = randomUUID();
  const success = { org_connection_id: org, endpoint_id: 'ep-1', brand_id: 'brand-1', portal_id: 'portal-1', platform_type: 'epic', external_id: externalId };

  const bad = await webhook('patient.connection_success', success, { sign: false });
  check('an unsigned webhook is refused', bad.status === 401, String(bad.status));
  const stale = await webhook('patient.connection_success', success, { stale: true });
  check('a stale webhook is refused', stale.status === 401, String(stale.status));
  const none = await rows('provider_connections', `user_id=eq.${a.id}&select=id`);
  check('nothing was written by refused webhooks', Array.isArray(none.body) && none.body.length === 0);

  const ok = await webhook('patient.connection_success', success);
  check('a signed connection_success is accepted', ok.status === 200 && ok.body?.ok === true, JSON.stringify(ok.body));
  const conn = await rows('provider_connections', `user_id=eq.${a.id}&select=*`);
  const row = conn.body?.[0];
  check(
    'the connection is bound to the person the external id was issued to',
    row?.source === 'fasten' && row?.status === 'connected' && row?.endpoint_name === 'Foo Clinic' && row?.fasten_org_connection_id === org && row?.endpoint_id === 'fasten:ep-1',
    JSON.stringify(row && { source: row.source, status: row.status, name: row.endpoint_name }),
  );
  check('the export was asked for with the private key', seen.exportAuth === expectedAuth && JSON.parse(seen.exportBody || '{}').org_connection_id === org);
  check('the export task was kept', row?.fasten_export_task_id === 'task-1');

  const replay = await webhook('patient.connection_success', success, { id: ok.id });
  check('a replayed delivery is skipped', replay.status === 200 && replay.body?.duplicate === true, JSON.stringify(replay.body));

  // Someone else's external id cannot take this connection.
  const sb = await start(b.jwt);
  const steal = await webhook('patient.connection_success', { ...success, external_id: sb.body?.externalId });
  check('a connection id already bound is not rebound to another person', steal.body?.ignored === 'bound elsewhere', JSON.stringify(steal.body));
  const bRows = await rows('provider_connections', `user_id=eq.${b.id}&select=id`);
  check('the other person has no connection', Array.isArray(bRows.body) && bRows.body.length === 0);

  const forged = await webhook('patient.connection_success', { ...success, org_connection_id: randomUUID(), external_id: 'x'.repeat(43) });
  check('an unknown external id binds nothing', forged.body?.ignored === 'unbound', JSON.stringify(forged.body));

  // Her client sees the connection but not Fasten's id for it.
  const mine = await rows('provider_connections', 'select=id,source,status', a.jwt);
  check('she can read her Fasten connection', mine.status === 200 && mine.body?.[0]?.source === 'fasten');
  const secret = await rows('provider_connections', 'select=fasten_org_connection_id', a.jwt);
  check('she cannot read the Fasten connection id', secret.status !== 200, String(secret.status));
  const theirs = await rows('provider_connections', 'select=id', b.jwt);
  check('another person cannot see it', Array.isArray(theirs.body) && theirs.body.length === 0);

  const ready = await webhook('patient.ehi_export_success', {
    org_connection_id: org,
    task_id: 'task-1',
    download_links: [{ url: `http://${HOST}/v1/bridge/fhir/ehi-export/task-1/download/f.jsonl`, export_type: 'jsonl', content_type: 'application/fhir+ndjson' }],
  });
  check('export_success is acknowledged', ready.status === 200 && ready.body?.accepted === true, JSON.stringify(ready.body));

  let active: any = null;
  for (let i = 0; i < 30 && active?.status !== 'active'; i++) {
    await sleep(500);
    active = (await rows('provider_connections', `id=eq.${row?.id}&select=status,record_count,last_error`)).body?.[0];
  }
  check('the connection becomes active with what arrived', active?.status === 'active' && active?.record_count === 2, JSON.stringify(active));
  const records = await rows('clinical_records', `connection_id=eq.${row?.id}&select=source_id,kind&order=source_id`);
  check('records are filed under the connection', JSON.stringify(records.body?.map((r: any) => r.source_id)) === '["Condition/c1","Observation/o1"]', JSON.stringify(records.body));
  const labs = await rows('results', `connection_id=eq.${row?.id}&select=test_name,value,source_ref,provider`);
  check('the lab is in her results', labs.body?.length === 1 && labs.body[0].value === 12 && labs.body[0].provider === 'Foo Clinic', JSON.stringify(labs.body));
  check('the signed download was fetched without the private key', seen.signedAuth === undefined, String(seen.signedAuth));

  const again = await webhook('patient.ehi_export_success', {
    org_connection_id: org,
    download_links: [{ url: `http://${HOST}/v1/bridge/fhir/ehi-export/task-1/download/f.jsonl`, export_type: 'jsonl' }],
  });
  await sleep(2000);
  const count = await rows('clinical_records', `connection_id=eq.${row?.id}&select=id`);
  check('a second export updates rather than duplicates', again.status === 200 && count.body?.length === 2, String(count.body?.length));

  const failed = await webhook('patient.ehi_export_failed', { org_connection_id: org, failure_reason: 'tefca_no_documents_found' });
  const after = (await rows('provider_connections', `id=eq.${row?.id}&select=status,last_error`)).body?.[0];
  check('a failed export says so plainly', failed.status === 200 && after?.status === 'error' && after?.last_error === 'Your provider did not share any records.', JSON.stringify(after));

  const gone = await fetch(`${API}/rest/v1/rpc/disconnect_provider`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${a.jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_connection: row?.id }),
  }).then((r) => r.json());
  const left = await rows('results', `user_id=eq.${a.id}&source=eq.provider&select=id`);
  check('removing the provider takes its records and labs', gone === true && left.body?.length === 0, JSON.stringify(left.body));

  const late = await webhook('patient.ehi_export_success', {
    org_connection_id: org,
    download_links: [{ url: `http://${HOST}/v1/bridge/fhir/ehi-export/task-1/download/f.jsonl`, export_type: 'jsonl' }],
  });
  check('an export arriving after removal files nothing', late.body?.ignored === 'no connection', JSON.stringify(late.body));
} finally {
  for (const u of [a, b]) await fetch(`${API}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: admin });
  fake.close();
}

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
