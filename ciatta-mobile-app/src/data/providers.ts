// Running a provider connection, end to end.
//
// The pure parts decide what the request looks like and what a response
// means; this is the part that touches the network, the browser and the
// keychain. Kept apart from them so the rules stay testable under node.
//
// The one thing worth reading twice: she logs in at her provider's own
// page, in the system browser, and Ciatta never sees that page. Not a
// WebView. A WebView is a window this app controls, which means a window
// this app could read her password out of, and a provider would be right
// to refuse it. openAuthSessionAsync hands the login to Safari and gets
// back only the redirect.

import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { parseCompact } from '../lib/providers/brandsDirectory';
import type { Endpoint } from '../lib/providers/directory';
import type { ClinicalRecord } from '../lib/providers/fhirMap';
import { catalogSearchUrl, type FastenHit, parseCatalogSearch } from '../lib/providers/fastenCatalog';
import { canUpdate, providerName, type SyncFailure } from '../lib/providers/connectionView';
import { parseEndpointBundle, withTestEndpoints } from '../lib/providers/epicDirectory';
import {
  authorizeUrl,
  failureLine,
  notActivatedLine,
  readCallback,
  refusedAtLogin,
  type SmartConfig,
  smartConfigUrl,
} from '../lib/providers/smart';

// Where the app's browser session waits for the login to come back.
export const APP_CALLBACK = 'ciatta://provider-callback';

// The redirect registered with Epic and sent in the request. The same as
// APP_CALLBACK unless the build names the https forwarding page
// (supabase/functions/provider-callback), which Epic accepts where it
// rewrites a ciatta:// address. Must equal the backend's SMART_REDIRECT_URI,
// since the token exchange repeats it.
export const REDIRECT_URI = process.env.EXPO_PUBLIC_SMART_REDIRECT_URI?.trim() || APP_CALLBACK;

// Epic's public directory of everyone running its FHIR server. Fetched
// rather than bundled, because it changes and a stale hospital URL is a
// connection that fails.
const EPIC_DIRECTORY = 'https://open.epic.com/Endpoints/R4';

// Development and preview builds. Production builds carry neither the
// test servers nor the client id field.
export const showsTestProviders = __DEV__ || process.env.EXPO_PUBLIC_TEST_PROVIDERS === '1';

export type ConnectOutcome =
  | { ok: true; connectionId: string; written: number }
  | { ok: false; message: string };

// PKCE, generated here because expo-crypto cannot load under node and the
// rules that use these values are tested without it.
async function randomness() {
  const bytes = Crypto.getRandomBytes(64);
  const verifier = base64url(bytes);
  const state = base64url(Crypto.getRandomBytes(16));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, state, challenge: digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
}

function base64url(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

// The directory she searches: every hospital and clinic on Epic with its
// town and state, carried with the app (see lib/providers/brandsDirectory),
// with the sandbox at the front so the flow is reachable before any
// production registration exists. Parsed once and kept, because ninety
// thousand rows is worth reading only once a session.
let carried: Promise<Endpoint[]> | null = null;

async function readCarried(): Promise<Endpoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/providers/epic-brands.dir'));
  await asset.downloadAsync();
  if (!asset.localUri) return [];
  return parseCompact(await new File(asset.localUri).text());
}

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

// What the provider says about its own OAuth endpoints. Asked rather than
// assumed: the paths differ per vendor and per install.
async function smartConfig(endpoint: Endpoint): Promise<SmartConfig | null> {
  try {
    const res = await fetch(smartConfigUrl(endpoint), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const authorization = typeof j.authorization_endpoint === 'string' ? j.authorization_endpoint : '';
    const token = typeof j.token_endpoint === 'string' ? j.token_endpoint : '';
    if (!authorization || !token) return null;
    return {
      authorizationEndpoint: authorization,
      tokenEndpoint: token,
      scopesSupported: Array.isArray(j.scopes_supported) ? (j.scopes_supported as string[]) : [],
    };
  } catch {
    return null;
  }
}

// Whether the provider's authorize page is the refusal page. Any doubt (no
// network, an odd answer) is a no, so a real login is never held back.
async function refusesClient(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    return refusedAtLogin(await res.text());
  } catch {
    return false;
  }
}

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

