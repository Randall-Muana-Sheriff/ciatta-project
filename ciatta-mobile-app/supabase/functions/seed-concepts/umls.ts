// A small client for the UMLS Terminology Services REST API.
//
// No Deno or Supabase imports, the same arrangement as compute.ts, links.ts
// and paging.ts: plain TypeScript so a Node test can exercise it directly
// while the edge function imports it by relative path. It lives here rather
// than in src/lib because only this directory deploys with the function.
//
// Two rules from the API's own documentation shape everything below. The
// rate limit is 20 requests per second per IP, so the caller sleeps between
// calls rather than firing a batch. And the search endpoint returns at most
// 200 objects with no pagination, which is ample for one term but is the
// reason nothing here tries to enumerate a vocabulary.

const BASE = 'https://uts-ws.nlm.nih.gov/rest';

// The source abbreviations UMLS uses. LOINC is LNC, which is the one most
// likely to be written wrongly from memory.
export const SABS = {
  loinc: 'LNC',
  snomed: 'SNOMEDCT_US',
  rxnorm: 'RXNORM',
} as const;

export type UmlsHit = { ui: string; rootSource: string; name: string };

// The shape of fetch this module needs, so a test can supply one without a
// network. Deliberately narrower than the real fetch.
export type Fetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export function searchUrl(term: string, sab: string, apiKey: string): string {
  const q = new URLSearchParams({
    string: term,
    sabs: sab,
    // Source asserted identifiers, so a LOINC search returns a LOINC code
    // rather than a UMLS CUI. The CUI is fetched separately when needed.
    returnIdType: 'sourceUi',
    // Exact only. A fuzzy match would silently map her "Bloating" to
    // whatever is nearest, which is a guess recorded as a fact.
    searchType: 'exact',
    apiKey,
  });
  return `${BASE}/search/current?${q.toString()}`;
}

export function crosswalkUrl(system: string, code: string, targetSab: string, apiKey: string): string {
  const q = new URLSearchParams({ targetSource: targetSab, apiKey });
  // The source and the code are path segments here, not query parameters,
  // which is the shape that differs most from the search endpoint.
  return `${BASE}/crosswalk/current/source/${encodeURIComponent(system)}/${encodeURIComponent(code)}?${q.toString()}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// UMLS answers "nothing found" with a single row whose ui is the literal
// string NONE. Treating that as a hit would write a concept called
// NO RESULTS into her vocabulary.
function toHits(rows: unknown): UmlsHit[] {
  if (!Array.isArray(rows)) return [];
  const out: UmlsHit[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const ui = typeof row.ui === 'string' ? row.ui : '';
    const rootSource = typeof row.rootSource === 'string' ? row.rootSource : '';
    const name = typeof row.name === 'string' ? row.name : '';
    if (!ui || ui === 'NONE') continue;
    out.push({ ui, rootSource, name });
  }
  return out;
}

// Search nests its rows under result.results.
export function parseSearch(body: unknown): UmlsHit[] {
  if (!isRecord(body)) return [];
  const result = body.result;
  if (!isRecord(result)) return [];
  return toHits(result.results);
}

// Crosswalk puts them directly on result. The two shapes genuinely differ
// and reading one with the other's parser returns an empty list, which would
// look exactly like "no concept found".
export function parseCrosswalk(body: unknown): UmlsHit[] {
  if (!isRecord(body)) return [];
  return toHits(body.result);
}

// A failed request throws. Returning an empty list would be indistinguishable
// from "this term has no concept", and the seeding task would then record an
// absence caused by a network error as a fact about the vocabulary.
//
// The key is never in the thrown message: an error reaches a log, and a log
// is exactly where a key must not be. That rule covers the cause chain as
// well as the message, which is why the two awaits below are wrapped.
export async function searchTerm(
  fetcher: Fetcher,
  term: string,
  sab: string,
  apiKey: string
): Promise<UmlsHit[]> {
  const url = searchUrl(term, sab, apiKey);

  let response;
  try {
    response = await fetcher(url);
  } catch {
    // Deliberately discards the original error rather than chaining it. On
    // Deno, which is what this function actually deploys to, a network level
    // rejection carries the full request URL in `cause`, and that URL carries
    // the API key as a query parameter, so attaching the original here would
    // put the key one `console.error(e)` away from the function logs. Node's
    // undici does not leak this way, which is exactly why no test in the app
    // suite could have caught it. The transport detail is not worth a key.
    throw new Error('UMLS search failed: the request did not complete');
  }

  if (!response.ok) throw new Error(`UMLS search failed with status ${response.status}`);

  // Reading the body is the same hazard by a second route: a body that fails
  // mid stream rejects from the same client and carries the same URL.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('UMLS search failed: the response body could not be read');
  }

  return parseSearch(body);
}
