// A clinical AI analysis of one lab report she added.
//
// Runs as her: the database client carries her JWT, so every read is hers
// under RLS. The facts are gathered here from her rows (the cycle is the
// one exception, sent by the app in an exact shape). The model is given
// only those facts and a strict schema. Its answer is checked against
// them (check.ts) and retried once with the reasons. If it still fails,
// nothing is stored and she is told plainly.
//
// It never prescribes, doses, or tells her to start or stop a medication;
// the check refuses an answer that does.
//
// Logging: counts, the model name and rejection reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { ANALYSIS_SCHEMA, type Analysis, checkAnalysis, readAnalysis } from './check.ts';
import { fakeAnalysis } from './fake.ts';
import { type Facts, type FactTest, fingerprint, readCycle } from './facts.ts';
import { testKey } from './keys.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o';
const CONSIDERATIONS_OFF = Deno.env.get('LAB_ANALYSIS_CONSIDERATIONS') === 'off';
// The fake model only ever runs against a local stack.
const FAKE_ALLOWED = Deno.env.get('LAB_ANALYSIS_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);

const NOT_CHECKED = 'The analysis could not be checked, so it is not shown. Your results above are unaffected.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const INSTRUCTIONS = [
  'You are a clinical laboratory consultant writing for the patient whose results these are. Write plainly, warmly and precisely.',
  'Use only the facts given. Quote every value exactly as given, with its unit. Do not compute percentages, ratios or differences that are not in the facts.',
  'urgent: results that need prompt attention, first among them any result flagged HH, LL or AA, with action contact_today or urgent_care. Empty when nothing is urgent.',
  'summary: two or three sentences on what this report shows.',
  'findings: each result outside its range, explained: what the test measures, what a result like this commonly relates to, and relevance to her cycle, conditions, medications or symptoms when the facts support it.',
  'patterns: results that make sense together, naming the tests.',
  'considerations: conditions worth discussing with her clinician, each with the tests behind it, a confidence of low, moderate or high, and how a clinician would confirm or rule it out. Say what would confirm a condition; never declare that she has it.',
  'next_tests: tests a clinician might consider, each with a reason. questions: questions she could ask her clinician.',
  'Never give a dose, and never tell her to start, stop, increase or decrease any medication or supplement. Ranges are the lab\'s own; do not substitute other ranges.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);
  const uid = who.user.id;

  let body: { documentId?: unknown; cycle?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  if (!documentId) return json({ error: 'Bad request' }, 400);

  // Hers, or nothing: RLS returns no row for someone else's report.
  const { data: doc } = await db.from('documents').select('id, occurred_at, title, metadata').eq('id', documentId).eq('doc_type', 'lab_report').maybeSingle();
  if (!doc) return json({ error: 'That report was not found.' }, 404);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) {
    console.log('lab-analysis: no OPENAI_API_KEY configured');
    return json({ error: 'Lab analysis is not set up yet' }, 503);
  }

  const { data: allowed, error: claimError } = await db.rpc('claim_lab_analysis');
  if (claimError) return json({ error: 'Could not check today\'s analyses' }, 500);
  if (allowed !== true) return json({ error: 'That is the most analyses for today. Try again tomorrow.' }, 429);

  const facts = await gatherFacts(db, uid, doc, readCycle(body.cycle));
  if (!facts.tests.length) return json({ error: 'This report has no results to analyse.' }, 422);
  const hash = fingerprint([
    ...facts.tests.map((t) => ({ name: t.name, value: t.value, value_text: t.value_text, unit: t.unit, on: facts.collected_on })),
    ...facts.earlier.flatMap((e) => e.results.map((r) => ({ name: e.name, ...r }))),
  ]);

  let attempt = 0;
  let reasons: string[] = [];
  let analysis: Analysis | null = null;
  while (attempt < 2 && !analysis) {
    attempt++;
    const raw = fake ? fakeFor(fake, attempt, facts) : await callModel(facts, reasons);
    const read = readAnalysis(raw);
    if (!read) {
      reasons = ['the answer was not in the required shape'];
      continue;
    }
    if (CONSIDERATIONS_OFF) read.considerations = [];
    const problems = checkAnalysis(read, facts);
    if (problems.length) {
      reasons = problems;
      console.log(`lab-analysis: attempt ${attempt} refused (${problems.length} problems)`);
      continue;
    }
    analysis = read;
  }
  if (!analysis) return json({ error: NOT_CHECKED }, 422);

  const model = fake ? `fake:${fake}` : MODEL;
  const { error: storeError } = await db.rpc('store_lab_analysis', { p_document: documentId, p_model: model, p_facts_hash: hash, p_analysis: analysis });
  if (storeError) return json({ error: 'The analysis could not be saved.' }, 500);
  console.log(`lab-analysis: stored, ${facts.tests.length} tests, attempt ${attempt}`);
  return json({ analysis, model, created_at: new Date().toISOString(), facts_hash: hash });
});

