// Starting a Fasten Connect session for the signed in person.
//
// One action, start: a one time external id, issued to her and kept with
// her user id for two hours. The app opens Fasten's search with it, Fasten
// echoes it in its signed webhook, and fasten-webhook binds whatever she
// connects to her. The app never names a connection, so it can never name
// someone else's.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PUBLIC_ID = Deno.env.get('FASTEN_PUBLIC_ID') ?? '';

const VALID_FOR_MS = 2 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function externalId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Not allowed' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (body.action !== 'start') return json({ error: 'Invalid request' }, 400);
  if (!PUBLIC_ID) return json({ error: 'Ciatta is not set up for other providers yet.' }, 503);

  const admin = createClient(url, serviceKey);
  try {
    await admin.from('fasten_connect_requests').delete().lt('expires_at', new Date().toISOString());
    const id = externalId();
    const { error } = await admin.from('fasten_connect_requests').insert({
      user_id: who.user.id,
      external_id: id,
      expires_at: new Date(Date.now() + VALID_FOR_MS).toISOString(),
    });
    if (error) throw error;
    return json({ externalId: id, publicId: PUBLIC_ID });
  } catch (e) {
    console.error('fasten-connect failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'That did not start. Nothing was shared.' }, 500);
  }
});
