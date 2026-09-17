import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REQUEST_INTERVAL_MS,
  planBatch,
  runSeed,
  resolveOne,
  type ConceptRow,
  type SeedOutcome,
  type SeedReport,
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
  // The failed term did not complete, which is not the same fact as UMLS
  // having no answer for it, so it is not in missing. The run continued.
  assert.deepEqual(report.missing, []);
  assert.equal(report.unreached.length, 1);
  assert.equal(report.unreached[0].term, 'Fatigue');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].code, '123456');
});

// A failure to reach UMLS and a failure to write to the database are both
// "the attempt did not complete", and neither is a fact about the vocabulary.
// Reporting either as not_found would put a false sentence in front of the
// operator: a claim about what UMLS says, made on evidence about something
// else entirely. They are separated here because they need different actions,
// a retry against a look at the database.

test('a request that does not complete is unavailable, never a statement about the vocabulary', async () => {
  const writes: ConceptRow[] = [];
  const f: Fetcher = async () => {
    throw new Error('UMLS search failed: the request did not complete');
  };
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Fatigue']
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(report.missing, [], 'a failed request was reported as UMLS having no answer');
  assert.equal(report.unreached.length, 1);
  assert.equal(report.unreached[0].term, 'Fatigue');
  assert.equal(report.unreached[0].reason, 'unavailable');
  assert.equal(report.unreached[0].stage, 'search');
  assert.equal(report.unreached[0].code, null);
  assert.equal(report.unreached[0].confirmed, false);
});

test('a database write that fails is never reported as UMLS having no answer', async () => {
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async () => { throw new Error('insert failed'); } },
    ['Heart rate']
  );
  assert.deepEqual(report.missing, [], 'a database failure was reported as a fact about the vocabulary');
  assert.equal(report.written, 0);
  assert.equal(report.unwritten.length, 1);
  assert.equal(report.unwritten[0].term, 'Heart rate');
  assert.equal(report.unwritten[0].reason, 'unavailable');
  assert.equal(report.unwritten[0].stage, 'write');
  // UMLS did answer, so what it said is kept rather than nulled. The code is
  // not in the table, but it is not unknown either.
  assert.equal(report.unwritten[0].code, '8867-4');
});

test('a unit whose write fails is not reported as a term UMLS could not resolve', async () => {
  // UMLS is never asked about a unit at all, so a ucum row appearing in a
  // list of terms UMLS had no answer for would be nonsense.
  const report = await runSeed(
    { fetcher: answering([]), apiKey: 'KEY', sleep: noSleep, write: async () => { throw new Error('insert failed'); } },
    ['percent']
  );
  assert.deepEqual(report.missing, []);
  assert.equal(report.written, 0);
  assert.equal(report.unwritten.length, 1);
  assert.equal(report.unwritten[0].system, 'ucum');
  assert.equal(report.unwritten[0].stage, 'write');
  assert.equal(report.unwritten[0].confirmed, false);
});

test('the three failure kinds land in three lists, because each needs a different action', async () => {
  const f: Fetcher = async (url) => {
    const term = new URL(url).searchParams.get('string') ?? '';
    if (term === 'Fatigue') throw new Error('UMLS search failed: the request did not complete');
    if (term === 'Bloating') return { ok: true, status: 200, json: async () => ({ result: { results: [] } }) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: { results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }] } }),
    };
  };
  const report = await runSeed(
    {
      fetcher: f,
      apiKey: 'KEY',
      sleep: noSleep,
      write: async (row) => { if (row.code === '8867-4') throw new Error('insert failed'); },
    },
    ['Bloating', 'Fatigue', 'Heart rate']
  );
  assert.deepEqual(report.missing.map((o) => o.term), ['Bloating'], 'missing must hold only a genuine absence');
  assert.deepEqual(report.unreached.map((o) => o.term), ['Fatigue']);
  assert.deepEqual(report.unwritten.map((o) => o.term), ['Heart rate']);
  assert.equal(report.written, 0);
});

// A repeated term is one concept, and the vocabulary is the same for everyone,
// so planning it twice buys nothing and spends the rate limit twice.
test('a repeated term is planned once, so a batch cannot multiply requests', () => {
  const plan = planBatch(['Heart rate', 'Heart rate', 'Heart rate']);
  assert.deepEqual(plan.refused, []);
  assert.equal(plan.planned.length, 1);
});

test('a repeated term issues one request rather than one per occurrence', async () => {
  let requests = 0;
  const f: Fetcher = async () => {
    requests += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: { results: [{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }] } }),
    };
  };
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async () => {} },
    new Array(50).fill('Heart rate')
  );
  assert.equal(requests, 1, 'a repeated term spent the rate limit once per occurrence');
  assert.equal(report.considered, 1);
  assert.equal(report.written, 1);
});

// Deduplication keys on the term, and a value that is not a string has no
// term. `String(['Heart rate'])` is `'Heart rate'`, and that value is
// reachable over the wire: JSON.parse of `{"terms":["Heart rate",["Heart
// rate"]]}` hands the function a nested array. Keying the seen set on a
// stringified non string made an off list value collide with a legitimate one,
// and the collision behaved differently depending on array order, so both
// orders are pinned here.

