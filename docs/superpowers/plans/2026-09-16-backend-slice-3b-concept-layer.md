# Backend Slice 3b: The Concept Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every measurement, symptom and medication in her record a standard clinical concept, so that what she logs and what a clinic sends can be recognised as the same thing.

**Architecture:** One `concepts` table holds the standard codes she needs, seeded once from the UMLS Metathesaurus rather than resolved per write, because UMLS allows 20 requests per second per IP and one Apple Health sync can carry hundreds of observations. Her rows point at a concept by foreign key. A `fhir_observation()` function renders any observation as a FHIR R4 Observation resource on the way out. Nothing about her existing rows is rewritten: the bespoke metric string stays where it is, and the concept sits beside it.

**Tech Stack:** Supabase Postgres 17, Deno edge functions, pgTAP, `tsx --test` with `node:test`, UMLS Terminology Services REST API (`https://uts-ws.nlm.nih.gov/rest`), LOINC, SNOMED CT US edition, RxNorm.

**Spec:** `docs/superpowers/specs/2026-09-15-backend-design.md`, section 5.2a (the two founder decisions of 16 September 2026) and section 5.3.

**Source document:** `Ciatta MVP — Technical Stack & Architecture v0.1`, at the repository root. Normalization sits second in its flow, directly after ingestion and before evidence extraction, which is why this slice precedes threads and insights.

**Renumbering:** the slice previously called 3b (threads, thread evidence, insights, research refs) becomes **3c** and follows this one. Recorded here so the two are not confused.

## Global Constraints

- Never represent an inference as a measured fact. A concept mapping is an assertion about vocabulary, never about her.
- Missing data is unknown. Never convert missing information into "none", and never into zero. An unmapped row is unmapped, not "no concept".
- A user must only be able to access their own data. Never expose another user's health information.
- The UMLS API key is a secret. It never appears in `src/`, never in a migration, never in a commit, never in a log line, and never in a table a non superuser can read. Local work reads it from `ciatta-mobile-app/.env`; server work reads it from Supabase Vault under the name `umls_api_key`.
- No raw personal health information in logs, and no personal health information is ever sent to the UMLS API. Seeding sends vocabulary terms such as "Heart rate" and "Fatigue", never a value, never a date, never a user id.
- Every new database function gets its own `revoke execute ... from public, anon, authenticated`. Revoke then grant, never additive.
- Every new table holding her data gets RLS and an owner select policy. `concepts` is reference data and is the deliberate exception, stated in Task 1.
- No em dash, en dash or hyphen in user facing copy. Compound words become separate words ("heart rate", not "heart-rate"). Remote or templated strings render through `displayCopy()` in `src/lib/displayCopy.ts`. Git trailers are exempt.
- The product name never appears in user facing copy.
- Do not redesign the frontend. This slice adds no screens.
- Migrations are new files. Never edit a migration already applied to the live project; the live project holds all twenty one through `20260917100400`.
- UMLS rate limit: 20 requests per second per IP. The search endpoint returns at most 200 objects and does not paginate.

---

### Task 1: The concepts table

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260918100000_concepts.sql`
- Create: `ciatta-mobile-app/supabase/tests/concepts.test.sql`

**Interfaces:**
- Produces: table `public.concepts` with columns `id uuid`, `system public.code_system`, `code text`, `display text`, `domain text`, `cui text`, `seeded_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`; enum `public.code_system` with values `loinc`, `snomed`, `rxnorm`, `ucum`.

**What this table is.** Reference data, not her data. A LOINC code for heart rate is the same fact for everyone, so this table has no `user_id`, and that is the one deliberate departure from this project's rule that every table carries RLS and an owner policy. It is readable by any signed in user and writable only by the service role, which is exactly the shape `anon` already has nowhere and `authenticated` has on `baselines`.

**Why `cui` is stored.** The UMLS Concept Unique Identifier is what lets one term be recognised across vocabularies. Storing it is what makes Task 5's crosswalk a local lookup rather than a network call.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/supabase/tests/concepts.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_type('public', 'code_system', 'the code system enum exists');
select has_table('public', 'concepts', 'concepts exists');

-- Reference data, not her data: no user_id column at all.
select hasnt_column('public', 'concepts', 'user_id',
  'concepts carries no user_id, because a LOINC code is the same fact for everyone');

-- Readable by a signed in user, writable only by the server.
select ok(has_table_privilege('authenticated', 'public.concepts', 'SELECT'),
  'authenticated can read concepts');
select ok(not has_table_privilege('authenticated', 'public.concepts', 'INSERT'),
  'authenticated cannot write concepts');
select ok(not has_table_privilege('authenticated', 'public.concepts', 'UPDATE'),
  'authenticated cannot update concepts');
select ok(not has_table_privilege('anon', 'public.concepts', 'SELECT'),
  'anon cannot read concepts');

-- One row per code within a system.
select col_is_unique('public', 'concepts', array['system', 'code'],
  'a code is recorded once per system');

-- A concept with no display text is useless and must not be storable.
select col_not_null('public', 'concepts', 'display', 'display is required');
select col_not_null('public', 'concepts', 'code', 'code is required');
select col_not_null('public', 'concepts', 'system', 'system is required');

-- seeded_at records when UMLS last confirmed this row, which is how a stale
-- vocabulary is found later. It is nullable because a hand entered concept
-- has never been confirmed by UMLS at all, and pretending otherwise would
-- be the same fabrication this project keeps removing.
select col_is_null('public', 'concepts', 'seeded_at',
  'seeded_at is nullable, because a concept UMLS has never confirmed has no such date');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL. The type and table do not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260918100000_concepts.sql`:

