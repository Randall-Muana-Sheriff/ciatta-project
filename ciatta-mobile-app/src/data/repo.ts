import type { SupabaseClient } from '@supabase/supabase-js';

import type { Attachment } from '../lib/attachments';
import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import type { Answers as OnboardingAnswers } from '../lib/onboarding';
import type { DailyRow } from '../lib/healthMetrics';
import { type Day, loadDays as loadSampleDays } from './daily';
import { daysFromRows } from './dailyRows';
import type { Episode } from './cycleLog';
import { type EvidenceRow, type InsightRow, insightView, type InsightView } from './insightRows';
import { type OutcomeValue, type TodayLoop, todayLoop } from './loopRows';
import { paginateAll } from './pagination';
import {
  type DbSourceKind,
  type DbSourceStatus,
  episodeToRow,
  type EpisodeRow,
  type JournalRow,
  type JournalView,
  journalView,
  rowToEpisode,
  type SourceRow,
  sourceView,
  type SourceView,
} from './rows';
import { type EntryKind, insight as sampleInsight, journal, person, sources } from './sample';
import { VITAL_METRICS } from '../lib/vitals';

// Every daily_metrics column daysFromRows/rowToDay actually reads. Named
// explicitly, like every other realRepo method, rather than select('*'),
// which would also pull id, user_id, source_id, provenance, metadata,
// occurred_at, created_at and updated_at: real columns, just not ones this
// projection has any use for.
const DAILY_COLUMNS =
  'day, sleep_hours, stage_awake, stage_rem, stage_light, stage_deep, time_in_bed, steps, active_minutes, workouts, resting_hr, hrv, temp_deviation, energy, mood, stress, caffeine, alcohol, foods, digestion, note';

// An insight with its thread embedded, and the thread's evidence with the
// row each piece points at. The two observation joins on a link are named
// by their foreign keys because temporal_links reaches observations twice.
const INSIGHT_COLUMNS =
  'id, thread_id, title, what_changed, connected, you_told, not_established, alternatives, status, confidence, valid_from, updated_at, threads(key, title, status, domains, observation_count, first_observed_at, last_observed_at, confidence)';
const OBSERVATION_REF = 'metric, domain, value, value_text, unit, occurred_at';
const EVIDENCE_COLUMNS =
  `role, note, created_at, observations(${OBSERVATION_REF}), changes(metric, direction, from_value, to_value, detected_on), ` +
  `temporal_links(occurred_on, a:observations!temporal_links_a_observation_id_fkey(${OBSERVATION_REF}), b:observations!temporal_links_b_observation_id_fkey(${OBSERVATION_REF})), ` +
  'research_refs(title, publication, year, summary)';

// The name each source kind is stored and shown under. Only apple_health is
// ever written by saveSourceStatus today; the rest are named so the mapping
// is total, not because anything else calls it yet.
const SOURCE_NAME: Record<DbSourceKind, string> = {
  apple_health: 'Apple Health',
  health_connect: 'Health Connect',
  lab: 'Lab',
  document: 'Document',
  manual: 'Manual',
  user_report: 'You',
};

