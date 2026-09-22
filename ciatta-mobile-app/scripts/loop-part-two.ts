// The second half of the learning loop, end to end, against the LOCAL
// stack: spec section 11 test 1 from "watch next cycle" to "Today shows
// what changed since last time", then test 3, "nothing happened". It runs
// part one's seed shifted four weeks into the past, posts to reach the
// first insight, then as her: looks at it, watches the thread, sees a new
// cycle arrive with the same low sleep week, sees the count rise and the
// insight updated, tries a walk that the server can measure, reports on
// it, and finally posts with nothing new and checks that nothing new was
// written anywhere.
//
//   cd ciatta-mobile-app
//   supabase start && supabase migration up
//   npm run test:loop2
//
// It starts `supabase functions serve` itself and stops it at the end, and
// deletes the seeded user whatever happens.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { realRepo } from '../src/data/repo';
import { check, localEnv, must, post, rows, serveFunctions } from './loop-support';
import { assertLocal, LOCAL_URL, SEED_EMAIL, SEED_PASSWORD, seedLoop } from './seed-loop';

const DAY_MS = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (day: string, hour: number) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

type Counts = Record<string, number>;
async function countRows(admin: SupabaseClient, userId: string): Promise<Counts> {
  const out: Counts = {};
  for (const table of ['threads', 'insights', 'learning_events', 'outcomes', 'recommendations', 'actions']) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    out[table] = count ?? 0;
  }
  return out;
}

