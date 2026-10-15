// Finishing a provider connection, and pulling what it gives.
//
// Runs as her: the caller's JWT is verified before anything is read or
// written, and every row touched is scoped to that user id. The service
// key is used only to write the token columns, which no policy grants to
// authenticated, and is never forwarded anywhere.
//
// Two actions.
//
//   exchange  the code from her provider's callback, plus the verifier
//             the device held. Tokens are stored and never returned.
//   sync      fetch her chart with the stored token, refreshing first
//             when it is about to expire.
//
// What this never does: return a token to the device, accept a token from
// the device, or write to her provider. Every scope asked for is read
// only and the function has no code path that posts to a FHIR server.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  allowedClients,
  connectionKey,
  dueBefore,
  exchangeBody,
  failureLine,
  isFailure,
  keepGoing,
  needsRefresh,
  readTokens,
  refreshBody,
  sameSecret,
  SYNC_BATCH,
  MAX_PAGES,
  nextPage,
  pageOutcome,
  planFor,
  planQuery,
} from './exchange.ts';
import { labFromResource, mapBundle } from './fhirMap.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// The public client ids registered with the vendor: production, and non
// production for the sandbox. Public by design: PKCE is what proves the
// exchange, not a secret.
const CLIENT_IDS = allowedClients(Deno.env.get('SMART_CLIENT_IDS'), Deno.env.get('SMART_CLIENT_ID'));
const REDIRECT_URI = Deno.env.get('SMART_REDIRECT_URI') ?? 'ciatta://provider-callback';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Only what the device is allowed to know. Never a token, never a raw
// provider error.
const publicConnection = (row: Record<string, unknown>) => ({
  id: row.id,
  endpointName: row.endpoint_name,
  organization: row.organization,
  status: row.status,
  recordCount: row.record_count,
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

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

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);
  const uid = who.user.id;

  if (!CLIENT_IDS.length) {
    // Said plainly rather than failing as a provider error. A missing
    // registration is our problem, not her hospital's.
    return json({ error: 'Ciatta is not registered with a provider network yet.' }, 503);
  }

  let body: { action?: string; clientId?: string; connectionId?: string; code?: string; verifier?: string; endpoint?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const admin = createClient(url, serviceKey);

  try {
    if (body.action === 'exchange') return await exchange(admin, uid, body);
    if (body.action === 'sync') return await sync(admin, uid, body.connectionId ?? '');
    return json({ error: 'Invalid request' }, 400);
  } catch (e) {
    // The message is never forwarded: a provider's error text can carry
    // her name, her medical record number, or a fragment of a token.
    console.error('provider-connect failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'That did not finish. Nothing was shared.' }, 500);
  }
});

async function exchange(admin: any, uid: string, body: Record<string, any>): Promise<Response> {
  const { code, verifier, endpoint } = body;
  if (!code || !verifier || !endpoint?.fhirBaseUrl || !endpoint?.tokenEndpoint) {
    return json({ error: 'Invalid request' }, 400);
  }

  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  if (!CLIENT_IDS.includes(clientId)) {
    // An older build carrying an id that has since changed. Said as ours
    // to fix, before her provider is called at all.
    return json({ error: 'This version of Ciatta cannot connect to providers. Updating the app should fix it.' }, 400);
  }

  const res = await fetch(endpoint.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: exchangeBody(code, REDIRECT_URI, clientId, verifier),
  });

  const tokens = readTokens(await res.json().catch(() => null), new Date());
  if (isFailure(tokens)) {
    return json({ error: failureLine(tokens) }, 400);
  }

  const row = {
    user_id: uid,
    // Her provider's server, not the directory row she tapped: rows are
    // numbered, and the same hospital can come back under another number.
    endpoint_id: connectionKey(String(endpoint.fhirBaseUrl)),
    endpoint_name: String(endpoint.name ?? 'Your provider'),
    organization: endpoint.organization ?? null,
    fhir_base_url: String(endpoint.fhirBaseUrl),
    vendor: ['epic', 'cerner', 'athena'].includes(endpoint.vendor) ? endpoint.vendor : 'other',
    portal_name: endpoint.portalName ?? null,
    status: 'connected',
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_expires_at: tokens.expiresAt,
    fhir_patient_id: tokens.patientId,
    token_endpoint: String(endpoint.tokenEndpoint),
    client_id: clientId,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('provider_connections')
    .upsert(row, { onConflict: 'user_id,endpoint_id' })
    .select('id')
    .single();
  if (error) throw error;

  // Pull straight away, so "your records will download automatically" is
  // true rather than a promise she has to trigger herself.
  return await sync(admin, uid, data.id as string);
}

async function sync(admin: any, uid: string, connectionId: string): Promise<Response> {
  if (!connectionId) return json({ error: 'Invalid request' }, 400);

  const { data: conn, error } = await admin
    .from('provider_connections')
    .select('*')
    .eq('id', connectionId)
    // Scoped to her even with the service key. The key bypasses RLS, so
    // this clause is the only thing standing between a wrong id and
    // somebody else's chart.
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!conn) return json({ error: 'That connection was not found.' }, 404);

  await admin
    .from('provider_connections')
    .update({ sync_attempted_at: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('user_id', uid);

  let accessToken: string = conn.access_token ?? '';
  let refreshToken: string | null = conn.refresh_token ?? null;

  // A new access token from the refresh token. A Response when it cannot
  // be had: expired when the provider refuses, or unreachable for now.
  const refresh = async (): Promise<Response | null> => {
    if (!refreshToken) return await markExpired(admin, uid, connectionId);
    const tokenEndpoint: string | null = conn.token_endpoint ?? (await discoverTokenEndpoint(conn.fhir_base_url));
    if (!tokenEndpoint) {
      // Could not ask the provider where to refresh. Not marked expired:
      // the refresh token is still good, and the next sync tries again.
      return json({ error: 'Ciatta could not reach that provider right now. Nothing was shared.' }, 502);
    }
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: refreshBody(refreshToken, conn.client_id ?? CLIENT_IDS[0]),
    });
    const fresh = readTokens(await res.json().catch(() => null), new Date());
    if (isFailure(fresh)) return await markExpired(admin, uid, connectionId);
    accessToken = fresh.accessToken;
    refreshToken = fresh.refreshToken ?? refreshToken;
    await admin
      .from('provider_connections')
      .update({
        access_token: fresh.accessToken,
        refresh_token: refreshToken,
        token_expires_at: fresh.expiresAt,
        token_endpoint: tokenEndpoint,
      })
      .eq('id', connectionId)
      .eq('user_id', uid);
    return null;
  };

  if (needsRefresh(conn.token_expires_at, new Date())) {
    const stopped = await refresh();
    if (stopped) return stopped;
  }
  // A long sync can outlast the token it started with. The first refusal
  // in a run gets one refresh and the same page again; only a refusal of a
  // fresh token means the connection itself has gone.
  let refreshedOnRefusal = false;

  const patientId: string = conn.fhir_patient_id ?? '';
  if (!patientId) {
    return json({ error: 'Your provider did not say which record is yours, so nothing was read.' }, 400);
  }

  let written = 0;
  let skipped = 0;

  for (const entry of planFor(conn.vendor)) {
    let page: string | null = planQuery(conn.fhir_base_url, entry, patientId);
    for (let n = 0; page && n < MAX_PAGES; n++) {
      const res = await fetch(page, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' },
      });
      const outcome = pageOutcome(res.status);
      if (outcome === 'expired') {
        if (refreshedOnRefusal) return await markExpired(admin, uid, connectionId);
        refreshedOnRefusal = true;
        const stopped = await refresh();
        if (stopped) return stopped;
        n--;
        continue;
      }
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
              connection_id: connectionId,
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

  const { data: updated, error: updateError } = await admin
    .from('provider_connections')
    .update({
      // active only once something actually arrived. A connection that
      // authorised and returned nothing is connected, not active, and the
      // difference is what stops the screen claiming a chart it does not
      // have.
      status: (held ?? 0) > 0 ? 'active' : 'connected',
      record_count: held ?? 0,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .eq('user_id', uid)
    .select('*')
    .single();
  if (updateError) throw updateError;

  return json({ connection: publicConnection(updated), written, skipped });
}

// Where the provider refreshes tokens, asked of the provider itself, for a
// connection made before the address was kept. Null when it cannot say.
async function discoverTokenEndpoint(fhirBaseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${fhirBaseUrl.replace(/\/+$/, '')}/.well-known/smart-configuration`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const config = await res.json();
    return typeof config?.token_endpoint === 'string' ? config.token_endpoint : null;
  } catch {
    return null;
  }
}

// The connections that have waited longest, read one at a time. One that
// fails is noted and the run goes on to the next.
async function syncDue(admin: any): Promise<Response> {
  const started = Date.now();
  let considered = 0;
  let synced = 0;
  // Batches until the time budget is spent or nobody is due, so a backlog
  // drains instead of stretching everyone's interval. Each sync stamps
  // sync_attempted_at first, so no connection is taken twice in a run.
  while (keepGoing(started, Date.now())) {
    const { data: due, error } = await admin
      .from('provider_connections')
      .select('id, user_id')
      .in('status', ['active', 'connected'])
      .or(`sync_attempted_at.is.null,sync_attempted_at.lt.${dueBefore(new Date())}`)
      .order('sync_attempted_at', { ascending: true, nullsFirst: true })
      .limit(SYNC_BATCH);
    if (error) throw error;
    const batch = (due ?? []) as { id: string; user_id: string }[];
    if (!batch.length) break;
    considered += batch.length;

    for (const c of batch) {
      try {
        const res = await sync(admin, c.user_id, c.id);
        if (res.ok) synced++;
      } catch (e) {
        console.error('provider sync failed', e instanceof Error ? e.name : 'unknown');
        await admin
          .from('provider_connections')
          .update({
            sync_attempted_at: new Date().toISOString(),
            last_error: 'The last update did not finish. Ciatta will try again.',
          })
          .eq('id', c.id)
          .eq('user_id', c.user_id);
      }
    }
  }
  // Counts only, never who: a backlog shows up in the logs as a number.
  console.log('provider sync_due', JSON.stringify({ considered, synced }));
  return json({ considered, synced });
}

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
