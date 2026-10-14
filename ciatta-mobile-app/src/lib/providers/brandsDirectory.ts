// Epic's Brands bundle, made small enough to carry.
//
// Epic publishes two directories. The endpoint list (open.epic.com/
// Endpoints/R4) has one row per health system and no locations, so five
// rows simply say "St Luke's" and she cannot tell which is hers. The
// Brands bundle (open.epic.com/Endpoints/Brands) has every health system
// with the states it serves, and under each one every hospital and clinic
// with its address. That is the list she should be choosing from.
//
// It is also ninety six megabytes, which no phone should download. So a
// script reads it once (scripts/build-provider-directory.ts) and keeps
// only what choosing needs, in a plain text form:
//
//   B <tab> system name <tab> FHIR base <tab> states, comma separated
//   F <tab> facility name <tab> town <tab> state <tab> system index
//
// The app parses that back into the same Endpoint rows the search already
// understands. Pure, both directions, so both are tested.

import type { Endpoint } from './directory';

type Resource = {
  resourceType?: string;
  id?: string;
  active?: boolean;
  status?: string;
  name?: string;
  address?: unknown;
  endpoint?: { reference?: string }[];
  partOf?: { reference?: string };
};

type Address = { city?: string; state?: string };

// A reference in this bundle is a urn:uuid, and the id is its tail.
const idOf = (reference: string | undefined) => (reference ?? '').split(':').pop() ?? '';

// Tabs and line breaks would break the format, and nothing in a name needs
// them.
const clean = (text: string | undefined) => (text ?? '').replace(/[\t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').trim();

// "BETHLEHEM" as "Bethlehem", "WILKES-BARRE" as "Wilkes-Barre": the
// directory is typed by hundreds of IT departments, half in capitals.
function town(text: string | undefined): string {
  const t = clean(text);
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

const addresses = (r: Resource): Address[] => (Array.isArray(r.address) ? (r.address as Address[]) : []);

export function compactBrands(json: unknown): string {
  const entries = (json as { entry?: { resource?: Resource }[] } | null)?.entry;
  if (!Array.isArray(entries)) return '';

  const endpoints = new Map<string, string>();
  for (const { resource: r } of entries) {
    if (r?.resourceType !== 'Endpoint' || !r.id) continue;
    if (r.status && r.status !== 'active') continue;
    const address = clean(typeof r.address === 'string' ? r.address : '').replace(/\/+$/, '');
    // Only https, for the same reason as the endpoint list: anything else
    // would carry her record in clear text.
    if (/^https:\/\//i.test(address)) endpoints.set(r.id, address);
  }

  const lines: string[] = [];
  const systems = new Map<string, number>();
  for (const { resource: r } of entries) {
    if (r?.resourceType !== 'Organization' || !r.id || r.active === false || !r.endpoint?.length) continue;
    const base = r.endpoint.map((ref) => endpoints.get(idOf(ref.reference))).find(Boolean);
    const name = clean(r.name);
    if (!base || !name) continue;
    const states = [...new Set(addresses(r).map((a) => clean(a.state)).filter(Boolean))];
    systems.set(r.id, systems.size);
    lines.push(['B', name, base, states.join(',')].join('\t'));
  }

  const seen = new Set<string>();
  for (const { resource: r } of entries) {
    if (r?.resourceType !== 'Organization' || r.active === false || r.endpoint?.length) continue;
    const system = systems.get(idOf(r.partOf?.reference));
    const name = clean(r.name);
    if (system === undefined || !name) continue;
    const a = addresses(r)[0] ?? {};
    const city = town(a.city);
    const state = clean(a.state);
    const key = `${system}|${name.toLowerCase()}|${city.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(['F', name, city, state, String(system)].join('\t'));
  }
  return lines.join('\n');
}

// "PA and NJ", "PA, NJ and NY". Said, not listed.
function area(states: string[]): string | null {
  if (!states.length) return null;
  if (states.length === 1) return states[0];
  return `${states.slice(0, -1).join(', ')} and ${states[states.length - 1]}`;
}

export function parseCompact(text: string): Endpoint[] {
  const systems: Endpoint[] = [];
  const out: Endpoint[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f[0] === 'B' && f.length >= 4 && f[1] && f[2]) {
      const system: Endpoint = {
        id: `epic-brand-${systems.length}`,
        name: f[1],
        organization: null,
        fhirBaseUrl: f[2],
        vendor: 'epic',
        portalName: 'MyChart',
        location: area(f[3] ? f[3].split(',') : []),
      };
      systems.push(system);
      out.push(system);
    } else if (f[0] === 'F' && f.length >= 5) {
      const system = systems[Number(f[4])];
      if (!system || !f[1]) continue;
      out.push({
        id: `epic-facility-${out.length}`,
        name: f[1],
        organization: system.name,
        organizationArea: system.location,
        fhirBaseUrl: system.fhirBaseUrl,
        vendor: 'epic',
        portalName: 'MyChart',
        location: [f[2], f[3]].filter(Boolean).join(', ') || null,
      });
    }
  }
  return out;
}
