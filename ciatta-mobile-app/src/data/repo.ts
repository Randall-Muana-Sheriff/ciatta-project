import type { SupabaseClient } from '@supabase/supabase-js';

import { type CycleProfile, normalizeProfile } from '../lib/cycleProfile';
import type { DailyRow } from '../lib/healthMetrics';
import { type Day, loadDays as loadSampleDays } from './daily';
import { daysFromRows } from './dailyRows';
import type { Episode } from './cycleLog';
import { paginateAll } from './pagination';
import { episodeToRow, type EpisodeRow, type JournalRow, type JournalView, journalView, rowToEpisode, type SourceRow, sourceView, type SourceView } from './rows';
import { type EntryKind, journal, person, sources } from './sample';

// Every daily_metrics column daysFromRows/rowToDay actually reads. Named
// explicitly, like every other realRepo method, rather than select('*'),
// which would also pull id, user_id, source_id, provenance, metadata,
// occurred_at, created_at and updated_at: real columns, just not ones this
// projection has any use for.
const DAILY_COLUMNS =
  'day, sleep_hours, stage_awake, stage_rem, stage_light, stage_deep, time_in_bed, steps, active_minutes, workouts, resting_hr, hrv, temp_deviation, energy, mood, stress, caffeine, alcohol, foods, digestion, note';

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
  firstName(): Promise<string | null>;
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
    async firstName() {
      const row = must(await db.from('profiles').select('first_name').eq('id', userId).maybeSingle()) as { first_name: string | null } | null;
      return row?.first_name ?? null;
    },
  };
}
