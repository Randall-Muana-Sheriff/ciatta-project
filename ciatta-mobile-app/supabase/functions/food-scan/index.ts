// Reads a meal photo: which foods are on the plate, where, and an estimate
// of each one's calories, protein, carbs and fat.
//
// Called by the app with her access token. The photo arrives once, is sent
// to OpenAI's vision model, and is not stored or logged here: the function
// returns the reading and forgets it. The phone keeps the photo with the
// meal, as it keeps every attachment.
//
// Nothing the model says is trusted as is. The app checks every item
// (src/lib/foodScan.ts readScan) before it reaches the screen, and every
// figure is shown as an estimate she can correct.
//
// Logging: counts and failure reasons only, never the photo or the foods.

import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');
const MODEL = Deno.env.get('OPENAI_FOOD_MODEL') ?? 'gpt-4o';

// The phone resizes to 1024px before sending; anything bigger is refused.
const MAX_BASE64 = 2_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const SCHEMA = {
  name: 'meal',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['not_food', 'items'],
    properties: {
      not_food: { type: 'boolean' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'portion', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'x', 'y', 'r'],
          properties: {
            name: { type: 'string' },
            portion: { type: 'string' },
            kcal: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' },
            r: { type: 'number' },
          },
        },
      },
    },
  },
};

const INSTRUCTIONS = [
  'You identify the foods visible in a photo of a meal and estimate their nutrition.',
  'List each distinct food you can see, at most 12, with a short everyday name in title case (for example "Grilled Chicken", "Tomatoes").',
  'Give the portion you can see in words (for example "150 g", "1 cup", "2 slices").',
  'Estimate kcal, protein_g, carbs_g and fat_g for that portion of that food only.',
  'Give x and y, the centre of that food in the photo, as fractions of width and height from the top left, and r, its rough radius as a fraction of the photo width.',
  'Only name foods you can actually see. Do not guess hidden ingredients or sauces you cannot see.',
  'If the photo does not show food, set not_food to true and return no items.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);

  // Counted before anything is spent: past 40 today, refused.
  const { data: allowed, error: claimError } = await db.rpc('claim_food_scan');
  if (claimError) return json({ error: 'Could not check today\'s scans' }, 500);
  if (allowed !== true) return json({ error: 'That is the most scans for today. You can still add foods yourself.' }, 429);

  if (!openAiKey) {
    console.log('food-scan: no OPENAI_API_KEY configured');
    return json({ error: 'Scanning is not set up yet' }, 503);
  }

  let image: unknown;
  try {
    image = (await req.json())?.image;
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (typeof image !== 'string' || !image.length) return json({ error: 'Bad request' }, 400);
  if (image.length > MAX_BASE64) return json({ error: 'Photo too large' }, 413);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } }],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`food-scan: model returned ${res.status}`);
      return json({ error: 'Could not read the photo' }, 502);
    }
    const body = await res.json();
    const text = body?.choices?.[0]?.message?.content;
    const parsed = typeof text === 'string' ? JSON.parse(text) : null;
    console.log(`food-scan: ${Array.isArray(parsed?.items) ? parsed.items.length : 0} items`);
    return json(parsed ?? { not_food: true, items: [] });
  } catch (e) {
    console.log(`food-scan: failed (${e instanceof Error ? e.name : 'unknown'})`);
    return json({ error: 'Could not read the photo' }, 502);
  }
});
