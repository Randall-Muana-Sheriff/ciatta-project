// A clinical AI analysis of one medical document she added: an
// explanation of its terms and findings, and a full clinical read across
// her record.
//
// Runs as her: every read is hers under RLS. The facts are the document's
// own extraction plus her record. The model's answer is checked against
// them (check.ts) and retried once; only an answer that passes is stored,
// with the server's key, for the person the verified token names.
//
// Logging: counts, the model name and rejection reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { checkDocumentAnalysis, DOC_ANALYSIS_SCHEMA, type DocAnalysis, readDocAnalysis } from './check.ts';
import { fakeDocAnalysis } from './fake.ts';
import { analysisFingerprint, type DocFacts, readCycle } from './facts.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_ANALYSIS_MODEL') ?? 'gpt-4o';
const CONSIDERATIONS_OFF = Deno.env.get('LAB_ANALYSIS_CONSIDERATIONS') === 'off';
const FAKE_ALLOWED = Deno.env.get('DOCUMENT_ANALYSIS_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);
const NOT_CHECKED = 'The analysis could not be checked, so it is not shown. The document above is unaffected.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const INSTRUCTIONS = [
  'You are a clinician explaining a medical document to the patient it belongs to. Write plainly, warmly and precisely.',
  'Use only the facts given: the document and her record. Quote values and doses exactly as written. Do not compute percentages or differences.',
  'urgent: anything the document says needs prompt attention, with action contact_today or urgent_care; empty when nothing is urgent.',
  'summary: two or three sentences on what the document says.',
  'terms: medical words the document itself uses, each explained in plain language.',
  'findings: what the document found or decided, each explained, with relevance to her record when the facts support it.',
  'patterns: how this document connects with her record (labs, conditions, medications, symptoms, cycle), naming the items.',
  'considerations: conditions worth discussing with her clinician, with the items behind each, a confidence of low, moderate or high, and how a clinician would confirm it. Never declare she has a condition the document does not name.',
  'next_steps: practical next steps, such as follow ups the document lists. questions: questions she could ask her clinician.',
  'Never suggest a dose, and never tell her to start, stop or change a medication yourself. You may repeat the document’s own medication instructions only by saying the document says so, for example: "Your visit summary says to stop ibuprofen."',
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

  const { data: doc } = await db.from('documents').select('id, doc_type, title, occurred_at, metadata').eq('id', documentId).neq('doc_type', 'lab_report').maybeSingle();
  if (!doc) return json({ error: 'That document was not found.' }, 404);

  // An insurance card is not analysed: there is nothing clinical in it, and
  // its member id should not be sent anywhere again.
  if (doc.doc_type === 'insurance') return json({ error: 'Insurance cards are not analysed.' }, 422);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) return json({ error: 'Document analysis is not set up yet' }, 503);

  const { data: allowed, error: claimError } = await db.rpc('claim_lab_analysis');
  if (claimError) return json({ error: 'Could not check today\'s analyses' }, 500);
  if (allowed !== true) return json({ error: 'That is the most analyses for today. Try again tomorrow.' }, 429);

  const extraction = (doc.metadata?.extraction ?? {}) as Record<string, unknown>;
  const facts = await gatherFacts(db, uid, doc, extraction, readCycle(body.cycle));
  const hash = analysisFingerprint(extraction, facts.record.conditions, facts.record.medications);

  let attempt = 0;
  let reasons: string[] = [];
  let analysis: DocAnalysis | null = null;
  while (attempt < 2 && !analysis) {
    attempt++;
    const raw = fake ? fakeDocAnalysis(facts, fake === 'always-bad' || (fake === 'bad-then-good' && attempt === 1) ? 'bad' : 'good') : await callModel(facts, reasons);
    const read = readDocAnalysis(raw);
    if (!read) {
      reasons = ['the answer was not in the required shape'];
      continue;
    }
    if (CONSIDERATIONS_OFF) read.considerations = [];
    const problems = checkDocumentAnalysis(read, facts);
    if (problems.length) {
      reasons = problems;
      console.log(`document-analysis: attempt ${attempt} refused (${problems.length} problems)`);
      continue;
    }
    analysis = read;
  }
  if (!analysis) return json({ error: NOT_CHECKED }, 422);

  const model = fake ? `fake:${fake}` : MODEL;
  const admin = createClient(url, serviceKey);
  const { error: storeError } = await admin.rpc('store_document_analysis', { p_user: uid, p_document: documentId, p_model: model, p_facts_hash: hash, p_analysis: analysis });
  if (storeError) return json({ error: 'The analysis could not be saved.' }, 500);
  console.log(`document-analysis: stored, attempt ${attempt}`);
  return json({ analysis, model, created_at: new Date().toISOString(), facts_hash: hash });
});

