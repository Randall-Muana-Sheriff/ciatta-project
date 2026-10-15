# Provider Connection to Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person can connect a real hospital on Epic from a production build, keep the records current without reconnecting, see and remove each connection, and never meet test data or a test setting.

**Architecture:** The connection already works end to end against the SMART test server (commit `b779140`). This plan closes what stands between that and real patients. The `provider-connect` edge function learns to treat a refused token as expired, to accept only our own client ids, and to run a scheduled sync when called by pg_cron. A security definer RPC removes a connection and everything it sent. The Chart screen becomes where her providers are managed. Test hospitals and the client id field appear only in test builds. A committed end to end script checks the whole path on a laptop, and a final manual task takes it live.

**Tech Stack:** Expo 57 / React Native, TypeScript, node:test via `tsx --test`, Supabase Postgres with pgTAP in `supabase/tests`, Supabase Edge Functions (Deno), pg_cron with pg_net, Epic on FHIR (SMART on FHIR R4, SMART v1 scopes, public client with PKCE).

**Spec:** There is no separate spec. The requirements come from the code, the Epic registration screenshots in `ciatta-fhir-data-access/` (taken 2026-10-14), and the run against the SMART test server. They are listed below under Requirements.

## Requirements

1. **Removing a connection.** The connect sheet says "you can remove this connection whenever you want" (`src/screens/ProviderConnectScreen.tsx`), and Privacy says "You can disconnect a provider at any time" (`src/lib/privacyFacts.ts`). Nothing in the app does this yet. Removing a connection deletes the connection and every record and lab it sent. Her provider's chart is not changed.
2. **Keeping records current.** Nothing calls the `sync` action after the first connection. Records refresh on a schedule (each connection about once every 20 hours) and when she pulls down on the Chart screen.
3. **Telling her when a connection expires.** A 401 from the provider (she withdrew access in her portal, or the token lapsed early) is currently treated like a type the hospital does not publish. The sync then reports `record_count` 0 and status `connected` even though her records are still there. A 401 marks the connection expired and keeps her records. `record_count` is always the number of records she holds.
4. **The right client id for each provider.** Epic issues a non production client id, which works only against the sandbox at fhir.epic.com, and a production client id, which works for real hospitals. Today the build carries one id and the function holds one id. The app picks the id by endpoint and sends it in the exchange. The function accepts only ids on its list, stores the one used on the connection, and refreshes with it.
5. **No test data in production.** The Epic Sandbox and the SMART test server are listed at the top of every directory search, in every build, and the "I have a client ID" field is reachable in every build. Both appear only in development and preview builds.
6. **Going live** needs the Epic console, Supabase secrets, the deployed migrations and function, EAS environment variables, and a run on a phone. Task 7 is that checklist.

## Global Constraints

- Run all app commands from `ciatta-mobile-app/`. Unit tests: `npm test`. Typecheck: `npx tsc --noEmit`. SQL tests: `supabase test db` (needs `supabase start`).
- Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code (`AGENTS.md`).
- UI copy never contains an em dash, en dash or hyphen. Every remote or templated string renders through `displayCopy()` from `src/lib/displayCopy.ts`. Compound words become separate words.
- Keep Jost and the existing design. New UI reuses `ui/kit.tsx`, `ui/bento.tsx`, `ui/surface.tsx`, `ui/cardFill.tsx` and `ui/scheme.ts`. Every screen and sheet sits on Ground and is never a flat dark page.
- A token is never returned to the device, never accepted from the device, and never logged. A provider's error text is never forwarded (it can carry her name or record number).
- An edge function deploys only the files in its own directory. `supabase/functions/provider-connect/*.ts` cannot import from `src/`, and `src/` tests import those files by relative path (as `src/lib/providers/exchange.test.ts` already does).
- Every migration timestamp is later than `20261018100000`. Use the exact file names given in each task.
- Records already saved (connections, clinical records, provider labs) must still load after every migration.

## Review Focus