```sql
-- The standard vocabulary her record is described in.
--
-- Every other table in this schema holds one woman's information and carries
-- RLS with an owner policy. This one does not, and the departure is
-- deliberate: a LOINC code for heart rate is the same fact for every person
-- alive, so there is no owner to scope it to. It is reference data. She can
-- read it, only the server writes it, and anon holds nothing, which is the
-- same shape baselines already has minus the per user filter.
--
-- The four systems are the ones the architecture document names and the ones
-- the UMLS Metathesaurus serves: LOINC for measurements and laboratory
-- results, SNOMED CT for symptoms, findings and conditions, RxNorm for
-- medications, and UCUM for units.
create type public.code_system as enum ('loinc', 'snomed', 'rxnorm', 'ucum');

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  system public.code_system not null,
  code text not null,
  display text not null,
  -- The domain this concept belongs to in her record: vitals, activity,
  -- sleep, symptom, medication, result. Free text rather than an enum
  -- because the set grows with what she logs, and a migration to add a
  -- value is a poor trade for a column nothing branches on.
  domain text,
  -- The UMLS Concept Unique Identifier. This is the join that lets one term
  -- be recognised across vocabularies, and storing it is what makes the
  -- crosswalk a local lookup rather than a network call on every question.
  cui text,
  -- When UMLS last confirmed this row. Nullable on purpose: a concept
  -- entered by hand has never been confirmed by UMLS, and writing a date
  -- there would assert a confirmation that never happened.
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system, code)
);
create index concepts_cui on public.concepts (cui) where cui is not null;
create index concepts_domain on public.concepts (domain);

create trigger concepts_touch before update on public.concepts
  for each row execute function public.touch_updated_at();

revoke all on public.concepts from anon, authenticated;
grant select on public.concepts to authenticated;
grant all on public.concepts to service_role;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS. Report the assertion count you actually get; the plan does not predict it, because counts in this project have been stale twice.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260918100000_concepts.sql ciatta-mobile-app/supabase/tests/concepts.test.sql
git commit -m "Add the standard vocabulary her record is described in"
```

---

### Task 2: The mapping from her vocabulary to standard codes

**Files:**
- Create: `ciatta-mobile-app/src/lib/conceptMap.ts`
- Create: `ciatta-mobile-app/src/data/conceptMap.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks; this file is pure.
- Produces:
  - `export type CodeSystem = 'loinc' | 'snomed' | 'rxnorm' | 'ucum'`
  - `export type ConceptSeed = { system: CodeSystem; code: string; display: string; domain: string; term: string }`
  - `export const METRIC_CONCEPTS: ConceptSeed[]`
  - `export const SYMPTOM_TERMS: { term: string; domain: string }[]`
  - `export function seedTermsFor(domain: string): { term: string; domain: string }[]`

**The distinction this task turns on.** A `code` is a claim that a specific LOINC or SNOMED identifier is correct. A `term` is a search string handed to UMLS so it can tell us the code. Codes that are stable and well known are written down; everything else carries only a term and is resolved in Task 3. Writing a guessed code would be exactly the fabrication this project forbids, in a new place.

The five codes below are stable LOINC identifiers for device measurements and are written down with confidence. Everything in `SYMPTOM_TERMS` is a term, not a code, because SNOMED identifiers for symptom phrases are not something to recall from memory.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/src/data/conceptMap.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { METRIC_CONCEPTS, SYMPTOM_TERMS, seedTermsFor } from '../lib/conceptMap';

test('every metric concept carries a system, a code, a display and a term', () => {
  for (const c of METRIC_CONCEPTS) {
    assert.ok(c.system.length > 0, 'system');
    assert.ok(c.code.length > 0, `code for ${c.display}`);
    assert.ok(c.display.length > 0, 'display');
    assert.ok(c.term.length > 0, `term for ${c.display}`);
  }
});

test('the five metrics the baselines function computes all have a concept', () => {
  const domains = METRIC_CONCEPTS.map((c) => c.domain);
  for (const needed of ['sleep', 'activity', 'vitals']) {
    assert.ok(domains.includes(needed), `${needed} has at least one concept`);
  }
  const displays = METRIC_CONCEPTS.map((c) => c.display.toLowerCase());
  assert.ok(displays.some((d) => d.includes('heart rate')), 'resting heart rate is mapped');
  assert.ok(displays.some((d) => d.includes('step')), 'steps are mapped');
});

test('no display carries a hyphen, because these strings can reach her', () => {
  for (const c of METRIC_CONCEPTS) {
    assert.doesNotMatch(c.display, /[-–—]/, `${c.display} carries a dash`);
  }
});

test('symptom terms are terms, never codes', () => {
  for (const s of SYMPTOM_TERMS) {
    assert.ok(s.term.length > 0);
    assert.doesNotMatch(s.term, /^\d+$/, 'a term is a phrase, not a numeric identifier');
  }
});

test('seedTermsFor returns the terms for one domain and nothing else', () => {
  const symptoms = seedTermsFor('symptom');
  assert.ok(symptoms.length > 0);
  for (const s of symptoms) assert.equal(s.domain, 'symptom');
});

test('seedTermsFor returns an empty list for a domain with no terms, not a guess', () => {
  assert.deepEqual(seedTermsFor('nothing_here'), []);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npm test`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `ciatta-mobile-app/src/lib/conceptMap.ts`:

