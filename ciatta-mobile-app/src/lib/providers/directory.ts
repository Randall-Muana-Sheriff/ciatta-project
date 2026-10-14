// Finding the place she actually gets care.
//
// A health system is not one endpoint and not one name. St Luke's is six
// hundred clinics under one organization, half of them written in capitals
// by whoever typed them into the directory, and she knows hers as "St
// Lukes" with no apostrophe. So search has to be forgiving about how it is
// written and honest about how many it found, and the results have to
// group under the organization rather than arriving as six hundred rows.
//
// Pure, and holds no network. The directory arrives as data: today a
// bundled list of real FHIR endpoints, later the same shape fetched. The
// search must behave identically either way, which is why this file knows
// nothing about where the rows came from.

export type Endpoint = {
  id: string;
  // What she would recognise, as the directory spells it.
  name: string;
  // The parent health system, when the row belongs to one. Null for an
  // independent clinic, which is a real case and not a missing value.
  organization: string | null;
  // The FHIR base, which is what the connection is actually made to.
  fhirBaseUrl: string;
  // Which EHR is behind it. Shown nowhere; it decides how the authorize
  // URL is built, because vendors differ.
  vendor: 'epic' | 'cerner' | 'athena' | 'other';
  // The portal she will recognise on the login screen, when it has a name
  // of its own. MyChart is Epic's, and seeing it named before she is sent
  // there is the difference between a login and a redirect she did not
  // expect.
  portalName: string | null;
  // Where it is, as she would say it: "Bethlehem, PA" for a facility,
  // "PA and NJ" for a whole health system. Absent on rows from a list
  // that does not say, which is not the same as nowhere.
  location?: string | null;
  // Where the parent health system is, so two systems that share a name
  // ("St Luke's" in Pennsylvania and in Idaho) read as two places.
  organizationArea?: string | null;
};

// One organization and the endpoints under it, which is how the results
// read: a heading, a count, and the first few underneath.
export type ResultGroup = {
  // The organization, or the endpoint's own name when it has no parent.
  title: string;
  endpoints: Endpoint[];
  // True when there is exactly one and the group is really just a row.
  single: boolean;
  // Where the health system is, when the directory says.
  area: string | null;
};

// How many of a group's endpoints are listed before "View all".
export const PREVIEW = 3;

// The most a group lists even when opened. A health system can have three
// thousand facilities, and three thousand rows is not a choice anyone can
// make; past this she is asked to add her town instead.
export const MAX_SHOWN = 60;

// Folded for comparison: case, punctuation and the possessive all removed,
// so "St Luke's", "ST LUKES" and "st lukes" are one thing. Written once
// and used for both sides of every comparison, because folding only the
// haystack is the bug that makes a search miss what it is looking at.
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Whether a row answers the query. Every word has to appear somewhere in
// the row, in any order: "lukes boise" finds "St Luke's Boise Medical
// Center", which typing the full name never would.
// The folded text of each row, kept: a directory of ninety thousand rows
// folded again on every keystroke is a keyboard that lags.
const folded = new WeakMap<Endpoint, string>();

function hayOf(endpoint: Endpoint): string {
  let hay = folded.get(endpoint);
  if (hay === undefined) {
    hay = fold(`${endpoint.name} ${endpoint.organization ?? ''} ${endpoint.location ?? ''}`);
    folded.set(endpoint, hay);
  }
  return hay;
}

function matches(endpoint: Endpoint, words: string[]): boolean {
  const hay = hayOf(endpoint);
  return words.every((w) => hay.includes(w));
}

// The results, grouped under their organization.
//
// Groups are ordered by how well they match rather than by size: a
// hospital whose name starts with what she typed comes before a larger
// organization that merely contains it, because she is looking for hers
// and not for the biggest one.
export function search(directory: readonly Endpoint[], query: string): ResultGroup[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const words = q.split(' ');

  const hits = directory.filter((e) => matches(e, words));
  if (!hits.length) return [];

  // Grouped on the system and where it is, not the name alone: two
  // systems called St Luke's are two groups, never one.
  const groups = new Map<string, { title: string; area: string | null; endpoints: Endpoint[] }>();
  for (const e of hits) {
    const title = e.organization ?? e.name;
    const area = e.organization ? (e.organizationArea ?? null) : (e.location ?? null);
    const key = `${title}|${area ?? ''}`;
    const group = groups.get(key);
    // The system's own row leads its group, ahead of its facilities.
    if (group) {
      if (!e.organization) group.endpoints.unshift(e);
      else group.endpoints.push(e);
    } else {
      groups.set(key, { title, area, endpoints: [e] });
    }
  }

  return [...groups.values()]
    .map(({ title, area, endpoints }) => ({ title, area, endpoints, single: endpoints.length === 1 }))
    .sort((a, b) => {
      const aStarts = fold(a.title).startsWith(q) ? 0 : 1;
      const bStarts = fold(b.title).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.title.localeCompare(b.title);
    });
}

// What a group says under its heading. Counted, because "612 results under
// this organization" is the thing that tells her she is in the right place
// and still has to choose.
export function groupLine(group: ResultGroup): string | null {
  if (group.single) return null;
  const n = group.endpoints.length.toLocaleString('en-US');
  return group.area ? `${n} places in ${group.area}` : `${n} places under this organization`;
}

// Whether the group has more than it is showing.
export const hasMore = (group: ResultGroup) => group.endpoints.length > PREVIEW;

// What the screen says when nothing matched. It names what she typed, so
// she can see it was read, and it does not suggest her provider is absent
// from the world: the directory is what is incomplete, not her care.
export function noResults(query: string): string {
  return `No health institution found for "${query.trim()}". Try the name of the hospital or clinic rather than your doctor.`;
}
