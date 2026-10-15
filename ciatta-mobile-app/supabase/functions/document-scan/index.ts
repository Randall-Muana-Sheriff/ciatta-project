// Reads any medical document: a photo, a scan, or a PDF of any length.
//
// Called by the app with her access token. The file is sent to OpenAI's
// model to be read and is not stored or logged here. The model works out
// what kind of document it is and copies out what it says, filling only the
// section for that type. It is told to copy, never interpret. She checks
// every item on her phone before anything is filed (src/lib/documents.ts).
//
// Long PDFs are read eight pages at a time (../_shared), each piece counted
// against the day's limit shared with lab reports.
//
// Logging: counts and failure reasons only.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { chunkRanges, type ChunkRead } from '../_shared/chunks.ts';
import { pageCount, splitPdf } from '../_shared/pdf.ts';
import { fakeDocument } from './fake.ts';
import { mergeDocumentChunks } from './merge.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
// Used only to give back reads for a lab report, which the lab reader reads.
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_DOCUMENT_MODEL') ?? Deno.env.get('OPENAI_LAB_MODEL') ?? 'gpt-4o';
const FAKE_ALLOWED = Deno.env.get('DOCUMENT_SCAN_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);
const MAX_BASE64 = 12_000_000;
const TYPES = ['lab_report', 'visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'other'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const S = (type: string) => ({ type: [type, 'null'] });
const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };
const OBJ = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const NOBJ = (properties: Record<string, unknown>) => ({ anyOf: [OBJ(properties), { type: 'null' }] });
const MED = OBJ({ name: STR, strength: S('string'), dose: S('string'), frequency: S('string'), route: S('string'), prescriber: S('string'), date: S('string') });

const SCHEMA = {
  name: 'medical_document',
  strict: true,
  schema: OBJ({
    not_medical: { type: 'boolean' },
    doc_type: { type: 'string', enum: TYPES },
    title: S('string'),
    date: S('string'),
    clinician: S('string'),
    facility: S('string'),
    multiple_dates: { type: 'boolean' },
    unreadable_pages: { type: 'array', items: { type: 'integer' } },
    visit: NOBJ({
      reason: S('string'),
      diagnoses: { type: 'array', items: OBJ({ name: STR, status: { type: 'string', enum: ['new', 'existing', 'unclear'] } }) },
      medications_started: { type: 'array', items: MED },
      medications_stopped: { type: 'array', items: MED },
      medications_changed: { type: 'array', items: MED },
      procedures: { type: 'array', items: OBJ({ name: STR, date: S('string') }) },
      follow_ups: { type: 'array', items: OBJ({ specialty: STR, clinician: S('string'), reason: S('string'), when: S('string') }) },
      instructions: STRS,
      allergies: { type: 'array', items: OBJ({ substance: STR, reaction: S('string') }) },
    }),
    report: NOBJ({ study: S('string'), body_site: S('string'), findings: S('string'), impression: S('string'), named_conditions: STRS }),
    prescription: NOBJ({ medications: { type: 'array', items: MED } }),
    referral: NOBJ({ specialty: S('string'), clinician: S('string'), reason: S('string'), referred_by: S('string') }),
    insurance: NOBJ({ provider: S('string'), plan: S('string'), member_id: S('string') }),
    other: NOBJ({ description: S('string') }),
  }),
};

const INSTRUCTIONS = [
  'You read a medical document and copy what it says exactly. You do not interpret, diagnose, summarise beyond what is asked, or add anything the document does not say.',
  'doc_type: lab_report for laboratory results; visit for an after visit summary, clinic note, consultation note or discharge papers; imaging for radiology reports (ultrasound, X ray, CT, MRI, mammogram); pathology for biopsy, cytology or pathology reports; prescription for a prescription, pharmacy label or printout, or medication list; referral for a referral letter; insurance for an insurance card; other for any other medical document. not_medical is true when it is not a medical document.',
  'Fill only the section for that type and set every other section to null. For lab_report fill no section; the app reads it separately.',
  'title as printed, or null. date is the date of service, visit, study, prescription or card as YYYY-MM-DD, or null. clinician and facility as printed, or null.',
  'visit: reason for the visit as written; diagnoses as named, with status new when the document says it is new or was diagnosed at this visit, existing when it says it is known or ongoing, otherwise unclear; medications started, stopped or changed exactly as written, with strength, dose, frequency and route as printed; procedures done, with dates; follow ups or referrals, with when as written; instructions copied sentence by sentence as written; allergies with reactions as written.',
  'imaging and pathology: study (the modality or specimen), body_site, findings and impression copied in full as printed; named_conditions only for conditions the report itself names.',
  'prescription: each medication with strength, dose, frequency, route, prescriber and date as printed.',
  'referral: specialty, clinician referred to, reason and who referred, as printed. insurance: provider (the insurer), plan name and member id as printed. other: a one line description of what the document is.',
  'multiple_dates is true when the document covers more than one date of service. unreadable_pages lists pages, counted from 1, you could not read.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  let body: { file?: unknown; kind?: unknown; as?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const { file, kind } = body;
  const as = typeof body.as === 'string' && TYPES.includes(body.as) ? body.as : null;
  if (typeof file !== 'string' || !file.length || (kind !== 'image' && kind !== 'pdf')) return json({ error: 'Bad request' }, 400);
  if (file.length > MAX_BASE64) return json({ error: 'That file is too large. Try a shorter document, or split it.' }, 413);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) {
    console.log('document-scan: no OPENAI_API_KEY configured');
    return json({ error: 'Reading documents is not set up yet' }, 503);
  }

  let pages = 1;
  let parts: { first: number; last: number; part: unknown }[];
  if (kind === 'pdf' && !fake) {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(file), (c) => c.charCodeAt(0));
      pages = await pageCount(bytes);
    } catch {
      return json({ error: 'That PDF could not be opened' }, 400);
    }
    const ranges = chunkRanges(pages);
    const pieces = ranges.length === 1 ? [file] : await splitPdf(bytes, ranges);
    parts = ranges.map((r, i) => ({ ...r, part: { type: 'file', file: { filename: `document-${r.first}.pdf`, file_data: `data:application/pdf;base64,${pieces[i]}` } } }));
  } else {
    parts = [{ first: 1, last: 1, part: { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file}`, detail: 'high' } } }];
  }

  for (let i = 0; i < parts.length; i++) {
    const { data: allowed, error: claimError } = await db.rpc('claim_lab_scan');
    if (claimError) return json({ error: 'Could not check today\'s reads' }, 500);
    if (allowed !== true) {
      return json({ error: parts.length > 1 ? `This document needs ${parts.length} of today's reads and there are not enough left. Try again tomorrow.` : 'That is the most documents for today. Try again tomorrow.' }, 429);
    }
  }

  const reads: ChunkRead[] = await Promise.all(
    parts.map(async ({ first, last, part }) => ({ first, last, parsed: fake ? fakeDocument(as) : await readPart(part, as) })),
  );
  if (reads.every((r) => r.parsed == null)) return json({ error: 'Could not read the document' }, 502);
  const merged = mergeDocumentChunks(reads, pages);
  if (as) merged.doc_type = as;
  // A lab report is read again by the lab reader; the reads spent here are
  // given back so it costs her one read, not two.
  if (merged.doc_type === 'lab_report') {
    const { error: refundError } = await createClient(url, serviceKey).rpc('refund_lab_scan', { p_user: who.user.id, p_count: parts.length });
    if (refundError) console.log('document-scan: refund failed');
  }
  console.log(`document-scan: ${kind}, ${pages} pages, ${parts.length} pieces`);
  return json(merged);
});

async function readPart(part: unknown, as: string | null): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS + (as ? ` She says this document is of type ${as}; read it as that type.` : '') },
          { role: 'user', content: [part] },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`document-scan: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.log(`document-scan: piece failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}