test('a non string that stringifies to a vocabulary term is refused, not silently dropped', () => {
  // The dangerous order. The string is seen first, so the nested array was
  // deduplicated away and never refused: the batch wrote as if it were clean,
  // which loses the all or nothing guarantee for exactly this input.
  const plan = planBatch(['Heart rate', ['Heart rate']]);
  assert.equal(plan.refused.length, 1, 'a non string was silently dropped instead of refusing the batch');
  assert.equal(plan.planned.length, 1);
});

test('a non string that stringifies to a vocabulary term never writes, whatever the order', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '8867-4', rootSource: 'LNC', name: 'Heart rate' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Heart rate', ['Heart rate']]
  );
  assert.deepEqual(writes, [], 'an off list value rode in beside a legitimate one and the batch still wrote');
  assert.equal(report.written, 0);
  assert.equal(report.refused.length, 1);
});

test('a non string does not cause a term that is in the vocabulary to be reported as off list', () => {
  // The other order. Here the nested array was seen first, so the genuine
  // 'Heart rate' that followed was deduplicated away and never planned, and
  // the operator was told a term that is in the vocabulary is not in it.
  const plan = planBatch([['Heart rate'], 'Heart rate']);
  assert.equal(
    plan.planned.length,
    1,
    'a term that is in the vocabulary was dropped because a non string stringified to it'
  );
  assert.equal(plan.refused.length, 1);
});

test('both orderings of the same two values agree, so behaviour does not depend on array order', () => {
  const a = planBatch(['Heart rate', ['Heart rate']]);
  const b = planBatch([['Heart rate'], 'Heart rate']);
  assert.equal(a.planned.length, b.planned.length);
  assert.equal(a.refused.length, b.refused.length);
});

test('a refused non string is labelled so it cannot be mistaken for a vocabulary term', () => {
  // The sentence an operator reads must not be capable of naming something
  // that is in the vocabulary. String(['Heart rate']) is 'Heart rate', which
  // reads as a refusal of the real term and is the whole reason this label
  // changed. JSON.stringify renders ["Heart rate"], which collides with
  // nothing, because no vocabulary term contains a bracket or a quote.
  const plan = planBatch([['Heart rate'], 'Heart rate']);
  assert.deepEqual(plan.refused, ['["Heart rate"]']);
  assert.notDeepEqual(
    plan.refused,
    ['Heart rate'],
    'the refused label names a term that is in the vocabulary'
  );
  // The legitimate term is still planned, so the refusal is about the nested
  // array alone rather than about the term it stringified to.
  assert.equal(plan.planned.length, 1);
});

test('a value with no JSON rendering is still labelled as a string', () => {
  // JSON.stringify returns undefined rather than a string for undefined, a
  // function and a symbol, which would put a non string into the
  // refused: string[] it is pushed onto. This is unreachable over the wire,
  // because requested arrives from JSON.parse and JSON has no undefined, no
  // function and no symbol. It is reachable here, because planBatch and
  // runSeed are exported and the next caller may not come over the wire.
  const plan = planBatch([undefined, () => {}]);
  assert.equal(plan.refused.length, 2);
  for (const label of plan.refused) {
    assert.equal(typeof label, 'string', 'a value that is not a string reached refused: string[]');
  }
  assert.equal(plan.refused[0], 'undefined');
  assert.deepEqual(plan.planned, []);
});

test('an off list string is still labelled as itself, not as a quoted value', () => {
  // Only a non string gets the JSON rendering. A genuine off list term is
  // reported exactly as the caller sent it, because that is what they need to
  // see to correct it.
  assert.deepEqual(planBatch(['Sudden inexplicable dread']).refused, ['Sudden inexplicable dread']);
});