function fakeFor(kind: string, attempt: number, facts: Facts): Analysis {
  if (kind === 'always-bad' || (kind === 'bad-then-good' && attempt === 1)) return fakeAnalysis(facts, 'bad');
  return fakeAnalysis(facts, 'good');
}

async function callModel(facts: Facts, reasons: string[]): Promise<unknown> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: ANALYSIS_SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: `Facts:\n${JSON.stringify(facts)}` },
          ...(reasons.length ? [{ role: 'user', content: `Your previous answer was refused because: ${reasons.join('; ')}. Answer again following every rule.` }] : []),
        ],
      }),
    });
    if (!res.ok) {
      console.log(`lab-analysis: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? JSON.parse(text) : null;
  } catch (e) {
    console.log(`lab-analysis: model failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function gatherFacts(db: any, uid: string, doc: any, cycle: Facts['cycle']): Promise<Facts> {
  const on = String(doc.occurred_at).slice(0, 10);
  const { data: rows } = await db
    .from('results')
    .select('test_name, value, value_text, unit, reference_text, reference_low, reference_high, flag, panel')
    .eq('document_id', doc.id);
  const tests: FactTest[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    name: String(r.test_name),
    value: r.value == null ? null : Number(r.value),
    value_text: (r.value_text as string | null) ?? null,
    unit: (r.unit as string | null) ?? null,
    range: (r.reference_text as string | null) ?? null,
    low: r.reference_low == null ? null : Number(r.reference_low),
    high: r.reference_high == null ? null : Number(r.reference_high),
    flag: (r.flag as string | null) ?? null,
    panel: (r.panel as string | null) ?? null,
  }));

  // Her earlier results for the same tests: up to five each, before this draw.
  const keys = new Set(tests.map((t) => testKey(t.name)));
  const { data: before } = await db
    .from('results')
    .select('test_name, value, value_text, unit, occurred_at')
    .lt('occurred_at', `${on}T00:00:00Z`)
    .order('occurred_at', { ascending: false })
    .limit(1000);
  const earlierBy = new Map<string, { name: string; results: Facts['earlier'][number]['results'] }>();
  for (const r of (before ?? []) as Record<string, unknown>[]) {
    const k = testKey(String(r.test_name));
    if (!keys.has(k)) continue;
    const entry = earlierBy.get(k) ?? { name: String(r.test_name), results: [] };
    if (entry.results.length < 5) {
      entry.results.push({ on: String(r.occurred_at).slice(0, 10), value: r.value == null ? null : Number(r.value), value_text: (r.value_text as string | null) ?? null, unit: (r.unit as string | null) ?? null });
    }
    earlierBy.set(k, entry);
  }

  const [{ data: profile }, { data: conditions }, { data: clinical }, { data: meds }, { data: supps }, { data: episodes }] = await Promise.all([
    db.from('profiles').select('onboarding, body').eq('id', uid).maybeSingle(),
    db.from('conditions').select('name, status').neq('status', 'resolved'),
    db.from('clinical_records').select('name').eq('kind', 'condition').limit(100),
    db.from('medications').select('name').is('stopped_on', null),
    db.from('supplements').select('name').is('stopped_on', null),
    db
      .from('episodes')
      .select('symptoms, kinds')
      .gte('occurred_on', new Date(Date.parse(on) - 30 * 86_400_000).toISOString().slice(0, 10))
      .lte('occurred_on', on),
  ]);

  const counts = new Map<string, number>();
  for (const e of (episodes ?? []) as { symptoms: string[]; kinds: string[] }[]) {
    for (const name of [...(e.symptoms ?? []), ...(e.kinds ?? []).filter((k) => k !== 'Period')]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = (rs: { name: string }[] | null) => [...new Set((rs ?? []).map((r) => r.name).filter(Boolean))];

  return {
    collected_on: on,
    lab: (doc.metadata?.lab as string | null) ?? doc.title ?? null,
    tests,
    earlier: [...earlierBy.values()],
    cycle,
    profile: {
      age_range: (profile?.onboarding?.ageRange as string | null) ?? null,
      life_stage: (profile?.onboarding?.lifeStage as string | null) ?? null,
      gender: (profile?.body?.gender as string | null) ?? null,
    },
    conditions: names([...(conditions ?? []), ...(clinical ?? [])]),
    medications: names(meds),
    supplements: names(supps),
    symptoms: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
  };
}
