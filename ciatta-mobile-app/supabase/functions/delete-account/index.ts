// Deletes the caller's own account and everything that belongs to it. The
// user id comes only from the caller's verified token, never the request.
// Every table references auth.users on delete cascade, so removing her files
// and then her auth user removes everything.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { chunk, collectPaths } from './drain.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await caller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not signed in' }, 401);
  const uid = who.user.id;

  const admin = createClient(url, serviceKey);
  try {
    // list() reports a nested prefix as an entry with a null id; removing a
    // prefix like that is a no op, so a naive one level loop over it would
    // spin forever and never reach the account deletion below.
    const paths = await collectPaths(async (prefix, limit, offset) => {
      const { data, error } = await admin.storage.from('documents').list(prefix, { limit, offset });
      if (error) throw error;
      return (data ?? []).map((f) => ({ name: f.name, id: f.id }));
    }, uid);
    for (const batch of chunk(paths, 100)) {
      const { error: removeError } = await admin.storage.from('documents').remove(batch);
      if (removeError) throw removeError;
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    console.error('delete-account failed', e instanceof Error ? e.name : 'unknown');
    return json({ error: 'Delete did not finish' }, 500);
  }
});
