// Writes a batch of Apple Health data into her record. The user id comes
// only from the caller's verified token, never the request body. Writing a
// daily_metrics row already enqueues a baselines job through a database
// trigger, so this function never enqueues anything itself.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { buildDayRow, buildObservationRow, validateBatch } from './batch.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Finds her Apple Health source, creating it on the first call, and marks
// it synced right now. A single row upsert only sets the columns named
// here, so error and metadata on an existing source are left alone.
// Typed `any`: this project has no generated Database type to hand
// createClient, and without one supabase-js infers `never` row shapes for
// every table, which is worse than an explicit any here.
async function findOrCreateAppleHealthSource(admin: any, uid: string): Promise<string> {
  const { data, error } = await admin
    .from('health_sources')
    .upsert(
      { user_id: uid, kind: 'apple_health', name: 'Apple Health', status: 'active', last_synced_at: new Date().toISOString() },
      { onConflict: 'user_id,kind,name' }
    )
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('No source id returned');
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not supported' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);
  const uid = who.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid batch' }, 400);
  }

  const validated = validateBatch(body);
  if (!validated.ok) return json({ error: validated.error }, 400);
  const { observations, days } = validated.batch;

  const admin: any = createClient(url, serviceKey);
  try {
    const sourceId = await findOrCreateAppleHealthSource(admin, uid);

    let observationCount = 0;
    if (observations.length > 0) {
      const rows = observations.map((observation) => buildObservationRow(observation, { user_id: uid, source_id: sourceId }));
      const { data, error } = await admin.from('observations').upsert(rows, { onConflict: 'user_id,dedupe_key' }).select('id');
      if (error) throw error;
      observationCount = data?.length ?? rows.length;
    }

    // Each day is upserted on its own, one call at a time: a bulk upsert
    // shares one SET clause across every row in the call, so a batch mixing
    // a day that only has steps with one that only has sleep would blank
    // whichever columns the other row happened to omit. Upserting one row
    // at a time keeps each day's SET clause built from only its own keys.
    let dayCount = 0;
    for (const day of days) {
      const row = buildDayRow(day, { user_id: uid, source_id: sourceId });
      const { error } = await admin.from('daily_metrics').upsert(row, { onConflict: 'user_id,day' });
      if (error) throw error;
      dayCount += 1;
    }

    return json({ observations: observationCount, days: dayCount });
  } catch (e) {
    console.error('ingest-health failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Sync did not finish' }, 500);
  }
});