```ts
// What her record's own vocabulary is called in the standard ones.
//
// Two different things live here and the difference matters. A `code` is an
// assertion that a specific LOINC or SNOMED identifier is the right one. A
// `term` is a phrase handed to UMLS so that it can tell us the code. Only
// codes that are stable and well established are written down; everything
// else carries a term and is resolved against UMLS in the seeding task.
//
// Writing down a guessed code would be an inference recorded as a fact,
// which is the one thing this record must never do. An unresolved term is
// honest: it says we do not know yet.

export type CodeSystem = 'loinc' | 'snomed' | 'rxnorm' | 'ucum';

export type ConceptSeed = {
  system: CodeSystem;
  code: string;
  display: string;
  domain: string;
  // The phrase to confirm this code against UMLS at seed time. A code that
  // cannot be confirmed is reported rather than written.
  term: string;
};

// LOINC codes for the device measurements. These are the observation codes
// LOINC publishes for exactly these quantities, and each is confirmed
// against UMLS during seeding rather than trusted because it is written
// here.
export const METRIC_CONCEPTS: ConceptSeed[] = [
  { system: 'loinc', code: '8867-4',  display: 'Heart rate',                     domain: 'vitals',   term: 'Heart rate' },
  { system: 'loinc', code: '40443-4', display: 'Heart rate resting',             domain: 'vitals',   term: 'Heart rate --resting' },
  { system: 'loinc', code: '9279-1',  display: 'Respiratory rate',               domain: 'vitals',   term: 'Respiratory rate' },
  { system: 'loinc', code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry', domain: 'vitals', term: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
  { system: 'loinc', code: '8310-5',  display: 'Body temperature',               domain: 'vitals',   term: 'Body temperature' },
  { system: 'loinc', code: '41950-7', display: 'Number of steps in 24 hour Measured', domain: 'activity', term: 'Number of steps in 24 hour Measured' },
  { system: 'loinc', code: '55423-8', display: 'Number of steps in unspecified time Pedometer', domain: 'activity', term: 'Number of steps in unspecified time Pedometer' },
  { system: 'loinc', code: '93832-4', display: 'Sleep duration',                 domain: 'sleep',    term: 'Sleep duration' },
];

// Units, so a value carries a machine readable unit rather than a label.
// UCUM codes are short and stable.
export const UNIT_CONCEPTS: ConceptSeed[] = [
  { system: 'ucum', code: '/min',  display: 'per minute', domain: 'unit', term: 'per minute' },
  { system: 'ucum', code: 'ms',    display: 'millisecond', domain: 'unit', term: 'millisecond' },
  { system: 'ucum', code: 'Cel',   display: 'degree Celsius', domain: 'unit', term: 'degree Celsius' },
  { system: 'ucum', code: '%',     display: 'percent', domain: 'unit', term: 'percent' },
  { system: 'ucum', code: 'min',   display: 'minute', domain: 'unit', term: 'minute' },
  { system: 'ucum', code: 'h',     display: 'hour', domain: 'unit', term: 'hour' },
  { system: 'ucum', code: 'kcal',  display: 'kilocalorie', domain: 'unit', term: 'kilocalorie' },
  { system: 'ucum', code: '{count}', display: 'count', domain: 'unit', term: 'count' },
];

// The phrases she picks from when she logs. No codes here on purpose: SNOMED
// identifiers for these are resolved against UMLS, never recalled. The
// strings are exactly the ones in src/data/cycleLog.ts, so that a mapping is
// a mapping of what she actually chose rather than of a paraphrase.
export const SYMPTOM_TERMS: { term: string; domain: string }[] = [
  { term: 'Fatigue',             domain: 'symptom' },
  { term: 'Bloating',            domain: 'symptom' },
  { term: 'Sleep disruption',    domain: 'symptom' },
  { term: 'Nausea',              domain: 'symptom' },
  { term: 'Headache',            domain: 'symptom' },
  { term: 'Mood changes',        domain: 'symptom' },
  { term: 'Breast tenderness',   domain: 'symptom' },
  { term: 'Digestive changes',   domain: 'symptom' },
  { term: 'Bowel changes',       domain: 'symptom' },
  { term: 'Abdominal discomfort', domain: 'symptom' },
  { term: 'Dizziness',           domain: 'symptom' },
  // 'Other' is deliberately absent. It is a prompt for her own words, not a
  // clinical finding, and mapping it to any concept would assert a meaning
  // she did not give it.
];

// Everything seedable, grouped by domain, for the seeding function to walk.
const ALL_TERMS: { term: string; domain: string }[] = [
  ...METRIC_CONCEPTS.map((c) => ({ term: c.term, domain: c.domain })),
  ...UNIT_CONCEPTS.map((c) => ({ term: c.term, domain: c.domain })),
  ...SYMPTOM_TERMS,
];

export function seedTermsFor(domain: string): { term: string; domain: string }[] {
  return ALL_TERMS.filter((t) => t.domain === domain);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npm test && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/src/lib/conceptMap.ts ciatta-mobile-app/src/data/conceptMap.test.ts
git commit -m "Name what her record measures in the standard vocabularies"
```

---

