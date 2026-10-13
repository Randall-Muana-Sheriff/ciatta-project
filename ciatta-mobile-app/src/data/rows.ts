import { type Episode, normalizeEpisode, parseDay, shortDate } from './cycleLog';
import type { EntryKind, SourceKind } from './sample';
import { type Attachment, normalizeAttachments } from '../lib/attachments';
import type { CategoryKey } from '../lib/logCategories';
import { FULLNESS, type Fullness, PRODUCTS, type Product, type ProductUse } from '../lib/periodProducts';
import type { Found } from '../lib/quickLog';

// The shapes the database stores, and the app types they come from. Pure, so
// both modes and the tests share one mapping.

export type EpisodeRow = {
  client_id: string;
  logged_at: string;
  occurred_on: string;
  occurred_at: string;
  kinds: string[];
  period_start: string | null;
  period_end: string | null;
  flow: string | null;
  all_day: boolean;
  start_hour: number | null;
  end_hour: number | null;
  states: string[];
  pattern: string | null;
  locations: string[];
  sensations: string[];
  severity: number | null;
  affect: string[];
  trajectory: string[];
  changes: string[];
  day_impact: string[];
  symptoms: string[];
  context: string[];
  triggers: string[];
  flare_up_user_reported: boolean | null;
  helped: string[];
  helped_amount: string | null;
  note: string;
  note_context: string[];
  stool: number | null;
  bowel_pain: string | null;
  bowel_flags: string[];
  similar: boolean;
  metadata: Record<string, unknown>;
};

const HOUR = 3600000;

// When the time is unknown the row still needs a moment to sort by; midday of
// the day she gave, marked as unknown so nothing reads it as a real time.
export function episodeToRow(e: Episode, extra: Record<string, unknown> = {}): EpisodeRow {
  const timeKnown = !e.allDay && e.start != null;
  const at = new Date(parseDay(e.date).getTime() + (timeKnown ? (e.start as number) : 12) * HOUR);
  return {
    client_id: e.id,
    logged_at: e.loggedAt,
    occurred_on: e.date,
    occurred_at: at.toISOString(),
    kinds: e.kinds,
    period_start: e.periodStart,
    period_end: e.periodEnd,
    flow: e.flow,
    all_day: e.allDay,
    start_hour: e.start,
    end_hour: e.end,
    states: e.states,
    pattern: e.pattern,
    locations: e.locations,
    sensations: e.sensations,
    severity: e.severity,
    affect: e.affect,
    trajectory: e.trajectory,
    changes: e.changes,
    day_impact: e.dayImpact,
    symptoms: e.symptoms,
    context: e.context,
    triggers: e.triggers,
    flare_up_user_reported: e.flareUpUserReported,
    helped: e.helped,
    helped_amount: e.helpedAmount,
    note: e.note,
    note_context: e.noteContext,
    stool: e.stool,
    bowel_pain: e.bowelPain,
    bowel_flags: e.bowelFlags,
    similar: e.similar,
    // Attachments live in metadata rather than a column of their own: they
    // are references she can remove, not data anything queries on.
    metadata: { ...extra, time_known: timeKnown, attachments: e.attachments },
  };
}

export function rowToEpisode(r: EpisodeRow): Episode {
  return normalizeEpisode({
    id: r.client_id,
    loggedAt: new Date(r.logged_at).toISOString(),
    date: r.occurred_on,
    kinds: r.kinds,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    flow: r.flow,
    allDay: r.all_day,
    start: r.start_hour == null ? null : Number(r.start_hour),
    end: r.end_hour == null ? null : Number(r.end_hour),
    states: r.states,
    pattern: r.pattern,
    locations: r.locations,
    sensations: r.sensations,
    severity: r.severity,
    affect: r.affect,
    trajectory: r.trajectory,
    changes: r.changes,
    dayImpact: r.day_impact,
    symptoms: r.symptoms,
    context: r.context,
    triggers: r.triggers,
    flareUpUserReported: r.flare_up_user_reported,
    helped: r.helped,
    helpedAmount: r.helped_amount,
    note: r.note,
    noteContext: r.note_context,
    stool: r.stool,
    bowelPain: r.bowel_pain,
    bowelFlags: r.bowel_flags,
    similar: r.similar,
    // normalizeEpisode runs this through normalizeAttachments, which drops
    // anything the jsonb column holds that is not a whole attachment.
    attachments: (r.metadata?.attachments ?? []) as Episode['attachments'],
  });
}

