// Resolving one term against UMLS, and deciding what that answer permits.
//
// The rule the whole file turns on: a term UMLS cannot resolve produces no
// concept at all. It does not fall back to the term as its own code, it does
// not write a placeholder, and it does not pass silently. An unmapped
// symptom is unmapped, and the run says how many there were.

import { SABS, searchTerm, type Fetcher } from './umls.ts';
import { METRIC_CONCEPTS, SYMPTOM_TERMS, UNIT_CONCEPTS } from './vocabulary.ts';

// 60ms between requests is about 16 a second, under the API's limit of 20 per
// second per IP with margin for the clock. Seeding is a one time job, so
// there is nothing to gain from running closer to the ceiling.
export const REQUEST_INTERVAL_MS = 60;

export type SeedInput = {
  term: string;
  domain: string;
  system: 'loinc' | 'snomed' | 'rxnorm';
  // A code written down in conceptMap.ts, to be checked rather than trusted.
  expectedCode?: string;
};

export type SeedOutcome = {
  term: string;
  domain: string;
  system: string;
  code: string | null;
  display: string | null;
  confirmed: boolean;
  reason: 'resolved' | 'confirmed' | 'mismatch' | 'not_found';
};

// A row as it is written to public.concepts. seeded_at is nullable and the
// nullability carries meaning: see the unit branch in planBatch below.
export type ConceptRow = {
  system: string;
  code: string;
  display: string;
  domain: string;
  seeded_at: string | null;
};

export async function resolveOne(
  fetcher: Fetcher,
  input: SeedInput,
  apiKey: string,
  sleep: (ms: number) => Promise<void>
): Promise<SeedOutcome> {
  // Sleeping before rather than after means a caller can loop over this
  // function without holding the rate limit itself.
  await sleep(REQUEST_INTERVAL_MS);

  const sab = SABS[input.system];
  const hits = await searchTerm(fetcher, input.term, sab, apiKey);

  if (hits.length === 0) {
    // Unresolved, which is not the same fact as "this term has no code".
    // searchTerm returns an empty list for a genuine absence and also for a
    // shape change at NLM, a maintenance page served with a 200, or a row
    // whose ui is not a string, and none of those are distinguishable from
    // each other here. Nothing downstream may read this as a confirmed
    // absence.
    return {
      term: input.term,
      domain: input.domain,
      system: input.system,
      code: null,
      display: null,
      confirmed: false,
      reason: 'not_found',
    };
  }

  // Exact search, so several hits mean several codes carry the same exact
  // name. The first is taken and the rest ignored, which is a choice rather
  // than a certainty, and it is why nothing downstream treats a concept as
  // the only possible code for a term.
  const hit = hits[0];

  if (input.expectedCode) {
    const agrees = hit.ui === input.expectedCode;
    return {
      term: input.term,
      domain: input.domain,
      system: input.system,
      // What UMLS actually said, either way, so a person can compare it with
      // what was written down.
      code: hit.ui,
      display: hit.name || null,
      confirmed: agrees,
      reason: agrees ? 'confirmed' : 'mismatch',
    };
  }

  return {
    term: input.term,
    domain: input.domain,
    system: input.system,
    code: hit.ui,
    display: hit.name || null,
    confirmed: true,
    reason: 'resolved',
  };
}

// A term is either resolved against UMLS or, for a unit, written straight
// from the vocabulary. The two are a union rather than one type because a
// unit cannot be a SeedInput at all: SeedInput.system is loinc, snomed or
// rxnorm, and SABS has no UCUM entry to search with.
export type PlannedTerm =
  | { kind: 'resolve'; input: SeedInput }
  | { kind: 'unit'; row: ConceptRow };

export type Plan = { planned: PlannedTerm[]; refused: string[] };

// The one place a term becomes writable. Keyed by term, built once, from the
// compiled in lists only.
const BY_TERM = new Map<string, PlannedTerm>();