1. **She removes a provider while a scheduled sync of it is running.** She expects nothing from that provider to reappear. Clinical records reference the connection, so a write after removal fails. Labs in `results` have no such reference, so a lab written after removal would come back with nothing to remove it by. Task 1 writes clinical records before labs on every page, so a removed connection fails before any lab is written. Task 3's end to end check pins that a sync after removal writes nothing.
2. **She reconnects a hospital whose connection expired.** She expects the same connection to come back to life, not a second copy of that hospital. Pinned in Task 1 (end to end: reconnecting returns the same connection id, status active).
3. **A build carrying a client id the function no longer lists (an old build after an id change).** She expects a plain sentence saying an update fixes it, not "your provider did not complete the connection". Pinned in Task 2 (unit test for the allow list, and an end to end check of the function's answer). `functionError` is what carries that sentence to the sheet, since supabase-js leaves `data` empty on a 400.
4. **She pulls to refresh with one expired connection and one working one.** She expects the working one to update and a line naming the one that needs connecting again. Pinned in Task 5 (`syncNote` unit tests). `syncProviders` keeps going after a failure.
5. **A production build's directory.** She expects real hospitals only, never "Epic Sandbox (test data only)". Pinned in Task 6 (`withTestEndpoints(rows, false)` contains no test endpoint).

---

### Task 1: A sync that recognises a refused token, checked end to end

**Files:**
- Create: `ciatta-mobile-app/scripts/provider-e2e.mts`
- Create: `ciatta-mobile-app/scripts/provider-e2e.env`
- Modify: `ciatta-mobile-app/package.json` (scripts)
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/exchange.ts`
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/index.ts`
- Test: `ciatta-mobile-app/src/lib/providers/exchange.test.ts`

**Interfaces:**
- Consumes: `SMART_TEST` from `src/lib/providers/epicDirectory.ts`. `authorizeUrl`, `readCallback`, `smartConfigUrl` from `src/lib/providers/smart.ts`. `planFor`, `planQuery`, `nextPage`, `MAX_PAGES` from `exchange.ts` (already present).
- Produces:
  - `type PageOutcome = 'read' | 'skip' | 'expired'` and `function pageOutcome(status: number): PageOutcome` in `exchange.ts`
  - `async function markExpired(admin: any, uid: string, connectionId: string): Promise<Response>` in `index.ts`
  - `npm run e2e:provider`, which later tasks extend with more checks

- [ ] **Step 1: Write the failing unit test** (append to `src/lib/providers/exchange.test.ts`, and add `pageOutcome` to the import list from `'../../../supabase/functions/provider-connect/exchange.ts'`)

```ts
// ── What one page's answer means ─────────────────────────────────────

test('a page that answered is read', () => {
  assert.equal(pageOutcome(200), 'read');
});

test('a token the provider no longer accepts is an expired connection, not a missing type', () => {
  assert.equal(pageOutcome(401), 'expired');
});

test('a type the provider does not publish is skipped, and the rest of the chart still comes', () => {
  for (const status of [403, 404, 500, 503]) assert.equal(pageOutcome(status), 'skip', String(status));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test src/lib/providers/exchange.test.ts`
Expected: FAIL, `pageOutcome` is not exported.

- [ ] **Step 3: Implement `pageOutcome`** (in `exchange.ts`, directly after `nextPage`)

```ts
// What one page's answer means for the sync. 401 is the provider saying
// the token is no longer good: she withdrew access in her portal, or it
// lapsed early. That is not a type the hospital does not publish, and must
// not read as one.
export type PageOutcome = 'read' | 'skip' | 'expired';

export function pageOutcome(status: number): PageOutcome {
  if (status >= 200 && status < 300) return 'read';
  if (status === 401) return 'expired';
  return 'skip';
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npx tsx --test src/lib/providers/exchange.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the end to end script**

`scripts/provider-e2e.env` (no secrets: the SMART test server accepts any client id):

```
SMART_CLIENT_ID=ciatta-e2e
SMART_CLIENT_IDS=ciatta-e2e
SMART_REDIRECT_URI=ciatta://provider-callback
```

Run `git check-ignore scripts/provider-e2e.env`. Expected: no output (the file is not ignored and will be committed).

`scripts/provider-e2e.mts`:

```ts
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
    // CHECKS BEFORE CONNECTING (Task 2 adds one here)

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
```

Add to `package.json` `"scripts"`:

```json
"e2e:provider": "tsx scripts/provider-e2e.mts"
```

- [ ] **Step 6: Run the end to end script to see the expiry checks fail**

Run `supabase start` if it is not running. In a second terminal: `supabase functions serve provider-connect --env-file scripts/provider-e2e.env`. Then: `npm run e2e:provider`
Expected: every check passes except `a token the provider refuses marks the connection expired` and `her records are kept when it expires` (status comes back `connected` or `active` with `record_count` 0).

- [ ] **Step 7: Use `pageOutcome`, keep the count true, and write clinical records before labs** (in `index.ts`)

Add `pageOutcome` to the import from `'./exchange.ts'`.

Add at the end of the file:

```ts
// The provider no longer accepts this connection. Her records so far are
// kept, and the screen asks her to connect again.
async function markExpired(admin: any, uid: string, connectionId: string): Promise<Response> {
  await admin
    .from('provider_connections')
    .update({ status: 'expired', last_error: 'The connection needs to be made again.', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('user_id', uid);
  return json({ error: 'That connection has expired. You can connect again whenever you want.' }, 400);
}
```

In `sync`, replace both existing blocks that set `status: 'expired'` (the one when there is no refresh token, and the one when the refresh fails) with `return await markExpired(admin, uid, connectionId);`.

Replace the whole `for (const entry of planFor(conn.vendor)) { ... }` loop with:

```ts
  for (const entry of planFor(conn.vendor)) {
    let page: string | null = planQuery(conn.fhir_base_url, entry, patientId);
    for (let n = 0; page && n < MAX_PAGES; n++) {
      const res = await fetch(page, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' },
      });
      const outcome = pageOutcome(res.status);
      if (outcome === 'expired') return await markExpired(admin, uid, connectionId);
      // A provider that does not hold a resource type answers 404 or 403.
      // That is not a failed sync; it is a hospital that does not publish
      // immunisations, and the rest of the chart still arrives.
      if (outcome === 'skip') break;

      const bundle = await res.json().catch(() => null);
      page = nextPage(bundle, conn.fhir_base_url);
      const { records, skipped: missed } = mapBundle(bundle);
      skipped += missed;

      // Clinical records first. They reference the connection, so if she
      // removed it while this ran, the write fails here, before any lab is
      // put back into her results with nothing left to remove it by.
      if (records.length) {
        const rows = records.map((r) => ({
          user_id: uid,
          connection_id: connectionId,
          source_id: r.sourceId,
          kind: r.kind,
          name: r.name,
          value: r.value,
          flag: r.flag,
          effective_on: r.effectiveOn,
          status: r.status,
        }));
        const { error: writeError } = await admin
          .from('clinical_records')
          .upsert(rows, { onConflict: 'user_id,connection_id,source_id' });
        if (writeError) throw writeError;
        written += rows.length;
      }

      // Labs also go into her lab results, with the number, unit and printed
      // range kept apart, so Labs can draw where each value sits. Keyed by
      // connection and resource, so a re sync updates rather than repeats.
      if (entry.type === 'Observation') {
        const labs = (Array.isArray(bundle?.entry) ? bundle.entry : [])
          .map((e: { resource?: unknown }) => labFromResource(e?.resource))
          .filter((l: ReturnType<typeof labFromResource>): l is NonNullable<ReturnType<typeof labFromResource>> => l != null);
        if (labs.length) {
          const { error: labError } = await admin.from('results').upsert(
            labs.map((l: NonNullable<ReturnType<typeof labFromResource>>) => ({
              user_id: uid,
              test_name: l.name,
              value: l.value,
              value_text: l.valueText,
              unit: l.unit,
              reference_low: l.low,
              reference_high: l.high,
              reference_text: l.rangeText,
              flag: l.flag,
              status: l.status,
              provider: conn.organization ?? conn.endpoint_name ?? null,
              source: 'provider',
              source_ref: `${connectionId}:${l.sourceId}`,
              occurred_at: `${l.on}T12:00:00Z`,
            })),
            { onConflict: 'user_id,source_ref' },
          );
          if (labError) throw labError;
        }
      }
    }
  }

  // What she holds from this provider, not what this one run wrote. A run
  // that found nothing new does not make her chart look empty.
  const { count: held, error: countError } = await admin
    .from('clinical_records')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .eq('user_id', uid);
  if (countError) throw countError;
```

In the final `provider_connections` update directly below, change `status: written > 0 ? 'active' : 'connected'` to `status: (held ?? 0) > 0 ? 'active' : 'connected'`, and change `record_count: written` to `record_count: held ?? 0`.

- [ ] **Step 8: Run the end to end script again**

The served function reloads on save. Run: `npm run e2e:provider`
Expected: every check `PASS`, then `all passed`.

- [ ] **Step 9: Run all checks**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass, and the typecheck prints nothing.

- [ ] **Step 10: Commit**

```bash
git add scripts/provider-e2e.mts scripts/provider-e2e.env package.json supabase/functions/provider-connect/exchange.ts supabase/functions/provider-connect/index.ts src/lib/providers/exchange.test.ts
git commit -m "Provider sync: a token the provider refuses marks the connection expired and keeps her records; the count is what she holds; an end to end check against the SMART test server"
```

---

### Task 2: The right client id for each provider

**Files:**
- Create: `ciatta-mobile-app/src/lib/providers/clientChoice.ts`
- Test: `ciatta-mobile-app/src/lib/providers/clientChoice.test.ts`
- Create: `ciatta-mobile-app/supabase/migrations/20261018110000_provider_client_id.sql`
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/exchange.ts`
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/index.ts`
- Modify: `ciatta-mobile-app/src/data/providerAccess.ts`
- Modify: `ciatta-mobile-app/src/data/providers.ts`
- Modify: `ciatta-mobile-app/src/screens/ProviderConnectScreen.tsx`
- Modify: `ciatta-mobile-app/.env.example`, and your local `ciatta-mobile-app/.env` (not committed)
- Modify: `ciatta-mobile-app/scripts/provider-e2e.mts`
- Test: `ciatta-mobile-app/src/lib/providers/exchange.test.ts`

**Interfaces:**
- Consumes: `isSandbox(endpoint)` from `src/lib/providers/epicDirectory.ts`, which is true for `epic-sandbox` and `smart-test`.
- Produces:
  - `type ClientIds = { production: string; nonProduction: string }` and `function clientFor(endpoint: Endpoint, ids: ClientIds): string` in `clientChoice.ts`
  - `async function clientIds(): Promise<ClientIds>` in `providerAccess.ts`, replacing `clientId()` and `canConnect()`, which have no other callers
  - `function allowedClients(list: string | undefined, single: string | undefined): string[]` in `exchange.ts`
  - `async function functionError(error: unknown, data: unknown, fallback: string): Promise<string>` in `src/data/providers.ts`, which Task 5 uses again
  - `provider_connections.client_id text`
  - The exchange request body gains `clientId: string`

- [ ] **Step 1: Write the failing tests**

`src/lib/providers/clientChoice.test.ts`:

```ts
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
```

Append to `src/lib/providers/exchange.test.ts`, and add `allowedClients` to its import list:

```ts
// ── Which client ids the function accepts ────────────────────────────

test('the allowed ids are the listed ones and the single legacy one, each once', () => {
  assert.deepEqual(allowedClients('prod-id, nonprod-id', 'nonprod-id'), ['prod-id', 'nonprod-id']);
});

test('nothing configured allows nothing', () => {
  assert.deepEqual(allowedClients(undefined, undefined), []);
  assert.deepEqual(allowedClients(' , ', ''), []);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/providers/clientChoice.test.ts src/lib/providers/exchange.test.ts`
Expected: FAIL. `./clientChoice` cannot be found, and `allowedClients` is not exported.

- [ ] **Step 3: Implement the pure parts**

`src/lib/providers/clientChoice.ts`:

```ts
// Which of Ciatta's two Epic client ids a provider is asked with.
//
// Epic issues one registration two ids. The non production id works only
// against the sandbox at fhir.epic.com; the production id works at real
// hospitals once Epic has made it live there. Sending the wrong one gets
// a refusal page that says nothing useful, so the choice is made here,
// by endpoint, and tested.

import type { Endpoint } from './directory';
import { isSandbox } from './epicDirectory';

export type ClientIds = { production: string; nonProduction: string };

export function clientFor(endpoint: Endpoint, ids: ClientIds): string {
  return (isSandbox(endpoint) ? ids.nonProduction : ids.production).trim();
}
```

In `exchange.ts`, after `exchangeBody`:

```ts
// The client ids this function will exchange for: production and non
// production, from SMART_CLIENT_IDS, plus the older single SMART_CLIENT_ID
// so a deploy that has only that keeps working. Public by design. Listed so
// a request can only name one of ours.
export function allowedClients(list: string | undefined, single: string | undefined): string[] {
  const all = [...(list ?? '').split(','), single ?? ''].map((s) => s.trim()).filter(Boolean);
  return [...new Set(all)];
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/providers/clientChoice.test.ts src/lib/providers/exchange.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the column**

`supabase/migrations/20261018110000_provider_client_id.sql`:

```sql
-- Which of Ciatta's client ids a connection was made with. Epic issues a
-- production id and a non production id for the sandbox, and a refresh
-- must present the same id the connection was made with.
--
-- Not added to the authenticated grant. The phone has no use for it.

alter table public.provider_connections add column client_id text;

comment on column public.provider_connections.client_id is
  'The public SMART client id used at exchange, and so the one a refresh presents. Null on connections made before it was kept; the function then uses the first id it is configured with.';
```

Apply it: `supabase migration up`
Expected: the migration is applied with no error.

- [ ] **Step 6: The function accepts only our ids, keeps the one used, and refreshes with it** (in `index.ts`)

Add `allowedClients` to the import from `'./exchange.ts'`. Replace the `CLIENT_ID` constant and its comment with:

```ts
// The public client ids registered with the vendor: production, and non
// production for the sandbox. Public by design: PKCE is what proves the
// exchange, not a secret.
const CLIENT_IDS = allowedClients(Deno.env.get('SMART_CLIENT_IDS'), Deno.env.get('SMART_CLIENT_ID'));
```

Replace `if (!CLIENT_ID) {` with `if (!CLIENT_IDS.length) {`.

In the `body` type annotation, add `clientId?: string;`.

In `exchange`, directly after the `Invalid request` check:

```ts
  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  if (!CLIENT_IDS.includes(clientId)) {
    // An older build carrying an id that has since changed. Said as ours
    // to fix, before her provider is called at all.
    return json({ error: 'This version of Ciatta cannot connect to providers. Updating the app should fix it.' }, 400);
  }
```

Change `exchangeBody(code, REDIRECT_URI, CLIENT_ID, verifier)` to `exchangeBody(code, REDIRECT_URI, clientId, verifier)`. Add `client_id: clientId,` to the `row` object next to `token_endpoint`.

In `sync`, change `refreshBody(conn.refresh_token, CLIENT_ID)` to `refreshBody(conn.refresh_token, conn.client_id ?? CLIENT_IDS[0])`.

- [ ] **Step 7: The app picks the id by endpoint and sends it**

Replace the body of `src/data/providerAccess.ts`, from `import AsyncStorage` to the end of the file, with:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientIds } from '../lib/providers/clientChoice';

const KEY = 'ciatta.smart.clientId';

const PRODUCTION = process.env.EXPO_PUBLIC_SMART_CLIENT_ID ?? '';
const NON_PRODUCTION = process.env.EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD ?? '';

// Both ids. A value entered in the app replaces the non production id
// only: it is how a test build reaches the sandbox, and it can never point
// a real hospital at a different registration.
export async function clientIds(): Promise<ClientIds> {
  let entered = '';
  try {
    entered = (await AsyncStorage.getItem(KEY))?.trim() ?? '';
  } catch {
    // Storage unavailable. The build values are still a real answer.
  }
  return { production: PRODUCTION.trim(), nonProduction: entered || NON_PRODUCTION.trim() };
}

export async function setClientId(value: string): Promise<void> {
  const clean = value.trim();
  if (clean) await AsyncStorage.setItem(KEY, clean);
  else await AsyncStorage.removeItem(KEY);
}
```

In the comment at the top of that file, change "The build, through EXPO_PUBLIC_SMART_CLIENT_ID" to "The build, through EXPO_PUBLIC_SMART_CLIENT_ID (production) and EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD (the sandbox)", and change "The entered value wins" to "The entered value replaces the non production id".

In `src/data/providers.ts`, add above `connectProvider`:

```ts
// What the function said went wrong. On an answer other than 2xx,
// supabase-js puts the response in error.context and leaves data null,
// so the function's own sentence has to be read from there.
export async function functionError(error: unknown, data: unknown, fallback: string): Promise<string> {
  const said = (data as { error?: unknown } | null)?.error;
  if (typeof said === 'string' && said) return said;
  try {
    const body = await (error as { context?: Response } | null)?.context?.json();
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch {
    // Not JSON, or already read. The fallback still says nothing was shared.
  }
  return fallback;
}
```

In `connectProvider`, add `clientId,` to the `body` sent with `action: 'exchange'`, and replace

```ts
    return { ok: false, message: (data as { error?: string } | null)?.error ?? 'That did not finish. Nothing was shared.' };
```

with

```ts
    return { ok: false, message: await functionError(error, data, 'That did not finish. Nothing was shared.') };
```

In `src/screens/ProviderConnectScreen.tsx`:
- Replace `import { clientId as readClientId, setClientId } from '../data/providerAccess';` with `import { clientIds as readClientIds, setClientId } from '../data/providerAccess';`, and add `import { type ClientIds, clientFor } from '../lib/providers/clientChoice';`.
- Change `useState<string | null>(null)` for `registration` to `useState<ClientIds | null>(null)`, and `void readClientId().then(setRegistration);` to `void readClientIds().then(setRegistration);`.
- In `connect`, change `connectProvider(picked, registration ?? '')` to `connectProvider(picked, registration ? clientFor(picked, registration) : '')`.
- In the `<ProviderSheet` props, change `registration={registration}` to `registration={registration ? clientFor(picked, registration) : null}`, and in `onRegister` change `setRegistration(await readClientId());` to `setRegistration(await readClientIds());`.

In `.env.example`, replace the two SMART lines with:

```
# Epic on FHIR client ids (public; SMART public clients use PKCE, not a secret).
# Production, for real hospitals, and non production, for the Epic sandbox.
EXPO_PUBLIC_SMART_CLIENT_ID=
EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD=
# Must equal the function's SMART_REDIRECT_URI. Empty means ciatta://provider-callback.
EXPO_PUBLIC_SMART_REDIRECT_URI=
```

In your local `.env` (ignored by git), rename `EXPO_PUBLIC_SMART_CLIENT_ID=f5288d9f-8fc2-4f6c-9190-6725d04293f9` to `EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD=f5288d9f-8fc2-4f6c-9190-6725d04293f9`. The production id is added in Task 7.

- [ ] **Step 8: Add the end to end check for an id that is not ours** (in `scripts/provider-e2e.mts`, replace the line `// CHECKS BEFORE CONNECTING (Task 2 adds one here)`)

```ts
    const wrong = await call(her.jwt, {
      action: 'exchange',
      code: 'unused',
      verifier: 'unused',
      clientId: 'not one of ours',
      endpoint: { ...SMART_TEST, tokenEndpoint: 'https://example.invalid/token' },
    });
    check('a client id that is not ours is refused before the provider is called', wrong.status === 400 && /Updating the app/.test(wrong.body?.error ?? ''), wrong.body?.error);
```

- [ ] **Step 9: Run every check**

With the function still served: `npm run e2e:provider`
Expected: `all passed`, including the new check.

Run: `npm test && npx tsc --noEmit && supabase test db`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/providers/clientChoice.ts src/lib/providers/clientChoice.test.ts supabase/migrations/20261018110000_provider_client_id.sql supabase/functions/provider-connect/exchange.ts supabase/functions/provider-connect/index.ts src/data/providerAccess.ts src/data/providers.ts src/screens/ProviderConnectScreen.tsx .env.example scripts/provider-e2e.mts src/lib/providers/exchange.test.ts
git commit -m "Provider client ids: production for hospitals, non production for the sandbox; the function accepts only its own ids and refreshes with the one used; its own error sentence reaches the app"
```

---

### Task 3: Removing a provider

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261018120000_disconnect_provider.sql`
- Test: `ciatta-mobile-app/supabase/tests/disconnect_provider.test.sql`
- Modify: `ciatta-mobile-app/src/data/providers.ts`
- Modify: `ciatta-mobile-app/scripts/provider-e2e.mts`

**Interfaces:**
- Consumes: `provider_connections`, `clinical_records` (deleted with its connection by `on delete cascade`), `results.source` and `results.source_ref` (provider labs are `source = 'provider'`, `source_ref = '<connection id>:<resource>'`).
- Produces:
  - `public.disconnect_provider(p_connection uuid) returns boolean`, executable by `authenticated`
  - `async function disconnectProvider(connectionId: string): Promise<boolean>` in `src/data/providers.ts`

- [ ] **Step 1: Write the failing SQL test**

`supabase/tests/disconnect_provider.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local');

insert into public.provider_connections (id, user_id, endpoint_id, endpoint_name, fhir_base_url, vendor, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'one', 'Hospital One', 'https://one.example/R4', 'epic', 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'two', 'Hospital Two', 'https://two.example/R4', 'epic', 'active');

insert into public.clinical_records (user_id, connection_id, source_id, kind, name) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'Condition/1', 'condition', 'Asthma'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002', 'Condition/2', 'condition', 'Migraine');

insert into public.results (user_id, test_name, value, occurred_at, source, source_ref) values
  ('00000000-0000-0000-0000-0000000000a1', 'TSH', 4.2, '2026-01-01', 'provider', '10000000-0000-0000-0000-000000000001:Observation/1'),
  ('00000000-0000-0000-0000-0000000000a1', 'TSH', 3.9, '2026-02-01', 'provider', '10000000-0000-0000-0000-000000000002:Observation/2'),
  ('00000000-0000-0000-0000-0000000000a1', 'Ferritin', 20, '2026-03-01', 'report', 'document 1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), false, 'someone else cannot remove her connection');
reset role;
select is((select count(*)::int from public.provider_connections where id = '10000000-0000-0000-0000-000000000001'), 1,
  'and it is still there');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), true, 'she can remove her connection');
select is(public.disconnect_provider('10000000-0000-0000-0000-000000000001'), false, 'removing it a second time is a no');
reset role;

select is((select count(*)::int from public.provider_connections where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'only that connection is gone');
select is((select count(*)::int from public.clinical_records where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'its records are gone and the other provider''s stay');
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'provider'), 1,
  'its labs are gone and the other provider''s stay');
select is((select count(*)::int from public.results where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'report'), 1,
  'labs she added from a report are untouched');
select ok(not has_function_privilege('anon', 'public.disconnect_provider(uuid)', 'EXECUTE'), 'anon cannot call it');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `supabase test db`
Expected: `disconnect_provider.test.sql` fails because `public.disconnect_provider(unknown)` does not exist. The other files pass.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261018120000_disconnect_provider.sql`:

```sql
-- Removing a provider. The connect sheet and Privacy both tell her she can,
-- and this is what does it: the connection, every record it sent, and its
-- labs in her results. Nothing is changed at her provider.
--
-- Security definer because the client has no delete grant on any of these
-- tables, and must not: a delete the app could aim would be a way to empty
-- someone's chart. Every statement is scoped to auth.uid(), and a
-- connection that is not hers is a plain false, not an error that says it
-- exists.
--
-- clinical_records go with the connection by on delete cascade. Provider
-- labs in results have no foreign key, so they are deleted by the
-- connection id that prefixes their source_ref.

create function public.disconnect_provider(p_connection uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return false;
  end if;
  if not exists (select 1 from public.provider_connections where id = p_connection and user_id = me) then
    return false;
  end if;

  delete from public.results
  where user_id = me and source = 'provider' and source_ref like p_connection::text || ':%';

  delete from public.provider_connections where id = p_connection and user_id = me;
  return true;
end $$;

revoke execute on function public.disconnect_provider(uuid) from public, anon;
grant execute on function public.disconnect_provider(uuid) to authenticated;
```

Apply it: `supabase migration up`

- [ ] **Step 4: Run the SQL tests**

Run: `supabase test db`
Expected: `Result: PASS`.

- [ ] **Step 5: Add the data call** (in `src/data/providers.ts`, after `loadConnections`)

```ts
// Removes a provider: the connection, its records and its labs, on the
// server, as her. False when it was not hers or did not go through, so the
// screen can say nothing changed.
export async function disconnectProvider(connectionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('disconnect_provider', { p_connection: connectionId });
  return !error && data === true;
}
```

- [ ] **Step 6: Add the end to end removal checks** (in `scripts/provider-e2e.mts`)

Add this helper after `count`:

```ts
async function removeConnection(jwt: string, connectionId: string): Promise<unknown> {
  const res = await fetch(`${API}/rest/v1/rpc/disconnect_provider`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_connection: connectionId }),
  });
  return res.json();
}
```

Replace the line `// REMOVAL CHECKS (Task 3 adds them here)` with:

```ts
    check('someone else cannot remove her connection', (await removeConnection(other.jwt, id)) === false && (await connection(id)) !== null);
    check('she can remove it', (await removeConnection(her.jwt, id)) === true && (await connection(id)) === null);
    check('its records and labs are gone', (await count(her.jwt, 'clinical_records')) === 0 && (await count(her.jwt, 'results', '&source=eq.provider')) === 0);
    check('a sync after removal writes nothing', (await call(her.jwt, { action: 'sync', connectionId: id })).status === 404 && (await count(her.jwt, 'results', '&source=eq.provider')) === 0);
```

- [ ] **Step 7: Run every check**

Run: `npm run e2e:provider && npm test && npx tsc --noEmit`
Expected: `all passed`, then all unit tests pass and the typecheck prints nothing.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261018120000_disconnect_provider.sql supabase/tests/disconnect_provider.test.sql src/data/providers.ts scripts/provider-e2e.mts
git commit -m "Remove a provider: its connection, records and labs, scoped to her; another person's connection is a plain no"
```

---

### Task 4: Records kept current on a schedule

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20261018130000_provider_sync_schedule.sql`
- Test: `ciatta-mobile-app/supabase/tests/provider_sync.test.sql`
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/exchange.ts`
- Modify: `ciatta-mobile-app/supabase/functions/provider-connect/index.ts`
- Modify: `ciatta-mobile-app/scripts/provider-e2e.mts`
- Test: `ciatta-mobile-app/src/lib/providers/exchange.test.ts`

**Interfaces:**
- Consumes: the Vault secrets `service_role_key` and `project_url`, already used by `baselines_tick` (`supabase/migrations/20260917100000_scheduler.sql`). `sync(admin, uid, connectionId)` in `index.ts`.
- Produces:
  - `SYNC_EVERY_HOURS = 20`, `SYNC_BATCH = 3`, `function dueBefore(now: Date): string`, `function sameSecret(given: string, expected: string): boolean` in `exchange.ts`
  - The function action `sync_due`, accepted only with the service role key as bearer
  - `provider_connections.sync_attempted_at timestamptz`, `public.provider_sync_tick() returns integer`, cron job `provider-sync` every 15 minutes

- [ ] **Step 1: Write the failing unit tests** (append to `src/lib/providers/exchange.test.ts`, and add `dueBefore`, `sameSecret`, `SYNC_BATCH`, `SYNC_EVERY_HOURS` to its import list)

```ts
// ── The scheduled sync ───────────────────────────────────────────────

test('a connection is due once it has waited its interval', () => {
  assert.equal(SYNC_EVERY_HOURS, 20);
  assert.equal(dueBefore(new Date('2026-10-14T20:00:00.000Z')), '2026-10-14T00:00:00.000Z');
});

test('one scheduled run reads a few connections, not everyone', () => {
  assert.ok(SYNC_BATCH >= 1 && SYNC_BATCH <= 5);
});

test('the scheduler is recognised by the exact key and by nothing else', () => {
  assert.equal(sameSecret('key 123', 'key 123'), true);
  assert.equal(sameSecret('key 124', 'key 123'), false);
  assert.equal(sameSecret('key 12', 'key 123'), false);
  assert.equal(sameSecret('key 1234', 'key 123'), false);
  assert.equal(sameSecret('', ''), false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/providers/exchange.test.ts`
Expected: FAIL, the four names are not exported.

- [ ] **Step 3: Implement them** (in `exchange.ts`, after `needsRefresh`)

```ts
// How long a connection waits before the scheduled run reads it again, and
// how many one run reads. Under a day keeps a chart that changes at visits
// current; three keeps one run well inside the function's time limit.
export const SYNC_EVERY_HOURS = 20;
export const SYNC_BATCH = 3;

export function dueBefore(now: Date): string {
  return new Date(now.getTime() - SYNC_EVERY_HOURS * 3_600_000).toISOString();
}

// Whether the bearer is the service role key, compared in constant time so
// how long it takes says nothing about how much of a guess was right. An
// empty key is never a match, or an unset env would let an empty bearer in.
export function sameSecret(given: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(given);
  const b = encoder.encode(expected);
  if (b.length === 0) return false;
  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) difference |= (a[i] ?? 0) ^ b[i];
  return difference === 0;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/providers/exchange.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing SQL test**

`supabase/tests/provider_sync.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'provider_connections', 'sync_attempted_at', 'a connection records when a sync was last tried');
select has_function('public', 'provider_sync_tick', 'provider_sync_tick exists');
select ok(not has_function_privilege('anon', 'public.provider_sync_tick()', 'EXECUTE'), 'anon cannot run the provider sync');
select ok(not has_function_privilege('authenticated', 'public.provider_sync_tick()', 'EXECUTE'), 'authenticated cannot run the provider sync');
select ok(
  exists (select 1 from cron.job where jobname = 'provider-sync'
          and command not ilike '%bearer%' and command not ilike '%service_role%' and command not ilike '%eyJ%'),
  'the provider sync is scheduled, and its command carries no key'
);

select * from finish();
rollback;
```

Run: `supabase test db`
Expected: `provider_sync.test.sql` fails on all five.

- [ ] **Step 6: Write the migration**

`supabase/migrations/20261018130000_provider_sync_schedule.sql`:

```sql
-- Her records kept current without her asking. Every fifteen minutes the
-- scheduler asks provider-connect to read the few connections that have
-- waited longest, and each connection is read about once every twenty
-- hours (SYNC_EVERY_HOURS in the function).
--
-- sync_attempted_at, not last_synced_at, decides who is next. A connection
-- whose provider keeps failing is still moved to the back after each
-- attempt, so it cannot hold the front of the queue and starve everyone
-- else.
--
-- Same arrangement as baselines_tick: pg_net posts, and the service role
-- key comes from Vault at run time, so it is never in cron.job's command.

alter table public.provider_connections add column sync_attempted_at timestamptz;

comment on column public.provider_connections.sync_attempted_at is
  'When a sync of this connection last started, whether or not it finished. The scheduled run takes the oldest first.';

create function public.provider_sync_tick() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  service_key text;
  project_url text;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key';
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  if service_key is null or project_url is null then
    return 0;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/provider-connect',
    body := '{"action":"sync_due"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    timeout_milliseconds := 120000
  );
  return 1;
end $$;
revoke execute on function public.provider_sync_tick() from public, anon, authenticated;

select cron.schedule(
  'provider-sync',
  '*/15 * * * *',
  $$ select public.provider_sync_tick() $$
);
```

Apply it: `supabase migration up`. Run: `supabase test db`
Expected: `Result: PASS`.

- [ ] **Step 7: The function runs the scheduled sync** (in `index.ts`)

Add `dueBefore`, `sameSecret`, `SYNC_BATCH` to the import from `'./exchange.ts'`.

In `Deno.serve`, directly after `if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);`, add:

```ts
  // The scheduler, not a person. It may only run the scheduled sync, and
  // a signed in person can never reach that action.
  if (sameSecret(auth.slice('Bearer '.length), serviceKey)) {
    try {
      return await syncDue(createClient(url, serviceKey));
    } catch (e) {
      console.error('provider sync_due failed', e instanceof Error ? e.name : 'unknown');
      return json({ error: 'That did not finish.' }, 500);
    }
  }
```

In `sync`, directly after `if (!conn) return json({ error: 'That connection was not found.' }, 404);`, add:

```ts
  await admin
    .from('provider_connections')
    .update({ sync_attempted_at: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('user_id', uid);
```

Add before `markExpired` at the end of the file:

```ts
// The connections that have waited longest, read one at a time. One that
// fails is noted and the run goes on to the next.
async function syncDue(admin: any): Promise<Response> {
  const { data: due, error } = await admin
    .from('provider_connections')
    .select('id, user_id')
    .in('status', ['active', 'connected'])
    .or(`sync_attempted_at.is.null,sync_attempted_at.lt.${dueBefore(new Date())}`)
    .order('sync_attempted_at', { ascending: true, nullsFirst: true })
    .limit(SYNC_BATCH);
  if (error) throw error;

  let synced = 0;
  for (const c of (due ?? []) as { id: string; user_id: string }[]) {
    try {
      const res = await sync(admin, c.user_id, c.id);
      if (res.ok) synced++;
    } catch (e) {
      console.error('provider sync failed', e instanceof Error ? e.name : 'unknown');
      await admin
        .from('provider_connections')
        .update({ last_error: 'The last update did not finish. Ciatta will try again.' })
        .eq('id', c.id)
        .eq('user_id', c.user_id);
    }
  }
  return json({ considered: (due ?? []).length, synced });
}
```

- [ ] **Step 8: Add the end to end checks** (in `scripts/provider-e2e.mts`, replace the line `// SCHEDULED SYNC CHECKS (Task 4 adds them here)`)

```ts
    await setConnection(id, { sync_attempted_at: new Date(Date.now() - 24 * 3600_000).toISOString() });
    const due = await call(SERVICE, { action: 'sync_due' });
    const attempted = Date.parse((await connection(id))?.sync_attempted_at ?? '');
    check('the scheduled run reads a connection that is due', due.status === 200 && attempted > Date.now() - 120_000, JSON.stringify(due.body));
    check('a signed in person cannot run the scheduled sync', (await call(her.jwt, { action: 'sync_due' })).status === 400);
```

- [ ] **Step 9: Run every check**

Run: `npm run e2e:provider && npm test && npx tsc --noEmit && supabase test db`
Expected: `all passed`, and all three suites pass.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261018130000_provider_sync_schedule.sql supabase/tests/provider_sync.test.sql supabase/functions/provider-connect/exchange.ts supabase/functions/provider-connect/index.ts scripts/provider-e2e.mts src/lib/providers/exchange.test.ts
git commit -m "Provider records kept current: the scheduler reads the connections that have waited longest every fifteen minutes, each about once every twenty hours"
```

---

### Task 5: Her providers on the Chart screen

**Files:**
- Create: `ciatta-mobile-app/src/lib/providers/connectionView.ts`
- Test: `ciatta-mobile-app/src/lib/providers/connectionView.test.ts`
- Modify: `ciatta-mobile-app/src/data/providers.ts`
- Modify: `ciatta-mobile-app/src/screens/ChartScreen.tsx`
- Modify: `ciatta-mobile-app/src/screens/ProfileScreen.tsx:285-307`

**Interfaces:**
- Consumes: `Connection`, `loadConnections`, `loadClinicalRecords`, `disconnectProvider` (Task 3) and `functionError` (Task 2) from `src/data/providers.ts`. `dayLabel` from `src/lib/providers/clinicalView.ts`.
- Produces, in `connectionView.ts`:
  - `function updatedLine(lastSyncedAt: string | null, now: Date): string`
  - `const canSync: (c: Connection) => boolean`, `const needsReconnect: (c: Connection) => boolean`, `const providerName: (c: Connection) => string`
  - `function connectionLine(c: Connection, now: Date): string`
  - `type RecordsSource = { status: string; tone: 'live' | 'suggested' | undefined; connected: boolean; target: 'chart' | 'providerConnect' }` and `function recordsSource(connections: readonly Connection[]): RecordsSource`
  - `type SyncFailure = { name: string; message: string }` and `function syncNote(failures: readonly SyncFailure[]): string | null`
- Produces, in `src/data/providers.ts`: `async function syncProviders(connections: readonly Connection[]): Promise<SyncFailure[]>`

- [ ] **Step 1: Write the failing tests**

`src/lib/providers/connectionView.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx tsx --test src/lib/providers/connectionView.test.ts`
Expected: FAIL, `./connectionView` cannot be found.

- [ ] **Step 3: Implement `connectionView.ts`**

```ts
// How her provider connections are described: on the Chart screen, where
// she manages them, and on the Data Sources row in Profile.
//
// Pure, so every sentence is tested. A connection is described by what
// she holds from it, not by what the last run happened to write.

import type { Connection } from '../../data/providers';
import { dayLabel } from './clinicalView';

const DAY = 86_400_000;
const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const records = (n: number) => (n === 1 ? '1 record' : `${n} records`);

export function updatedLine(lastSyncedAt: string | null, now: Date): string {
  if (!lastSyncedAt) return 'Not updated yet';
  const at = new Date(lastSyncedAt);
  if (Number.isNaN(at.getTime())) return 'Not updated yet';
  const days = Math.round((localDay(now) - localDay(at)) / DAY);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `Updated ${dayLabel(iso)}`;
}

export const canSync = (c: Connection) => c.status === 'active' || c.status === 'connected';
export const needsReconnect = (c: Connection) => c.status === 'expired' || c.status === 'error';
export const providerName = (c: Connection) => c.organization ?? c.endpointName;

export function connectionLine(c: Connection, now: Date): string {
  if (needsReconnect(c)) return 'Needs connecting again. The records it already sent are kept.';
  if (c.recordCount === 0) return 'Connected. Nothing has arrived yet.';
  return `${records(c.recordCount)}. ${c.lastError ?? updatedLine(c.lastSyncedAt, now)}`;
}

export type RecordsSource = {
  status: string;
  tone: 'live' | 'suggested' | undefined;
  connected: boolean;
  target: 'chart' | 'providerConnect';
};

export function recordsSource(connections: readonly Connection[]): RecordsSource {
  const kept = connections.filter((c) => canSync(c) || needsReconnect(c));
  if (!kept.length) {
    return { status: 'Your hospital or clinic, through its portal', tone: 'suggested', connected: false, target: 'providerConnect' };
  }
  if (kept.some(needsReconnect)) return { status: 'Needs connecting again', tone: undefined, connected: true, target: 'chart' };
  const total = kept.reduce((n, c) => n + c.recordCount, 0);
  if (total === 0) return { status: 'Connected. Nothing has arrived yet.', tone: 'live', connected: true, target: 'chart' };
  const from = kept.length === 1 ? providerName(kept[0]) : `${kept.length} providers`;
  return { status: `${records(total)} from ${from}`, tone: 'live', connected: true, target: 'chart' };
}

export type SyncFailure = { name: string; message: string };

export function syncNote(failures: readonly SyncFailure[]): string | null {
  if (!failures.length) return null;
  if (failures.length === 1) return `${failures[0].name}: ${failures[0].message}`;
  const names = failures.map((f) => f.name);
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} could not be updated just now.`;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsx --test src/lib/providers/connectionView.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `syncProviders`** (in `src/data/providers.ts`, after `disconnectProvider`)

Add to the imports: `import { canSync, providerName, type SyncFailure } from '../lib/providers/connectionView';`

```ts
// Asks each working provider for anything new, through the function that
// holds the tokens. One at a time, and a failure does not stop the rest.
export async function syncProviders(connections: readonly Connection[]): Promise<SyncFailure[]> {
  const failures: SyncFailure[] = [];
  for (const c of connections.filter(canSync)) {
    const { data, error } = await supabase.functions.invoke('provider-connect', {
      body: { action: 'sync', connectionId: c.id },
    });
    if (error || !data?.connection) {
      failures.push({ name: providerName(c), message: await functionError(error, data, 'That did not finish.') });
    }
  }
  return failures;
}
```

- [ ] **Step 6: The Chart screen lists her providers, refreshes them on pull, and can remove one**

In `src/screens/ChartScreen.tsx`:

Replace the import lines for `react-native` and `../data/providers` with:

```tsx
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Connection, disconnectProvider, loadClinicalRecords, loadConnections, syncProviders } from '../data/providers';
import { connectionLine, needsReconnect, providerName, syncNote } from '../lib/providers/connectionView';
```

Replace the body of `ChartScreen`, from `const nav = useNav();` to the end of the `isEmpty(view)` branch (the `if (isEmpty(view)) { ... }` block, inclusive), with:

```tsx
  const nav = useNav();
  const [view, setView] = useState<ChartView | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const read = useCallback(async () => {
    setBusy(true);
    try {
      const [records, conns] = await Promise.all([loadClinicalRecords(), loadConnections()]);
      setView(chartView(records));
      setConnections(conns);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  // Pulling down asks her providers for anything new, then reads again.
  const refresh = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      setNote(syncNote(await syncProviders(connections)));
    } finally {
      await read();
    }
  }, [connections, read]);

  const add = useCallback(() => nav.push('providerConnect' as Screen), [nav]);

  const remove = useCallback(
    (c: Connection) => {
      Alert.alert(
        displayCopy(`Remove ${providerName(c)}?`),
        'The records it sent are removed from Ciatta. Nothing changes in your chart at your provider, and you can connect again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () =>
              void disconnectProvider(c.id).then((ok) => {
                if (!ok) setNote('That provider could not be removed just now. Nothing was changed.');
                return read();
              }),
          },
        ],
      );
    },
    [read],
  );

  const providers = connections.length ? (
    <Providers connections={connections} onReconnect={add} onRemove={remove} onAdd={add} />
  ) : null;

  if (!view) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <View style={s.centre}>
          <ActivityIndicator color={G.meta} />
        </View>
      </DetailScreen>
    );
  }

  if (isEmpty(view)) {
    return (
      <DetailScreen title="From your providers" onBack={nav.back}>
        <ScrollView
          style={s.fill}
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor={G.meta} />}
        >
          <Lead
            style={s.lede}
            text={
              connections.length
                ? 'Nothing has arrived from your providers yet. Pull down to check again.'
                : 'Nothing has arrived from a provider yet. Connecting a hospital or clinic brings your results, conditions and medications here.'
            }
          />
          {note ? <Text style={[font('caption1'), s.note]}>{displayCopy(note)}</Text> : null}
          {providers ?? (
            <View style={[s.pad, { marginTop: SPACE.block }]}>
              <SecondaryButton label="Connect a Provider" onPress={add} />
            </View>
          )}
        </ScrollView>
      </DetailScreen>
    );
  }
```

In the main return, change `onRefresh={read}` to `onRefresh={refresh}`, and directly after the `<Text ...>Everything here came from your provider, in their words. Ciatta has not changed any of it.</Text>` element add:

```tsx
        {note ? <Text style={[font('caption1'), s.note]}>{displayCopy(note)}</Text> : null}
        {providers}
```

Add these components before `function Standing`:

```tsx
// Her providers, each with what it has sent and when, and the two things
// she can do: connect again when it has expired, and remove it.
function Providers({
  connections,
  onReconnect,
  onRemove,
  onAdd,
}: {
  connections: readonly Connection[];
  onReconnect: () => void;
  onRemove: (c: Connection) => void;
  onAdd: () => void;
}) {
  const now = new Date();
  return (
    <View style={s.section}>
      <Eyebrow>Your providers</Eyebrow>
      <View style={s.card}>
        <CardFill />
        {connections.map((c, n) => (
          <View key={c.id} style={[s.provider, n > 0 && s.divided]}>
            <Text style={[font('subhead', 'semibold'), s.name]}>{displayCopy(providerName(c))}</Text>
            <Text style={[font('caption1'), needsReconnect(c) ? s.attention : s.when]}>{displayCopy(connectionLine(c, now))}</Text>
            <View style={s.providerActions}>
              {needsReconnect(c) ? <TextAction label="Connect again" onPress={onReconnect} /> : null}
              <TextAction label="Remove" onPress={() => onRemove(c)} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: SPACE.near }}>
        <SecondaryButton label="Add Another Provider" onPress={onAdd} />
      </View>
    </View>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && s.pressed}>
      <Text style={[font('footnote', 'semibold'), s.action]}>{label}</Text>
    </Pressable>
  );
}
```

Add to the `StyleSheet.create` object:

```ts
  provider: { paddingVertical: 12, gap: 2 },
  providerActions: { flexDirection: 'row', gap: 18, marginTop: 6 },
  action: { color: L.ink },
  attention: { color: HUE.attention, marginTop: 2 },
  pressed: { opacity: 0.6 },
```

- [ ] **Step 7: The Data Sources row uses `recordsSource`** (in `src/screens/ProfileScreen.tsx`)

Add `import { recordsSource } from '../lib/providers/connectionView';`. Replace `const linked = (providers ?? []).filter((c) => c.status === 'active');` with `const records = recordsSource(providers ?? []);`, and replace the `Health Records` `SourceRow`'s `status`, `tone`, `connected` and `onPress` props with:

```tsx
          status={records.status}
          tone={records.tone}
          connected={records.connected}
          onPress={() => onOpen(records.target)}
```

- [ ] **Step 8: Run all checks**

Run: `npm test && npx tsc --noEmit`
Expected: all pass, typecheck silent.

- [ ] **Step 9: Drive it on the phone**

Use a development build pointed at your local Supabase, or the hosted project after Task 7's deploy steps. Connect the SMART test server, then:
- Open Profile, then Data Sources. Health Records reads `490 records from SMART Test Server (test data only)`, and tapping it opens From your providers.
- The Your providers card shows the test server with `490 records. Updated today`.
- Pull down: the spinner shows, the count stays the same, and no note appears.
- Tap Remove, then Remove in the alert. The screen shows the empty state with Connect a Provider.

- [ ] **Step 10: Commit**

```bash
git add src/lib/providers/connectionView.ts src/lib/providers/connectionView.test.ts src/data/providers.ts src/screens/ChartScreen.tsx src/screens/ProfileScreen.tsx
git commit -m "Your providers on the Chart screen: what each has sent and when, pull down to update, connect again when expired, remove; Data Sources says when one needs connecting again"
```

---

### Task 6: Test hospitals only in test builds

**Files:**
- Modify: `ciatta-mobile-app/src/lib/providers/epicDirectory.ts`
- Test: `ciatta-mobile-app/src/lib/providers/epicDirectory.test.ts`
- Modify: `ciatta-mobile-app/src/data/providers.ts`
- Modify: `ciatta-mobile-app/src/screens/ProviderConnectScreen.tsx`
- Modify: `ciatta-mobile-app/eas.json`

**Interfaces:**
- Consumes: `SANDBOX`, `SMART_TEST`, `isSandbox` in `epicDirectory.ts`.
- Produces:
  - `const TEST_ENDPOINTS: readonly Endpoint[]` and `function withTestEndpoints(rows: Endpoint[], include: boolean): Endpoint[]` in `epicDirectory.ts`
  - `const showsTestProviders: boolean` in `src/data/providers.ts`
  - The build variable `EXPO_PUBLIC_TEST_PROVIDERS=1` in the `development` and `preview` EAS profiles

- [ ] **Step 1: Write the failing test** (append to `src/lib/providers/epicDirectory.test.ts`, and add `isSandbox`, `TEST_ENDPOINTS`, `withTestEndpoints` to its import from `./epicDirectory` if they are not already there)

```ts
test('a test build lists the test servers first', () => {
  const rows = withTestEndpoints([{ ...SANDBOX, id: 'mercy', name: 'Mercy Hospital' }], true);
  assert.deepEqual(rows.slice(0, 2).map((r) => r.id), TEST_ENDPOINTS.map((r) => r.id));
  assert.equal(rows.length, 3);
});

test('a production build never lists test data', () => {
  const rows = withTestEndpoints([{ ...SANDBOX, id: 'mercy', name: 'Mercy Hospital' }], false);
  assert.deepEqual(rows.map((r) => r.id), ['mercy']);
  assert.ok(!rows.some(isSandbox));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx --test src/lib/providers/epicDirectory.test.ts`
Expected: FAIL, `withTestEndpoints` is not exported.

- [ ] **Step 3: Implement it** (in `epicDirectory.ts`, after `SMART_TEST`)

```ts
// The two test servers, at the front of the directory in test builds and
// absent from production ones: synthetic patients must never be one tap
// away from someone looking for her own hospital.
export const TEST_ENDPOINTS: readonly Endpoint[] = [SANDBOX, SMART_TEST];

export function withTestEndpoints(rows: Endpoint[], include: boolean): Endpoint[] {
  return include ? [...TEST_ENDPOINTS, ...rows] : rows;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx --test src/lib/providers/epicDirectory.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the directory and on the connect screen**

In `src/data/providers.ts`, change the import from `'../lib/providers/epicDirectory'` to `import { parseEndpointBundle, withTestEndpoints } from '../lib/providers/epicDirectory';` and add below `EPIC_DIRECTORY`:

```ts
// Development and preview builds. Production builds carry neither the
// test servers nor the client id field.
export const showsTestProviders = __DEV__ || process.env.EXPO_PUBLIC_TEST_PROVIDERS === '1';
```

Replace `loadDirectory` with:

```ts
export async function loadDirectory(): Promise<Endpoint[]> {
  carried ??= readCarried().catch(() => []);
  const rows = await carried;
  if (rows.length) return withTestEndpoints(rows, showsTestProviders);
  // The carried file could not be read: fall back to Epic's live list of
  // health systems, which has no locations but is still every system.
  carried = null;
  try {
    const res = await fetch(EPIC_DIRECTORY, { headers: { Accept: 'application/json' } });
    if (!res.ok) return withTestEndpoints([], showsTestProviders);
    return withTestEndpoints(parseEndpointBundle(await res.json(), 'epic', 'MyChart'), showsTestProviders);
  } catch {
    // Offline, or the vendor moved the file. The screen says the directory
    // could not be reached, rather than showing an empty search that looks
    // like no match.
    return withTestEndpoints([], showsTestProviders);
  }
}
```

In `src/screens/ProviderConnectScreen.tsx`, add `showsTestProviders` to the import from `'../data/providers'`. Replace the block that starts `{directory !== null && directory.length <= 1 ? (` and ends with its `) : null}` with:

```tsx
      {directory !== null && directory.every(isSandbox) ? (
        <Text style={[font('caption1'), s.note]}>
          {showsTestProviders
            ? 'The full directory could not be reached just now. You can still connect to the test servers below.'
            : 'The directory of hospitals and clinics could not be reached just now. Check your connection and try again.'}
        </Text>
      ) : null}
```

In `ProviderSheet`, change `{showSetup ? (` to `{!showsTestProviders ? null : showSetup ? (`, so the client id field and the "I have a client ID" link exist only in test builds. The "Ciatta is early" sentence above them stays in every build.

In `eas.json`, add `"env": { "EXPO_PUBLIC_TEST_PROVIDERS": "1" }` to the `development` and `preview` profiles. `waydroid` and `device` extend `preview` and inherit it. `production` gets nothing.

- [ ] **Step 6: Run all checks**

Run: `npm test && npx tsc --noEmit`
Expected: all pass, typecheck silent.

- [ ] **Step 7: Commit**

```bash
git add src/lib/providers/epicDirectory.ts src/lib/providers/epicDirectory.test.ts src/data/providers.ts src/screens/ProviderConnectScreen.tsx eas.json
git commit -m "Test servers and the client id field only in development and preview builds; a production directory is real hospitals only"
```

---

### Task 7: Going live

Manual steps with exact values. Nothing here is committed except `.env.example`, which Task 2 already updated. Do the steps in order and tick each one off.

**Files:** none.

- [ ] **Step 1: Finish the Epic registration** (fhir.epic.com, Build Apps, the Ciatta patient app, app id 62277)

- Endpoint URI: add `https://pghlquiwqnknpveyssui.supabase.co/functions/v1/provider-callback`, then remove the `ciatta://provider-callback` entry (Epic stored it as `https://ciatta://provider-callback`, which no phone can open).
- Summary, required before production: `Keep your health records, cycle and symptoms together, and read them in one place.` Write the Description to match. Public copy is gender neutral, so it never says women or her.
- Intended Purposes: tick **Individuals' Access to their EHI**, and untick **Educational Resources** unless Ciatta is mainly educational. Intended Users: tick **Individual/Caregiver**.
- Thumbnail and screenshots: use the app icon `ciatta-mobile-app/CIATTA_Icon-02.png` and up to 10 phone screenshots, including the connect sheet and From your providers.
- Data Use Questionnaire: make both tabs (5/28/2021 and 12/27/2018) agree. Today **The user's care team** is ticked in one and not the other. Unless Ciatta sends data to clinicians itself, untick it in both.
- Automatic Client Distribution is **None**, so each hospital must switch Ciatta on before its patients can connect, and until then they see the "has not switched on Ciatta's connection yet" message. Read Epic's current criteria for **USCDI v3** distribution on open.epic.com. If Ciatta's API list qualifies, choosing it makes Ciatta available at Epic hospitals without asking each one. This is a product decision, so confirm it before changing the setting.
- Accept the open.epic terms of use, then **Save & Ready for Production**. Copy the **Production Client ID** shown afterwards. The Non-Production Client ID is `f5288d9f-8fc2-4f6c-9190-6725d04293f9`.

- [ ] **Step 2: Configure and deploy the backend** (from `ciatta-mobile-app/`)

```bash
supabase db push
supabase secrets set SMART_CLIENT_IDS="<production client id>,f5288d9f-8fc2-4f6c-9190-6725d04293f9" SMART_REDIRECT_URI="https://pghlquiwqnknpveyssui.supabase.co/functions/v1/provider-callback"
supabase functions deploy provider-connect
supabase functions deploy provider-callback
```

Expected: `db push` lists `20261018100000`, `20261018110000`, `20261018120000`, `20261018130000` and applies them without error.

In the Supabase SQL editor for project `pghlquiwqnknpveyssui`, run:

```sql
select name from vault.secrets where name in ('service_role_key', 'project_url');
select jobname, schedule from cron.job where jobname = 'provider-sync';
```

Expected: both secret names come back, and `provider-sync | */15 * * * *`. If either secret is missing, create it as the scheduler plan describes (`docs/superpowers/plans/2026-09-16-backend-slice-3a-scheduler-and-links.md`, Task 5). Without them `provider_sync_tick` posts nothing and records stop updating on their own.

- [ ] **Step 3: Set the build variables** (EAS, for the `preview` and `production` environments)

```bash
for env in preview production; do
  eas env:create --environment $env --name EXPO_PUBLIC_SMART_CLIENT_ID --value "<production client id>" --visibility plaintext
  eas env:create --environment $env --name EXPO_PUBLIC_SMART_CLIENT_ID_NONPROD --value "f5288d9f-8fc2-4f6c-9190-6725d04293f9" --visibility plaintext
  eas env:create --environment $env --name EXPO_PUBLIC_SMART_REDIRECT_URI --value "https://pghlquiwqnknpveyssui.supabase.co/functions/v1/provider-callback" --visibility plaintext
done
```

Add the same three lines to your local `.env` for development builds.

- [ ] **Step 4: Run it on a phone against the Epic sandbox** (preview build: `eas build --profile preview --platform ios`)

- In Profile, Data Sources, Health Records, search and pick **Epic Sandbox (test data only)**. Continue to MyChart. Safari opens Epic's login.
- Log in as one of the MyChart test patients listed on open.epic.com under Test Patients (the page gives each one's MyChart username and password). Approve access, choosing 12 months if asked.
- Expected: Safari closes on its own through the forwarding page, the sheet reports records arriving, and From your providers lists Epic Sandbox with `Updated today`.
- In the SQL editor: `select status, refresh_token is not null as can_refresh, client_id from provider_connections order by created_at desc limit 1;`
  Expected: `active | t | f5288d9f-8fc2-4f6c-9190-6725d04293f9`. If `can_refresh` is `f`, Epic did not issue a refresh token, and the connection will expire within the hour. Check the app's refresh token setting in the Epic console before going further.
- Pull down on From your providers. Expected: no note, same count.
- Remove it. Expected: the empty state, and `select count(*) from clinical_records` for your user is 0.

- [ ] **Step 5: Run it against one real hospital, once Epic shows the production client as live**

- In a production build (`eas build --profile production`), search for your own hospital. The test servers are not listed.
- Expected, either way:
  - The hospital has switched Ciatta on: your own MyChart login opens and your records arrive.
  - It has not: the sheet says it has not switched on Ciatta's connection yet, and no Epic error page opens. That is the per-hospital activation from Step 1, not a fault.
