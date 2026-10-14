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
import { parseEndpointBundle, SANDBOX, SMART_TEST } from '../lib/providers/epicDirectory';
import {
  authorizeUrl,
  failureLine,
  notActivatedLine,
  readCallback,
  refusedAtLogin,
  type SmartConfig,
  smartConfigUrl,
} from '../lib/providers/smart';

export const REDIRECT_URI = 'ciatta://provider-callback';

// Epic's public directory of everyone running its FHIR server. Fetched
// rather than bundled, because it changes and a stale hospital URL is a
// connection that fails.
const EPIC_DIRECTORY = 'https://open.epic.com/Endpoints/R4';

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
  if (rows.length) return [SANDBOX, SMART_TEST, ...rows];
  // The carried file could not be read: fall back to Epic's live list of
  // health systems, which has no locations but is still every system.
  carried = null;
  try {
    const res = await fetch(EPIC_DIRECTORY, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [SANDBOX, SMART_TEST];
    return [SANDBOX, SMART_TEST, ...parseEndpointBundle(await res.json(), 'epic', 'MyChart')];
  } catch {
    // Offline, or the vendor moved the file. The sandbox still works and
    // the screen says the rest of the directory could not be reached,
    // rather than showing an empty search that looks like no match.
    return [SANDBOX, SMART_TEST];
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
  const result = await WebBrowser.openAuthSessionAsync(request.url, REDIRECT_URI);
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
      code: callback.code,
      verifier: request.verifier,
      endpoint: { ...endpoint, tokenEndpoint: config.tokenEndpoint },
    },
  });

  if (error || !data?.connection?.id) {
    return { ok: false, message: (data as { error?: string } | null)?.error ?? 'That did not finish. Nothing was shared.' };
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
    .select('id, endpoint_name, organization, status, record_count, last_synced_at, last_error')
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
  }));
}