async function callModel(facts: DocFacts, reasons: string[]): Promise<unknown> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: DOC_ANALYSIS_SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: `Facts:\n${JSON.stringify(facts)}` },
          ...(reasons.length ? [{ role: 'user', content: `Your previous answer was refused because: ${reasons.join('; ')}. Answer again following every rule.` }] : []),
        ],
      }),
    });
    if (!res.ok) {
      console.log(`document-analysis: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? JSON.parse(text) : null;
  } catch (e) {
    console.log(`document-analysis: model failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function gatherFacts(db: any, uid: string, doc: any, extraction: Record<string, unknown>, cycle: DocFacts['record']['cycle']): Promise<DocFacts> {
  const on = String(doc.occurred_at).slice(0, 10);
  const yearAgo = new Date(Date.parse(on) - 365 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profile }, { data: conditions }, { data: meds }, { data: supps }, { data: procs }, { data: labs }, { data: episodes }] = await Promise.all([
    db.from('profiles').select('onboarding, body').eq('id', uid).maybeSingle(),
    db.from('conditions').select('name, status, kind').neq('status', 'resolved'),
    db.from('medications').select('name').is('stopped_on', null),
    db.from('supplements').select('name').is('stopped_on', null),
    db.from('procedures').select('name, performed_on').order('performed_on', { ascending: false }).limit(50),
    db.from('results').select('test_name, value, value_text, unit, reference_text, flag, occurred_at').gte('occurred_at', `${yearAgo}T00:00:00Z`).order('occurred_at', { ascending: false }).limit(500),
    db.from('episodes').select('symptoms, kinds').gte('occurred_on', new Date(Date.parse(on) - 15 * 86_400_000).toISOString().slice(0, 10)).lte('occurred_on', new Date(Date.parse(on) + 15 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const latest = new Map<string, DocFacts['record']['labs'][number]>();
  for (const l of (labs ?? []) as Record<string, unknown>[]) {
    const k = String(l.test_name).toLowerCase();
    if (latest.has(k)) continue;
    latest.set(k, { name: String(l.test_name), value: l.value == null ? null : Number(l.value), value_text: (l.value_text as string | null) ?? null, unit: (l.unit as string | null) ?? null, range: (l.reference_text as string | null) ?? null, flag: (l.flag as string | null) ?? null, on: String(l.occurred_at).slice(0, 10) });
  }
  const counts = new Map<string, number>();
  for (const e of (episodes ?? []) as { symptoms: string[]; kinds: string[] }[]) {
    for (const n of [...(e.symptoms ?? []), ...(e.kinds ?? []).filter((k) => k !== 'Period')]) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const names = (rs: { name: string }[] | null) => [...new Set((rs ?? []).map((r) => r.name).filter(Boolean))];
  return {
    document: { type: String(doc.doc_type), date: on, title: doc.title ?? null, clinician: (doc.metadata?.clinician as string | null) ?? null, facility: (doc.metadata?.facility as string | null) ?? null, extraction },
    record: {
      conditions: names(conditions),
      medications: names(meds),
      supplements: names(supps),
      procedures: ((procs ?? []) as { name: string; performed_on: string | null }[]).map((p) => ({ name: p.name, on: p.performed_on })),
      labs: [...latest.values()].slice(0, 80),
      cycle,
      symptoms: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      profile: {
        age_range: (profile?.onboarding?.ageRange as string | null) ?? null,
        life_stage: (profile?.onboarding?.lifeStage as string | null) ?? null,
        gender: (profile?.body?.gender as string | null) ?? null,
      },
    },
  };
}
