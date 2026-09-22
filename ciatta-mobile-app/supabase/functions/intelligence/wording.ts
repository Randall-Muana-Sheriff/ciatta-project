// The only place sentences are made. Structured fields in, sentences out,
// and every sentence is built from a fixed set of frames, so that nothing
// reaching her can say more than the record does. FORBIDDEN is the list of
// words no sentence may contain; offending() is how index.ts proves it
// before a row is written, and how wording.test.ts proves it for every
// frame. Where the frames below differ from the plan's first draft it is
// because that draft used a forbidden word itself.
//
// No Deno or Supabase imports on purpose, the same arrangement as
// threads.ts: plain TypeScript so src/data/wording.test.ts can exercise it
// under node:test. The import from threads.ts is type only, so tsx never
// has to resolve the .ts suffix Deno needs.
//
// notEstablished and alternatives are lists of lines, one sentence each,
// because the Evidence screen renders them as rows. index.ts joins them
// with a newline for the text columns, and the app splits them again.

import type { ChangeRow, Missing, ObservationRow, Occurrence, ThreadCandidate } from './threads.ts';

export const FORBIDDEN: readonly string[] = [
  'cause',
  'caused',
  'causing',
  'because',
  'diagnos',
  'you have',
  'condition',
  'disorder',
  'syndrome',
  'deficien',
  'risk of',
];

// The first forbidden word a sentence contains, or null when it is clean.
export function offending(text: string): string | null {
  const lower = text.toLowerCase();
  return FORBIDDEN.find((w) => lower.includes(w)) ?? null;
}

// Something she told the record near an occurrence: the day, which kind of
// thing it was (the observation metric: note, symptom, pain_episode, ...)
// and the words themselves.
export type ContextEntry = { on: string; metric: string; text: string };

export type WordingFacts = {
  // Every change row in the window; the ones the candidate cites as
  // evidence are the ones worded.
  changes: ChangeRow[];
  context: ContextEntry[];
};

export type InsightText = {
  title: string;
  meta: string;
  whatChanged: string;
  connected: string;
  youTold: string;
  notEstablished: string[];
  alternatives: string[];
};

export const NOTHING_NOTED = 'You did not note anything around these days.';
export const STANDING_LINE = 'Things that happen near each other do not show that one brought on the other, or which came first.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Mirrors word() in src/lib/engine.ts.
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => WORDS[n] ?? String(n);
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${word(n)} times`);

const LABELS: Record<string, string> = {
  cycle_length: 'cycle length',
  sleep_hours: 'sleep',
  resting_hr: 'resting heart rate',
  hrv: 'heart rate variability',
  steps: 'steps',
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
  wrist_temperature: 'degrees',
};

function label(side: string): string {
  if (side.startsWith('symptom:')) return side.slice('symptom:'.length);
  return LABELS[side] ?? side.replace(/_/g, ' ');
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Postgres numerics reach a client as strings; Number() keeps this honest
// whichever way index.ts read them.
function fmtValue(metric: string, raw: number | string): string {
  const n = Number(raw);
  const text = Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const unit = UNITS[metric];
  return unit ? `${text} ${unit}` : text;
}

const DAY_MS = 86400000;
function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const daysApart = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);

export function dateWords(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

// "30 January and 27 February", "a, b and c", "a, b, c and 2 more days".
function dateList(days: string[]): string {
  const withYear = new Set(days.map((d) => d.slice(0, 4))).size > 1;
  const shown = days.slice(0, 3).map((d) => dateWords(d, withYear));
  const more = days.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more days`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

// Months between the first and the last occurrence, never fewer than one.
function monthsAcross(first: string, last: string): string {
  const n = Math.max(1, Math.round(daysApart(first, last) / 30.4375));
  return n === 1 ? '1 month' : `${n} months`;
}

const MISSING_LINES: Record<Missing, string> = {
  no_change_row: 'Neither side has moved outside its usual range in a sustained way, so there is no finding behind this yet.',
  single_source: 'Both sides come from one source, so a change in that device would show on both.',
  no_context: 'Nothing you noted around these days can say what else was going on.',
};

const ALTERNATIVES = [
  'A busy or stressful stretch can move several of these at once.',
  'Illness, travel, or a change in routine can shift several of these at once.',
];
const DEVICE_ALTERNATIVE = 'A device worn differently, or its own drift, can shift every reading it takes.';

const MAX_NOTE = 80;
function quoted(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return `“${trimmed.length > MAX_NOTE ? `${trimmed.slice(0, MAX_NOTE - 1).trimEnd()}…` : trimmed}”`;
}