for (const concept of [...METRIC_CONCEPTS, ...UNIT_CONCEPTS]) {
  if (concept.system === 'ucum') {
    // UCUM is written without ever asking UMLS, and the row carries no
    // seeded_at, because SABS has no UCUM source abbreviation and so no
    // search could confirm it. A date there would assert a confirmation that
    // never happened.
    //
    // Writing UCUM unconfirmed is safe in a way that writing SNOMED
    // unconfirmed would not be, and the difference is checkability rather
    // than trust. UCUM is a unit grammar: /min, Cel, %, {count} are readable
    // by inspection, and a reviewer can tell whether the code means what the
    // display says. A SNOMED identifier is an opaque number that no one can
    // eyeball, so an unconfirmed one would be a guess recorded as a fact.
    BY_TERM.set(concept.term, {
      kind: 'unit',
      row: {
        system: concept.system,
        code: concept.code,
        display: concept.display,
        domain: concept.domain,
        seeded_at: null,
      },
    });
    continue;
  }
  BY_TERM.set(concept.term, {
    kind: 'resolve',
    input: {
      term: concept.term,
      domain: concept.domain,
      system: concept.system,
      // Written down, so it is checked rather than trusted.
      expectedCode: concept.code,
    },
  });
}

for (const symptom of SYMPTOM_TERMS) {
  // No expectedCode on purpose. A SNOMED identifier for a symptom is
  // resolved, never recalled.
  BY_TERM.set(symptom.term, {
    kind: 'resolve',
    input: { term: symptom.term, domain: symptom.domain, system: 'snomed' },
  });
}

// Turns a request into work, refusing anything that is not in the vocabulary.
// A caller names terms and nothing else: the system, the domain and the
// expected code all come from the compiled in list, so there is no request
// shape that can write an arbitrary row through a legitimate term.
//
// null means the whole vocabulary.
export function planBatch(requested: readonly unknown[] | null): Plan {
  if (requested === null) return { planned: [...BY_TERM.values()], refused: [] };

  const planned: PlannedTerm[] = [];
  const refused: string[] = [];
  for (const term of requested) {
    const entry = typeof term === 'string' ? BY_TERM.get(term) : undefined;
    if (!entry) {
      refused.push(typeof term === 'string' ? term : String(term));
      continue;
    }
    planned.push(entry);
  }
  return { planned, refused };
}

export type SeedDeps = {
  fetcher: Fetcher;
  apiKey: string;
  sleep: (ms: number) => Promise<void>;
  write: (row: ConceptRow) => Promise<void>;
};

export type SeedReport = {
  considered: number;
  written: number;
  mismatched: SeedOutcome[];
  missing: SeedOutcome[];
  refused: string[];
};

export async function runSeed(deps: SeedDeps, requested: readonly unknown[] | null): Promise<SeedReport> {
  const { planned, refused } = planBatch(requested);

  // One unrecognised term refuses the whole batch and writes nothing. All or
  // nothing rather than best effort, because the interesting case is a caller
  // slipping one off list term in beside legitimate ones, and a partial run
  // would make that look like a success.
  if (refused.length > 0) {
    return { considered: 0, written: 0, mismatched: [], missing: [], refused };
  }

  const outcomes: SeedOutcome[] = [];
  let written = 0;

  for (const entry of planned) {
    const term = entry.kind === 'unit' ? entry.row.display : entry.input.term;
    const domain = entry.kind === 'unit' ? entry.row.domain : entry.input.domain;
    const system = entry.kind === 'unit' ? entry.row.system : entry.input.system;

    try {
      if (entry.kind === 'unit') {
        await deps.write(entry.row);
        written += 1;
        continue;
      }

      const outcome = await resolveOne(deps.fetcher, entry.input, deps.apiKey, deps.sleep);
      outcomes.push(outcome);

      // Only a resolved or confirmed term is written. A mismatch and a not
      // found both write nothing, which is what keeps an unknown from
      // becoming a fact.
      if ((outcome.reason === 'resolved' || outcome.reason === 'confirmed') && outcome.code && outcome.display) {
        await deps.write({
          system: outcome.system,
          code: outcome.code,
          display: outcome.display,
          domain: outcome.domain,
          seeded_at: new Date().toISOString(),
        });
        written += 1;
      }
    } catch (e) {
      // The name only. The error from a failed request carries the request
      // URL on Deno and that URL carries the API key, so the object, its
      // message and its cause are all unloggable here. umls.ts sanitizes its
      // own throws, and this is the second guard rather than a substitute for
      // the first.
      //
      // The term is health vocabulary rather than her health information, so
      // naming it is safe and is the only way to know which one failed.
      console.error('seed-concepts failed for term', term, e instanceof Error ? e.name : 'unknown');
      outcomes.push({
        term,
        domain,
        system,
        code: null,
        display: null,
        confirmed: false,
        reason: 'not_found',
      });
    }
  }

  return {
    considered: planned.length,
    written,
    mismatched: outcomes.filter((o) => o.reason === 'mismatch'),
    missing: outcomes.filter((o) => o.reason === 'not_found'),
    refused: [],
  };
}
