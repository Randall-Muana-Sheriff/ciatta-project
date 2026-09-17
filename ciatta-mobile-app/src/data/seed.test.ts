import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REQUEST_INTERVAL_MS,
  planBatch,
  runSeed,
  resolveOne,
  type ConceptRow,
} from '../../supabase/functions/seed-concepts/seed';
import { SABS, type Fetcher } from '../../supabase/functions/seed-concepts/umls';
import {
  METRIC_CONCEPTS as FUNCTION_METRICS,
  SYMPTOM_TERMS as FUNCTION_SYMPTOMS,
  UNIT_CONCEPTS as FUNCTION_UNITS,
} from '../../supabase/functions/seed-concepts/vocabulary';
import { METRIC_CONCEPTS, SYMPTOM_TERMS, UNIT_CONCEPTS } from '../lib/conceptMap';

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

// Everything below this line is additional to the brief. The brief's suite
// covers resolveOne alone, which is one term at a time and writes nothing.
// The tests below cover the part that decides what may be written at all.

test('resolveOne sleeps before the request rather than after it', async () => {
  // The brief's test proves the sleep happened, not that it happened first,
  // and those are different properties: sleeping afterwards still totals the
  // same milliseconds while letting a loop fire its first two requests back
  // to back. The order is the whole enforcement, so it is pinned separately.
  const order: string[] = [];
  const f: Fetcher = async () => {
    order.push('request');
    return { ok: true, status: 200, json: async () => ({ result: { results: [] } }) };
  };
  await resolveOne(f, { term: 'x', domain: 'vitals', system: 'loinc' }, 'KEY', async () => {
    order.push('sleep');
  });
  assert.deepEqual(order, ['sleep', 'request']);
});

// The function directory is the only thing that deploys, so it carries its own
// copy of the vocabulary. These two tests are what make that copy safe: a term
// added, removed or reworded in src/lib/conceptMap.ts without the same edit
// here fails the suite rather than silently seeding a different vocabulary
// than the app believes in.
test('the function copy of the vocabulary has not drifted from conceptMap.ts', () => {
  assert.deepEqual(
    FUNCTION_METRICS,
    METRIC_CONCEPTS,
    'METRIC_CONCEPTS in the seed function has drifted from src/lib/conceptMap.ts'
  );
  assert.deepEqual(
    FUNCTION_UNITS,
    UNIT_CONCEPTS,
    'UNIT_CONCEPTS in the seed function has drifted from src/lib/conceptMap.ts'
  );
  assert.deepEqual(
    FUNCTION_SYMPTOMS,
    SYMPTOM_TERMS,
    'SYMPTOM_TERMS in the seed function has drifted from src/lib/conceptMap.ts'
  );
});

test('every term in the vocabulary is unique, so a term names exactly one concept', () => {
  const terms = [
    ...FUNCTION_METRICS.map((c) => c.term),
    ...FUNCTION_UNITS.map((c) => c.term),
    ...FUNCTION_SYMPTOMS.map((s) => s.term),
  ];
  assert.equal(new Set(terms).size, terms.length, 'two vocabulary entries share a term');
});

// The invariant the whole table rests on. concepts has no RLS and no owner,
// which is only safe while the vocabulary is a static compiled in list. A
// concept created because one woman logged an unmapped term would make the
// table an aggregate activity log: a rare code plus a readable created_at
// tells any signed in user that somebody logged that symptom at that hour.
test('a term that is not in the vocabulary is refused, and nothing at all is written', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '123456', rootSource: 'SNOMEDCT_US', name: 'Some finding' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Sudden inexplicable dread']
  );
  assert.deepEqual(writes, [], 'a term from outside the vocabulary reached the table');
  assert.deepEqual(report.refused, ['Sudden inexplicable dread']);
  assert.equal(report.written, 0);
  assert.equal(report.considered, 0);
});

test('one unknown term refuses the whole batch, so nothing rides in beside it', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Heart rate', 'Sudden inexplicable dread']
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(report.refused, ['Sudden inexplicable dread']);
});

test('planBatch takes the system and the domain from the vocabulary, never from the caller', () => {
  // The caller names a term and nothing else. There is no request shape that
  // can say which system or domain a term belongs to, which is what stops a
  // caller writing an arbitrary row through a legitimate term.
  const plan = planBatch(['Heart rate', 'Fatigue']);
  assert.deepEqual(plan.refused, []);
  assert.deepEqual(plan.planned, [
    { kind: 'resolve', input: { term: 'Heart rate', domain: 'vitals', system: 'loinc', expectedCode: '8867-4' } },
    { kind: 'resolve', input: { term: 'Fatigue', domain: 'symptom', system: 'snomed' } },
  ]);
});