export function wordInsight(candidate: ThreadCandidate, facts: WordingFacts): InsightText {
  const sides = candidate.key.split('~') as [string, string];
  const cited = new Set(candidate.evidence.map((e) => e.changeId).filter((id): id is string => !!id));
  // The latest cited change per side is the one worded.
  const latest = new Map<string, ChangeRow>();
  for (const c of [...facts.changes].filter((c) => cited.has(c.id)).sort((x, y) => (x.detected_on < y.detected_on ? -1 : 1))) {
    latest.set(c.metric, c);
  }
  const sideWord = (side: string) => {
    const c = latest.get(side);
    return c ? `${c.direction} ${label(side)}` : label(side);
  };

  const days = candidate.occurrences.map((o: Occurrence) => o.at);
  const meta = `Seen ${times(candidate.recurrence)} across ${monthsAcross(candidate.firstObservedAt, candidate.lastObservedAt)}`;
  const title = `${capital(sideWord(sides[0]))} and ${sideWord(sides[1])}, ${meta.charAt(0).toLowerCase()}${meta.slice(1)}`;

  const changed = sides
    .map((side) => latest.get(side))
    .filter((c): c is ChangeRow => !!c)
    // window_days is the span the USUAL was taken over (the baselines
    // window), not how long the change lasted; the sentence says so.
    .map(
      (c) =>
        `${capital(label(c.metric))} ran ${c.direction} than usual: ${fmtValue(c.metric, c.to_value)} against your usual ${fmtValue(c.metric, c.from_value)} from the last ${c.window_days} days, as of ${dateWords(c.detected_on)}.`
    );
  const whatChanged = changed.length ? changed.join(' ') : 'No sustained change was detected on either side around these days.';

  const cycle = sides.includes('cycle_length');
  const partner = sides.find((s) => s !== 'cycle_length') ?? sides[1];
  const connected = cycle
    ? `A period start followed ${sideWord(partner)} within the week before it on ${dateList(days)}. ${meta}.`
    : `${capital(sideWord(sides[0]))} and ${sideWord(sides[1])} occurred alongside each other on ${dateList(days)}. ${meta}.`;

  const seen = new Set<string>();
  const entries = facts.context
    .filter((e) => e.text.trim() && !seen.has(`${e.on}|${e.text}`) && seen.add(`${e.on}|${e.text}`))
    .sort((x, y) => (x.on < y.on ? -1 : x.on > y.on ? 1 : 0));
  const withYear = new Set(entries.map((e) => e.on.slice(0, 4))).size > 1;
  const said = entries
    .slice(0, 3)
    .map((e) => `${e.metric === 'note' ? quoted(e.text) : e.text.trim().toLowerCase()} on ${dateWords(e.on, withYear)}`);
  const moreSaid = entries.length - said.length;
  const youTold = !said.length
    ? NOTHING_NOTED
    : `You noted ${said.length === 1 ? said[0] : `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`}${moreSaid > 0 ? `, and ${moreSaid} more` : ''}.`;

  const notEstablished = [
    STANDING_LINE,
    ...candidate.missing.map((m) => MISSING_LINES[m]),
    ...(candidate.missing.length ? [] : ['Whether this comes back again is not known yet.']),
  ];
  const alternatives = [...ALTERNATIVES, ...(candidate.missing.includes('single_source') ? [DEVICE_ALTERNATIVE] : [])];

  return { title, meta, whatChanged, connected, youTold, notEstablished, alternatives };
}

// What she told the record, as one observation mirrored from an episode or
// a journal entry, turned into the words youTold can carry. Null for an
// observation that is not something she said (a device reading, or a
// mirrored field with nothing in it). The day is the UTC day of the
// timestamp, the same day the links step used.
export function contextEntry(o: ObservationRow): ContextEntry | null {
  const on = o.occurred_at.slice(0, 10);
  const text = (o.value_text ?? '').trim();
  switch (o.metric) {
    case 'note':
    case 'symptom':
      return text ? { on, metric: o.metric, text } : null;
    case 'pain_episode':
      return { on, metric: o.metric, text: text && text !== 'Reported' ? `pain in your ${text.toLowerCase()}` : 'pain' };
    case 'stool_type':
      return { on, metric: o.metric, text: 'a bowel movement' };
    case 'flow':
      return text ? { on, metric: o.metric, text: `${text.toLowerCase()} flow` } : null;
    case 'period_start':
      return { on, metric: o.metric, text: 'a period start' };
    default:
      return null;
  }
}

// ── Slice 4: offers, lessons, and what changed since last time ─────────

