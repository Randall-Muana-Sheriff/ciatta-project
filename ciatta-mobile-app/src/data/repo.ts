import type { SupabaseClient } from '@supabase/supabase-js';

import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
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
  loadJournal(): Promise<JournalView>;
  addJournal(text: string, kind: EntryKind): Promise<void>;
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
};

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
    loadJournal: async () => view,
    addJournal: async (text, kind) => {
      const d = new Date();
      const month = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      const item = { text, date: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`, tag: kind, kind, usedInInsight: false };
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
  };
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
    async loadJournal() {
      const rows = await paginateAll<JournalRow>(
        (from, to) =>
          db
            .from('journal_entries')
            .select('client_id, text, kind, tag, occurred_at')
            .order('occurred_at')
            .order('client_id')
            .range(from, to) as unknown as Page<JournalRow>,
      );
      return journalView(rows);
    },
    async addJournal(text, kind) {
      must(await db.from('journal_entries').insert({ user_id: userId, client_id: `j-${Date.now()}`, text, kind, occurred_at: new Date().toISOString() }));
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
  };
}