// Where screens get their record. Demo serves the sample person and keeps
// nothing; real reads and writes her own rows, protected by RLS.
export type Repo = {
  mode: 'demo' | 'real';
  loadEpisodes(): Promise<Episode[]>;
  saveEpisode(e: Episode, extra?: Record<string, unknown>): Promise<void>;
  loadCycleProfile(): Promise<CycleProfile | null>;
  saveCycleProfile(p: CycleProfile): Promise<void>;
  // Null until she finishes the first session. The Gate reads this to decide
  // whether to show onboarding, so an unfinished session resumes rather than
  // being skipped.
  loadOnboardedAt(): Promise<string | null>;
  // One call rather than a save per step, because a half written first
  // session is worse than none: it would leave her with a record that says
  // things she never finished saying. Everything lands or nothing does.
  completeOnboarding(a: OnboardingAnswers): Promise<void>;
  loadJournal(): Promise<JournalView>;
  // Files ride along in metadata, as they do on an episode. Optional, so a
  // caller with nothing attached passes nothing.
  addJournal(text: string, kind: EntryKind, attachments?: Attachment[]): Promise<void>;
  loadSources(): Promise<SourceView[]>;
  loadDays(): Promise<Day[]>;
  // Her newest live insight, or null when the server has not written one:
  // the Insight screen shows its empty note then, never the sample.
  loadInsight(): Promise<InsightView | null>;
  // The loop, as get_today() composes it: the newest insight with what
  // changed about it since she last looked, her offers, what she is
  // trying, and what was learned. Null in demo mode, where the local store
  // keeps the sample loop in memory.
  loadToday(): Promise<TodayLoop | null>;
  recordVisit(): Promise<void>;
  recordInsightView(insightId: string): Promise<void>;
  setThreadWatch(threadId: string, watching: boolean): Promise<void>;
  // Returns the action's id, or null in demo mode.
  startAction(input: StartAction): Promise<string | null>;
  reportOutcome(actionId: string, reported: OutcomeValue): Promise<void>;
  dismissRecommendation(id: string, reason: string): Promise<void>;
  // Real mode only: writes or updates the row for one source kind, keyed by
  // (user_id, kind, name) so a repeat call updates the same row instead of
  // creating a duplicate. Omitting lastSyncedAt leaves whatever was already
  // stored there untouched, rather than clearing it.
  saveSourceStatus(kind: DbSourceKind, status: DbSourceStatus, lastSyncedAt?: string): Promise<void>;
  firstName(): Promise<string | null>;
  // Today's measured readings, by the hour they happened.
  //
  // daily_metrics holds one row per day, which is the wrong shape for a
  // chart of a day. These come from observations, which carry the time each
  // sample was taken, so the line is drawn where readings actually are.
  loadIntraday(sinceIso: string): Promise<IntradayPoint[]>;
  // What she reported about herself: conditions, surgeries, medications and
  // supplements, as she named them. Written at onboarding and never
  // inferred, which is why the brief can print them as hers.
  loadReported(): Promise<Reported>;
  // Reviewed reference rows, which are the only thing the Care agent is
  // allowed to cite. Reference data with no owner, so every signed in
  // person reads the same rows.
  loadReferences(): Promise<ReferenceRow[]>;
  // The newest reading of each vital that never folded into a daily row:
  // blood pressure, blood oxygen, weight.
  loadVitals(): Promise<VitalReading[]>;
};

// A published finding, quoted. summary is verbatim from the source, which
// is why the agent may show it without summarising it further.
export type VitalReading = { metric: string; value: number; unit: string | null; at: string };

export type ReferenceRow = {
  id: string;
  title: string;
  publication: string | null;
  year: number | null;
  url: string | null;
  summary: string;
  domains: string[];
};

export type Reported = { conditions: string[]; surgeries: string[]; medications: string[]; supplements: string[] };

// One measured sample with the moment it was taken. value_text carries the
// sleep stage for sleep_analysis, where there is no number to plot.
export type IntradayPoint = { metric: string; value: number | null; valueText: string | null; at: string };