export type RecommendationKind =
  | 'observe'
  | 'log'
  | 'reflect'
  | 'try'
  | 'review'
  | 'prepare'
  | 'explore'
  | 'discuss'
  | 'connect'
  | 'continue'
  | 'no_action_yet';

export type RecommendationContext = { cycle?: boolean; kind?: 'walk' | 'custom' };

// An offer is a title and one line under it, from fixed frames. "Only if
// it feels appropriate" travels with every try, because an offer is never
// an instruction.
export function recommendationText(type: RecommendationKind, ctx: RecommendationContext = {}): { title: string; body: string } {
  const nextTime = ctx.cycle ? 'your next cycle' : 'what happens next time';
  const showsWhen = ctx.cycle ? 'It will show here when your next cycle ends.' : 'It will show here the next time this comes around.';
  switch (type) {
    case 'observe':
      return { title: `Watch ${nextTime}`, body: showsWhen };
    case 'continue':
      return { title: `Watching ${nextTime}`, body: showsWhen };
    case 'try':
      return ctx.kind === 'walk'
        ? { title: 'A short walk today', body: 'Only if it feels appropriate. The next few days will show whether your energy or sleep follow.' }
        : { title: 'Something small to try', body: 'Only if it feels appropriate.' };
    case 'reflect':
      return { title: 'Describe what changed', body: 'A few words about these days will sit beside the record.' };
    case 'log':
      return { title: 'Log what is going on', body: 'Bleeding, pain, symptoms, and what was going on.' };
    case 'review':
      return { title: 'View the evidence', body: 'Every line traces back to something in your record.' };
    case 'prepare':
      return { title: 'Prepare for an appointment', body: 'This has come back often enough to be worth a conversation.' };
    case 'explore':
      return { title: 'Look at this over time', body: 'The Journey view shows these days in place.' };
    case 'discuss':
      return { title: 'Bring this to your clinician', body: 'What was seen, and what is not established, in one place.' };
    case 'connect':
      return { title: 'Connect a source', body: 'A device would let the record see more of these days.' };
    case 'no_action_yet':
      return { title: 'Nothing to do yet', body: 'Watching is enough for now.' };
  }
}

export type OutcomeValue = 'improved' | 'unchanged' | 'worse' | 'insufficient_evidence' | 'unknown';

export type LearningEvent =
  | { type: 'pattern_recurred'; count: number }
  | { type: 'pattern_resolved' }
  | { type: 'insight_updated' }
  | { type: 'outcome_measured'; action: string; metric: string | null; measured: OutcomeValue; ratio: number | null }
  | { type: 'outcome_reported'; action: string; reported: OutcomeValue };

const REPORTED_WORDS: Record<OutcomeValue, string> = {
  improved: 'better',
  unchanged: 'about the same',
  worse: 'worse',
  insufficient_evidence: 'hard to tell',
  unknown: 'unknown',
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// One sentence per lesson. A measured outcome names the measure, the
// direction and the size; it never says the action did it.
export function learningText(event: LearningEvent): string {
  switch (event.type) {
    case 'pattern_recurred':
      return `The same combination came back: seen ${times(event.count)} now.`;
    case 'pattern_resolved':
      return 'This combination has not come back for some time.';
    case 'insight_updated':
      return 'This reading was rewritten with what was seen since.';
    case 'outcome_measured': {
      const action = lowerFirst(event.action);
      if (event.measured === 'unknown' || !event.metric) return `After ${action}, no measure was named, so nothing was measured.`;
      if (event.measured === 'insufficient_evidence') return `After ${action}, there were not enough readings in the days around it to say.`;
      const measure = label(event.metric);
      if (event.measured === 'unchanged' || event.ratio == null) return `After ${action}, ${measure} stayed about the same over the next three days.`;
      const direction = event.ratio > 0 ? 'higher' : 'lower';
      return `After ${action}, ${measure} ran ${direction}, about ${Math.round(Math.abs(event.ratio) * 100)} percent, over the next three days.`;
    }
    case 'outcome_reported':
      return `You said ${lowerFirst(event.action)} left things ${REPORTED_WORDS[event.reported]}.`;
  }
}

export type SinceState = 'new' | 'updated' | 'continuing' | 'resolved' | 'unchanged';

// Today's kicker: what happened to the insight since she last looked.
export function sinceText(state: SinceState): string {
  switch (state) {
    case 'new':
      return 'New since your last visit';
    case 'updated':
      return 'Updated since your last visit';
    case 'continuing':
      return 'Seen again since your last visit';
    case 'resolved':
      return 'Resolved since your last visit';
    case 'unchanged':
      return 'No meaningful change since your last visit';
  }
}
