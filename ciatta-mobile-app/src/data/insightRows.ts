import type { Screen } from '../navigation';
import { parseDay, shortDate } from './cycleLog';
import type { insight as sampleInsight } from './sample';

// Projects an insights row, its thread and the thread's evidence into the
// shape InsightScreen already renders. Nothing here decides anything about
// her: every sentence was made by the intelligence function's wording
// module, and this file only lays the stored parts out as rows, dates and
// labels. Pure, so the test can hand it rows and read the screen shape.
//
// The sample insight names four screens; a real one may point at any the
// navigation knows (a resting heart rate reading has no home among the
// sample's four), so the view's basedOn is typed on Screen and the sample
// still satisfies it.

export type InsightView = Omit<typeof sampleInsight, 'basedOn'> & {
  basedOn: { label: string; sub: string; value: string; screen: Screen }[];
};

// The columns each embedded row carries, as realRepo selects them.
export type ObservationRef = {
  metric: string;
  domain: string;
  value: number | string | null;
  value_text: string | null;
  unit: string | null;
  occurred_at: string;
};

export type EvidenceRow = {
  role: 'supports' | 'context' | 'contradicts' | 'alternative_explanation' | 'user_reported' | 'research_context';
  note: string | null;
  observations: ObservationRef | null;
  changes: { metric: string; direction: 'lower' | 'higher'; from_value: number | string; to_value: number | string; detected_on: string } | null;
  temporal_links: { occurred_on: string; a: ObservationRef | null; b: ObservationRef | null } | null;
  research_refs: { title: string; publication: string | null; year: number | null; summary: string } | null;
};

export type ThreadRef = {
  key: string;
  title: string;
  status: string;
  domains: string[];
  observation_count: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
  confidence: { missing?: string[]; recurrence?: number; occurrences?: number } | null;
};

export type InsightRow = {
  id: string;
  thread_id: string;
  title: string;
  what_changed: string;
  connected: string;
  you_told: string;
  not_established: string;
  alternatives: string[];
  status: string;
  confidence: unknown;
  valid_from: string;
  updated_at: string;
  threads: ThreadRef | null;
};

// Mirrors WINDOW_DAYS in supabase/functions/intelligence/index.ts, which
// the app cannot import without bundling a Deno file.
const WINDOW_DAYS = 180;

export const NO_RESEARCH = {
  claim: 'No published research is attached to this yet.',
  meta: 'Research here would be about groups of people, never about you.',
};

