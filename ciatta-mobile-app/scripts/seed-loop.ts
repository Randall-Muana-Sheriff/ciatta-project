// Seeds one LOCAL user with the spec's section 11 test 1 shape, so the
// intelligence function can be run end to end against the local stack:
// cycles of 29, 28, 27 and 26 days ending two days ago, sleep that ran
// lower than usual in the week before each of the last two period starts,
// a change row for each of those weeks, a temporal link from the last low
// night to the period start that followed it, and one journal note in the
// final week. Then it queues an intelligence job for her.
//
// Refuses any URL that is not the local stack: this writes health data,
// and it exists for a Docker database that is thrown away.
//
//   cd ciatta-mobile-app
//   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
//   SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npx tsx scripts/seed-loop.ts
//
// Kept out of src/ so it is neither bundled into the app nor picked up by
// npm test. loop-part-one.ts imports seedLoop() and runs the whole
// acceptance test around it.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const LOCAL_URL = 'http://127.0.0.1:54321';
export const SEED_EMAIL = 'loop@test.local';
export const SEED_PASSWORD = 'loop-test-only';
export const SEED_NOTE = 'Slept badly all week, work deadline';

export function assertLocal(url: string): void {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error('refusing to seed anything but the local stack');
  }
}

const DAY_MS = 86400000;
const at = (iso: string, hour: number) => `${iso}T${String(hour).padStart(2, '0')}:00:00.000Z`;

// Cycles of 29, 28, 27 and 26 days, the last one ending two days ago.
export const LENGTHS = [29, 28, 27, 26];

function must<D>(result: { data: D; error: { message: string } | null }, what: string): D {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export type Seeded = { userId: string; starts: string[]; lengths: number[] };

export async function seedLoop(admin: SupabaseClient, today = new Date()): Promise<Seeded> {
  const day = (offset: number) => new Date(today.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
  const startOffsets = [-2];
  for (const n of [...LENGTHS].reverse()) startOffsets.unshift(startOffsets[0] - n);
  const starts = startOffsets.map(day);

  // The admin list ignores an email filter and returns everyone, so the
  // match is made here. A previous seed is deleted first: the cascade from
  // auth.users clears every row she had. The auth admin calls answer with
  // a discriminated union, so each is narrowed on its error rather than
  // passed through must().
  const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw new Error(`list users: ${listed.error.message}`);
  const previous = listed.data.users.find((u) => u.email === SEED_EMAIL);
  if (previous) {
    const deleted = await admin.auth.admin.deleteUser(previous.id);
    if (deleted.error) throw new Error(`delete previous seed: ${deleted.error.message}`);
  }
  const created = await admin.auth.admin.createUser({ email: SEED_EMAIL, password: SEED_PASSWORD, email_confirm: true });
  if (created.error) throw new Error(`create user: ${created.error.message}`);
  const uid = created.data.user.id;

  const watch = must(
    await admin.from('health_sources').insert({ user_id: uid, kind: 'apple_health', name: 'Watch', status: 'active' }).select('id').single(),
    'watch source'
  );
  if (!watch) throw new Error('watch source: no row returned');

  // Her period starts, as episodes; the trigger mirrors each into a
  // period_start observation with her own report as its source.
  must(
    await admin.from('episodes').insert(
      starts.map((d, i) => ({
        user_id: uid,
        client_id: `loop-period-${i}`,
        logged_at: at(d, 9),
        occurred_on: d,
        occurred_at: at(d, 9),
        kinds: ['Period'],
        period_start: d,
        provenance: 'REPORTED',
      }))
    ),
    'episodes'
  );
  const periodObs = must(
    await admin.from('observations').select('id, value_text').eq('user_id', uid).eq('metric', 'period_start'),
    'period observations'
  ) as { id: string; value_text: string }[];
  const periodId = new Map(periodObs.map((o) => [o.value_text, o.id]));

  // Sleep every night for the whole window: 7.3 hours as usual, 6.2 in
  // the week before each of the last two starts.
  const lowWeeks = [starts[3], starts[4]];
  const isLow = (d: string) =>
    lowWeeks.some((s) => {
      const gap = Math.round((Date.parse(s) - Date.parse(d)) / DAY_MS);
      return gap >= 1 && gap <= 7;
    });
  const nights: string[] = [];
  for (let k = 130; k >= 0; k--) nights.push(day(-k));
  const sleepRows = must(
    await admin
      .from('observations')
      .insert(
        nights.map((d) => ({
          user_id: uid,
          domain: 'sleep',
          metric: 'sleep_hours',
          value: isLow(d) ? 6.2 : 7.3,
          unit: 'hours',
          occurred_at: at(d, 7),
          source_id: watch.id,
          provenance: 'MEASURED',
          dedupe_key: `loop:sleep:${d}`,
        }))
      )
      .select('id, occurred_at'),
    'sleep observations'
  ) as { id: string; occurred_at: string }[];
  const sleepId = new Map(sleepRows.map((r) => [r.occurred_at.slice(0, 10), r.id]));

  // What the baselines run would have written for those two weeks: a
  // sustained lower sleep, detected the day before each start, and a link
  // from the last low night to the start that followed it.
  must(
    await admin.from('changes').insert(
      lowWeeks.map((s) => ({
        user_id: uid,
        metric: 'sleep_hours',
        from_value: 7.3,
        to_value: 6.2,
        window_days: 90,
        deviation: -1.1,
        direction: 'lower',
        quality: 'ok',
        detected_on: day(startOffsets[starts.indexOf(s)] - 1),
      }))
    ),
    'changes'
  );
  must(
    await admin.from('temporal_links').insert(
      lowWeeks.map((s) => {
        const night = day(startOffsets[starts.indexOf(s)] - 1);
        return {
          user_id: uid,
          a_observation_id: sleepId.get(night),
          b_observation_id: periodId.get(s),
          relation: 'within_3d',
          gap_hours: 26,
          occurred_on: s,
        };
      })
    ),
    'links'
  );

  // One thing she told the record in the final week.
  must(
    await admin.from('journal_entries').insert({
      user_id: uid,
      client_id: 'loop-note-1',
      text: SEED_NOTE,
      kind: 'Notes',
      occurred_at: at(day(-5), 21),
    }),
    'journal entry'
  );

  must(await admin.rpc('enqueue_job', { uid, job_kind: 'intelligence' }), 'enqueue');
  return { userId: uid, starts, lengths: LENGTHS };
}

// Run directly: seed and print who was seeded.
if (process.argv[1] && /seed-loop\.ts$/.test(process.argv[1])) {
  const url = process.env.SUPABASE_URL ?? LOCAL_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required: supabase status -o env');
    process.exit(1);
  }
  assertLocal(url);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  seedLoop(admin)
    .then((seeded) => console.log(JSON.stringify(seeded)))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