test('a symptom is planned with no expected code, because a SNOMED id is resolved and never recalled', () => {
  const entry = planBatch(['Nausea']).planned[0];
  assert.equal(entry.kind, 'resolve');
  if (entry.kind !== 'resolve') return;
  assert.equal(entry.input.expectedCode, undefined);
});

test('planBatch with no request plans the whole vocabulary and refuses nothing', () => {
  const plan = planBatch(null);
  assert.deepEqual(plan.refused, []);
  assert.equal(
    plan.planned.length,
    FUNCTION_METRICS.length + FUNCTION_UNITS.length + FUNCTION_SYMPTOMS.length
  );
});

test('a mismatch between a written code and UMLS writes nothing and is reported in full', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '99999-9', rootSource: 'LNC', name: 'Something else' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Heart rate']
  );
  assert.deepEqual(writes, [], 'a mismatched code was written');
  assert.equal(report.written, 0);
  assert.equal(report.mismatched.length, 1);
  assert.equal(report.mismatched[0].code, '99999-9');
  assert.equal(report.mismatched[0].term, 'Heart rate');
});

test('a term UMLS cannot answer writes nothing and is counted as missing', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Bloating']
  );
  assert.deepEqual(writes, []);
  assert.equal(report.written, 0);
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0].term, 'Bloating');
  assert.equal(report.missing[0].code, null);
});

test('a request that fails writes nothing for that term and does not stop the run', async () => {
  const writes: ConceptRow[] = [];
  let call = 0;
  const f: Fetcher = async () => {
    call += 1;
    if (call === 1) throw new Error('UMLS search failed: the request did not complete');
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: { results: [{ ui: '123456', rootSource: 'SNOMEDCT_US', name: 'Bloating' }] } }),
    };
  };
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Fatigue', 'Bloating']
  );
  // The failed term is unresolved, not absent, and the run continued.
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0].term, 'Fatigue');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].code, '123456');
});

// Units never go through UMLS. SABS has no UCUM entry, so there is no search
// that could confirm one, and a seeded_at date on a unit row would assert a
// confirmation that never happened.
test('a unit is written straight from the vocabulary, with no UMLS request at all', async () => {
  const writes: ConceptRow[] = [];
  let requests = 0;
  const f: Fetcher = async () => {
    requests += 1;
    return { ok: true, status: 200, json: async () => ({ result: { results: [] } }) };
  };
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['degree Celsius']
  );
  assert.equal(requests, 0, 'a unit term was sent to UMLS, which cannot answer for UCUM');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].system, 'ucum');
  assert.equal(writes[0].code, 'Cel');
  assert.equal(writes[0].display, 'degree Celsius');
  assert.equal(report.written, 1);
});

test('a unit row carries no seeded_at, because UMLS never confirmed it', async () => {
  const writes: ConceptRow[] = [];
  await runSeed(
    { fetcher: answering([]), apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['percent']
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].seeded_at, null, 'a unit row claimed a UMLS confirmation that never happened');
});

test('a confirmed code does carry a seeded_at, because UMLS did confirm it', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Heart rate']
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].code, '8867-4');
  assert.ok(typeof writes[0].seeded_at === 'string' && writes[0].seeded_at.length > 0);
});

test('nothing but a vocabulary term is ever sent to UMLS', async () => {
  // No values, no dates, no user id. The only strings that leave are the same
  // for every woman using the app.
  const sent: string[] = [];
  const f: Fetcher = async (url) => {
    sent.push(url);
    return { ok: true, status: 200, json: async () => ({ result: { results: [] } }) };
  };
  await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async () => {} },
    ['Fatigue', 'Headache']
  );
  assert.equal(sent.length, 2);
  for (const url of sent) {
    const string = new URL(url).searchParams.get('string') ?? '';
    assert.ok(
      FUNCTION_SYMPTOMS.some((s) => s.term === string),
      `a string that is not a vocabulary term was sent to UMLS: ${string}`
    );
  }
});

test('the symptoms are sent to snomed and the metrics to loinc, which is what SABS says', () => {
  for (const entry of planBatch(null).planned) {
    if (entry.kind === 'resolve' && entry.input.domain === 'symptom') {
      assert.equal(entry.input.system, 'snomed');
    }
  }
  const heart = planBatch(['Heart rate']).planned[0];
  assert.equal(heart.kind, 'resolve');
  if (heart.kind !== 'resolve') return;
  assert.equal(SABS[heart.input.system], 'LNC');
});
