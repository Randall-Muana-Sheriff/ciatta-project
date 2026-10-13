// Reads a lab report: a photo of the paper, or the PDF a clinic sent.
//
// Called by the app with her access token. The file arrives once, is sent
// to OpenAI's model to read, and is not stored or logged here: the function
// returns what was read and forgets the file. She checks and corrects every
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
    required: ['not_lab', 'collected_on', 'lab', 'tests'],
    properties: {
      not_lab: { type: 'boolean' },
      collected_on: NULLABLE('string'),
      lab: NULLABLE('string'),
      tests: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value', 'value_text', 'unit', 'range', 'flag'],
          properties: {
            name: { type: 'string' },
            value: NULLABLE('number'),
            value_text: NULLABLE('string'),
            unit: NULLABLE('string'),
            range: NULLABLE('string'),
            flag: NULLABLE('string'),
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
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  // Counted before anything is spent: past 20 today, refused.
  const { data: allowed, error: claimError } = await db.rpc('claim_lab_scan');
  if (claimError) return json({ error: 'Could not check today\'s scans' }, 500);
  if (allowed !== true) return json({ error: 'That is the most lab reports for today. Try again tomorrow.' }, 429);

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

  const part =
    kind === 'pdf'
      ? { type: 'file', file: { filename: 'lab-report.pdf', file_data: `data:application/pdf;base64,${file}` } }
      : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${file}`, detail: 'high' } };

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
      return json({ error: 'Could not read the report' }, 502);
    }
    const out = await res.json();
    const text = out?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    console.log(`lab-scan: ${kind}, ${Array.isArray(parsed?.tests) ? parsed.tests.length : 0} tests`);
    return json(parsed ?? { not_lab: true, collected_on: null, lab: null, tests: [] });
  } catch (e) {
    console.log(`lab-scan: failed (${e instanceof Error ? e.name : 'unknown'})`);
    return json({ error: 'Could not read the report' }, 502);
  }
});