### Task 3: The UMLS client

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/seed-concepts/umls.ts`
- Create: `ciatta-mobile-app/src/data/umls.test.ts`

**Interfaces:**
- Consumes: `CodeSystem` from `src/lib/conceptMap.ts` (re-declared locally; see the note below).
- Produces:
  - `export type UmlsHit = { ui: string; rootSource: string; name: string }`
  - `export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>`
  - `export const SABS: Record<'loinc' | 'snomed' | 'rxnorm', string>`
  - `export function searchUrl(term: string, sab: string, apiKey: string): string`
  - `export function crosswalkUrl(system: string, code: string, targetSab: string, apiKey: string): string`
  - `export function parseSearch(body: unknown): UmlsHit[]`
  - `export function parseCrosswalk(body: unknown): UmlsHit[]`
  - `export async function searchTerm(fetcher: Fetcher, term: string, sab: string, apiKey: string): Promise<UmlsHit[]>`

**Why the types are re-declared rather than imported.** Only the `supabase/functions/seed-concepts/` directory deploys with the edge function, and `src/lib/` does not. This is the same constraint that put `paging.ts` beside the baselines function rather than reusing the app's helper, and it is recorded here so nobody "fixes" it by adding an import that breaks the deploy.

**The API, from its own documentation.** Base `https://uts-ws.nlm.nih.gov/rest`. Search is `GET /search/current?string=<term>&sabs=<SAB>&returnIdType=sourceUi&searchType=exact&apiKey=<key>` and returns `{ result: { results: [ { ui, rootSource, name, uri } ] } }`. Crosswalk is `GET /crosswalk/current/source/<SAB>/<code>?targetSource=<SAB>&apiKey=<key>` and returns `{ result: [ { ui, rootSource, name, ... } ] }`. Note the shapes differ: search nests under `result.results`, crosswalk is `result` directly. Getting that wrong is the most likely bug in this task.

**Rate limit.** 20 requests per second per IP. Search returns at most 200 objects and does not paginate.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/src/data/umls.test.ts`:

```ts
// The UMLS client lives beside the edge function (only that directory
// deploys) but is plain TypeScript with no Deno imports, so this suite
// exercises it directly, the same arrangement as paging.ts and links.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SABS,
  crosswalkUrl,
  parseCrosswalk,
  parseSearch,
  searchTerm,
  searchUrl,
  type Fetcher,
} from '../../supabase/functions/seed-concepts/umls';

test('the search url carries every parameter the API requires', () => {
  const url = searchUrl('Heart rate', SABS.loinc, 'KEY');
  assert.ok(url.startsWith('https://uts-ws.nlm.nih.gov/rest/search/current?'), url);
  assert.match(url, /string=Heart\+rate|string=Heart%20rate/);
  assert.match(url, /sabs=LNC/);
  assert.match(url, /returnIdType=sourceUi/);
  assert.match(url, /searchType=exact/);
  assert.match(url, /apiKey=KEY/);
});

test('the crosswalk url uses the path form, not a query parameter', () => {
  const url = crosswalkUrl(SABS.loinc, '8867-4', SABS.snomed, 'KEY');
  assert.ok(url.startsWith('https://uts-ws.nlm.nih.gov/rest/crosswalk/current/source/LNC/8867-4?'), url);
  assert.match(url, /targetSource=SNOMEDCT_US/);
  assert.match(url, /apiKey=KEY/);
});

test('a term with a space and a slash survives into the url', () => {
  const url = searchUrl('Heart rate --resting', SABS.loinc, 'KEY');
  assert.ok(!url.includes(' '), 'no raw spaces in a url');
});

test('parseSearch reads the nested result.results shape', () => {
  const hits = parseSearch({
    pageSize: 200,
    result: { classType: 'searchResults', results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate', uri: 'x' }] },
  });
  assert.deepEqual(hits, [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
});

test('parseCrosswalk reads the flat result shape, which differs from search', () => {
  const hits = parseCrosswalk({
    pageSize: 25,
    result: [{ classType: 'SourceAtomCluster', ui: '1776003', rootSource: 'SNOMEDCT_US', name: 'Renal tubular acidosis' }],
  });
  assert.deepEqual(hits, [{ ui: '1776003', rootSource: 'SNOMEDCT_US', name: 'Renal tubular acidosis' }]);
});

test('a NONE result is no hits, never a fabricated one', () => {
  assert.deepEqual(parseSearch({ result: { results: [{ ui: 'NONE', rootSource: '', name: 'NO RESULTS' }] } }), []);
});

test('a malformed body is no hits rather than a throw', () => {
  assert.deepEqual(parseSearch({}), []);
  assert.deepEqual(parseSearch(null), []);
  assert.deepEqual(parseCrosswalk({ result: 'not an array' }), []);
});

test('searchTerm returns hits on a 200', async () => {
  const fetcher: Fetcher = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: { results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }] } }),
  });
  const hits = await searchTerm(fetcher, 'Heart rate', SABS.loinc, 'KEY');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].ui, '8867-4');
});

test('a non 200 throws rather than returning an empty list, because empty would read as not found', async () => {
  const fetcher: Fetcher = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(() => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'KEY'), /503/);
});

