// Builds the threads in her record and writes an insight about each one
// whose chain holds. This is the reasoning that runs AFTER the arithmetic:
// complete_baselines_job enqueues a job here as its last act
// (supabase/migrations/20260922100200_intelligence_job.sql), so this reads
// the changes and temporal links that run wrote and never a stale window.
//
// Server only, enforced the same way baselines/index.ts enforces it: every
// request must present the service role key as its bearer, checked in
// constant time, and anything else is refused with a 401 before a job is
// claimed. The job carries the user id it was queued for; the caller
// supplies nothing about who this is for.
//
// Three pure modules do the thinking and are tested under node:test from
// src/data: threads.ts counts what recurred, gate.ts decides whether the
// chain from finding to relationship to source can be traced, and
// wording.ts is the only place a sentence is made. This file reads, calls
// them in that order, and writes.
//
// Logging: counts and reasons only. A thread key names two metrics about
// her, and an insight title is a sentence about her; neither is logged.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { keysetFilter, readAllPages } from '../baselines/paging.ts';
import { gate, type GateReason } from './gate.ts';
import {
  buildThreads,
  type ChangeRow,
  type EpisodeRow,
  type JournalRow,
  type LinkRow,
  type ObservationRow,
  type ThreadCandidate,
} from './threads.ts';
import { contextEntry, offending, wordInsight, type ContextEntry } from './wording.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 180 days, twice the baselines window (WINDOW_DAYS in baselines/compute.ts
// is 90). A baseline needs enough days to say what is usual for one
// measure; recurrence needs enough history for two things to have happened
// near each other MORE THAN ONCE, at least a week apart, and for a cycle
// pair that means two completed cycles, which is three period starts and
// can run past 90 days on its own.
export const WINDOW_DAYS = 180;
// A recurring thread that gains no occurrence for this long becomes
// watching: still hers, still shown, no longer the thing that keeps
// happening.
export const WATCHING_AFTER_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const daysApart = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Compares the presented bearer against the service role key in constant
// time, exactly as baselines/index.ts does and for the same reason: a
// plain === stops at the first byte that differs, and how long it takes
// then says how much of a guess was right. This walks the whole expected
// key every call and folds every difference into one accumulator. Nothing
// here is logged.
function bearerIsServiceRole(given: string): boolean {
  const encoder = new TextEncoder();
  const presented = encoder.encode(given);
  const expected = encoder.encode(serviceKey);
  if (expected.length === 0) return false;
  let difference = presented.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= (presented[i] ?? 0) ^ expected[i];
  return difference === 0;
}

type JobRow = { id: string; user_id: string; kind: string; status: string; attempts: number };
type ThreadRow = { id: string; key: string; status: string; observation_count: number; last_observed_at: string | null };
type LiveInsight = { id: string; what_changed: string; connected: string; you_told: string; not_established: string };

// PostgREST renders numeric columns as strings. Number() on the way in, so
// nothing downstream ever concatenates two values it meant to compare.
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

// The status transitions this slice makes, and no other. A thread the
// builder no longer produces (its occurrences have left the window) is
// left as it is.
export function nextStatus(prior: ThreadRow | undefined, candidate: ThreadCandidate, todayIso: string): string {
  if (!prior) return 'new';
  if (candidate.occurrences.length > prior.observation_count) return 'recurring';
  if (prior.status === 'recurring' && daysApart(candidate.lastObservedAt, todayIso) > WATCHING_AFTER_DAYS) return 'watching';
  return prior.status;
}

// Typed `any`: as in baselines, this project has no generated Database
// type to hand createClient, and without one supabase-js infers `never`
// row shapes for every table.
// deno-lint-ignore no-explicit-any
type Admin = any;
// A row as the Data API returns it: an id for the cursor, everything else
// as read and coerced below.
// deno-lint-ignore no-explicit-any
type Row = { id: string } & Record<string, any>;

