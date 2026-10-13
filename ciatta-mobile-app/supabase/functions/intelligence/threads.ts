// How often two things in her record have happened near each other, and
// what is still missing before that recurrence can be said out loud. This
// file counts and names; it does not interpret. It computes no correlation,
// ranks nothing by strength, and says nothing about cause. An occurrence is
// an EVENT in her record (something she reported, a period start, a workout
// the device recorded) with something else near it: another event, or a
// measure that was unusual at the time, which means a sustained change was
// detected within a week of it. One event is one occurrence however many
// readings sit beside it. A candidate is a pair whose occurrences have
// come back. The sentences that reach her belong to wording.ts, and
// whether a candidate has earned the screen at all belongs to gate.ts.
//
// No Deno or Supabase imports on purpose, the same arrangement as
// baselines/compute.ts and baselines/links.ts: plain TypeScript so a Node
// test (src/data/threads.test.ts) can exercise it directly, while the edge
// function imports it by relative path.

// Plain rows, named as the tables name them so index.ts can pass a select
// straight through.
export type ChangeRow = {
  id: string;
  metric: string;
  direction: 'lower' | 'higher';
  detected_on: string;
  deviation: number;
  quality: string;
  // The usual and the recent value, and the span the recent one was held
  // over. The builder never reads them; wording.ts says them.
  from_value: number;
  to_value: number;
  window_days: number;
};

export type LinkRow = {
  id: string;
  a_observation_id: string;
  b_observation_id: string;
  relation: string;
  gap_hours: number;
  occurred_on: string;
};

export type ObservationRow = {
  id: string;
  domain: string;
  metric: string;
  value: number | null;
  value_text: string | null;
  occurred_at: string;
  source_id: string | null;
  provenance: string;
  // The episode or journal entry this observation was mirrored from, so
  // that the row an occurrence is made of is never counted as context
  // around it.
  origin_id: string | null;
};

export type EpisodeRow = { id: string; occurred_on: string; kinds: string[]; period_start: string | null };
export type JournalRow = { id: string; occurred_on: string };

export type ThreadInput = {
  changes: ChangeRow[];
  links: LinkRow[];
  observations: ObservationRow[];
  episodes: EpisodeRow[];
  journals: JournalRow[];
};

// changeId is the finding behind an occurrence that has a measure in it:
// the sustained change that was detected near the event. An occurrence
// between two events has none.
export type Occurrence = { at: string; aObservationId: string; bObservationId: string; linkId: string; changeId?: string };

// The roles a candidate can assign on its own. contradicts marks a time
// the event came round and the measure had moved the OTHER way.
// alternative_explanation and research_context exist in the enum for a
// later slice; nothing here has the standing to assign them.
export type EvidenceRole = 'supports' | 'contradicts' | 'user_reported';
export type EvidenceRef = { role: EvidenceRole; linkId?: string; changeId?: string; observationId?: string };

export type Missing = 'no_change_row' | 'single_source' | 'no_context';

export type ThreadCandidate = {
  key: string;
  title: string;
  domains: string[];
  occurrences: Occurrence[];
  // How many occurrences stand at least MIN_SEPARATION_DAYS apart. Two
  // links three days apart are one stretch of her record, not a pattern
  // that has come back.
  recurrence: number;
  firstObservedAt: string;
  lastObservedAt: string;
  evidence: EvidenceRef[];
  missing: Missing[];
};

// One earlier match is not enough to call it recurring (engine.ts, the
// notEstablished line of the cycle insight). Two is the least that can be
// called "again", and it is the floor, not a claim of significance.
export const MIN_RECURRENCE = 2;
export const MIN_SEPARATION_DAYS = 7;
// A change row counts as the finding behind an occurrence when it was
// detected within this many days of it. A change months earlier is a
// finding about a different stretch of her record.
export const CHANGE_PROXIMITY_DAYS = 7;
// An episode or journal entry this close to an occurrence is what she told
// the record around those days.
export const CONTEXT_DAYS = 7;
// The name a device reading's measure goes by in daily_metrics and in
// changes. A thread is about the measure, not the sample, so its side takes
// that name and the change row for it can be found.
const MEASURE_OF: Record<string, string> = {
  sleep_analysis: 'sleep_hours',
  resting_heart_rate: 'resting_hr',
  exercise_time: 'active_minutes',
};
// Period starts closer together than this are the same period logged
// twice. Mirrors MERGE_DAYS in src/lib/cycleModel.ts, which is the code the
// screens run; the cross check in threads.test.ts keeps the two in step.
const MERGE_DAYS = 10;