export async function connectProvider(endpoint: Endpoint, clientId: string): Promise<ConnectOutcome> {
  const config = await smartConfig(endpoint);
  if (!config) {
    return { ok: false, message: 'Ciatta could not reach that provider right now. Nothing was shared.' };
  }

  const random = await randomness();
  const request = authorizeUrl(endpoint, config, REDIRECT_URI, clientId, random);

  // Asked first, without her: a login that Epic has not activated for
  // Ciatta is a dead error page, and it is better said here than shown.
  if (await refusesClient(request.url)) {
    return { ok: false, message: notActivatedLine(endpoint.organization ?? endpoint.name) };
  }

  // Her provider's page, in the system browser. Ciatta cannot read it.
  const result = await WebBrowser.openAuthSessionAsync(request.url, APP_CALLBACK);
  if (result.type !== 'success') {
    return { ok: false, message: 'The connection was not finished, so nothing was shared.' };
  }

  const callback = readCallback(result.url, request.state);
  if (!callback.ok) return { ok: false, message: failureLine(callback.reason) };

  // The code and the verifier go to the function, which holds the tokens.
  // Neither ever comes back down.
  const { data, error } = await supabase.functions.invoke('provider-connect', {
    body: {
      action: 'exchange',
      clientId,
      code: callback.code,
      verifier: request.verifier,
      endpoint: { ...endpoint, tokenEndpoint: config.tokenEndpoint },
    },
  });

  if (error || !data?.connection?.id) {
    return { ok: false, message: await functionError(error, data, 'That did not finish. Nothing was shared.') };
  }
  return { ok: true, connectionId: data.connection.id as string, written: Number(data.written ?? 0) };
}

export type Connection = {
  id: string;
  endpointName: string;
  organization: string | null;
  status: string;
  recordCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  source: 'smart' | 'fasten';
};

// Everything her connected hospitals have sent. Read as her, so RLS is
// what scopes it: there is no user filter here to get wrong.
export async function loadClinicalRecords(): Promise<ClinicalRecord[]> {
  const { data, error } = await supabase
    .from('clinical_records')
    .select('source_id, kind, name, value, flag, effective_on, status')
    .order('effective_on', { ascending: false })
    .limit(2000);
  if (error || !data) return [];
  return data.map((r) => ({
    sourceId: r.source_id as string,
    kind: r.kind as ClinicalRecord['kind'],
    name: r.name as string,
    value: (r.value as string | null) ?? null,
    flag: (r.flag as ClinicalRecord['flag']) ?? null,
    effectiveOn: (r.effective_on as string | null) ?? null,
    status: (r.status as string | null) ?? null,
  }));
}

export async function loadConnections(): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('provider_connections')
    // The token columns are not in the grant, so they cannot be asked
    // for here even by mistake.
    .select('id, endpoint_name, organization, status, record_count, last_synced_at, last_error, source')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    endpointName: r.endpoint_name as string,
    organization: (r.organization as string | null) ?? null,
    status: r.status as string,
    recordCount: (r.record_count as number) ?? 0,
    lastSyncedAt: (r.last_synced_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    source: r.source === 'fasten' ? 'fasten' : 'smart',
  }));
}

// A Fasten session for her: the one time id the webhook will bind her
// connections by, and the public id the search opens with. Nothing about
// which provider she picks ever comes back through here.
export type FastenStart = { ok: true; externalId: string; publicId: string } | { ok: false; message: string };

export async function startFasten(): Promise<FastenStart> {
  const { data, error } = await supabase.functions.invoke('fasten-connect', { body: { action: 'start' } });
  if (error || typeof data?.externalId !== 'string' || typeof data?.publicId !== 'string') {
    return { ok: false, message: await functionError(error, data, 'That did not start. Nothing was shared.') };
  }
  return { ok: true, externalId: data.externalId, publicId: data.publicId };
}

// Fasten's public id, which is meant to be in the app. Empty in a build
// made without it, and then the search simply has no Fasten results.
export const FASTEN_PUBLIC_ID = process.env.EXPO_PUBLIC_FASTEN_PUBLIC_ID?.trim() ?? '';

// Fasten's catalog, for the same words she typed into the MyChart search.
// Null when it could not be reached, which the screen says, rather than an
// empty list that would read as no match.
export async function searchFasten(query: string, signal?: AbortSignal): Promise<FastenHit[] | null> {
  if (!FASTEN_PUBLIC_ID || query.trim().length < 2) return [];
  try {
    const res = await fetch(catalogSearchUrl(FASTEN_PUBLIC_ID), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: query.trim() }),
      signal,
    });
    if (!res.ok) return null;
    return parseCatalogSearch(await res.json());
  } catch {
    return null;
  }
}

// Removes a provider: the connection, its records and its labs, on the
// server, as her. False when it was not hers or did not go through, so the
// screen can say nothing changed.
export async function disconnectProvider(connectionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('disconnect_provider', { p_connection: connectionId });
  return !error && data === true;
}

// Asks each working provider for anything new, through the function that
// holds the tokens. One at a time, and a failure does not stop the rest.
export async function syncProviders(connections: readonly Connection[]): Promise<SyncFailure[]> {
  const failures: SyncFailure[] = [];
  for (const c of connections.filter(canUpdate)) {
    const { data, error } = await supabase.functions.invoke('provider-connect', {
      body: { action: 'sync', connectionId: c.id },
    });
    if (error || !data?.connection) {
      failures.push({ name: providerName(c), message: await functionError(error, data, 'That did not finish.') });
    }
  }
  return failures;
}
