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

type SeedOutcomeBase = {
  term: string;
  domain: string;
  system: string;
  code: string | null;
  display: string | null;
  confirmed: boolean;
};

// not_found means UMLS answered and had nothing. unavailable means the attempt
// did not complete, which is not evidence about the vocabulary at all. Keeping
// them apart is the difference between telling an operator "UMLS has no code
// for this" and "we could not find out", and only one of those is true when a
// request or a write fails.
//
// A union rather than one type carrying an optional stage. The optional
// version permitted `{ reason: 'unavailable' }` with no stage, and an outcome
// shaped like that falls out of every list in the response and is reported
// nowhere at all. No test can catch it: a test would have to construct an
// outcome the code never builds, so it would be asserting against a hand
// rolled object and testing the test rather than the code. A defect no test
// can express is one only the compiler can prevent, so the compiler is given
// what it needs to prevent it.
export type SeedOutcome =
  | (SeedOutcomeBase & { reason: 'resolved' | 'confirmed' | 'mismatch' | 'not_found' })
  // Which attempt did not complete. A failed search means retry; a failed
  // write means look at the database.
  | (SeedOutcomeBase & { reason: 'unavailable'; stage: 'search' | 'write' })
  // UMLS answered, with a code, and with no display that can be written.
  // umls.ts sets name to '' when the field is absent or is not a string, and
  // resolveOne turns that into display: null, while concepts.display is not
  // null in the table.
  //
  // Its own reason rather than a reuse of unavailable/write, and the criterion
  // is the one that split unreached from unwritten: what would the operator
  // do. unwritten says look at the database, and here the database is fine and
  // was never asked. not_found says UMLS has nothing, and here UMLS answered.
  // Either label sends a person to a healthy system to look for a fault that
  // is not there. What is actually needed is a look at the UMLS record for
  // this code, or a display supplied in the vocabulary, and neither of the
  // existing two reasons says that.
  | (SeedOutcomeBase & { reason: 'unusable' });

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
    // UMLS answered, and the answer was empty. An attempt that did not
    // complete is reported separately, as unavailable, because a network
    // failure is not evidence about the vocabulary.
    //
    // A residual ambiguity remains here and is deliberate. searchTerm returns
    // an empty list for a genuine absence and also for a shape change at NLM,
    // a maintenance page served with a 200, or a row whose ui is not a
    // string. Those all arrive as a successful response, so they cannot be
    // told apart from a real absence at this point. Nothing downstream may
    // read not_found as proof that a term has no code.
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
  | { kind: 'unit'; term: string; row: ConceptRow };

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
      term: concept.term,
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
  // A repeated term is planned once. The vocabulary is the same for everyone
  // and a concept is written idempotently, so a second occurrence buys
  // nothing while spending the rate limit again: without this, an array of
  // ten thousand copies of one term would issue ten thousand requests against
  // a limit of twenty a second.
  const seen = new Set<string>();
  for (const term of requested) {
    // A value that is not a string has no term, so it is refused here, before
    // the deduplication, rather than being stringified into one.
    // String(['Heart rate']) is 'Heart rate', and that value arrives over the
    // wire from a plain JSON.parse of {"terms":["Heart rate",["Heart rate"]]}.
    // Keying the seen set on a stringified non string let an off list value
    // collide with a legitimate one, and the collision behaved differently
    // depending on array order: in one order the off list value was
    // deduplicated away and silently dropped, losing the all or nothing
    // guarantee, and in the other the legitimate term was dropped and the
    // operator was told a term that is in the vocabulary is not in it.
    //
    // The label is JSON rendered rather than stringified, so that what an
    // operator reads cannot itself name a vocabulary term. String(['Heart
    // rate']) is 'Heart rate', which reads as a refusal of the real term and
    // would say something untrue even though the real term is planned
    // correctly. JSON.stringify gives ["Heart rate"], which collides with
    // nothing, because no vocabulary term contains a bracket or a quote.
    if (typeof term !== 'string') {
      // The String fallback is not redundant. JSON.stringify returns undefined
      // rather than a string for undefined, a function and a symbol, and
      // refused is a string[] that must stay one. Nothing arriving from
      // JSON.parse can be any of those three, so this is unreachable over the
      // wire, but planBatch and runSeed are exported and the next caller may
      // not come over the wire.
      refused.push(JSON.stringify(term) ?? String(term));
      continue;
    }

    if (seen.has(term)) continue;
    seen.add(term);

    const entry = BY_TERM.get(term);
    if (!entry) {
      refused.push(term);
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
  // UMLS answered and had nothing for these.
  missing: SeedOutcome[];
  // The UMLS request did not complete. Retry.
  unreached: SeedOutcome[];
  // UMLS answered but the row did not reach the database. Look at the
  // database. For a unit there was no UMLS request to begin with.
  unwritten: SeedOutcome[];
  // UMLS answered with a code and no usable display, so there was nothing
  // writable to send. Look at the UMLS record for the code, or give the term a
  // display in the vocabulary. Not a fault in the database, which was never
  // asked, and not a statement that UMLS has no code, because it gave one.
  unusable: SeedOutcome[];
  refused: string[];
};

// The name only, never the object, its message or its cause. On Deno a failed
// request carries the request URL and that URL carries the API key, and a
// thrown PostgREST error is a plain object whose stringification can carry a
// row. The instanceof guard degrades anything that is not an Error to
// 'unknown' rather than stringifying it.
//
// The term is health vocabulary rather than her health information, so naming
// it is safe and is the only way to know which one failed.
function logFailure(term: string, e: unknown): void {
  console.error('seed-concepts failed for term', term, e instanceof Error ? e.name : 'unknown');
}

export async function runSeed(deps: SeedDeps, requested: readonly unknown[] | null): Promise<SeedReport> {
  const { planned, refused } = planBatch(requested);

  // One unrecognised term refuses the whole batch and writes nothing. All or
  // nothing rather than best effort, because the interesting case is a caller
  // slipping one off list term in beside legitimate ones, and a partial run
  // would make that look like a success.
  if (refused.length > 0) {
    return {
      considered: 0,
      written: 0,
      mismatched: [],
      missing: [],
      unreached: [],
      unwritten: [],
      unusable: [],
      refused,
    };
  }

  const outcomes: SeedOutcome[] = [];
  let written = 0;

  for (const entry of planned) {
    // A unit is never sent to UMLS, so a failure here can only be the write.
    // Reporting it as a term UMLS had no answer for would be nonsense: UMLS
    // was never asked.
    if (entry.kind === 'unit') {
      try {
        await deps.write(entry.row);
        written += 1;
      } catch (e) {
        logFailure(entry.term, e);
        outcomes.push({
          term: entry.term,
          domain: entry.row.domain,
          system: entry.row.system,
          code: entry.row.code,
          display: entry.row.display,
          confirmed: false,
          reason: 'unavailable',
          stage: 'write',
        });
      }
      continue;
    }

    const input = entry.input;

    let outcome: SeedOutcome;
    try {
      outcome = await resolveOne(deps.fetcher, input, deps.apiKey, deps.sleep);
    } catch (e) {
      // The attempt did not complete, so nothing was learned about this term.
      // umls.ts sanitizes its own throws, and logFailure is the second guard
      // rather than a substitute for the first.
      logFailure(input.term, e);
      outcomes.push({
        term: input.term,
        domain: input.domain,
        system: input.system,
        code: null,
        display: null,
        confirmed: false,
        reason: 'unavailable',
        stage: 'search',
      });
      continue;
    }

    // UMLS answered for this term and the answer cannot be written. Said
    // explicitly, before the write, because the alternative is what this
    // branch was added to fix: the write guard below simply did not fire, the
    // outcome fell through still carrying reason: 'resolved', and 'resolved'
    // matches none of the filters at the bottom of this function. The term was
    // written nowhere and reported nowhere, and the run said considered: 1,
    // written: 0 with every list empty.
    //
    // The compiler could not see it, because the outcome was structurally
    // valid the whole time. Only the conservation assertion in the test suite
    // can: written plus every list must come back to considered.
    if ((outcome.reason === 'resolved' || outcome.reason === 'confirmed') && !(outcome.code && outcome.display)) {
      // Only the reason changes. The code is kept so the operator holds the
      // row, and confirmed is left as UMLS left it, because confirmed records
      // whether UMLS confirmed the concept rather than whether it was written.
      outcomes.push({ ...outcome, reason: 'unusable' });
      continue;
    }

    // Only a resolved or confirmed term is written. A mismatch and a not
    // found both write nothing, which is what keeps an unknown from becoming
    // a fact.
    if ((outcome.reason === 'resolved' || outcome.reason === 'confirmed') && outcome.code && outcome.display) {
      try {
        await deps.write({
          system: outcome.system,
          code: outcome.code,
          display: outcome.display,
          domain: outcome.domain,
          seeded_at: new Date().toISOString(),
        });
        written += 1;
      } catch (e) {
        logFailure(input.term, e);
        // What UMLS said is kept rather than nulled. The code is not in the
        // table, but it is not unknown either, and saying otherwise would be
        // the same false statement in the other direction.
        outcomes.push({ ...outcome, reason: 'unavailable', stage: 'write' });
        continue;
      }
    }

    outcomes.push(outcome);
  }

  return {
    considered: planned.length,
    written,
    mismatched: outcomes.filter((o) => o.reason === 'mismatch'),
    missing: outcomes.filter((o) => o.reason === 'not_found'),
    unreached: outcomes.filter((o) => o.reason === 'unavailable' && o.stage === 'search'),
    unwritten: outcomes.filter((o) => o.reason === 'unavailable' && o.stage === 'write'),
    unusable: outcomes.filter((o) => o.reason === 'unusable'),
    refused: [],
  };
}
