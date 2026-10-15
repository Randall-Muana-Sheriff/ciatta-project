// The token exchange and the sync, as pure decisions.
//
// index.ts does the network and the database; everything that can be
// decided without either lives here, so src/lib can exercise it under
// node. Same arrangement as wording.ts and summary.ts.
//
// Why the exchange happens on a server at all, when the client is public
// and holds no secret: the refresh token. It is six to twelve months of
// access to her chart, and a phone is lost, backed up, and jailbroken. So
// the code and the verifier go up, the tokens stay up, and the device
// gets a connection id and a status.

export type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  patient?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  patientId: string | null;
  // What the provider actually granted, which is often less than was
  // asked for. Recorded so a later fetch that comes back empty can be
  // explained by the scope she was given rather than reported as an
  // empty chart.
  grantedScopes: string[];
};

export type ExchangeFailure = { reason: 'provider_error' | 'malformed' | 'no_access_token'; detail: string };

// A provider's response, believed only as far as it can be checked.
export function readTokens(body: unknown, now: Date): Tokens | ExchangeFailure {
  if (!body || typeof body !== 'object') return { reason: 'malformed', detail: 'the provider sent something unreadable' };
  const r = body as TokenResponse;

  if (typeof r.error === 'string' && r.error) {
    const detail = typeof r.error_description === 'string' && r.error_description ? r.error_description : r.error;
    return { reason: 'provider_error', detail };
  }

  const accessToken = typeof r.access_token === 'string' ? r.access_token.trim() : '';
  if (!accessToken) return { reason: 'no_access_token', detail: 'no access token came back' };

  // Default to an hour when the provider does not say, which is the SMART
  // default, and never trust a negative or absurd value.
  const seconds = typeof r.expires_in === 'number' && r.expires_in > 0 && r.expires_in < 60 * 60 * 24 * 400
    ? r.expires_in
    : 3600;

  return {
    accessToken,
    refreshToken: typeof r.refresh_token === 'string' && r.refresh_token.trim() ? r.refresh_token.trim() : null,
    expiresAt: new Date(now.getTime() + seconds * 1000).toISOString(),
    patientId: typeof r.patient === 'string' && r.patient.trim() ? r.patient.trim() : null,
    grantedScopes: typeof r.scope === 'string' ? r.scope.split(/\s+/).filter(Boolean) : [],
  };
}

export const isFailure = (x: Tokens | ExchangeFailure): x is ExchangeFailure => 'reason' in x;

// The form body for the exchange. The verifier goes here and only here,
// which is the whole of PKCE: it was never in the authorize request.
export function exchangeBody(code: string, redirectUri: string, clientId: string, verifier: string): string {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  }).toString();
}

// The client ids this function will exchange for: production and non
// production, from SMART_CLIENT_IDS, plus the older single SMART_CLIENT_ID
// so a deploy that has only that keeps working. Public by design. Listed so
// a request can only name one of ours.
export function allowedClients(list: string | undefined, single: string | undefined): string[] {
  const all = [...(list ?? '').split(','), single ?? ''].map((s) => s.trim()).filter(Boolean);
  return [...new Set(all)];
}

export function refreshBody(refreshToken: string, clientId: string): string {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  }).toString();
}

// Which resources to pull, and in what order. Conditions and medications
// first, because they are the ones the brief and the agent already have
// somewhere to put.
export const FETCH_ORDER = [
  'Condition',
  'MedicationRequest',
  'AllergyIntolerance',
  'Observation',
  'Immunization',
  'Procedure',
] as const;

// The whole chart, as Epic's patient API answers it: each resource type
// with the category it requires. Conditions live on four lists in Epic
// (her problem list, health concerns, visit diagnoses and history), so
// each is read. Appointments, longitudinal care plans and clinical notes
// are only returned when asked for by category. A type a provider does
// not publish answers 403 or 404, and the rest of the chart still comes.
export type PlanEntry = { type: string; params?: Record<string, string> };
export const FETCH_PLAN: readonly PlanEntry[] = [
  { type: 'Condition', params: { category: 'problem-list-item' } },
  { type: 'Condition', params: { category: 'health-concern' } },
  { type: 'Condition', params: { category: 'encounter-diagnosis' } },
  { type: 'Condition', params: { category: 'medical-history' } },
  { type: 'MedicationRequest' },
  { type: 'AllergyIntolerance' },
  { type: 'Observation' },
  { type: 'Immunization' },
  { type: 'Procedure' },
  { type: 'DiagnosticReport' },
  { type: 'DocumentReference', params: { category: 'clinical-note' } },
  { type: 'Encounter' },
  { type: 'Appointment', params: { 'service-category': 'appointment' } },
  { type: 'Device' },
  { type: 'FamilyMemberHistory' },
  { type: 'Goal' },
  { type: 'CarePlan', params: { category: '38717003' } },
  { type: 'Coverage' },
];

// The categories above are Epic's rules. Other servers often leave a
// condition untagged, and a query by category then returns none of them,
// so elsewhere each type is read once, whole.
export function planFor(vendor: string): readonly PlanEntry[] {
  if (vendor === 'epic') return FETCH_PLAN;
  const seen = new Set<string>();
  const plan: PlanEntry[] = [];
  for (const { type } of FETCH_PLAN) {
    if (seen.has(type)) continue;
    seen.add(type);
    plan.push({ type });
  }
  return plan;
}

// A server answers a page at a time. Enough pages for a long record, and
// a bound so one that never says it is finished cannot hold the sync.
export const MAX_PAGES = 50;

// The next page's address, when the server gives one. Only ever on the
// server's own origin: the request carries her token, and a next link
// pointing anywhere else would hand it over.
export function nextPage(bundle: unknown, base: string): string | null {
  const links = (bundle as { link?: unknown } | null)?.link;
  if (!Array.isArray(links)) return null;
  const next = links.find((l) => l?.relation === 'next');
  if (typeof next?.url !== 'string') return null;
  try {
    const url = new URL(next.url);
    return url.origin === new URL(base).origin ? url.toString() : null;
  } catch {
    return null;
  }
}

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

export function planQuery(base: string, entry: PlanEntry, patientId: string, count = 100): string {
  const url = new URL(resourceQuery(base, entry.type, patientId, count));
  for (const [k, v] of Object.entries(entry.params ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

// The query for one resource type, scoped to her patient id and nothing
// else. The id is required: a query without it asks the server for every
// patient it has, and a server that honoured that would be a breach.
export function resourceQuery(base: string, type: string, patientId: string, count = 100): string {
  const clean = base.replace(/\/+$/, '');
  const params = new URLSearchParams({ patient: patientId, _count: String(count) });
  if (type === 'Observation') {
    // Observation without a category returns every reading the hospital
    // holds, which on a long record is tens of thousands of rows. Labs
    // and vitals are what Ciatta shows.
    params.set('category', 'laboratory,vital-signs');
  }
  return `${clean}/${type}?${params.toString()}`;
}

// Whether a stored token still has useful life. A minute of slack, so a
// token that expires mid request is refreshed before it is used rather
// than after it fails.
export function needsRefresh(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return true;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return true;
  return at - now.getTime() < 60_000;
}

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

// What she is told. Never the protocol's words.
export function failureLine(failure: ExchangeFailure): string {
  switch (failure.reason) {
    case 'provider_error':
      return 'Your provider did not complete the connection. Nothing was shared.';
    case 'no_access_token':
      return 'Your provider finished without granting access. Nothing was shared.';
    default:
      return 'Your provider sent back something Ciatta could not read. Nothing was shared.';
  }
}
