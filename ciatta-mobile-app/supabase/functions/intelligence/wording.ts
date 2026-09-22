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

import type { ChangeRow, Missing, Occurrence, ThreadCandidate } from './threads.ts';

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
    .map(
      (c) =>
        `${capital(label(c.metric))} ran ${c.direction} than usual: ${fmtValue(c.metric, c.to_value)} against your usual ${fmtValue(c.metric, c.from_value)}, over ${c.window_days} days to ${dateWords(c.detected_on)}.`
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
