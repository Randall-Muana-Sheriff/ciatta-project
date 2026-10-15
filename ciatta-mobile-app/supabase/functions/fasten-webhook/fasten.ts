// Fasten Connect, the parts that decide things.
//
// Pure, with no Deno imports, so npm test runs every rule here under node.
// The network and the database live in index.ts.
//
// Fasten signs its webhooks to the Standard Webhooks specification: an
// HMAC SHA256 of "id.timestamp.body" with the endpoint's secret, sent as
// one or more space separated "v1,<base64>" values. Checked here with Web
// Crypto, which both node and Deno have, rather than a library, so the
// check itself is under test.

import { labFromResource, mapResource } from '../provider-connect/fhirMap.ts';

export const FASTEN_API = 'https://api.connect.fastenhealth.com/v1';

// How far a webhook's timestamp may be from now before it is refused as a
// replay. The specification's own recommendation.
export const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Compared in full whatever the first difference, so the time taken says
// nothing about how much of a forged signature was right.
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhook(body: string, headers: Headers, secret: string, now: Date): Promise<boolean> {
  const id = headers.get('webhook-id') ?? '';
  const timestamp = headers.get('webhook-timestamp') ?? '';
  const signatures = headers.get('webhook-signature') ?? '';
  if (!id || !timestamp || !signatures || !secret) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  let key: Uint8Array;
  try {
    key = base64ToBytes(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret);
  } catch {
    return false;
  }
  if (!key.length) return false;

  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = bytesToBase64(new Uint8Array(mac));

  return signatures
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('v1,'))
    .some((s) => sameText(s.slice(3), expected));
}

// One FHIR resource per line. A line that is not a JSON object is
// counted, never guessed at.
export function readNdjson(text: string): { resources: unknown[]; malformed: number } {
  const resources: unknown[] = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const value = JSON.parse(trimmed);
      if (value && typeof value === 'object' && !Array.isArray(value)) resources.push(value);
      else malformed++;
    } catch {
      malformed++;
    }
  }
  return { resources, malformed };
}

// Where the records are. Only https links on Fasten's own API: the link
// is fetched with Ciatta's private key attached, so a link anywhere else
// would hand that key to whoever named it.
//
// testHost is the end to end test's stand in for Fasten, set only in its
// env file. Empty in every deployed function.
export function jsonlLinks(event: Record<string, any>, testHost = ''): string[] {
  const links: unknown[] = Array.isArray(event?.download_links)
    ? event.download_links
    : event?.download_link
      ? [event.download_link]
      : [];
  return links
    .filter((l: any) => l && typeof l.url === 'string' && (l.export_type ?? 'jsonl') === 'jsonl')
    .map((l: any) => l.url as string)
    .filter((u) => {
      try {
        const parsed = new URL(u);
        if (testHost && parsed.host === testHost) return true;
        return parsed.protocol === 'https:' && parsed.host === 'api.connect.fastenhealth.com';
      } catch {
        return false;
      }
    });
}

export function exportFailureLine(reason: string | undefined): string {
  if (reason === 'tefca_no_documents_found') return 'Your provider did not share any records.';
  return 'Ciatta could not get your records from this provider. Try connecting again later.';
}

// The catalog's name for the institution, under data or at the top level.
export function providerLabel(catalog: unknown): string {
  const c = catalog as Record<string, any> | null;
  const name = c?.data?.name ?? c?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Your provider';
}

// provider_connections is unique per person and endpoint_id, where a SMART
// connection's endpoint_id is its server address. Prefixed so a Fasten
// connection can never land on one.
export function connectionEndpointKey(data: { endpoint_id?: string; org_connection_id: string }): string {
  return `fasten:${data.endpoint_id || data.org_connection_id}`;
}

export function basicAuth(publicId: string, privateKey: string): string {
  return `Basic ${btoa(`${publicId}:${privateKey}`)}`;
}

// The start action issues 32 random bytes as base64url, 43 characters.
export function externalIdLooksValid(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

// Rows for clinical_records and results, the same shape the SMART sync
// writes, so Records and Labs cannot tell the two apart. An export can
// carry one resource twice (a record seen through two sources, or amended
// since); one upsert statement may not touch a row twice, so each key
// keeps only its last version.
export function rowsFrom(resources: readonly unknown[], uid: string, connectionId: string, provider: string) {
  const records = new Map<string, Record<string, unknown>>();
  const labs = new Map<string, Record<string, unknown>>();
  let skipped = 0;
  for (const resource of resources) {
    const r = mapResource(resource);
    if (!r) {
      skipped++;
      continue;
    }
    records.set(r.sourceId, {
      user_id: uid,
      connection_id: connectionId,
      source_id: r.sourceId,
      kind: r.kind,
      name: r.name,
      value: r.value,
      flag: r.flag,
      effective_on: r.effectiveOn,
      status: r.status,
    });
    const l = labFromResource(resource);
    if (l) {
      labs.set(l.sourceId, {
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
        provider,
        source: 'provider',
        source_ref: `${connectionId}:${l.sourceId}`,
        connection_id: connectionId,
        occurred_at: `${l.on}T12:00:00Z`,
      });
    }
  }
  return { records: [...records.values()], labs: [...labs.values()], skipped };
}