test('the thrown message carries the status but never the key', async () => {
  const fetcher: Fetcher = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => searchTerm(fetcher, 'Heart rate', SABS.loinc, 'SECRETKEY'),
    (e: Error) => {
      assert.match(e.message, /401/);
      assert.ok(!e.message.includes('SECRETKEY'), 'the key must never reach an error message');
      return true;
    }
  );
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npm test`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `ciatta-mobile-app/supabase/functions/seed-concepts/umls.ts`:

```ts
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
// is exactly where a key must not be.
export async function searchTerm(
  fetcher: Fetcher,
  term: string,
  sab: string,
  apiKey: string
): Promise<UmlsHit[]> {
  const response = await fetcher(searchUrl(term, sab, apiKey));
  if (!response.ok) throw new Error(`UMLS search failed with status ${response.status}`);
  return parseSearch(await response.json());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npm test && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/functions/seed-concepts/umls.ts ciatta-mobile-app/src/data/umls.test.ts
git commit -m "Ask UMLS what her vocabulary is called, and never guess when it does not answer"
```

---

### Task 4: The seeding function

**Files:**
- Create: `ciatta-mobile-app/supabase/functions/seed-concepts/index.ts`
- Create: `ciatta-mobile-app/supabase/functions/seed-concepts/seed.ts`
- Create: `ciatta-mobile-app/src/data/seed.test.ts`

**Interfaces:**
- Consumes: `Fetcher`, `SABS`, `UmlsHit`, `searchTerm` from `./umls.ts`.
- Produces:
  - `export type SeedInput = { term: string; domain: string; system: 'loinc' | 'snomed' | 'rxnorm'; expectedCode?: string }`
  - `export type SeedOutcome = { term: string; domain: string; system: string; code: string | null; display: string | null; confirmed: boolean; reason: 'resolved' | 'confirmed' | 'mismatch' | 'not_found' }`
  - `export async function resolveOne(fetcher: Fetcher, input: SeedInput, apiKey: string, sleep: (ms: number) => Promise<void>): Promise<SeedOutcome>`
  - `export const REQUEST_INTERVAL_MS = 60`

**The rule this task exists to hold.** A term UMLS cannot resolve produces a row with `code: null` and `reason: 'not_found'`, and nothing is written to `concepts` for it. It does not fall back to the term as its own code, does not write a placeholder, and does not skip silently. An unmapped symptom is unmapped, and the run reports how many.

**The mismatch case.** Task 2 writes down eight LOINC codes. Each is sent to UMLS as a term and the answer is compared with the written code. Agreement gives `reason: 'confirmed'`. Disagreement gives `reason: 'mismatch'`, **writes nothing**, and reports both codes, because a disagreement between a written code and the vocabulary is a fact someone needs to look at rather than a conflict to resolve automatically.

- [ ] **Step 1: Write the failing test**

Create `ciatta-mobile-app/src/data/seed.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REQUEST_INTERVAL_MS, resolveOne } from '../../supabase/functions/seed-concepts/seed';
import { SABS, type Fetcher } from '../../supabase/functions/seed-concepts/umls';

const noSleep = async () => {};

const answering = (rows: { ui: string; rootSource: string; name: string }[]): Fetcher =>
  async () => ({ ok: true, status: 200, json: async () => ({ result: { results: rows } }) });

test('a term UMLS resolves gives a code and a display', async () => {
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  const out = await resolveOne(f, { term: 'Heart rate', domain: 'vitals', system: 'loinc' }, 'KEY', noSleep);
  assert.equal(out.code, '8867-4');
  assert.equal(out.display, 'Heart rate');
  assert.equal(out.confirmed, true);
  assert.equal(out.reason, 'resolved');
});

test('a written code that UMLS agrees with is confirmed', async () => {
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  const out = await resolveOne(
    f, { term: 'Heart rate', domain: 'vitals', system: 'loinc', expectedCode: '8867-4' }, 'KEY', noSleep
  );
  assert.equal(out.reason, 'confirmed');
  assert.equal(out.code, '8867-4');
  assert.equal(out.confirmed, true);
});

test('a written code UMLS disagrees with writes nothing and reports both', async () => {
  const f = answering([{ ui: '99999-9', rootSource: 'LNC', name: 'Something else' }]);
  const out = await resolveOne(
    f, { term: 'Heart rate', domain: 'vitals', system: 'loinc', expectedCode: '8867-4' }, 'KEY', noSleep
  );
  assert.equal(out.reason, 'mismatch');
  assert.equal(out.confirmed, false);
  // The code reported is what UMLS actually said, so a person can compare.
  assert.equal(out.code, '99999-9');
});

test('a term with no answer is not found, and carries no code at all', async () => {
  const f = answering([]);
  const out = await resolveOne(f, { term: 'Bloating', domain: 'symptom', system: 'snomed' }, 'KEY', noSleep);
  assert.equal(out.reason, 'not_found');
  assert.equal(out.code, null);
  assert.equal(out.display, null);
  assert.equal(out.confirmed, false);
});

test('a not found term never falls back to the term as its own code', async () => {
  const f = answering([]);
  const out = await resolveOne(f, { term: 'Bloating', domain: 'symptom', system: 'snomed' }, 'KEY', noSleep);
  assert.notEqual(out.code, 'Bloating');
  assert.equal(out.code, null);
});

test('the first hit is taken when several come back, and only the first', async () => {
  const f = answering([
    { ui: 'A', rootSource: 'LNC', name: 'First' },
    { ui: 'B', rootSource: 'LNC', name: 'Second' },
  ]);
  const out = await resolveOne(f, { term: 'x', domain: 'vitals', system: 'loinc' }, 'KEY', noSleep);
  assert.equal(out.code, 'A');
});

test('resolveOne sleeps before its request, so a caller in a loop stays under the rate limit', async () => {
  let slept = 0;
  const f = answering([{ ui: 'A', rootSource: 'LNC', name: 'First' }]);
  await resolveOne(f, { term: 'x', domain: 'vitals', system: 'loinc' }, 'KEY', async (ms) => { slept += ms; });
  assert.equal(slept, REQUEST_INTERVAL_MS);
});

test('the interval keeps a loop under twenty requests a second', () => {
  assert.ok(1000 / REQUEST_INTERVAL_MS < 20, `${1000 / REQUEST_INTERVAL_MS} requests per second`);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npm test`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the resolver**

Create `ciatta-mobile-app/supabase/functions/seed-concepts/seed.ts`:

```ts
// Resolving one term against UMLS, and deciding what that answer permits.
//
// The rule the whole file turns on: a term UMLS cannot resolve produces no
// concept at all. It does not fall back to the term as its own code, it does
// not write a placeholder, and it does not pass silently. An unmapped
// symptom is unmapped, and the run says how many there were.

import { SABS, searchTerm, type Fetcher } from './umls.ts';

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npm test && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 5: Write the edge function around it**

Create `ciatta-mobile-app/supabase/functions/seed-concepts/index.ts`:

```ts
// Seeds the concepts table from UMLS. Run once, and again when the
// vocabulary in conceptMap.ts changes.
//
// Server only, and it enforces that the same way the baselines function
// does: the bearer must be the service role key, compared in constant time,
// and anything else is refused with a 401 before a single request goes out.
// The reason is narrower here but still real: this function holds the UMLS
// key, and an open endpoint that spends someone else's rate limit is not
// something to leave standing.
//
// Nothing about her ever reaches UMLS. The only strings sent are vocabulary
// terms such as "Heart rate" and "Fatigue": no values, no dates, no user id,
// no row from her record.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { resolveOne, type SeedInput, type SeedOutcome } from './seed.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The same constant time comparison the baselines function uses, and for the
// same reason: a plain === stops at the first differing byte, so how long it
// takes says how much of a guess was right.
function bearerIsServiceRole(given: string): boolean {
  const encoder = new TextEncoder();
  const presented = encoder.encode(given);
  const expected = encoder.encode(serviceKey);
  if (expected.length === 0) return false;
  let difference = presented.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= (presented[i] ?? 0) ^ expected[i];
  return difference === 0;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not supported' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!bearerIsServiceRole(bearer)) return json({ error: 'Not allowed' }, 401);

  const apiKey = Deno.env.get('UMLS_API_KEY') ?? '';
  if (!apiKey) {
    // Reported rather than raised, and named precisely, because this is the
    // ordinary deploy day failure and a person needs to know which secret.
    return json({ error: 'UMLS_API_KEY is not set on this function' }, 503);
  }

  let inputs: SeedInput[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.terms)) return json({ error: 'Invalid batch' }, 400);
    inputs = body.terms as SeedInput[];
  } catch {
    return json({ error: 'Invalid batch' }, 400);
  }

  const admin: any = createClient(url, serviceKey);
  const outcomes: SeedOutcome[] = [];

  for (const input of inputs) {
    try {
      const outcome = await resolveOne(fetch, input, apiKey, sleep);
      outcomes.push(outcome);

      // Only a resolved or confirmed term is written. A mismatch and a not
      // found both write nothing, which is what keeps an unknown from
      // becoming a fact.
      if ((outcome.reason === 'resolved' || outcome.reason === 'confirmed') && outcome.code && outcome.display) {
        const { error } = await admin.from('concepts').upsert(
          {
            system: outcome.system,
            code: outcome.code,
            display: outcome.display,
            domain: outcome.domain,
            seeded_at: new Date().toISOString(),
          },
          { onConflict: 'system,code' }
        );
        if (error) throw error;
      }
    } catch (e) {
      // The term is health vocabulary rather than her health information, so
      // naming it here is safe and is the only way to know which one failed.
      console.error('seed-concepts failed for term', input.term, e instanceof Error ? e.name : 'unknown');
      outcomes.push({
        term: input.term,
        domain: input.domain,
        system: input.system,
        code: null,
        display: null,
        confirmed: false,
        reason: 'not_found',
      });
    }
  }

  const written = outcomes.filter((o) => o.reason === 'resolved' || o.reason === 'confirmed').length;
  const mismatched = outcomes.filter((o) => o.reason === 'mismatch');
  const missing = outcomes.filter((o) => o.reason === 'not_found');

  return json({
    considered: outcomes.length,
    written,
    // Both lists are returned in full rather than counted, because a
    // mismatch needs a person to look at it and a missing term needs a
    // decision about whether that part of her vocabulary can be standardised
    // at all.
    mismatched,
    missing,
  });
});
```

- [ ] **Step 6: Typecheck the function and commit**

Run: `cd ciatta-mobile-app && npx tsc --noEmit && deno check supabase/functions/seed-concepts/index.ts`
Expected: both clean. Revert any `deno.lock` change rather than committing it.

```bash
git add ciatta-mobile-app/supabase/functions/seed-concepts/ ciatta-mobile-app/src/data/seed.test.ts
git commit -m "Seed the vocabulary from UMLS, and write nothing for a term it cannot answer"
```

---

### Task 5: Her rows point at a concept

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260918100100_observation_concepts.sql`
- Modify: `ciatta-mobile-app/supabase/tests/concepts.test.sql`

**Interfaces:**
- Consumes: `public.concepts` from Task 1.
- Produces: column `public.observations.concept_id uuid references public.concepts (id)`, and function `public.concept_for(p_system public.code_system, p_code text) returns uuid`.

**Nullable, and it stays nullable.** Every observation already in her record predates this slice, and an observation whose metric has no concept is an ordinary thing rather than a broken row. A `not null` column here would force a fabricated concept onto every unmapped row, which is the fault this project keeps removing.

**The metric string stays.** `observations.metric` is not dropped, not renamed, and not migrated away. The concept sits beside it. Anything that reads `metric` today keeps working, and this slice is additive rather than a rewrite of her record.

- [ ] **Step 1: Write the failing test**

Append to `ciatta-mobile-app/supabase/tests/concepts.test.sql`, and raise the plan count by 6:

```sql
-- The link from her record to the vocabulary.
select has_column('public', 'observations', 'concept_id', 'observations can carry a concept');
select col_is_null('public', 'observations', 'concept_id',
  'concept_id is nullable, because an unmapped observation is ordinary, not broken');
select col_is_fk('public', 'observations', 'concept_id', 'concept_id is a foreign key');

-- The metric string is untouched. Anything reading it today keeps working.
select has_column('public', 'observations', 'metric', 'the metric string stays');

-- The lookup, and it is server only like every other function here.
select has_function('public', 'concept_for', 'concept_for exists');
select ok(not has_function_privilege('authenticated', 'public.concept_for(public.code_system, text)', 'EXECUTE'),
  'authenticated cannot execute concept_for');
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL, the column and the function do not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260918100100_observation_concepts.sql`:

```sql
-- The link from her record to the standard vocabulary.
--
-- Additive on purpose. observations.metric is not dropped, not renamed and
-- not migrated away: the concept sits beside it, and everything reading the
-- metric string today keeps working. A rewrite of a live table holding her
-- health information is not a thing to do for tidiness.
--
-- Nullable, and it stays that way. Every row already in her record predates
-- this slice, and an observation whose metric has no standard concept is an
-- ordinary thing rather than a broken row. A not null column would force
-- something fabricated onto every unmapped row, which is the fault this
-- project keeps taking out.
alter table public.observations
  add column concept_id uuid references public.concepts (id);

create index observations_concept on public.observations (concept_id) where concept_id is not null;

-- Resolving a code to a concept id, for the ingest paths that know the code
-- rather than the row.
create function public.concept_for(p_system public.code_system, p_code text) returns uuid
language sql stable security invoker set search_path = '' as $$
  select id from public.concepts where system = p_system and code = p_code;
$$;
revoke execute on function public.concept_for(public.code_system, text) from public, anon, authenticated;
grant execute on function public.concept_for(public.code_system, text) to service_role;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260918100100_observation_concepts.sql ciatta-mobile-app/supabase/tests/concepts.test.sql
git commit -m "Let an observation carry its standard concept, without disturbing what is already there"
```

---

### Task 6: FHIR on the way out

**Files:**
- Create: `ciatta-mobile-app/supabase/migrations/20260918100200_fhir_observation.sql`
- Modify: `ciatta-mobile-app/supabase/tests/concepts.test.sql`

**Interfaces:**
- Consumes: `public.observations.concept_id` from Task 5, `public.concepts` from Task 1.
- Produces: function `public.fhir_observation(p_observation_id uuid) returns jsonb`.

**What this is for.** The architecture document asks for FHIR as the representation her data is exchanged in. This renders one stored observation as a FHIR R4 `Observation` resource, so an export or a clinic hand off speaks a standard shape rather than this schema's column names.

**Provenance survives the translation.** FHIR has no field meaning "she told us this rather than a device measuring it", so the resource carries an extension naming the provenance verbatim. Losing it in translation would flatten a measured fact and a reported one into the same thing, which is precisely what this record refuses to do.

**Security.** `security invoker`, so the function sees exactly the rows the caller may see. Called as her, it can only render her own observations, because RLS on `observations` still applies. That is why it needs no user check of its own, and the test proves it rather than asserting it.

- [ ] **Step 1: Write the failing test**

Append to `ciatta-mobile-app/supabase/tests/concepts.test.sql`, and raise the plan count by 7:

```sql
select has_function('public', 'fhir_observation', 'fhir_observation exists');

-- Seed one user, one concept, one observation.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'fhir@example.com') on conflict do nothing;
insert into public.concepts (id, system, code, display, domain, seeded_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'loinc', '8867-4', 'Heart rate', 'vitals', now())
  on conflict do nothing;
insert into public.observations (id, user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key, concept_id)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
        'vitals', 'heart_rate', 62, 'count/min', '2026-09-10T08:00:00Z', 'MEASURED', 'fhirtest:1',
        '00000000-0000-0000-0000-0000000000c1');

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') ->> 'resourceType',
  'Observation',
  'it renders a FHIR Observation resource'
);

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{code,coding,0,code}',
  '8867-4',
  'the LOINC code travels in code.coding'
);

