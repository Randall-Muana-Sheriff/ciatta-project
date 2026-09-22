/// <reference types="node" />
// The first half of the learning loop, end to end, against the LOCAL
// stack: spec section 11 test 1 up to "watch next cycle", and test 3,
// "nothing happened". Seeds the section 11 user, serves the functions,
// posts to intelligence, and checks the rows the way the founder would:
// one thread, one insight whose you_told carries the reported note and
// whose not_established is not empty, evidence that points at real rows,
// then a second run that writes no second insight. It also reads the
// insight back as HER, through the app's own realRepo, so the joins and
// the row level security behind the Insight screen are proved too.
//
// This is a script rather than a pgTAP test because pgTAP cannot call an
// edge function. It needs Docker and the local stack:
//
//   cd ciatta-mobile-app
//   supabase start && supabase migration up
//   npm run test:loop
//
// It starts `supabase functions serve` itself and stops it at the end, and
// deletes the seeded user whatever happens. Nothing here can reach the
// live project: the URL is refused unless it is local.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { realRepo } from '../src/data/repo';
import { check, localEnv, must, post, rows, serveFunctions } from './loop-support';
import { assertLocal, LOCAL_URL, SEED_EMAIL, SEED_NOTE, SEED_PASSWORD, seedLoop } from './seed-loop';

async function main() {
  const env = await localEnv();
  const url = process.env.SUPABASE_URL ?? env.API_URL ?? LOCAL_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? env.ANON_KEY;
  if (!serviceKey || !anonKey) throw new Error('the local stack is not running: supabase start');
  assertLocal(url);
  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | null = null;
  const server = await serveFunctions();
  try {
    const seeded = await seedLoop(admin);
    userId = seeded.userId;
    console.log(`seeded cycles of ${seeded.lengths.join(', ')} days`);

    // Section 11 test 1: recur, thread, insight.
    const first = await post(url, serviceKey);
    check(first.processed && first.threads === 1 && first.insights === 1, 'first run builds one thread and writes one insight');

    const threads = rows(await admin.from('threads').select('id, key, status, observation_count, confidence').eq('user_id', userId), 'threads');
    check(threads.length === 1 && threads[0].key === 'cycle_length~sleep_hours', 'the thread is cycle_length~sleep_hours');
    check(threads[0].status === 'new' && threads[0].observation_count === 2, 'it is new and has been seen twice');

    const insights = rows(
      await admin.from('insights').select('id, status, title, what_changed, connected, you_told, not_established, updated_at').eq('user_id', userId),
      'insights'
    );
    check(insights.length === 1 && insights[0].status === 'new', 'one insight, status new');
    check(insights[0].you_told.includes(SEED_NOTE), 'you_told carries the note she wrote');
    check(insights[0].not_established.trim().length > 0, 'not_established is not empty');
    for (const part of ['title', 'what_changed', 'connected'] as const) check(insights[0][part].trim().length > 0, `${part} is not empty`);

    const evidence = rows(
      await admin
        .from('thread_evidence')
        .select('role, link_id, change_id, observation_id, temporal_links(id), changes(id), observations(id)')
        .eq('thread_id', threads[0].id),
      'evidence'
    ) as unknown as { role: string; temporal_links: unknown; changes: unknown; observations: unknown }[];
    check(evidence.length === 5, 'five evidence rows: two occurrences, two findings, one thing she told');
    check(
      evidence.every((e) => e.temporal_links || e.changes || e.observations),
      'every evidence row joins to a real link, change or observation'
    );

    // The app's own read, as her: joins and row level security together.
    const hers = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await hers.auth.signInWithPassword({ email: SEED_EMAIL, password: SEED_PASSWORD });
    if (signedIn.error) throw new Error(`sign in: ${signedIn.error.message}`);
    const view = await realRepo(hers, userId).loadInsight();
    check(!!view && view.headline === insights[0].title, 'realRepo.loadInsight reads her insight back with its title as the headline');
    check(view!.basedOn.length === 5 && view!.basedOn.some((r) => r.screen === 'journal'), 'basedOn lists her five sources, her note among them');
    check(view!.method.length === 4 && view!.stillOpen.length > 0, 'method has four rows and stillOpen is filled');
    await hers.auth.signOut();

    // Section 11 test 3: nothing happened, so nothing new is said.
    must(await admin.rpc('enqueue_job', { uid: userId, job_kind: 'intelligence' }), 'enqueue again');
    const second = await post(url, serviceKey);
    check(second.processed && second.threads === 1 && second.insights === 0, 'second run with no new data writes no second insight');
    const after = rows(await admin.from('insights').select('id, status, updated_at').eq('user_id', userId), 'insights after');
    check(after.length === 1 && after[0].id === insights[0].id, 'the same single insight remains');
    check(after[0].status === 'continuing' && after[0].updated_at > insights[0].updated_at, 'it is marked continuing and its updated_at moved');

    console.log('PASS: the first half of the loop holds');
  } finally {
    server.stop();
    if (userId) {
      const gone = await admin.auth.admin.deleteUser(userId);
      if (gone.error) console.error(`could not delete the seed user: ${gone.error.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