export type StartAction = {
  kind: string;
  title: string;
  intent?: string;
  metric?: string;
  wanted?: 'higher' | 'lower';
  insightId?: string;
  recommendationId?: string;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function demoRepo(): Repo {
  let own: Episode[] = [];
  let view: JournalView = journal;
  return {
    mode: 'demo',
    loadEpisodes: async () => own,
    saveEpisode: async (e) => {
      own = [...own.filter((x) => x.id !== e.id), e];
    },
    loadCycleProfile: async () => null,
    saveCycleProfile: async () => {},
    // Demo never onboards: the example person arrives with a record already
    // built, and walking a first session for someone who is not her would
    // teach the wrong thing about what Ciatta does with her answers.
    loadOnboardedAt: async () => new Date().toISOString(),
    completeOnboarding: async () => {},
    loadJournal: async () => view,
    addJournal: async (text, kind, attachments = []) => {
      const d = new Date();
      const month = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      const item = { text, date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, tag: kind, kind, usedInInsight: false, attachments };
      const rest = view.months.filter((m) => m.month !== month);
      const current = view.months.find((m) => m.month === month);
      view = { ...view, count: view.count + 1, months: [{ month, items: [item, ...(current?.items ?? [])] }, ...rest] };
    },
    loadSources: async () => sources,
    loadDays: async () => loadSampleDays(),
    loadInsight: async () => sampleInsight,
    loadToday: async () => null,
    recordVisit: async () => {},
    recordInsightView: async () => {},
    setThreadWatch: async () => {},
    startAction: async () => null,
    reportOutcome: async () => {},
    dismissRecommendation: async () => {},
    saveSourceStatus: async () => {},
    firstName: async () => person.firstName,
    // The example person's day. Demo is explicitly not her record, so a
    // drawn day here is an illustration rather than a claim.
    loadIntraday: async () => sampleIntraday(),
    loadReported: async () => ({
      conditions: ['Endometriosis'],
      surgeries: [],
      medications: ['Levothyroxine'],
      supplements: ['Magnesium'],
    }),
    loadVitals: async () => [
      { metric: 'blood_pressure_systolic', value: 118, unit: 'mmHg', at: new Date().toISOString() },
      { metric: 'blood_pressure_diastolic', value: 76, unit: 'mmHg', at: new Date().toISOString() },
      { metric: 'oxygen_saturation', value: 0.98, unit: '%', at: new Date().toISOString() },
      { metric: 'body_mass', value: 64.2, unit: 'kg', at: new Date().toISOString() },
    ],
    loadReferences: async () => [
      {
        id: 'sample-endo-delay',
        title: 'Endometriosis: A Review',
        publication: 'JAMA',
        year: 2025,
        url: 'https://doi.org/10.1001/jama.2025.2975',
        summary:
          'The diagnosis is often delayed, averaging 5 to 12 years after onset of symptoms, with most women consulting 3 or more clinicians prior to diagnosis.',
        domains: ['endometriosis', 'diagnosis'],
      },
    ],
  };
}

// A plausible day for the example person: a night, then a heart rate that
// rises through the morning and settles after lunch. Deterministic, so the
// demo screen does not change shape between launches.
function sampleIntraday(): IntradayPoint[] {
  const base = new Date();
  const at = (h: number, m = 0) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const hr: [number, number][] = [
    [7, 62], [8, 68], [9, 74], [10, 71], [11, 69], [12, 73], [13, 70], [14, 66], [15, 64], [16, 63],
  ];
  return [
    { metric: 'sleep_analysis', value: null, valueText: 'asleep_core', at: at(6, 26) },
    ...hr.map(([h, v]) => ({ metric: 'heart_rate', value: v, valueText: null, at: at(h) })),
  ];
}

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

// PostgREST caps one response at max_rows (1000), so a plain select would
// quietly hand back only part of her record once she has logged more than
// that. Every list read is paged, in an order that cannot shift between
// pages: the time it happened, then her own id for anything logged in the
// same moment.
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export function realRepo(db: SupabaseClient, userId: string): Repo {
  return {
    mode: 'real',
    async loadEpisodes() {
      const rows = await paginateAll<EpisodeRow>(
        (from, to) => db.from('episodes').select('*').order('occurred_at').order('client_id').range(from, to) as unknown as Page<EpisodeRow>,
      );
      return rows.map(rowToEpisode);
    },
    async saveEpisode(e, extra = {}) {
      must(await db.from('episodes').upsert({ ...episodeToRow(e, extra), user_id: userId }, { onConflict: 'user_id,client_id' }));
    },
    async loadCycleProfile() {
      const row = must(await db.from('profiles').select('cycle_profile').eq('id', userId).maybeSingle()) as { cycle_profile: unknown } | null;
      return normalizeProfile(row?.cycle_profile);
    },
    async saveCycleProfile(p) {
      must(await db.from('profiles').update({ cycle_profile: p }).eq('id', userId));
    },
    async loadOnboardedAt() {
      const row = must(
        await db.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle(),
      ) as { onboarded_at: string | null } | null;
      return row?.onboarded_at ?? null;
    },
    async completeOnboarding(a) {
      const now = new Date().toISOString();

      // Her own words first, and on their own row. They go to raw_inputs
      // rather than into the profile blob because they are evidence: a
      // sentence she wrote, at a time, in a mode, which a later interpretation
      // can point back at. parse_status stays pending, since nothing has read
      // it yet and marking it parsed would claim work that did not happen.
      const opening = a.opening.trim();
      if (opening) {
        must(
          await db.from('raw_inputs').insert({
            user_id: userId,
            text: opening,
            input_mode: a.openingMode === 'spoken' ? 'spoken' : 'typed',
            parse_status: 'pending',
            occurred_at: now,
            metadata: { source: 'onboarding' },
          }),
        );
      }

      // Conditions and surgeries, one row each, REPORTED and status unknown.
      // The default is deliberate: that she listed something does not
      // establish it is current, and the column default says so.
      // Symptoms join conditions and surgeries here rather than becoming
      // episodes, because she gave no date and no severity and an episode
      // without those is an occurrence nobody reported. status stays at the
      // column default of unknown for the same reason: that she named it does
      // not establish she has it today.
      const named = [
        ...a.conditions.map((name) => ({ name, kind: 'condition' as const })),
        ...a.surgeries.map((name) => ({ name, kind: 'surgery' as const })),
        ...a.symptoms.map((name) => ({ name, kind: 'symptom' as const })),
      ].filter((r) => r.name.trim());
      if (named.length) {
        must(
          await db.from('conditions').insert(
            named.map((r) => ({ user_id: userId, kind: r.kind, name: r.name.trim(), provenance: 'REPORTED' })),
          ),
        );
      }

      // Medications and supplements. No dose and no start date: she was not
      // asked, and writing a null is honest where inventing "as needed" would
      // not be.
      const meds = a.medications.map((n) => n.trim()).filter(Boolean);
      if (meds.length) {
        must(
          await db.from('medications').insert(
            meds.map((name) => ({ user_id: userId, name, provenance: 'REPORTED', occurred_at: now })),
          ),
        );
      }
      const sups = a.supplements.map((n) => n.trim()).filter(Boolean);
      if (sups.length) {
        must(
          await db.from('supplements').insert(
            sups.map((name) => ({ user_id: userId, name, provenance: 'REPORTED', occurred_at: now })),
          ),
        );
      }

      // The name she gave wins over the one the sign in trigger copied out of
      // her Google or Apple account. The email authenticates her; it does not
      // get to decide what she is called.
      //
      // Only written when she actually typed one. An empty string over the
      // provider's name would leave a woman who skipped the question with no
      // name at all, which is worse than a name she did not choose.
      const name = a.name.trim();

      // The profile last, and onboarded_at with it. If any write above threw,
      // this one never runs and onboarded_at stays null, so the next launch
      // resumes the first session rather than dropping her into a Today built
      // on half an answer.
      must(
        await db
          .from('profiles')
          .update({
            ...(name ? { first_name: name } : {}),
            onboarded_at: now,
            onboarding: {
              intents: a.intents,
              ageRange: a.ageRange,
              lifeStage: a.lifeStage,
              cycle:
                a.cycleLength == null && a.cycleRegular == null && a.lastPeriodOn == null
                  ? null
                  : { length: a.cycleLength, regular: a.cycleRegular, lastPeriodOn: a.lastPeriodOn },
              goals: a.goals,
              symptoms: a.symptoms,
              skipped: a.skipped,
            },
          })
          .eq('id', userId),
      );
    },
    async loadJournal() {
      const rows = await paginateAll<JournalRow>(
        (from, to) =>
          db
            .from('journal_entries')
            .select('client_id, text, kind, tag, occurred_at, metadata')
            .order('occurred_at')
            .order('client_id')
            .range(from, to) as unknown as Page<JournalRow>,
      );
      return journalView(rows);
    },
    async addJournal(text, kind, attachments = []) {
      must(
        await db.from('journal_entries').insert({
          user_id: userId,
          client_id: `j-${Date.now()}`,
          text,
          kind,
          occurred_at: new Date().toISOString(),
          metadata: attachments.length ? { attachments } : {},
        }),
      );
    },
    async loadSources() {
      const rows = must(await db.from('health_sources').select('kind, name, status, last_synced_at, created_at').order('created_at')) as SourceRow[];
      return rows.map(sourceView);
    },
    async loadDays() {
      const rows = await paginateAll<DailyRow>(
        (from, to) =>
          db
            .from('daily_metrics')
            .select(DAILY_COLUMNS)
            .order('day')
            .range(from, to) as unknown as Page<DailyRow>,
      );
      return daysFromRows(rows, new Date());
    },
    async loadInsight() {
      // One row: the newest insight still in force (valid_to null) that she
      // has not dismissed. Its thread's evidence is a few rows per
      // occurrence over a 180 day window, well under max_rows, so neither
      // read pages.
      const row = must(
        await db
          .from('insights')
          .select(INSIGHT_COLUMNS)
          .is('valid_to', null)
          .neq('status', 'dismissed')
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as InsightRow | null;
      if (!row) return null;
      // Through unknown because supabase-js's select parser cannot type the
      // two foreign key named joins on a link; the shape is EvidenceRow.
      const evidence = must(
        await db.from('thread_evidence').select(EVIDENCE_COLUMNS).eq('thread_id', row.thread_id).order('created_at'),
      ) as unknown as EvidenceRow[];
      return insightView(row, evidence);
    },
    async loadToday() {
      return todayLoop(must(await db.rpc('get_today')));
    },
    async recordVisit() {
      must(await db.rpc('record_visit'));
    },
    async recordInsightView(insightId) {
      must(await db.rpc('record_insight_view', { p_insight_id: insightId }));
    },
    async setThreadWatch(threadId, watching) {
      must(await db.rpc('set_thread_watch', { p_thread_id: threadId, p_watching: watching }));
    },
    async startAction(input) {
      const id = must(
        await db.rpc('start_action', {
          p_kind: input.kind,
          p_title: input.title,
          p_intent: input.intent ?? null,
          p_metric: input.metric ?? null,
          p_wanted: input.wanted ?? null,
          p_insight_id: input.insightId ?? null,
          p_recommendation_id: input.recommendationId ?? null,
        }),
      ) as unknown;
      return typeof id === 'string' ? id : null;
    },
    async reportOutcome(actionId, reported) {
      must(await db.rpc('report_outcome', { p_action_id: actionId, p_reported: reported }));
    },
    async dismissRecommendation(id, reason) {
      must(await db.rpc('dismiss_recommendation', { p_id: id, p_reason: reason }));
    },
    async saveSourceStatus(kind, status, lastSyncedAt) {
      const payload: Record<string, unknown> = { user_id: userId, kind, name: SOURCE_NAME[kind], status };
      if (lastSyncedAt) payload.last_synced_at = lastSyncedAt;
      must(await db.from('health_sources').upsert(payload, { onConflict: 'user_id,kind,name' }));
    },
    async firstName() {
      const row = must(await db.from('profiles').select('first_name').eq('id', userId).maybeSingle()) as { first_name: string | null } | null;
      return row?.first_name ?? null;
    },
    async loadReported() {
      const [conditions, meds, sups] = await Promise.all([
        db.from('conditions').select('kind, name'),
        db.from('medications').select('name'),
        db.from('supplements').select('name'),
      ]);
      const named = (must(conditions) ?? []) as { kind: string; name: string }[];
      return {
        conditions: named.filter((c) => c.kind === 'condition').map((c) => c.name),
        surgeries: named.filter((c) => c.kind === 'surgery').map((c) => c.name),
        medications: ((must(meds) ?? []) as { name: string }[]).map((m) => m.name),
        supplements: ((must(sups) ?? []) as { name: string }[]).map((m) => m.name),
      };
    },
    async loadReferences() {
      // Only reviewed rows. reviewed_by null means the summary has passed
      // no check against its source, and an unchecked citation is the one
      // kind of wrong answer she has no way to catch.
      const rows = must(
        await db
          .from('research_refs')
          .select('id, title, publication, year, url, summary, domains')
          .not('reviewed_by', 'is', null)
          .order('year', { ascending: false }),
      ) as ReferenceRow[] | null;
      return rows ?? [];
    },
    async loadVitals() {
      // Ordered newest first and deduped in code to the first of each
      // metric, which is one round trip rather than one per metric.
      const rows = must(
        await db
          .from('observations')
          .select('metric, value, unit, occurred_at')
          .in('metric', [...VITAL_METRICS])
          .not('value', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(200),
      ) as { metric: string; value: number; unit: string | null; occurred_at: string }[] | null;
      const seen = new Set<string>();
      const out: VitalReading[] = [];
      for (const r of rows ?? []) {
        if (seen.has(r.metric)) continue;
        seen.add(r.metric);
        out.push({ metric: r.metric, value: Number(r.value), unit: r.unit, at: r.occurred_at });
      }
      return out;
    },
    async loadIntraday(sinceIso) {
      // Only the two metrics the day chart draws, and only today's. Reading
      // every observation since midnight would pull the whole of Apple
      // Health's firehose for a chart that plots one line.
      const rows = must(
        await db
          .from('observations')
          .select('metric, value, value_text, occurred_at')
          .in('metric', ['heart_rate', 'sleep_analysis'])
          .gte('occurred_at', sinceIso)
          .order('occurred_at'),
      ) as { metric: string; value: number | null; value_text: string | null; occurred_at: string }[];
      return rows.map((r) => ({ metric: r.metric, value: r.value, valueText: r.value_text, at: r.occurred_at }));
    },
  };
}
