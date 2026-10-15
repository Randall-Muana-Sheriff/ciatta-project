// Fasten Connect's webhook: connections made, records ready, exports failed,
// access revoked.
//
// No JWT: Fasten is the caller. What stands in for it is the signature,
// checked over the raw body before a single field is read. An unsigned,
// tampered or stale call gets 401 and nothing else.
//
// Which person a connection belongs to comes only from here: the external
// id Fasten echoes was issued to one signed in person by fasten-connect,
// and that is who the connection is bound to. The app never says.
//
// Logs carry the event type and counts. Never a resource, a name, or an id
// that could be joined back to her.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  basicAuth,
  connectionEndpointKey,
  exportFailureLine,
  externalIdLooksValid,
  FASTEN_API,
  jsonlLinks,
  providerLabel,
  readNdjson,
  rowsFrom,
  verifyWebhook,
} from './fasten.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PUBLIC_ID = Deno.env.get('FASTEN_PUBLIC_ID') ?? '';
const PRIVATE_KEY = Deno.env.get('FASTEN_PRIVATE_KEY') ?? '';
const SECRET = Deno.env.get('FASTEN_WEBHOOK_SECRET') ?? '';
// Overridable only so the end to end test can stand in for Fasten. The
// download link check still requires Fasten's own host.
const API = Deno.env.get('FASTEN_API_BASE') ?? FASTEN_API;
const LINK_HOST_OVERRIDE = Deno.env.get('FASTEN_LINK_HOST') ?? '';

const BATCH = 500;
const EVENTS_KEPT_DAYS = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const auth = () => ({ Authorization: basicAuth(PUBLIC_ID, PRIVATE_KEY) });

// A failure Fasten should deliver again. The event id is released first,
// so the retry is not taken for a duplicate.
class Retry extends Error {}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Not allowed' }, 405);
  const body = await req.text();
  if (!(await verifyWebhook(body, req.headers, SECRET, new Date()))) return json({ error: 'Not signed' }, 401);

  let event: Record<string, any>;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ ok: true, ignored: 'unreadable' });
  }
  const type = typeof event?.type === 'string' ? event.type : '';
  const data: Record<string, any> = event?.data && typeof event.data === 'object' ? event.data : event;
  const webhookId = req.headers.get('webhook-id') ?? '';

  const admin = createClient(url, serviceKey);

  // Once per delivery id. A repeat is acknowledged and skipped.
  const { data: fresh, error: seenError } = await admin
    .from('fasten_webhook_events')
    .upsert({ webhook_id: webhookId }, { onConflict: 'webhook_id', ignoreDuplicates: true })
    .select('webhook_id');
  if (seenError) {
    console.error('fasten-webhook dedupe failed', seenError.code ?? 'unknown');
    return json({ error: 'Try again' }, 500);
  }
  if (!fresh?.length) return json({ ok: true, duplicate: true });

  await admin
    .from('fasten_webhook_events')
    .delete()
    .lt('received_at', new Date(Date.now() - EVENTS_KEPT_DAYS * 86_400_000).toISOString());

  try {
    console.log('fasten-webhook', type || 'untyped');
    if (type === 'patient.connection_success') return await connected(admin, data);
    if (type === 'patient.ehi_export_success') return await exportReady(admin, data);
    if (type === 'patient.ehi_export_failed') return await exportFailed(admin, data);
    if (type === 'patient.authorization_revoked') return await revoked(admin, data);
    return json({ ok: true, ignored: type || 'untyped' });
  } catch (e) {
    await admin.from('fasten_webhook_events').delete().eq('webhook_id', webhookId);
    console.error('fasten-webhook failed', type, e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Try again' }, e instanceof Retry ? 502 : 500);
  }
});

async function connected(admin: any, data: Record<string, any>): Promise<Response> {
  const orgConnectionId = typeof data.org_connection_id === 'string' ? data.org_connection_id : '';
  if (!orgConnectionId || !externalIdLooksValid(data.external_id)) return json({ ok: true, ignored: 'unbound' });

  const { data: request, error: requestError } = await admin
    .from('fasten_connect_requests')
    .select('user_id')
    .eq('external_id', data.external_id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) return json({ ok: true, ignored: 'unbound' });
  const uid: string = request.user_id;

  // A Fasten connection id belongs to the first person it was bound to.
  const { data: existing, error: existingError } = await admin
    .from('provider_connections')
    .select('id, user_id')
    .eq('fasten_org_connection_id', orgConnectionId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.user_id !== uid) return json({ ok: true, ignored: 'bound elsewhere' });

  const name = await catalogName(data);
  const { data: row, error: upsertError } = await admin
    .from('provider_connections')
    .upsert(
      {
        user_id: uid,
        endpoint_id: connectionEndpointKey({ endpoint_id: data.endpoint_id, org_connection_id: orgConnectionId }),
        endpoint_name: name,
        organization: name,
        portal_name: typeof data.platform_type === 'string' ? data.platform_type : null,
        vendor: 'fasten',
        source: 'fasten',
        fasten_org_connection_id: orgConnectionId,
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint_id' },
    )
    .select('id')
    .single();
  if (upsertError) throw upsertError;

  // The export is asked for here, with Ciatta's key. It is idempotent per
  // connection, so a repeat returns the one already running.
  const res = await fetch(`${API}/bridge/fhir/ehi-export`, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ org_connection_id: orgConnectionId }),
  });
  if (!res.ok) throw new Retry(`export request ${res.status}`);
  const task = await res.json().catch(() => null);
  const taskId = task?.data?.task_id ?? task?.data?.id ?? task?.task_id ?? null;
  await admin
    .from('provider_connections')
    .update({ fasten_export_task_id: typeof taskId === 'string' ? taskId : null })
    .eq('id', row.id)
    .eq('user_id', uid);
  return json({ ok: true });
}