async function main() {
  const env = await localEnv();
  const url = process.env.SUPABASE_URL ?? env.API_URL ?? LOCAL_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? env.ANON_KEY;
  if (!serviceKey || !anonKey) throw new Error('the local stack is not running: supabase start');
  assertLocal(url);
  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const today = new Date();
  const day = (offset: number) => iso(new Date(today.getTime() + offset * DAY_MS));

  let userId: string | null = null;
  const server = await serveFunctions();
  try {
    // Part one, four weeks ago: its last period start lands 30 days back.
    const seeded = await seedLoop(admin, new Date(today.getTime() - 28 * DAY_MS));
    userId = seeded.userId;
    const uid = userId;
    const first = await post(url, serviceKey);
    check(first.processed && first.threads === 1 && first.insights === 1, 'part one reaches its insight');

    const hers = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await hers.auth.signInWithPassword({ email: SEED_EMAIL, password: SEED_PASSWORD });
    if (signedIn.error) throw new Error(`sign in: ${signedIn.error.message}`);
    const repo = realRepo(hers, uid);

    // She opens the app: the insight is new, she is offered watching it.
    let loop = await repo.loadToday();
    check(loop?.insight?.since === 'new', 'Today says the insight is new since her last visit');
    check(loop!.recommendations.some((r) => r.type === 'observe'), 'she is offered watching her next cycle');
    check(loop!.recommendations.some((r) => r.type === 'review') && loop!.recommendations.some((r) => r.type === 'reflect'), 'and the evidence and describing what changed');
    await repo.recordInsightView(loop!.insight!.id);
    await repo.recordVisit();
    loop = await repo.loadToday();
    check(loop?.insight?.since === 'unchanged', 'once seen, with nothing new, Today says no meaningful change');

    // Watch next cycle.
    await repo.setThreadWatch(loop!.insight!.threadId, true);
    loop = await repo.loadToday();
    check(loop?.insight?.threadStatus === 'watching', 'the thread is watching, through the RPC');

    // A new cycle arrives with the same low sleep week before it.
    const priorStart = seeded.starts[seeded.starts.length - 1];
    const newStart = day(-3);
    must(
      await admin.from('episodes').insert({
        user_id: uid, client_id: 'loop-period-5', logged_at: at(newStart, 9), occurred_on: newStart, occurred_at: at(newStart, 9),
        kinds: ['Period'], period_start: newStart, provenance: 'REPORTED',
      }),
      'new period'
    );
    const periodObs = rows(await admin.from('observations').select('id, value_text').eq('user_id', uid).eq('metric', 'period_start').eq('value_text', newStart), 'period observation');
    const watchSource = rows(await admin.from('health_sources').select('id').eq('user_id', uid).eq('kind', 'apple_health'), 'watch');
    const nights: string[] = [];
    for (let k = 27; k >= 0; k--) nights.push(day(-k));
    const lowWeek = (d: string) => {
      const gap = Math.round((Date.parse(newStart) - Date.parse(d)) / DAY_MS);
      return gap >= 1 && gap <= 7;
    };
    const sleepRows = rows(
      await admin.from('observations').insert(
        nights.map((d) => ({
          user_id: uid, domain: 'sleep', metric: 'sleep_hours', value: lowWeek(d) ? 6.2 : 7.3, unit: 'hours',
          occurred_at: at(d, 7), source_id: watchSource[0].id, provenance: 'MEASURED', dedupe_key: `loop:sleep:${d}`,
        }))
      ).select('id, occurred_at'),
      'sleep'
    );
    const lastLowNight = day(-4);
    const night = sleepRows.find((r) => r.occurred_at.startsWith(lastLowNight))!;
    must(await admin.from('changes').insert({ user_id: uid, metric: 'sleep_hours', from_value: 7.3, to_value: 6.2, window_days: 90, deviation: -1.1, direction: 'lower', quality: 'ok', detected_on: lastLowNight }), 'change');
    must(await admin.from('temporal_links').insert({ user_id: uid, a_observation_id: night.id, b_observation_id: periodObs[0].id, relation: 'within_3d', gap_hours: 26, occurred_on: newStart }), 'link');
    void priorStart;

    must(await admin.rpc('enqueue_job', { uid, job_kind: 'intelligence' }), 'enqueue');
    const second = await post(url, serviceKey);
    check(second.processed && second.threads === 1 && second.insights === 1, 'the new cycle rewrites the insight');
    const thread = rows(await admin.from('threads').select('status, observation_count').eq('user_id', uid), 'thread')[0];
    check(thread.observation_count === 3 && thread.status === 'recurring', 'the thread has been seen three times and is recurring');
    const live = rows(await admin.from('insights').select('id, status').eq('user_id', uid).is('valid_to', null), 'live insight');
    check(live.length === 1 && live[0].status === 'updated', 'one live insight, updated');
    const lessons = rows(await admin.from('learning_events').select('type, key').eq('user_id', uid), 'lessons');
    check(lessons.some((l) => l.type === 'pattern_recurred') && lessons.some((l) => l.type === 'insight_updated'), 'the recurrence and the rewrite are recorded as lessons');
    loop = await repo.loadToday();
    check(loop?.insight?.since === 'updated', 'Today says the insight was updated since her last visit');
    check(loop!.learning.some((l) => l.type === 'pattern_recurred'), 'and lists what was learned since her last visit');
    check(loop!.recommendations.some((r) => r.type === 'prepare'), 'seen three times, she is offered preparing for an appointment');

    // A walk she tried five days ago, with steps the server can measure,
    // and a fresh drop in steps so a walk is offered again today.
    const walkDay = day(-5);
    const metricDays = [-8, -7, -6, -5, -4, -3].map((k) => ({ user_id: uid, day: day(k), steps: k <= -6 ? 3000 : 4200, energy: k <= -6 ? 2 : 3 }));
    must(await admin.from('daily_metrics').insert(metricDays), 'daily metrics');
    const action = rows(
      await admin.from('actions').insert({ user_id: uid, kind: 'walk', title: 'A short walk', metric: 'steps', wanted: 'higher', started_on: walkDay, started_at: at(walkDay, 12), target_end_at: at(day(-2), 12) }).select('id'),
      'action'
    )[0];
    must(await admin.from('changes').insert({ user_id: uid, metric: 'steps', from_value: 6000, to_value: 3000, window_days: 90, deviation: -1.5, direction: 'lower', quality: 'ok', detected_on: day(0) }), 'steps change');
    must(await admin.rpc('enqueue_job', { uid, job_kind: 'intelligence' }), 'enqueue');
    const third = await post(url, serviceKey);
    check(third.processed && third.outcomes === 1, 'the walk is measured');
    const outcome = rows(await admin.from('outcomes').select('id, measured, reported, measured_evidence').eq('action_id', action.id), 'outcome')[0];
    check(outcome.measured === 'improved' && outcome.reported === null, 'measured improved, and nothing reported was invented');
    check(typeof outcome.measured_evidence?.ratio === 'number' && outcome.measured_evidence.ratio > 0.1, 'with the ratio as evidence');
    check((await countRows(admin, uid)).actions === 1 && rows(await admin.from('actions').select('status').eq('id', action.id), 'action')[0].status === 'ended', 'the action ended when its window passed');
    loop = await repo.loadToday();
    check(loop!.actions.some((a) => a.id === action.id && a.outcome?.measured === 'improved'), 'Today lists the walk with its measured outcome');
    check(loop!.learning.some((l) => l.type === 'outcome_measured'), 'and the lesson from it');
    check(loop!.recommendations.some((r) => r.type === 'try'), 'a walk is offered again on the fresh drop in steps');

    // She reports how it went.
    await repo.reportOutcome(action.id, 'improved');
    const fourth = await post(url, serviceKey);
    check(fourth.processed && fourth.learning === 1, 'her report becomes one lesson');
    check(rows(await admin.from('outcomes').select('measured').eq('action_id', action.id), 'outcome')[0].measured === 'improved', 'and the measured half is untouched by her report');

    // Nothing happened: nothing new is written anywhere.
    const before = await countRows(admin, uid);
    must(await admin.rpc('enqueue_job', { uid, job_kind: 'intelligence' }), 'enqueue');
    const fifth = await post(url, serviceKey);
    check(fifth.processed && fifth.insights === 0 && fifth.outcomes === 0 && fifth.learning === 0, 'a run with nothing new writes no insight, outcome or lesson');
    const after = await countRows(admin, uid);
    check(JSON.stringify(before) === JSON.stringify(after), 'row counts are unchanged everywhere');
    await hers.auth.signOut();

    console.log('PASS: the second half of the loop holds');
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
