// Reads a lab report: a photo of the paper, or the PDF a clinic sent.
//
// Called by the app with her access token. The file arrives once, is sent
// to OpenAI's model to read, and is not stored or logged here: the function
// returns what was read and forgets the file. A PDF over eight pages is
// split and read eight pages at a time; each piece counts against the
// day's limit. She checks and corrects every
// line on her phone before anything is saved.
//
// Nothing the model says is trusted as is. The app checks every test
// (src/lib/labs.ts readLabScan) before it reaches the screen.
//
// The model is told to copy, not to interpret: the test names, values,
// units, ranges and flags as printed, and nothing the page does not say.
//
// Logging: counts and failure reasons only, never the file or the results.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { pageCount, splitPdf } from './pdf.ts';
import { chunkRanges, type ChunkRead, mergeChunks } from './scan.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_LAB_MODEL') ?? 'gpt-4o';

// A photo is resized on the phone; a PDF of a few pages fits well under this.
const MAX_BASE64 = 12_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const NULLABLE = (type: string) => ({ type: [type, 'null'] });

const SCHEMA = {
  name: 'lab_report',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['not_lab', 'collected_on', 'lab', 'ordering_clinician', 'specimen', 'unreadable_pages', 'multiple_dates', 'tests'],
    properties: {
      not_lab: { type: 'boolean' },
      collected_on: NULLABLE('string'),
      lab: NULLABLE('string'),
      ordering_clinician: NULLABLE('string'),
      specimen: NULLABLE('string'),
      unreadable_pages: { type: 'array', items: { type: 'integer' } },
      multiple_dates: { type: 'boolean' },
      tests: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value', 'value_text', 'unit', 'range', 'flag', 'panel'],
          properties: {
            name: { type: 'string' },
            value: NULLABLE('number'),
            value_text: NULLABLE('string'),
            unit: NULLABLE('string'),
            range: NULLABLE('string'),
            flag: NULLABLE('string'),
            panel: NULLABLE('string'),
          },
        },
      },
    },
  },
};

const INSTRUCTIONS = [
  'You read a laboratory report and copy its results exactly. You do not interpret, diagnose or add anything.',
  'For each test on the report give: name as printed; value as a number when the result is a number, otherwise null;',
  'value_text with the result in words when it is not a number (for example "Negative", "Non reactive"), otherwise null;',
  'unit as printed or null; range as the reference range is printed (for example "15 to 150", "<5", "Negative") or null if none is printed;',
  'flag as the HL7 code for the flag printed beside the result: H, L, HH, LL, A, AA or N, or null when the report prints no flag. Never infer a flag from the range.',
  'collected_on is the collection date as YYYY-MM-DD, or null if the report does not show one. lab is the laboratory name as printed, or null.',
  'Copy decimals exactly as printed. Skip anything that is not a test result, such as addresses, comments and page numbers.',
  'If the document is not a lab report, set not_lab to true and return no tests.',
  'panel is the heading the test is printed under, such as "Complete Blood Count", "Comprehensive Metabolic Panel" or "Lipid Panel", or null when it is under none.',
  'ordering_clinician is the ordering or referring clinician as printed, or null. specimen is the specimen as printed (for example "Serum", "Whole blood", "Urine"), or null.',
  'multiple_dates is true when the document shows results collected on more than one date, otherwise false.',
  'unreadable_pages lists the page numbers of this document, counted from 1, that you could not read; an empty list when you read every page.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  if (!openAiKey) {
    console.log('lab-scan: no OPENAI_API_KEY configured');
    return json({ error: 'Reading lab reports is not set up yet' }, 503);
  }

  let body: { file?: unknown; kind?: unknown };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const { file, kind } = body;
  if (typeof file !== 'string' || !file.length || (kind !== 'image' && kind !== 'pdf')) return json({ error: 'Bad request' }, 400);
  if (file.length > MAX_BASE64) return json({ error: 'That file is too large' }, 413);

  // The pieces to read: one for a photo, eight pages at a time for a PDF.
  let pages = 1;
  let parts: { first: number; last: number; part: unknown }[];
  if (kind === 'pdf') {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(file), (c) => c.charCodeAt(0));
      pages = await pageCount(bytes);
    } catch {
      return json({ error: 'That PDF could not be opened' }, 400);
    }
    const ranges = chunkRanges(pages);
    const pieces = ranges.length === 1 ? [file] : await splitPdf(bytes, ranges);
    parts = ranges.map((r, i) => ({
      ...r,
      part: { type: 'file', file: { filename: `lab-report-${r.first}.pdf`, file_data: `data:application/pdf;base64,${pieces[i]}` } },
    }));
  } else {
    parts = [{ first: 1, last: 1, part: { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file}`, detail: 'high' } } }];
  }

  // Counted before anything is spent: each piece is one of the day's 20.
  for (let i = 0; i < parts.length; i++) {
    const { data: allowed, error: claimError } = await db.rpc('claim_lab_scan');
    if (claimError) return json({ error: 'Could not check today\'s scans' }, 500);
    if (allowed !== true) {
      return json({ error: parts.length > 1 ? `This report needs ${parts.length} of today's reads and there are not enough left. Try again tomorrow.` : 'That is the most lab reports for today. Try again tomorrow.' }, 429);
    }
  }

  const reads: ChunkRead[] = await Promise.all(parts.map(async ({ first, last, part }) => ({ first, last, parsed: await readPart(part) })));
  if (reads.every((r) => r.parsed == null)) return json({ error: 'Could not read the report' }, 502);
  const merged = mergeChunks(reads, pages);
  console.log(`lab-scan: ${kind}, ${pages} pages, ${parts.length} pieces, ${(merged.tests as unknown[]).length} tests`);
  return json(merged);
});

// One piece, read by the model. Null when the model failed or answered
// with something that is not the schema; the merge marks its pages.
async function readPart(part: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          { role: 'user', content: [part] },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`lab-scan: model returned ${res.status}`);
      return null;
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.log(`lab-scan: piece failed (${e instanceof Error ? e.name : 'unknown'})`);
    return null;
  }
}
