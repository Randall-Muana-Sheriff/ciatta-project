// A whole provider connection against the SMART test server, run on this
// machine: the app's own request builder for the login, and the
// provider-connect function served locally for everything after it.
//
// Needs `supabase start`, and in another terminal:
//   supabase functions serve provider-connect --env-file scripts/provider-e2e.env
//
// Run: npm run e2e:provider. Prints each check and exits 1 if any failed.
// The two test users it makes are deleted at the end.

import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

import { SMART_TEST } from '../src/lib/providers/epicDirectory';
import { authorizeUrl, readCallback, smartConfigUrl } from '../src/lib/providers/smart';

const local = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const API: string = local.API_URL;
const ANON: string = local.ANON_KEY;
const SERVICE: string = local.SERVICE_ROLE_KEY;
const CLIENT_ID = 'ciatta-e2e';
const REDIRECT = 'ciatta://provider-callback';
const PASSWORD = 'provider-e2e-password-1';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

async function user(tag: string): Promise<{ id: string; jwt: string }> {
  const email = `provider-e2e-${tag}-${Date.now()}@example.com`;
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

async function call(bearer: string, body: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API}/functions/v1/provider-connect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function setConnection(id: string, patch: Record<string, unknown>) {
  await fetch(`${API}/rest/v1/provider_connections?id=eq.${id}`, { method: 'PATCH', headers: admin, body: JSON.stringify(patch) });
}

async function connection(id: string): Promise<any> {
  const rows = await fetch(`${API}/rest/v1/provider_connections?id=eq.${id}&select=*`, { headers: admin }).then((r) => r.json());
  return rows[0] ?? null;
}

async function count(jwt: string, table: string, filter = ''): Promise<number> {
  const res = await fetch(`${API}/rest/v1/${table}?select=id${filter}`, {
    method: 'HEAD',
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, Prefer: 'count=exact' },
  });
  return Number(res.headers.get('content-range')?.split('/')[1] ?? -1);
}

async function login(): Promise<{ code: string; verifier: string; tokenEndpoint: string }> {
  const raw = await fetch(smartConfigUrl(SMART_TEST)).then((r) => r.json());
  const config = {
    authorizationEndpoint: raw.authorization_endpoint,
    tokenEndpoint: raw.token_endpoint,
    scopesSupported: raw.scopes_supported ?? [],
  };
  const verifier = b64u(randomBytes(64));
  const state = b64u(randomBytes(16));
  const challenge = b64u(createHash('sha256').update(verifier).digest());
  const req = authorizeUrl(SMART_TEST, config, REDIRECT, CLIENT_ID, { verifier, state, challenge });
  // The test server's launch skips its login and patient pick, so the
  // authorize address answers with the redirect straight away.
  const landed = (await fetch(req.url, { redirect: 'manual' })).headers.get('location') ?? '';
  check('the login comes back to the app', landed.startsWith(REDIRECT), landed.slice(0, 40));
  const cb = readCallback(landed, req.state);
  check('the state matches and a code arrived', cb.ok);
  check('a different state is refused', !readCallback(landed, 'not the same state').ok);
  if (!cb.ok) throw new Error('no code came back');
  return { code: cb.code, verifier, tokenEndpoint: config.tokenEndpoint };
}

async function exchange(jwt: string) {
  const { code, verifier, tokenEndpoint } = await login();
  return call(jwt, { action: 'exchange', code, verifier, clientId: CLIENT_ID, endpoint: { ...SMART_TEST, tokenEndpoint } });
}

async function main() {
  const her = await user('her');
  const other = await user('other');
  try {
    const wrong = await call(her.jwt, {
      action: 'exchange',
      code: 'unused',
      verifier: 'unused',
      clientId: 'not one of ours',
      endpoint: { ...SMART_TEST, tokenEndpoint: 'https://example.invalid/token' },
    });
    check('a client id that is not ours is refused before the provider is called', wrong.status === 400 && /Updating the app/.test(wrong.body?.error ?? ''), wrong.body?.error);

    const ex = await exchange(her.jwt);
    const id: string = ex.body?.connection?.id ?? '';
    check('the exchange finishes and records arrive', ex.status === 200 && ex.body.written > 0, `${ex.status} written ${ex.body?.written}`);
    check('no token comes back to the device', !/access_token|refresh_token|eyJ/.test(JSON.stringify(ex.body)));
    const held = await count(her.jwt, 'clinical_records');
    check('every page is read', held > 300, `${held} records`);
    check('the record count is what she holds', ex.body?.connection?.recordCount === held);

    const again = await call(her.jwt, { action: 'sync', connectionId: id });
    check('a re sync makes no duplicates', again.status === 200 && (await count(her.jwt, 'clinical_records')) === held);

    // SCHEDULED SYNC CHECKS (Task 4 adds them here)

    const theirs = await call(other.jwt, { action: 'sync', connectionId: id });
    check('someone else cannot sync her connection', theirs.status === 404);
    check('someone else reads none of her records', (await count(other.jwt, 'clinical_records')) === 0);

    await setConnection(id, { token_expires_at: new Date(Date.now() - 3600_000).toISOString() });
    const refreshed = await call(her.jwt, { action: 'sync', connectionId: id });
    check('an expired token is refreshed and the sync goes on', refreshed.status === 200 && (await connection(id))?.status === 'active');

    await setConnection(id, { access_token: 'refused at the provider', token_expires_at: new Date(Date.now() + 3600_000).toISOString() });
    const refused = await call(her.jwt, { action: 'sync', connectionId: id });
    const expired = await connection(id);
    check('a token the provider refuses marks the connection expired', refused.status === 400 && expired?.status === 'expired', `${refused.status} ${expired?.status}`);
    check('her records are kept when it expires', (await count(her.jwt, 'clinical_records')) === held && expired?.record_count === held);

    const back = await exchange(her.jwt);
    check('connecting again revives the same connection', back.body?.connection?.id === id && back.body?.connection?.status === 'active');

    // REMOVAL CHECKS (Task 3 adds them here)
  } finally {
    for (const u of [her, other]) await fetch(`${API}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: admin });
  }
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
