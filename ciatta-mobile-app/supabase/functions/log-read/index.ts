// Reading what she says to Ciatta, so it can be added to her timeline.
//
// "Had a dull ache since lunch and felt totally drained" becomes Pain and
// Fatigue, today. The model may only choose words from the vocabulary the
// app sends, which is the record's own list of log words; read.ts drops
// anything else. Nothing is saved here: the app shows what was understood
// and she confirms it first.
//
// Runs as her: the JWT is verified, and each read is counted against her
// day. What she said is sent to the model and is never stored or logged.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { readLogResult } from './read.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_LOG_MODEL') ?? 'gpt-4o-mini';
const FAKE_ALLOWED = Deno.env.get('LOG_READ_FAKE_MODEL') === '1' && /^https?:\/\/(127\.0\.0\.1|localhost|kong)(:\d+)?/.test(url);

const MAX_TEXT = 1000;
const MAX_WORDS = 400;
const MAX_WORD = 60;

const SCHEMA = {
  name: 'log_read',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'daysAgo'],
    properties: { items: { type: 'array', items: { type: 'string' } }, daysAgo: { type: 'integer' } },
  },
};

const INSTRUCTIONS =
  'You read a short message a person wrote about their own health and choose which words from a fixed vocabulary it describes. ' +
  'Return only words copied exactly from the vocabulary. Choose a word only when the message clearly says it: an ache or cramp is Pain, ' +
  'feeling drained or exhausted is Fatigue. Do not diagnose and do not add anything the message does not say. ' +
  'daysAgo is how many days ago it happened: 0 for today, 1 for yesterday, and so on; 0 when the message does not say.';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  const vocabulary = (Array.isArray(body.vocabulary) ? body.vocabulary : [])
    .filter((w): w is string => typeof w === 'string' && w.length > 0 && w.length <= MAX_WORD)
    .slice(0, MAX_WORDS);
  if (!text || !vocabulary.length) return json({ error: 'Bad request' }, 400);

  const fake = FAKE_ALLOWED ? req.headers.get('x-fake-model') : null;
  if (!fake && !openAiKey) return json({ error: 'Reading messages is not set up yet' }, 503);

  const { data: allowed, error: claimError } = await db.rpc('claim_log_read');
  if (claimError) return json({ error: 'Could not check today\'s reads' }, 500);
  if (allowed !== true) return json({ error: 'That is the most for today. Try again tomorrow.' }, 429);

  if (fake) return json(readLogResult(JSON.parse(fake), vocabulary));

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
          { role: 'user', content: `Vocabulary: ${JSON.stringify(vocabulary)}\n\nMessage: ${JSON.stringify(text)}` },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`log-read: model returned ${res.status}`);
      return json({ error: 'Could not read that just now' }, 502);
    }
    const out = await res.json();
    const content = out?.choices?.[0]?.message?.content;
    return json(readLogResult(typeof content === 'string' ? JSON.parse(content) : null, vocabulary));
  } catch (e) {
    console.log(`log-read: failed (${e instanceof Error ? e.name : 'unknown'})`);
    return json({ error: 'Could not read that just now' }, 502);
  }
});