const LABELS: Record<string, string> = {
  cycle_length: 'cycle length',
  period_start: 'period start',
  sleep_hours: 'sleep',
  resting_hr: 'resting heart rate',
  hrv: 'heart rate variability',
  steps: 'steps',
  active_minutes: 'active minutes',
  wrist_temperature: 'wrist temperature',
  pain_episode: 'pain',
  stool_type: 'bowel movements',
  flow: 'flow',
};
const UNITS: Record<string, string> = {
  sleep_hours: 'hours',
  resting_hr: 'beats a minute',
  hrv: 'milliseconds',
  steps: 'steps',
  active_minutes: 'minutes',
  wrist_temperature: 'degrees',
};
// Where a change row's metric lives, since a change carries no domain.
const METRIC_DOMAIN: Record<string, string> = {
  sleep_hours: 'sleep',
  steps: 'activity',
  active_minutes: 'activity',
  resting_hr: 'vitals',
  hrv: 'vitals',
  wrist_temperature: 'vitals',
};
const SCREEN_BY_DOMAIN: Record<string, Screen> = {
  cycle: 'cycle',
  sleep: 'sleep',
  symptom: 'symptoms',
  pain: 'symptoms',
  gut: 'symptoms',
  context: 'journal',
  activity: 'movement',
};
const DOMAIN_WORDS: Record<string, string> = {
  cycle: 'cycle',
  sleep: 'sleep',
  symptom: 'symptoms',
  pain: 'pain',
  gut: 'digestion',
  context: 'notes',
  activity: 'activity',
  vitals: 'vitals',
};
const MISSING_WORDS: Record<string, string> = {
  no_change_row: 'a sustained change on either side',
  single_source: 'a second source',
  no_context: 'anything you noted around those days',
};
// Mirrors word() in src/lib/engine.ts for counts of times.
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => WORDS[n] ?? String(n);
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${word(n)} times`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const screenFor = (domain: string): Screen => SCREEN_BY_DOMAIN[domain] ?? 'healthrecords';
const label = (metric: string) => LABELS[metric] ?? metric.replace(/_/g, ' ');

// The UTC day of a timestamp, or a plain date as it is, shown as "20 Sep".
const dayOf = (iso: string) => iso.slice(0, 10);
const dateWords = (iso: string) => shortDate(parseDay(dayOf(iso)));

function fmtValue(value: number | string | null, unit: string | null, metric: string): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const text = Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const u = unit ?? UNITS[metric];
  return u ? `${text} ${u}` : text;
}

// "and" list: "cycle and sleep", "cycle, sleep and symptoms".
function andList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function monthsAcross(first: string | null, last: string | null): string {
  if (!first || !last) return '1 month';
  const [fy, fm, fd] = dayOf(first).split('-').map(Number);
  const [ly, lm, ld] = dayOf(last).split('-').map(Number);
  const days = Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(fy, fm - 1, fd)) / 86400000);
  const n = Math.max(1, Math.round(days / 30.4375));
  return n === 1 ? '1 month' : `${n} months`;
}

type BasedOn = InsightView['basedOn'][number] & { on: string };

// One row per piece of evidence that points at something in her record: a
// change (the finding), a link (an occurrence, shown as the later thing
// after the earlier), or an observation she reported (her context). A
// research ref is not about her and goes to the evidence box instead.
function basedOnRow(e: EvidenceRow): BasedOn | null {
  if (e.changes) {
    const c = e.changes;
    return {
      label: capital(label(c.metric)),
      sub: `${capital(c.direction)} than usual · ${dateWords(c.detected_on)}`,
      value: fmtValue(c.to_value, null, c.metric),
      screen: screenFor(METRIC_DOMAIN[c.metric] ?? ''),
      on: c.detected_on,
    };
  }
  if (e.temporal_links) {
    const { a, b, occurred_on } = e.temporal_links;
    if (!a || !b) return null;
    const measured = [b, a].find((o) => o.value != null) ?? null;
    return {
      label: `${capital(label(b.metric))} after ${label(a.metric)}`,
      sub: `${dateWords(b.occurred_at)} · ${dateWords(a.occurred_at)}`,
      value: measured ? fmtValue(measured.value, measured.unit, measured.metric) : '',
      screen: screenFor(b.domain),
      on: occurred_on,
    };
  }
  if (e.observations) {
    const o = e.observations;
    const text = (o.value_text ?? '').trim();
    const name = o.metric === 'note' ? (text ? `“${text}”` : 'A note') : o.metric === 'symptom' ? capital(text || 'symptom') : capital(label(o.metric));
    return {
      label: name,
      sub: dateWords(o.occurred_at),
      value: o.metric === 'note' || o.metric === 'symptom' ? '' : fmtValue(o.value, o.unit, o.metric),
      screen: screenFor(o.domain),
      on: dayOf(o.occurred_at),
    };
  }
  return null;
}

export function insightView(row: InsightRow | null, evidence: EvidenceRow[] = []): InsightView | null {
  if (!row) return null;
  const thread = row.threads;
  const count = thread?.observation_count ?? 0;
  const missing = thread?.confidence?.missing ?? [];
  const domains = (thread?.domains ?? []).map((d) => DOMAIN_WORDS[d] ?? d);

  const basedOn = evidence
    .filter((e) => e.role === 'supports' || e.role === 'user_reported' || e.role === 'context')
    .map(basedOnRow)
    .filter((r): r is BasedOn => !!r)
    .sort((x, y) => (x.on < y.on ? -1 : x.on > y.on ? 1 : 0))
    .map(({ on: _on, ...rest }) => rest);

  const research = evidence.find((e) => e.role === 'research_context' && e.research_refs)?.research_refs ?? null;
  const researchMeta = research
    ? [research.publication, research.year != null ? `published ${research.year}` : null, 'not about you'].filter((x): x is string => !!x).join(' · ')
    : NO_RESEARCH.meta;

  return {
    headline: row.title,
    meta: `Seen ${times(count)} · across ${monthsAcross(thread?.first_observed_at ?? null, thread?.last_observed_at ?? null)} · updated ${dateWords(row.updated_at)}`,
    basedOn,
    evidence: research ? { claim: research.summary, meta: researchMeta } : NO_RESEARCH,
    stillOpen: row.not_established.split('\n').map((l) => l.trim()).filter(Boolean).join(' '),
    method: [
      { label: 'Looked at', value: `${capital(andList(domains) || 'her record')} over the last ${WINDOW_DAYS} days` },
      { label: 'Pattern', value: thread?.title ?? row.title },
      { label: 'Times seen', value: capital(times(count)) },
      { label: 'What is missing', value: missing.length ? capital(andList(missing.map((m) => MISSING_WORDS[m] ?? m.replace(/_/g, ' ')))) : 'Nothing named yet' },
    ],
  };
}