// ── Notes ──────────────────────────────────────────────────────

export type JournalRow = {
  client_id: string;
  text: string;
  kind: EntryKind;
  tag: string | null;
  occurred_at: string;
  // Files kept with the entry, in metadata like an episode's. Absent on
  // rows written before entries could carry any.
  metadata?: { attachments?: unknown; category?: unknown; items?: unknown } | null;
};

export type JournalView = {
  count: number;
  since: string;
  months: {
    month: string;
    items: {
      text: string;
      date: string;
      tag: string;
      kind: EntryKind;
      usedInInsight: boolean;
      attachments?: Attachment[];
      category?: CategoryKey;
      items?: Found;
      // When it happened, as stored. Absent on sample entries.
      at?: string;
    }[];
  }[];
};

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function journalView(rows: JournalRow[]): JournalView {
  if (rows.length === 0) return { count: 0, since: 'No entries yet', months: [] };
  const sorted = [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const months: JournalView['months'] = [];
  for (const r of sorted) {
    const d = new Date(r.occurred_at);
    const month = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    let group = months.find((m) => m.month === month);
    if (!group) {
      group = { month, items: [] };
      months.push(group);
    }
    group.items.push({
      text: r.text,
      date: shortDate(d),
      tag: r.tag ?? r.kind,
      kind: r.kind,
      usedInInsight: false,
      attachments: normalizeAttachments(r.metadata?.attachments),
      category: typeof r.metadata?.category === 'string' ? (r.metadata.category as CategoryKey) : undefined,
      items: r.metadata?.items && typeof r.metadata.items === 'object' ? (r.metadata.items as Found) : undefined,
      at: r.occurred_at,
    });
  }
  const oldest = new Date(sorted[sorted.length - 1].occurred_at);
  return { count: rows.length, since: `Since ${MONTHS_LONG[oldest.getMonth()]}`, months };
}

// ── Sources ────────────────────────────────────────────────────

export type DbSourceKind = 'apple_health' | 'health_connect' | 'lab' | 'document' | 'manual' | 'user_report';
export type DbSourceStatus = 'requested' | 'connected' | 'active' | 'refused' | 'disconnected' | 'error' | 'unsupported';

export type SourceRow = { kind: DbSourceKind; name: string; status: DbSourceStatus; last_synced_at: string | null; created_at: string };
export type SourceView = { name: string; kind: SourceKind; status: string; facts: { label: string; value: string }[] };

const KIND_VIEW: Record<DbSourceKind, SourceKind> = {
  apple_health: 'measured',
  health_connect: 'measured',
  lab: 'lab',
  document: 'lab',
  manual: 'logged',
  user_report: 'logged',
};

const STATUS_LABEL: Record<DbSourceStatus, string> = {
  requested: 'Requested',
  connected: 'Connected',
  active: 'Active',
  refused: 'Refused',
  disconnected: 'Disconnected',
  error: 'Needs attention',
  unsupported: 'Not available yet',
};

export function sourceView(r: SourceRow): SourceView {
  return {
    name: r.name,
    kind: KIND_VIEW[r.kind],
    status: STATUS_LABEL[r.status],
    facts: [
      { label: 'Since', value: shortDate(new Date(r.created_at)) },
      { label: 'Last updated', value: r.last_synced_at ? shortDate(new Date(r.last_synced_at)) : 'Not yet' },
    ],
  };
}

// A period product use, as stored. A product outside the list the app
// offers is dropped rather than shown under a name she never chose.
export type ProductUseRow = {
  client_id: string;
  product: string;
  size: string;
  started_at: string;
  ended_at: string | null;
  fullness: string | null;
};

export function productUseView(r: ProductUseRow): ProductUse | null {
  if (!(PRODUCTS as readonly string[]).includes(r.product)) return null;
  return {
    id: r.client_id,
    product: r.product as Product,
    size: r.size,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    fullness: (FULLNESS as readonly string[]).includes(r.fullness ?? '') ? (r.fullness as Fullness) : null,
  };
}