async function runJob(admin: Admin, job: JobRow): Promise<{ threads: number; insights: number }> {
  const today = new Date();
  const todayIso = isoDay(today);
  const start = new Date(today.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const startIso = isoDay(start);

  // Every read is paged, for the reason paging.ts gives: a read that is
  // complete only because the window happened to be small is a read that
  // silently truncates the woman who has logged the most. Each one orders
  // by the column it pages on and passes that column to keysetFilter.
  const observations = (
    await readAllPages<Row>((after, limit) => {
      const query = admin
        .from('observations')
        .select('id, domain, metric, value, value_text, occurred_at, source_id, provenance, origin_id')
        .eq('user_id', job.user_id)
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', today.toISOString());
      return (after ? query.or(keysetFilter(after)) : query).order('occurred_at').order('id').limit(limit);
    })
  ).map((row): ObservationRow => ({ ...(row as ObservationRow), value: numOrNull(row.value) }));

  const links = (
    await readAllPages<Row>(
      (after, limit) => {
        const query = admin
          .from('temporal_links')
          .select('id, a_observation_id, b_observation_id, relation, gap_hours, occurred_on')
          .eq('user_id', job.user_id)
          .gte('occurred_on', startIso)
          .lte('occurred_on', todayIso);
        return (after ? query.or(keysetFilter(after, 'occurred_on')) : query).order('occurred_on').order('id').limit(limit);
      },
      undefined,
      (row) => ({ occurredAt: row.occurred_on, id: row.id })
    )
  ).map((row): LinkRow => ({ ...(row as LinkRow), gap_hours: num(row.gap_hours) }));

  const changes = (
    await readAllPages<Row>(
      (after, limit) => {
        const query = admin
          .from('changes')
          .select('id, metric, direction, detected_on, detected_at, deviation, quality, from_value, to_value, window_days')
          .eq('user_id', job.user_id)
          .gte('detected_on', startIso)
          .lte('detected_on', todayIso);
        return (after ? query.or(keysetFilter(after, 'detected_at')) : query).order('detected_at').order('id').limit(limit);
      },
      undefined,
      (row) => ({ occurredAt: row.detected_at, id: row.id })
    )
  ).map(
    (row): ChangeRow => ({
      id: row.id,
      metric: row.metric,
      direction: row.direction,
      detected_on: row.detected_on,
      deviation: num(row.deviation),
      quality: row.quality,
      from_value: num(row.from_value),
      to_value: num(row.to_value),
      window_days: num(row.window_days),
    })
  );

  const episodes = (
    await readAllPages<Row>((after, limit) => {
      const query = admin
        .from('episodes')
        .select('id, occurred_on, occurred_at, kinds, period_start')
        .eq('user_id', job.user_id)
        .gte('occurred_on', startIso)
        .lte('occurred_on', todayIso);
      return (after ? query.or(keysetFilter(after)) : query).order('occurred_at').order('id').limit(limit);
    })
  ).map((row): EpisodeRow => ({ id: row.id, occurred_on: row.occurred_on, kinds: row.kinds ?? [], period_start: row.period_start }));

  const journals = (
    await readAllPages<Row>((after, limit) => {
      const query = admin
        .from('journal_entries')
        .select('id, occurred_at')
        .eq('user_id', job.user_id)
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', today.toISOString());
      return (after ? query.or(keysetFilter(after)) : query).order('occurred_at').order('id').limit(limit);
    })
  ).map((row): JournalRow => ({ id: row.id, occurred_on: String(row.occurred_at).slice(0, 10) }));

  const candidates = buildThreads({ changes, links, observations, episodes, journals });

  const { data: priorRows, error: priorError } = await admin
    .from('threads')
    .select('id, key, status, observation_count, last_observed_at')
    .eq('user_id', job.user_id);
  if (priorError) throw priorError;
  const prior = new Map<string, ThreadRow>(((priorRows ?? []) as ThreadRow[]).map((t) => [t.key, t]));
  const byObservation = new Map(observations.map((o) => [o.id, o]));

  let written = 0;
  const withheld: Record<GateReason, number> = { no_finding: 0, no_relationship: 0, no_source: 0, insufficient_recurrence: 0, stale: 0 };

  for (const candidate of candidates) {
    const status = nextStatus(prior.get(candidate.key), candidate, todayIso);
    // Components and the names of what is missing; never a score.
    const confidence = { recurrence: candidate.recurrence, occurrences: candidate.occurrences.length, missing: candidate.missing };
    const { data: thread, error: threadError } = await admin
      .from('threads')
      .upsert(
        {
          user_id: job.user_id,
          key: candidate.key,
          title: candidate.title,
          status,
          domains: candidate.domains,
          first_observed_at: candidate.firstObservedAt,
          last_observed_at: candidate.lastObservedAt,
          observation_count: candidate.occurrences.length,
          confidence,
        },
        { onConflict: 'user_id,key' }
      )
      .select('id')
      .single();
    if (threadError) throw threadError;

    // The trace is replaced whole: what THIS run can point at, not an
    // accumulation of what earlier runs once could.
    const { error: clearError } = await admin.from('thread_evidence').delete().eq('thread_id', thread.id);
    if (clearError) throw clearError;
    const evidenceRows = candidate.evidence.map((e) => ({
      user_id: job.user_id,
      thread_id: thread.id,
      role: e.role,
      observation_id: e.observationId ?? null,
      change_id: e.changeId ?? null,
      link_id: e.linkId ?? null,
      note: e.linkId ? 'occurrence' : e.changeId ? 'finding' : 'context',
    }));
    if (evidenceRows.length > 0) {
      const { error: evidenceError } = await admin.from('thread_evidence').insert(evidenceRows);
      if (evidenceError) throw evidenceError;
    }

    const verdict = gate(candidate, { changes, links, observations }, todayIso);
    if (!verdict.pass) {
      withheld[verdict.reason] += 1;
      continue;
    }

    const context = candidate.evidence
      .filter((e) => e.role === 'user_reported' && e.observationId)
      .map((e) => byObservation.get(e.observationId!))
      .filter((o): o is ObservationRow => !!o)
      .map(contextEntry)
      .filter((c): c is ContextEntry => !!c);
    const text = wordInsight(candidate, { changes, context });

    // Proved before a row is written, not assumed from the tests. A
    // forbidden word here is a bug in wording.ts; the row is withheld
    // rather than written and puzzled over later.
    const sentences = [text.title, text.whatChanged, text.connected, text.youTold, ...text.notEstablished, ...text.alternatives];
    if (sentences.some((s) => offending(s) !== null)) {
      console.error('intelligence wording refused');
      continue;
    }

    const notEstablished = text.notEstablished.join('\n');
    const { data: live, error: liveError } = await admin
      .from('insights')
      .select('id, what_changed, connected, you_told, not_established')
      .eq('thread_id', thread.id)
      .is('valid_to', null)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (liveError) throw liveError;
    const current = live as LiveInsight | null;

    if (
      current &&
      current.what_changed === text.whatChanged &&
      current.connected === text.connected &&
      current.you_told === text.youTold &&
      current.not_established === notEstablished
    ) {
      // The same four parts: seen again, nothing new to say. The touch
      // trigger moves updated_at.
      const { error: continueError } = await admin.from('insights').update({ status: 'continuing' }).eq('id', current.id);
      if (continueError) throw continueError;
      continue;
    }
    if (current) {
      const { error: closeError } = await admin.from('insights').update({ valid_to: today.toISOString() }).eq('id', current.id);
      if (closeError) throw closeError;
    }
    const { error: insertError } = await admin.from('insights').insert({
      user_id: job.user_id,
      thread_id: thread.id,
      title: text.title,
      what_changed: text.whatChanged,
      connected: text.connected,
      you_told: text.youTold,
      not_established: notEstablished,
      alternatives: text.alternatives,
      status: current ? 'updated' : 'new',
      confidence,
    });
    if (insertError) throw insertError;
    written += 1;
  }

  console.log('intelligence threads upserted', candidates.length);
  console.log('intelligence insights written', written);
  console.log('intelligence insights withheld', JSON.stringify(withheld));
  return { threads: candidates.length, insights: written };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not supported' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!bearerIsServiceRole(bearer)) return json({ error: 'Not allowed' }, 401);

  const admin: Admin = createClient(url, serviceKey);

  const { data: job, error: claimError } = await admin.rpc('claim_intelligence_job').single();
  if (claimError) {
    // `.single()` errors when the function returns no row: the normal
    // empty queue case, not a failure.
    if (claimError.code === 'PGRST116') return json({ processed: false });
    console.error('intelligence claim failed', claimError.code ?? 'unknown');
    return json({ error: 'Could not claim a job' }, 500);
  }
  if (!job) return json({ processed: false });

  try {
    const result = await runJob(admin, job as JobRow);
    const { error: completeError } = await admin.rpc('complete_intelligence_job', { job_id: (job as JobRow).id });
    if (completeError) throw completeError;
    // Sweeps done rows of every kind, so it is reused rather than copied.
    const { error: cleanupError } = await admin.rpc('cleanup_baselines_jobs');
    if (cleanupError) throw cleanupError;
    return json({ processed: true, ...result });
  } catch (e) {
    const errorName = e instanceof Error ? e.name : 'unknown';
    console.error('intelligence job failed', errorName);
    const { error: failError } = await admin.rpc('fail_intelligence_job', { job_id: (job as JobRow).id, error_name: errorName });
    if (failError) console.error('intelligence fail_intelligence_job also failed', failError.code ?? 'unknown');
    return json({ error: 'Intelligence did not finish' }, 500);
  }
});
