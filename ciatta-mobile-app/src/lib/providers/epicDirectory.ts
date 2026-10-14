// Reading a vendor's published endpoint directory.
//
// Epic publishes every organization running its FHIR server as a public
// Bundle of Endpoint resources, and Cerner and the others publish the same
// shape. That is where the hundreds of St Luke's clinics come from, and it
// is the reason this app does not ship a hand written list of hospital
// URLs: a guessed FHIR base is a connection that fails, or worse, points
// somewhere that is not her hospital.
//
// So nothing here invents a row. Every field comes from the Bundle, and an
// entry missing the two things a connection actually needs, a name and an
// address, is dropped rather than patched.
//
// Pure. The fetch lives in the data layer; this is the parse, which is the
// part with the edge cases.

import type { Endpoint } from './directory';

// A FHIR Endpoint resource, reduced to what is read. Everything is
// optional because a public directory is filled in by hundreds of
// different hospital IT departments and reliably contains surprises.
type Raw = {
  resource?: {
    resourceType?: string;
    id?: string;
    status?: string;
    name?: string;
    address?: string;
    managingOrganization?: { display?: string };
    contained?: { resourceType?: string; name?: string }[];
  };
};

// Epic's Bundle nests the organization name in two different places
// depending on how old the entry is: managingOrganization.display on newer
// rows, a contained Organization on older ones. Both are read, because
// dropping to null loses the grouping that makes the results legible.
function organizationOf(resource: NonNullable<Raw['resource']>): string | null {
  const display = resource.managingOrganization?.display?.trim();
  if (display) return display;
  const contained = resource.contained?.find((c) => c.resourceType === 'Organization')?.name?.trim();
  return contained || null;
}

// An organization whose name is the same as the endpoint's is not a parent,
// it is the same thing written twice. Grouping on it would make a heading
// that repeats its only row.
function parentOrSelf(name: string, organization: string | null): string | null {
  if (!organization) return null;
  return organization.toLowerCase() === name.toLowerCase() ? null : organization;
}

export function parseEndpointBundle(json: unknown, vendor: Endpoint['vendor'], portalName: string | null): Endpoint[] {
  const bundle = json as { entry?: Raw[] } | null;
  if (!bundle || !Array.isArray(bundle.entry)) return [];

  const out: Endpoint[] = [];
  const seen = new Set<string>();

  for (const entry of bundle.entry) {
    const r = entry?.resource;
    if (!r || r.resourceType !== 'Endpoint') continue;

    // An endpoint the vendor has marked off is one that will not answer.
    // Showing it would send her to a login that cannot work.
    if (r.status && r.status !== 'active') continue;

    const name = r.name?.trim();
    const address = r.address?.trim();
    if (!name || !address) continue;

    // Only https. A directory row offering a plain http FHIR base is a row
    // that would carry her health data in clear text, and there is no
    // version of that worth connecting to.
    if (!/^https:\/\//i.test(address)) continue;

    // The same hospital appears more than once in these bundles, usually
    // one row per facility pointing at one shared base. Deduped on the
    // address, since that is what a connection is actually made to.
    const key = `${address.replace(/\/+$/, '')}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: r.id?.trim() || key,
      name,
      organization: parentOrSelf(name, organizationOf(r)),
      fhirBaseUrl: address.replace(/\/+$/, ''),
      vendor,
      portalName,
    });
  }
  return out;
}

// Epic's sandbox, which is a real endpoint with real test patients behind
// it. Kept in the app rather than fetched so the flow can be exercised
// end to end before any production registration exists, and labelled so
// nobody mistakes it for a hospital.
export const SANDBOX: Endpoint = {
  id: 'epic-sandbox',
  name: 'Epic Sandbox (test data only)',
  organization: null,
  fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  vendor: 'epic',
  portalName: 'MyChart',
};

// Whether a row is the sandbox, so the interface can say so plainly rather
// than letting a test server sit in a list of hospitals looking like one.
export const isSandbox = (endpoint: Endpoint) => endpoint.id === SANDBOX.id || endpoint.id === 'smart-test';

// The SMART Health IT test server, which accepts any registered app. It is
// here so a connection can be run from start to finish (her login, the
// token, the records arriving) while Epic is still activating Ciatta. The
// address carries the launch: a standalone patient launch for one
// synthetic patient, with the login and consent pages skipped. Test data
// only, and labelled so.
export const SMART_TEST: Endpoint = {
  id: 'smart-test',
  name: 'SMART Test Server (test data only)',
  organization: null,
  fhirBaseUrl: 'https://launch.smarthealthit.org/v/r4/sim/WzMsIjI2YjYyYmVjLTA2NTEtNGU4OC1iOGUzLTgzMjNkNWYxYTdlYyIsIiIsIkFVVE8iLDEsMSwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0/fhir',
  vendor: 'other',
  portalName: 'the SMART test login',
};