// The institution's name from Fasten's catalog. Any failure is the plain
// fallback: a connection is worth more than its label.
async function catalogName(data: Record<string, any>): Promise<string> {
  const params = new URLSearchParams({ public_id: PUBLIC_ID, api_mode: PUBLIC_ID.startsWith('public_live_') ? 'live' : 'test' });
  if (typeof data.brand_id === 'string' && data.brand_id) params.set('brand_id', data.brand_id);
  else if (typeof data.portal_id === 'string' && data.portal_id) params.set('portal_id', data.portal_id);
  else return 'Your provider';
  try {
    const res = await fetch(`${API}/bridge/catalog?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return 'Your provider';
    return providerLabel(await res.json());
  } catch {
    return 'Your provider';
  }
}

async function connectionFor(admin: any, data: Record<string, any>) {
  const orgConnectionId = typeof data.org_connection_id === 'string' ? data.org_connection_id : '';
  if (!orgConnectionId) return null;
  const { data: conn, error } = await admin
    .from('provider_connections')
    .select('id, user_id, organization, endpoint_name')
    .eq('fasten_org_connection_id', orgConnectionId)
    .eq('source', 'fasten')
    .maybeSingle();
  if (error) throw error;
  return conn as { id: string; user_id: string; organization: string | null; endpoint_name: string } | null;
}

async function exportReady(admin: any, data: Record<string, any>): Promise<Response> {
  const conn = await connectionFor(admin, data);
  // Removed since, or never bound. Nothing to file it under.
  if (!conn) return json({ ok: true, ignored: 'no connection' });
  const links = jsonlLinks(data, LINK_HOST_OVERRIDE);
  if (!links.length) {
    await setError(admin, conn, exportFailureLine(undefined));
    return json({ ok: true, ignored: 'no links' });
  }

  // Acknowledged now and read after: an export can be large, and Fasten
  // should not wait on it. A failure from here on is said on the
  // connection, and connecting again asks for the export once more.
  const work = importExport(admin, conn, links).catch(async (e) => {
    console.error('fasten-webhook import failed', e instanceof Error ? e.name : 'unknown');
    await setError(admin, conn, 'Ciatta could not finish reading your records. Connect again to try once more.');
  });
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work);
  else await work;
  return json({ ok: true, accepted: true });
}

async function download(link: string): Promise<string> {
  // The link answers with a short lived signed address. It is fetched
  // without Ciatta's key, which is meant for Fasten alone.
  const first = await fetch(link, { headers: auth(), redirect: 'manual' });
  const location = first.headers.get('Location');
  if (location) {
    await first.body?.cancel();
    const signed = new URL(location, link);
    if (signed.protocol !== 'https:' && !LINK_HOST_OVERRIDE) throw new Error('insecure location');
    const res = await fetch(signed.toString());
    if (!res.ok) throw new Error(`download ${res.status}`);
    return await res.text();
  }
  if (!first.ok) throw new Error(`download ${first.status}`);
  return await first.text();
}

async function importExport(
  admin: any,
  conn: { id: string; user_id: string; organization: string | null; endpoint_name: string },
  links: string[],
) {
  let malformed = 0;
  let skipped = 0;
  for (const link of links) {
    const text = await download(link);
    const read = readNdjson(text);
    malformed += read.malformed;
    const { records, labs, skipped: missed } = rowsFrom(read.resources, conn.user_id, conn.id, conn.organization ?? conn.endpoint_name);
    skipped += missed;

    // Records first: they reference the connection, so a removal made
    // while this ran stops the import here, before a lab is written with
    // nothing left to remove it by.
    for (let i = 0; i < records.length; i += BATCH) {
      const { error } = await admin
        .from('clinical_records')
        .upsert(records.slice(i, i + BATCH), { onConflict: 'user_id,connection_id,source_id' });
      if (error) throw error;
    }
    for (let i = 0; i < labs.length; i += BATCH) {
      const { error } = await admin.from('results').upsert(labs.slice(i, i + BATCH), { onConflict: 'user_id,source_ref' });
      if (error) throw error;
    }
  }

  const { count: held, error: countError } = await admin
    .from('clinical_records')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('user_id', conn.user_id);
  if (countError) throw countError;

  const { error: updateError } = await admin
    .from('provider_connections')
    .update({
      status: (held ?? 0) > 0 ? 'active' : 'connected',
      record_count: held ?? 0,
      last_synced_at: new Date().toISOString(),
      last_error: (held ?? 0) > 0 ? null : 'Your provider did not share any records.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id)
    .eq('user_id', conn.user_id);
  if (updateError) throw updateError;
  console.log('fasten-webhook imported', JSON.stringify({ held: held ?? 0, skipped, malformed }));
}

async function exportFailed(admin: any, data: Record<string, any>): Promise<Response> {
  const conn = await connectionFor(admin, data);
  if (!conn) return json({ ok: true, ignored: 'no connection' });
  await setError(admin, conn, exportFailureLine(typeof data.failure_reason === 'string' ? data.failure_reason : undefined));
  return json({ ok: true });
}

async function revoked(admin: any, data: Record<string, any>): Promise<Response> {
  const conn = await connectionFor(admin, data);
  if (!conn) return json({ ok: true, ignored: 'no connection' });
  // What already arrived stays until she removes the provider herself.
  await admin
    .from('provider_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', conn.id)
    .eq('user_id', conn.user_id);
  return json({ ok: true });
}

async function setError(admin: any, conn: { id: string; user_id: string }, line: string) {
  await admin
    .from('provider_connections')
    .update({ status: 'error', last_error: line, updated_at: new Date().toISOString() })
    .eq('id', conn.id)
    .eq('user_id', conn.user_id);
}