const DAY_MS = 86400000;

// A calendar day as UTC midnight, from either a plain date or a timestamp.
// Nothing here needs a time zone: links carry occurred_on as a date, and an
// observation's day is the UTC day of its timestamp, the same day the
// links step used when it wrote occurred_on.
function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const isDay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Shared by the loop modules (recommend, outcomes, learning) so there is
// one day arithmetic on the server, not four copies.
export const daysApart = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
export const shiftDay = (iso: string, n: number) => new Date(dayMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

export type CycleLength = { observationId: string; start: string; end: string; length: number };

// Cycle length is not stored anywhere: it is the gap between one period
// start and the next, derived here the way cycleWindows() in cycleModel.ts
// derives it for the screens. The length belongs to the observation that
// CLOSED the cycle, the later start, because that is the moment it became
// known; cycleTrend in engine.ts pairs that same length with the final week
// before it. A first start has no length, and a start logged again within
// MERGE_DAYS is the same period and gets none either: unknown, never zero.
export function cycleLengths(observations: ObservationRow[]): CycleLength[] {
  const starts = observations
    .filter((o) => o.metric === 'period_start')
    .map((o) => ({ id: o.id, day: isDay(o.value_text) ? o.value_text : o.occurred_at.slice(0, 10) }))
    .filter((s) => isDay(s.day))
    .sort((x, y) => cmp(x.day, y.day) || cmp(x.id, y.id));
  const kept: typeof starts = [];
  for (const s of starts) {
    if (!kept.length || daysApart(kept[kept.length - 1].day, s.day) >= MERGE_DAYS) kept.push(s);
  }
  return kept.slice(1).map((s, i) => ({
    observationId: s.id,
    start: kept[i].day,
    end: s.day,
    length: daysApart(kept[i].day, s.day),
  }));
}

// Which side of a pair an observation can be, or null when it cannot be
// one. A journal note is context around an occurrence, never a thing that
// recurs with another. A period start stands for the cycle it closed, so
// only a start with a derived length has a side. A symptom is keyed by what
// she named, because "symptoms and sleep" says nothing and "headache and
// sleep" says something.
function sideOf(o: ObservationRow, lengths: Map<string, number>): string | null {
  if (o.metric === 'note') return null;
  if (o.metric === 'period_start') return lengths.has(o.id) ? 'cycle_length' : null;
  if (o.metric === 'symptom') {
    const name = (o.value_text ?? '').trim().toLowerCase();
    return name ? `symptom:${name}` : null;
  }
  return MEASURE_OF[o.metric] ?? o.metric;
}

// A continuous device reading is MEASURED. Everything else is an event:
// what she reported, a workout the device recorded, a result from a
// document. Only an event can anchor an occurrence.
const isEvent = (o: ObservationRow) => o.provenance !== 'MEASURED';
const dayNumber = (iso: string) => Math.round(dayMs(iso) / DAY_MS);

// Plain words for the pair, without hyphens (AGENTS.md). The wording module
// writes the sentences; this is only the label a thread is listed under.
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
function label(side: string): string {
  if (side.startsWith('symptom:')) return side.slice('symptom:'.length);
  return LABELS[side] ?? side.replace(/_/g, ' ');
}
function titleFor(sides: [string, string]): string {
  const words = `${label(sides[0])} and ${label(sides[1])}`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Greedy from the earliest: an occurrence counts when it stands at least
// MIN_SEPARATION_DAYS after the last one that counted. Occurrences are
// already sorted by day.
function recurrenceOf(occurrences: Occurrence[]): number {
  let count = 0;
  let last: string | null = null;
  for (const o of occurrences) {
    if (last == null || daysApart(last, o.at) >= MIN_SEPARATION_DAYS) {
      count++;
      last = o.at;
    }
  }
  return count;
}

const near = (day: string, occurrences: Occurrence[], within: number) =>
  occurrences.some((o) => Math.abs(daysApart(o.at, day)) <= within);

type Direction = 'lower' | 'higher';
type Found = Occurrence & { direction: Direction | null };
type Group = { sides: [string, string]; measured: boolean; occurrences: Map<string, Found> };

export function buildThreads(input: ThreadInput): ThreadCandidate[] {
  const byId = new Map(input.observations.map((o) => [o.id, o]));
  const cycles = cycleLengths(input.observations);
  const lengths = new Map(cycles.map((c) => [c.observationId, c.length]));
  const periodDay = new Map(cycles.map((c) => [c.observationId, c.end]));

  // Changes by the measure they are about, with the day as a number, so
  // finding the one nearest an event is arithmetic and not date parsing.
  const changesOf = new Map<string, { id: string; direction: Direction; day: number }[]>();
  for (const c of input.changes) {
    const list = changesOf.get(c.metric) ?? [];
    list.push({ id: c.id, direction: c.direction, day: dayNumber(c.detected_on) });
    changesOf.set(c.metric, list);
  }

  // Narrowest first, so the link kept for an event is the reading closest
  // to it, and in a fixed order so nothing depends on how the rows arrived.
  const links = [...input.links].sort(
    (x, y) => x.gap_hours - y.gap_hours || cmp(x.occurred_on, y.occurred_on) || cmp(x.id, y.id)
  );

  const groups = new Map<string, Group>();
  // An event and a measure with no finding near them: every other link
  // between the two would fail the same way, so the answer is kept.
  const nothingThere = new Set<string>();

  for (const link of links) {
    const a = byId.get(link.a_observation_id);
    const b = byId.get(link.b_observation_id);
    if (!a || !b) continue;
    // Two device readings near each other are two series running side by
    // side, which they do every day. The links step no longer writes such
    // a pair; one written before that is ignored here.
    if (!isEvent(a) && !isEvent(b)) continue;
    const sa = sideOf(a, lengths);
    const sb = sideOf(b, lengths);
    if (!sa || !sb || sa === sb) continue;
    // A cycle length is about the cycle that ended at the period start, so
    // its partner must fall inside that cycle: before the start day, as
    // cycleTrend reads the seven days before w.end and not the day itself.
    // a is the earlier observation, so a period start at a means the
    // partner came after it, in the next cycle.
    if (sa === 'cycle_length') continue;
    if (sb === 'cycle_length' && daysApart(a.occurred_at, periodDay.get(b.id)!) <= 0) continue;

    const sides: [string, string] = sa < sb ? [sa, sb] : [sb, sa];
    const key = sides.join('~');
    const both = isEvent(a) && isEvent(b);
    const event = both ? b : isEvent(a) ? a : b;
    const measure = both ? null : isEvent(a) ? b : a;
    // One occurrence per event. However many readings sit near a period
    // start, the period started once.
    const occurrenceKey = both ? [a.id, b.id].sort().join('~') : event.id;
    const group = groups.get(key);
    if (group?.occurrences.has(occurrenceKey)) continue;
    if (nothingThere.has(`${key}|${occurrenceKey}`)) continue;

    const at = both ? link.occurred_on : (periodDay.get(event.id) ?? event.occurred_at.slice(0, 10));

    // With a measure in the pair, the event only counts when the measure
    // was unusual near it: a sustained change detected within a week. A
    // period start with ordinary sleep before it is a period start, not an
    // occurrence of anything.
    let direction: Direction | null = null;
    let changeId: string | undefined;
    if (measure) {
      const day = dayNumber(at);
      const finding = (changesOf.get(measure === a ? sa : sb) ?? [])
        .filter((c) => Math.abs(c.day - day) <= CHANGE_PROXIMITY_DAYS)
        .sort((x, y) => Math.abs(x.day - day) - Math.abs(y.day - day) || cmp(x.id, y.id))[0];
      if (!finding) {
        nothingThere.add(`${key}|${occurrenceKey}`);
        continue;
      }
      direction = finding.direction;
      changeId = finding.id;
    }

    const into = group ?? { sides, measured: !!measure, occurrences: new Map<string, Found>() };
    groups.set(key, into);
    into.occurrences.set(occurrenceKey, {
      at,
      aObservationId: a.id,
      bObservationId: b.id,
      linkId: link.id,
      direction,
      ...(changeId ? { changeId } : {}),
    });
  }

  const out: ThreadCandidate[] = [];
  for (const [key, group] of groups) {
    const all = [...group.occurrences.values()].sort(
      (x, y) => cmp(x.at, y.at) || cmp(x.aObservationId, y.aObservationId) || cmp(x.bObservationId, y.bObservationId)
    );

    // The thread is about one direction: the one seen most often, and the
    // most recent when they tie. The times the measure had moved the other
    // way are kept as evidence against, and are not counted.
    let supporting = all;
    let against: Found[] = [];
    if (group.measured) {
      const lower = all.filter((o) => o.direction === 'lower');
      const higher = all.filter((o) => o.direction === 'higher');
      const latest = all[all.length - 1].direction;
      const chosen: Direction =
        lower.length === higher.length ? (latest as Direction) : lower.length > higher.length ? 'lower' : 'higher';
      supporting = chosen === 'lower' ? lower : higher;
      against = chosen === 'lower' ? higher : lower;
    }

    const recurrence = recurrenceOf(supporting);
    if (recurrence < MIN_RECURRENCE) continue;

    const members = supporting.flatMap((o) => [byId.get(o.aObservationId)!, byId.get(o.bObservationId)!]);
    const domains = [...new Set(members.map((o) => o.domain))].sort();
    const memberOrigins = new Set(members.map((o) => o.origin_id).filter((id): id is string => !!id));

    const evidence: EvidenceRef[] = supporting.map((o) => ({ role: 'supports', linkId: o.linkId }));
    const changeIds = [...new Set(supporting.map((o) => o.changeId).filter((id): id is string => !!id))].sort();
    for (const id of changeIds) evidence.push({ role: 'supports', changeId: id });
    for (const o of against) evidence.push({ role: 'contradicts', linkId: o.linkId });

    // Her context: what she told the record around those days, leaving out
    // the rows the occurrences themselves were mirrored from.
    const contextIds = new Set(
      [...input.episodes, ...input.journals]
        .filter((r) => !memberOrigins.has(r.id) && near(r.occurred_on, supporting, CONTEXT_DAYS))
        .map((r) => r.id)
    );
    for (const o of input.observations) {
      if (o.origin_id && contextIds.has(o.origin_id)) evidence.push({ role: 'user_reported', observationId: o.id });
    }

    const missing: Missing[] = [];
    // Two events have no measure between them, so there is no change row
    // that could be the finding.
    if (!changeIds.length) missing.push('no_change_row');
    if (
      supporting.every((o) => {
        const a = byId.get(o.aObservationId)!;
        const b = byId.get(o.bObservationId)!;
        return a.source_id != null && a.source_id === b.source_id;
      })
    ) {
      missing.push('single_source');
    }
    if (!contextIds.size) missing.push('no_context');

    out.push({
      key,
      title: titleFor(group.sides),
      domains,
      occurrences: supporting.map(({ direction: _direction, ...occurrence }) => occurrence),
      recurrence,
      firstObservedAt: supporting[0].at,
      lastObservedAt: supporting[supporting.length - 1].at,
      evidence,
      missing,
    });
  }

  return out.sort((x, y) => cmp(x.key, y.key));
}