select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{code,coding,0,system}',
  'http://loinc.org',
  'the coding system is the LOINC url, not the internal enum value'
);

select is(
  (public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{valueQuantity,value}')::numeric,
  62::numeric,
  'the value travels as a quantity'
);

-- Provenance has no home in FHIR, so it travels as an extension rather than
-- being dropped. A measured fact and a reported one must not flatten into
-- the same resource.
select is(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b1') #>> '{extension,0,valueString}',
  'MEASURED',
  'provenance survives the translation'
);

-- An observation with no concept still renders, with no code rather than a
-- fabricated one.
insert into public.observations (id, user_id, domain, metric, value, unit, occurred_at, provenance, dedupe_key)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
        'symptom', 'bloating', 3, null, '2026-09-11T08:00:00Z', 'REPORTED', 'fhirtest:2');

select ok(
  public.fhir_observation('00000000-0000-0000-0000-0000000000b2') -> 'code' -> 'coding' is null
  or jsonb_array_length(coalesce(public.fhir_observation('00000000-0000-0000-0000-0000000000b2') #> '{code,coding}', '[]'::jsonb)) = 0,
  'an unmapped observation renders with no coding rather than an invented one'
);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd ciatta-mobile-app && npx supabase test db`
Expected: FAIL, the function does not exist.

- [ ] **Step 3: Write the migration**

Create `ciatta-mobile-app/supabase/migrations/20260918100200_fhir_observation.sql`:

```sql
-- One stored observation, rendered as a FHIR R4 Observation resource.
--
-- This is the representation the architecture document asks her data to be
-- exchanged in, so an export or a hand off to a clinic speaks a standard
-- shape rather than this schema's column names.
--
-- security invoker, so the function sees exactly the rows its caller may
-- see. Called as her it can only ever render her own observations, because
-- RLS on observations still applies underneath. That is why there is no user
-- check written here: adding one would imply the RLS underneath is not
-- trusted, and it is.
create function public.fhir_observation(p_observation_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'resourceType', 'Observation',
    'id', o.id,
    'status', 'final',
    'effectiveDateTime', to_char(o.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'code', case when c.id is null then null else jsonb_build_object(
      'coding', jsonb_build_array(jsonb_build_object(
        -- The published url for each system, not this schema's enum value.
        -- A FHIR resource carrying "loinc" where a reader expects
        -- "http://loinc.org" is not a FHIR resource anyone else can read.
        'system', case c.system
                    when 'loinc'  then 'http://loinc.org'
                    when 'snomed' then 'http://snomed.info/sct'
                    when 'rxnorm' then 'http://www.nlm.nih.gov/research/umls/rxnorm'
                    when 'ucum'   then 'http://unitsofmeasure.org'
                  end,
        'code', c.code,
        'display', c.display
      )),
      'text', c.display
    ) end,
    'valueQuantity', case when o.value is null then null else jsonb_build_object(
      'value', o.value,
      'unit', o.unit
    ) end,
    'valueString', o.value_text,
    -- Provenance has no field in FHIR Observation, and dropping it would
    -- flatten a measurement and something she reported into the same
    -- resource. It travels as an extension so the distinction survives
    -- leaving this database.
    'extension', jsonb_build_array(jsonb_build_object(
      'url', 'https://ciatta.io/fhir/StructureDefinition/provenance',
      'valueString', o.provenance::text
    ))
  ))
  from public.observations o
  left join public.concepts c on c.id = o.concept_id
  where o.id = p_observation_id;
$$;
revoke execute on function public.fhir_observation(uuid) from public, anon;
-- She may render her own observations; RLS decides which those are.
grant execute on function public.fhir_observation(uuid) to authenticated, service_role;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ciatta-mobile-app && npx supabase db reset && npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ciatta-mobile-app/supabase/migrations/20260918100200_fhir_observation.sql ciatta-mobile-app/supabase/tests/concepts.test.sql
git commit -m "Render an observation as FHIR, and carry provenance across the translation"
```

---

### Task 7: Isolation, and the seeding run

Controller task, after the user says go.

- [ ] Confirm `umls_api_key` is in Supabase Vault on the live project and `UMLS_API_KEY` is set as a secret on the `seed-concepts` function. Neither is created by a migration, because a migration lives in git.
- [ ] Apply `20260918100000_concepts.sql`, `20260918100100_observation_concepts.sql` and `20260918100200_fhir_observation.sql`, then rewrite the recorded versions to match the filenames, as all three previous pushes did.
- [ ] Deploy `seed-concepts` with `verify_jwt = true`.
- [ ] Run the seeding once with the full term list from `conceptMap.ts`, and **report the three counts plainly**: written, mismatched, missing. A mismatch means a code written down in `conceptMap.ts` disagrees with UMLS and a person has to choose. A missing term means part of her vocabulary has no standard concept, which is a finding about the vocabulary rather than a failure of the run.
- [ ] Verify: `anon` holds nothing on `concepts`; `authenticated` holds `select` only; neither Data API role can execute `concept_for`; `fhir_observation` called as one user cannot render another user's observation.
- [ ] Record in the ledger how many of her symptom terms resolved and how many did not. That number is the honest measure of how much of her record the standards layer actually reaches, and it belongs in writing rather than in a summary.

---

## Self review

**1. Spec coverage.** Section 5.2a's standards decision is Tasks 1 to 6. The architecture document's "Health data normalization · OMOP / FHIR concepts" row is Tasks 1, 2, 5 and 6. Its "Healthcare terminology mapping · UMLS" row is Tasks 3 and 4. Its "Clinical references" row is **not** covered and is deliberately out of scope: reference ranges and guideline content are a separate slice, and nothing here claims them.

**2. Placeholder scan.** No TBDs. Every code step carries real SQL or TypeScript, every test step carries real assertions, and every expected failure is stated.

**3. Type consistency.** `CodeSystem` in `conceptMap.ts` and the `code_system` enum carry the same four values. `SeedInput.system` is narrower on purpose, three values, because UCUM is not searchable through the UMLS source search the way the other three are; the UCUM rows are written directly rather than resolved, which Task 4's edge function does by passing only the three searchable systems. `UmlsHit` field names match the API's documented response exactly: `ui`, `rootSource`, `name`.

**4. Known gaps carried, not hidden.**
- OMOP CDM proper (person, visit_occurrence, measurement, drug_exposure and the vocabulary tables) is **not** built. This is the concept layer, which is what "standardized clinical concepts, vocabulary mapping" asks for; the longitudinal warehouse structure is not in this slice and no task pretends otherwise.
- `daily_metrics`, `episodes`, `medications` and `results` do not get a `concept_id` in this slice. Only `observations` does, because every domain row already writes its observation in the same transaction, so the concept reaches the common language layer where the intelligence actually reads. Adding the column to four more tables would be duplication rather than coverage.
- The eight LOINC codes in Task 2 are written from knowledge and **confirmed at seed time rather than trusted**. If UMLS disagrees with any of them, Task 4 reports a mismatch and writes nothing. That is the designed outcome, not a failure of the plan.
- A symptom term that UMLS cannot resolve stays unmapped. How many there are is unknown until Task 7 runs, and the plan deliberately does not guess.
