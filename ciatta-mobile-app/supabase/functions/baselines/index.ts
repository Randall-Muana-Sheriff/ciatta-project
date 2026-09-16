// Works out what is usual for one person from her own history, and what
// has moved against it. This function is server only: there is no caller
// identity to verify, because the job it claims already carries the user
// id it was queued for (a daily_metrics write enqueues it through a
// database trigger; see supabase/migrations/20260915100900_jobs.sql). It
// is meant to be invoked by a scheduler holding the service role key, not
// by the app.
//
// Claiming, completing and failing a job all go through RPC functions
// (supabase/migrations/20260916100000_claim_baselines_job.sql) rather than
// the Data API's table routes, because "claim the oldest pending job,
// skipping any another run already has locked" needs one atomic SQL
// statement that a REST filter can't express.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  computeMetric,
  computeTempDeviations,
  buildDenseWindow,
  isoDay,
  METRICS,
  WINDOW_DAYS,
  WINDOW_SIZE,
  type Metric,
} from './compute.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type JobRow = {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  attempts: number;
};

// Typed `any`: as in ingest-health and delete-account, this project has no
// generated Database type to hand createClient, and without one
// supabase-js infers `never` row shapes for every table, which is worse
// than an explicit any here.
async function runJob(admin: any, job: JobRow): Promise<{ metrics: string[] }> {
  const today = new Date();
  const start = new Date(today.getTime() - (WINDOW_SIZE - 1) * 24 * 60 * 60 * 1000);
  const startIso = isoDay(start);
  const todayIso = isoDay(today);

  const { data: rows, error: rowsError } = await admin
    .from('daily_metrics')
    .select('day, sleep_hours, steps, resting_hr, hrv, active_minutes')
    .eq('user_id', job.user_id)
    .gte('day', startIso)
    .lte('day', todayIso)
    .order('day');
  if (rowsError) throw rowsError;

  const computed: string[] = [];
  for (const metric of METRICS) {
    const byDay = new Map<string, number>();
    for (const row of rows ?? []) {
      const value = (row as Record<Metric, number | null>)[metric];
      if (value != null) byDay.set(row.day as string, value);
    }
    const { dates, values } = buildDenseWindow(byDay, today, WINDOW_SIZE);
    const result = computeMetric(dates, values);
    if (!result) continue; // never measured; no row, not an insufficient one full of nulls

    const { error: baselineError } = await admin.from('baselines').upsert(
      {
        user_id: job.user_id,
        metric,
        window_days: WINDOW_DAYS,
        median: result.baseline.median,
        low: result.baseline.low,
        high: result.baseline.high,
        variability: result.baseline.variability,
        n: result.baseline.n,
        sufficient: result.baseline.sufficient,
        computed_at: today.toISOString(),
      },
      { onConflict: 'user_id,metric,window_days' }
    );
    if (baselineError) throw baselineError;

    if (result.change) {
      const { error: changeError } = await admin.from('changes').upsert(
        {
          user_id: job.user_id,
          metric,
          from_value: result.change.fromValue,
          to_value: result.change.toValue,
          window_days: WINDOW_DAYS,
          deviation: result.change.deviation,
          direction: result.change.direction,
          quality: result.change.quality,
          detected_on: result.change.detectedOn,
          detected_at: today.toISOString(),
        },
        { onConflict: 'user_id,metric,detected_on' }
      );
      if (changeError) throw changeError;
    }

    computed.push(metric);
  }

  // Wrist temperature has no daily_metrics column of its own (Task 4's
  // review found both temperature specs are absolute readings, not the
  // small nightly change from usual temp_deviation means), so it is read
  // from her observations directly rather than from the rows above.
  const { data: tempRows, error: tempError } = await admin
    .from('observations')
    .select('occurred_at, value')
    .eq('user_id', job.user_id)
    .eq('domain', 'vitals')
    .eq('metric', 'wrist_temperature')
    .gte('occurred_at', start.toISOString())
    .lte('occurred_at', today.toISOString());
  if (tempError) throw tempError;

  const tempByDay = new Map<string, { sum: number; count: number }>();
  for (const row of tempRows ?? []) {
    if (row.value == null) continue;
    const day = isoDay(new Date(row.occurred_at as string));
    const bucket = tempByDay.get(day) ?? { sum: 0, count: 0 };
    bucket.sum += row.value as number;
    bucket.count += 1;
    tempByDay.set(day, bucket);
  }
  const tempAverages = new Map<string, number>();
  for (const [day, { sum, count }] of tempByDay) tempAverages.set(day, sum / count);

  const { dates: tempDates, values: tempValues } = buildDenseWindow(tempAverages, today, WINDOW_SIZE);
  const deviations = computeTempDeviations(tempDates, tempValues);
  if (deviations.length > 0) {
    // Every row here shares exactly the same three keys, so one bulk
    // upsert is safe: unlike ingest-health's per-day rows (which vary in
    // which columns they carry, and so must go one at a time), a shared
    // SET clause here can only ever touch temp_deviation.
    const { error: tempWriteError } = await admin
      .from('daily_metrics')
      .upsert(
        deviations.map((d) => ({ user_id: job.user_id, day: d.day, temp_deviation: d.value })),
        { onConflict: 'user_id,day' }
      );
    if (tempWriteError) throw tempWriteError;
  }

  return { metrics: computed };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not supported' }, 405);

  const admin: any = createClient(url, serviceKey);

  const { data: job, error: claimError } = await admin.rpc('claim_baselines_job').single();
  if (claimError) {
    // A `.single()` RPC call errors when the function returns no row
    // (nothing pending), which is the normal empty queue case, not a
    // failure.
    if (claimError.code === 'PGRST116') return json({ processed: false });
    console.error('baselines claim failed', claimError.code ?? 'unknown');
    return json({ error: 'Could not claim a job' }, 500);
  }
  if (!job) return json({ processed: false });

  try {
    const { metrics } = await runJob(admin, job as JobRow);
    const { error: completeError } = await admin.rpc('complete_baselines_job', { job_id: (job as JobRow).id });
    if (completeError) throw completeError;
    const { error: cleanupError } = await admin.rpc('cleanup_baselines_jobs');
    if (cleanupError) throw cleanupError;
    return json({ processed: true, metrics });
  } catch (e) {
    const errorName = e instanceof Error ? e.name : 'unknown';
    console.error('baselines job failed', errorName);
    const { error: failError } = await admin.rpc('fail_baselines_job', { job_id: (job as JobRow).id, error_name: errorName });
    if (failError) console.error('baselines fail_baselines_job also failed', failError.code ?? 'unknown');
    return json({ error: 'Baselines did not finish' }, 500);
  }
});
