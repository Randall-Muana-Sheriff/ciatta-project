// Writes her health profile: her own rows in, one checked paragraph out.
//
// Called by the app with her access token, never with a service role key.
// The client it builds carries that token, so every read below runs as her
// under RLS and the function cannot see another woman's record even if the
// code asked it to. The user id comes from the verified token, never from
// the request body.
//
// The model never decides what is true. summary.ts gathers the facts from
// her rows, the prompt is given those facts and told it may add nothing,
// and the answer is checked against them before it is stored. A summary
// that fails goes in the bin and the caller falls back to the sentence the
// app writes itself, so there is no path where unchecked model text reaches
// her.
//
// Logging: counts and rejection reasons only. The facts are her health
// information and the summary is a paragraph about her; neither is logged.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { checkSummary, summaryPrompt, type SummaryFacts } from './summary.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openAiKey = Deno.env.get('OPENAI_API_KEY');

const MODEL = 'gpt-4o-mini';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// The newest value for each measured field, with the day it is from. Read
// here rather than passed in, so the model can only be told what the record
// actually holds.
type DayRow = {
  day: string;
  steps: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  active_minutes: number | null;
};

function newestReadings(days: DayRow[]): SummaryFacts['readings'] {
  const ordered = [...days].sort((a, b) => (a.day < b.day ? 1 : -1));
  const fields: [string, keyof DayRow, (n: number) => string][] = [
    ['Steps', 'steps', (n) => Math.round(n).toLocaleString('en-US')],
    ['Sleep time', 'sleep_hours', (n) => `${Math.floor(n)}h ${Math.round((n - Math.floor(n)) * 60)}m`],
    ['Resting heart rate', 'resting_hr', (n) => `${Math.round(n)} bpm`],
    ['Heart rate variability', 'hrv', (n) => `${Math.round(n)} ms`],
    ['Active minutes', 'active_minutes', (n) => `${Math.round(n)} min`],
  ];
  const out: SummaryFacts['readings'] = [];
  for (const [label, key, say] of fields) {
    const found = ordered.find((d) => typeof d[key] === 'number' && d[key] !== null);
    if (!found) continue;
    out.push({ label, value: say(found[key] as number), on: found.day });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not allowed' }, 401);

  // Her token, her client, her rows. Nothing below widens that.
  const db = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: who, error: whoError } = await db.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'Not allowed' }, 401);
  const uid = who.user.id;

  if (!openAiKey) {
    // Configuration, not her problem. The app falls back to its own
    // sentence, which is why this is a clean no rather than a 500.
    console.log('health-summary: no OPENAI_API_KEY configured');
    return json({ summary: null, reason: 'not_configured' });
  }

  const [profileRes, conditionsRes, medsRes, supsRes, daysRes, countRes] = await Promise.all([
    db.from('profiles').select('first_name, onboarding').eq('id', uid).maybeSingle(),
    db.from('conditions').select('kind, name'),
    db.from('medications').select('name'),
    db.from('supplements').select('name'),
    db.from('daily_metrics').select('day, steps, sleep_hours, resting_hr, hrv, active_minutes').order('day', { ascending: false }).limit(120),
    db.from('observations').select('id', { count: 'exact', head: true }),
  ]);

  const onboarding = (profileRes.data?.onboarding ?? {}) as Record<string, unknown>;
  const named = (conditionsRes.data ?? []) as { kind: string; name: string }[];
  const days = (daysRes.data ?? []) as DayRow[];

  const facts: SummaryFacts = {
    name: profileRes.data?.first_name ?? null,
    ageRange: (onboarding.ageRange as string) ?? null,
    lifeStage: (onboarding.lifeStage as string) ?? null,
    opening: null,
    intents: (onboarding.intents as string[]) ?? [],
    conditions: named.filter((c) => c.kind === 'condition').map((c) => c.name),
    surgeries: named.filter((c) => c.kind === 'surgery').map((c) => c.name),
    symptoms: named.filter((c) => c.kind === 'symptom').map((c) => c.name),
    medications: (medsRes.data ?? []).map((m: { name: string }) => m.name),
    supplements: (supsRes.data ?? []).map((m: { name: string }) => m.name),
    goals: (onboarding.goals as string[]) ?? [],
    readings: newestReadings(days),
    observationCount: countRes.count ?? 0,
    daysOfHistory: days.length,
  };

  const { system, user } = summaryPrompt(facts);

  let text = '';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.log('health-summary: model call failed', res.status);
      return json({ summary: null, reason: 'model_unavailable' });
    }
    const body = await res.json();
    text = String(body?.choices?.[0]?.message?.content ?? '');
  } catch {
    console.log('health-summary: model call threw');
    return json({ summary: null, reason: 'model_unavailable' });
  }

  const rejections = checkSummary(text, facts);
  if (rejections.length > 0) {
    // Reasons, never the text. A rejected summary is exactly the kind of
    // sentence that should not be written to a log.
    console.log('health-summary: rejected', JSON.stringify(rejections.map((r) => r.reason)));
    return json({ summary: null, reason: 'rejected', rejections: rejections.map((r) => r.reason) });
  }

  const summary = text.trim();
  const { error: writeError } = await db
    .from('health_summaries')
    .upsert({ user_id: uid, summary, model: MODEL, facts_count: facts.observationCount }, { onConflict: 'user_id' });
  if (writeError) {
    // She still gets the paragraph. Failing to cache it is not a reason to
    // withhold it.
    console.log('health-summary: write failed');
  }

  return json({ summary, reason: 'ok' });
});