test('a repeated off list term is refused once rather than once per occurrence', () => {
  const plan = planBatch(['Sudden inexplicable dread', 'Sudden inexplicable dread']);
  assert.deepEqual(plan.refused, ['Sudden inexplicable dread']);
  assert.deepEqual(plan.planned, []);
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

// The conservation law, and it is the structural assertion rather than a test
// of one branch.
//
// Every test above asserts on a list the code populates. None of them could
// assert on the list the code forgot, because a test written from the four
// lists can only ever check the four lists: an outcome that falls out of all
// of them is invisible to every one of those assertions, and the run still
// reports considered: 1, written: 0 with every list empty. That is a term
// vanishing, and nothing in the suite said a word about it.
//
// So this counts the report's own shape rather than a list of names written
// down here. Every array on the report except refused is an outcome list, so
// summing all of them plus written must come back to considered. A new list
// added later is counted automatically, and an outcome that reaches no list at
// all fails here whatever the reason on it happens to be.
//
// refused is excluded because a refused batch considers nothing: the run
// returns considered: 0 before any term is touched, so refused entries are not
// outcomes and counting them would break the identity in the other direction.
function accountedFor(report: SeedReport): number {
  const lists = Object.entries(report).filter(
    ([name, value]) => name !== 'refused' && Array.isArray(value)
  ) as [string, SeedOutcome[]][];
  return report.written + lists.reduce((total, [, list]) => total + list.length, 0);
}

function assertConserved(report: SeedReport, what: string): void {
  assert.equal(
    accountedFor(report),
    report.considered,
    `${what}: ${report.considered} considered but ${accountedFor(report)} accounted for, so a term is reported nowhere`
  );
}

// UMLS can answer with a real code and no usable name. umls.ts sets name to ''
// when the field is absent or not a string, which resolveOne turns into
// display: null, and a row with no display cannot be written because display is
// not null in the table. The term is not missing, because UMLS answered. It is
// not unwritten either, because the database was never asked and there is
// nothing wrong with it. It has its own reason so that the operator is sent to
// the UMLS record rather than to a healthy database.
test('a hit with a code but no display is reported rather than vanishing', async () => {
  const writes: ConceptRow[] = [];
  const f = answering([{ ui: '123456', rootSource: 'SNOMEDCT_US', name: '' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async (row) => { writes.push(row); } },
    ['Bloating']
  );
  assert.deepEqual(writes, [], 'a concept with no display reached the table');
  assert.equal(report.considered, 1);
  assert.equal(report.written, 0);
  assert.equal(report.unusable.length, 1, 'a term UMLS answered for was reported in no list at all');
  assert.equal(report.unusable[0].term, 'Bloating');
  // The code is kept. UMLS did answer, and the operator needs the code to look
  // the record up.
  assert.equal(report.unusable[0].code, '123456');
  assert.equal(report.unusable[0].display, null);
  assert.equal(report.unusable[0].reason, 'unusable');
  // What UMLS said is kept rather than rewritten, the same way the unwritten
  // branch keeps it. confirmed records whether UMLS confirmed the concept, not
  // whether the row reached the table, and UMLS did answer here.
  assert.equal(report.unusable[0].confirmed, true);
  // UMLS answered, so this is not a statement about the vocabulary having
  // nothing, and the database is not at fault either.
  assert.deepEqual(report.missing, [], 'a term UMLS answered for was reported as an absence');
  assert.deepEqual(report.unwritten, [], 'a healthy database was reported as the thing to look at');
  assertConserved(report, 'a hit with a code but no display');
});

test('a run conserves every term it considered, whatever happened to each one', async () => {
  // One run carrying every outcome the code can produce: a clean write, a
  // mismatch, a genuine absence, a request that did not complete, a write that
  // failed, a unit written with no request, and a hit with no usable name.
  const f: Fetcher = async (url) => {
    const term = new URL(url).searchParams.get('string') ?? '';
    if (term === 'Fatigue') throw new Error('UMLS search failed: the request did not complete');
    if (term === 'Bloating') return { ok: true, status: 200, json: async () => ({ result: { results: [] } }) };
    if (term === 'Nausea') {
      // A real code with no usable name.
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { results: [{ ui: '422587007', rootSource: 'SNOMEDCT_US' }] } }),
      };
    }
    if (term === 'Heart rate') {
      // Disagrees with the code written down in the vocabulary.
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { results: [{ ui: '99999-9', rootSource: 'LNC', name: 'Something else' }] } }),
      };
    }
    if (term === 'Headache') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { results: [{ ui: '25064002', rootSource: 'SNOMEDCT_US', name: 'Headache' }] } }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: { results: [{ ui: '9279-1', rootSource: 'LNC', name: 'Respiratory rate' }] } }),
    };
  };
  const report = await runSeed(
    {
      fetcher: f,
      apiKey: 'KEY',
      sleep: noSleep,
      // The respiratory rate write is the one that fails, so unwritten is
      // populated too.
      write: async (row) => { if (row.code === '9279-1') throw new Error('insert failed'); },
    },
    ['Headache', 'Bloating', 'Fatigue', 'Nausea', 'Heart rate', 'Respiratory rate', 'percent']
  );

  assert.equal(report.considered, 7);
  assertConserved(report, 'a run carrying every outcome kind');

  // And the terms landed where an operator would look for them, so the
  // identity above is not satisfied by pooling two of them.
  assert.deepEqual(report.missing.map((o) => o.term), ['Bloating']);
  assert.deepEqual(report.unreached.map((o) => o.term), ['Fatigue']);
  assert.deepEqual(report.unwritten.map((o) => o.term), ['Respiratory rate']);
  assert.deepEqual(report.mismatched.map((o) => o.term), ['Heart rate']);
  assert.deepEqual(report.unusable.map((o) => o.term), ['Nausea']);
  // Headache resolved and wrote, percent is a unit written with no request.
  assert.equal(report.written, 2);
});

test('the conservation law holds for a run where nothing goes wrong at all', async () => {
  const f = answering([{ ui: '25064002', rootSource: 'SNOMEDCT_US', name: 'Headache' }]);
  const report = await runSeed(
    { fetcher: f, apiKey: 'KEY', sleep: noSleep, write: async () => {} },
    ['Headache', 'percent']
  );
  assert.equal(report.written, 2);
  assertConserved(report, 'a run where every term wrote');
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
