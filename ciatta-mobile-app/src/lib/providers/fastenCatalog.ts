// Fasten's catalog, searched from the same box as the MyChart directory.
//
// Pure: the search address and what a result means. The fetch is in
// data/providers. Only the public id is used here, which is meant to be
// public; nothing she types is sent anywhere but Fasten's search.

// The same address the server uses (supabase/functions/fasten-webhook).
const FASTEN_API = 'https://api.connect.fastenhealth.com/v1';

export type FastenHit = {
  brandId: string;
  name: string;
  platforms: string[];
  // Two letter states, empty when the catalog says everywhere.
  locations: string[];
  // Only when there is exactly one, so Fasten can go straight to sign in.
  portalId?: string;
  endpointId?: string;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function catalogSearchUrl(publicId: string): string {
  const mode = publicId.startsWith('public_live_') ? 'live' : 'test';
  return `${FASTEN_API}/bridge/catalog/search?api_mode=${mode}&public_id=${encodeURIComponent(publicId)}`;
}

export function parseCatalogSearch(json: unknown): FastenHit[] {
  const hits = list((json as any)?.data?.hits?.hits);
  const out: FastenHit[] = [];
  for (const h of hits) {
    const s = (h as any)?._source;
    if (!s || s.hidden === true) continue;
    const brandId = str(s.id);
    const name = str(s.name);
    if (!brandId || !name) continue;
    const portals = list(s.portals);
    const endpoints = portals.length === 1 ? list((portals[0] as any)?.endpoints) : [];
    const hit: FastenHit = {
      brandId,
      name,
      platforms: list(s.platform_type).map(str).filter((p): p is string => !!p),
      locations: list(s.locations).map(str).filter((l): l is string => !!l && l !== 'ALL'),
    };
    const portalId = portals.length === 1 ? str((portals[0] as any)?.id) : null;
    if (portalId) hit.portalId = portalId;
    const endpointId = endpoints.length === 1 ? str((endpoints[0] as any)?.id) : null;
    if (endpointId) hit.endpointId = endpointId;
    out.push(hit);
  }
  return out;
}

const INSURERS = new Set(['aetna', 'anthem', 'cigna', 'humana', 'cms', 'medicare', 'bluebutton', 'uhc', 'unitedhealthcare', 'bcbs', 'centene', 'molina']);
const SYSTEMS: Record<string, string> = {
  epic: 'MyChart',
  cerner: 'Oracle Health',
  athena: 'athenahealth',
  nextgen: 'NextGen',
  eclinicalworks: 'eClinicalWorks',
  allscripts: 'Allscripts',
  veradigm: 'Veradigm',
  meditech: 'MEDITECH',
  va: 'VA',
};

// The system people would recognise, or null when the catalog names one
// they would not.
export function platformLine(hit: Pick<FastenHit, 'platforms'>): string | null {
  if (hit.platforms.some((p) => INSURERS.has(p.toLowerCase()))) return 'Insurance plan';
  for (const p of hit.platforms) {
    const known = SYSTEMS[p.toLowerCase()];
    if (known) return known;
  }
  return null;
}

export function placeLine(hit: Pick<FastenHit, 'locations'>): string | null {
  if (!hit.locations.length) return null;
  if (hit.locations.length <= 3) return hit.locations.join(', ');
  return `${hit.locations.slice(0, 3).join(', ')} and ${hit.locations.length - 3} more`;
}

export function fastenNote(hits: readonly FastenHit[] | null): string | null {
  if (hits === null) return 'Other providers and insurers could not be searched just now.';
  if (!hits.length) return 'No other providers or insurers matched.';
  return null;
}
