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
  exchangeBody,
  failureLine,
  FETCH_ORDER,
  isFailure,
  needsRefresh,
  readTokens,
  refreshBody,
  resourceQuery,
} from './exchange.ts';
import { labFromResource, mapBundle } from './fhirMap.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// The public client id, registered with the vendor. Public by design:
// PKCE is what proves the exchange, not a secret.
const CLIENT_ID = Deno.env.get('SMART_CLIENT_ID') ?? '';
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

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);
  const uid = who.user.id;

  if (!CLIENT_ID) {
    // Said plainly rather than failing as a provider error. A missing
    // registration is our problem, not her hospital's.
    return json({ error: 'Ciatta is not registered with a provider network yet.' }, 503);
  }

  let body: { action?: string; connectionId?: string; code?: string; verifier?: string; endpoint?: Record<string, unknown> };
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

  const res = await fetch(endpoint.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: exchangeBody(code, REDIRECT_URI, CLIENT_ID, verifier),
  });

  const tokens = readTokens(await res.json().catch(() => null), new Date());
  if (isFailure(tokens)) {
    return json({ error: failureLine(tokens) }, 400);
  }

  const row = {
    user_id: uid,
    endpoint_id: String(endpoint.id ?? endpoint.fhirBaseUrl),
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

  let accessToken: string = conn.access_token ?? '';

  if (needsRefresh(conn.token_expires_at, new Date())) {
    if (!conn.refresh_token) {
      await admin.from('provider_connections').update({ status: 'expired' }).eq('id', connectionId).eq('user_id', uid);
      return json({ error: 'That connection has expired. You can connect again whenever you want.' }, 400);
    }
    const res = await fetch(conn.token_endpoint ?? `${conn.fhir_base_url}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: refreshBody(conn.refresh_token, CLIENT_ID),
    });
    const fresh = readTokens(await res.json().catch(() => null), new Date());
    if (isFailure(fresh)) {
      await admin
        .from('provider_connections')
        .update({ status: 'expired', last_error: 'The connection needs to be made again.' })
        .eq('id', connectionId)
        .eq('user_id', uid);
      return json({ error: 'That connection has expired. You can connect again whenever you want.' }, 400);
    }
    accessToken = fresh.accessToken;
    await admin
      .from('provider_connections')
      .update({
        access_token: fresh.accessToken,
        refresh_token: fresh.refreshToken ?? conn.refresh_token,
        token_expires_at: fresh.expiresAt,
      })
      .eq('id', connectionId)
      .eq('user_id', uid);
  }

  const patientId: string = conn.fhir_patient_id ?? '';
  if (!patientId) {
    return json({ error: 'Your provider did not say which record is yours, so nothing was read.' }, 400);
  }

  let written = 0;
  let skipped = 0;

  for (const type of FETCH_ORDER) {
    const res = await fetch(resourceQuery(conn.fhir_base_url, type, patientId), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' },
    });
    // A provider that does not hold a resource type answers 404 or 403.
    // That is not a failed sync; it is a hospital that does not publish
    // immunisations, and the rest of the chart still arrives.
    if (!res.ok) continue;

    const bundle = await res.json().catch(() => null);
    const { records, skipped: missed } = mapBundle(bundle);
    skipped += missed;

    // Labs also go into her lab results, with the number, unit and printed
    // range kept apart, so Labs can draw where each value sits. Keyed by
    // connection and resource, so a re sync updates rather than repeats.
    if (type === 'Observation') {
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
    if (!records.length) continue;

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

  const { data: updated, error: updateError } = await admin
    .from('provider_connections')
    .update({
      // active only once something actually arrived. A connection that
      // authorised and returned nothing is connected, not active, and the
      // difference is what stops the screen claiming a chart it does not
      // have.
      status: written > 0 ? 'active' : 'connected',
      record_count: written,
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
