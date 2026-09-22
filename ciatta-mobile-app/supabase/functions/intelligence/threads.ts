// How often two things in her record have happened near each other, and
// what is still missing before that recurrence can be said out loud. This
// file counts and names; it does not interpret. It computes no correlation,
// ranks nothing by strength, and says nothing about cause: an occurrence is
// a temporal_links row, and a candidate is a pair of metrics whose links
// have recurred. The sentences that reach her belong to wording.ts, and
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

export type Occurrence = { at: string; aObservationId: string; bObservationId: string; linkId: string };

// The roles a candidate can assign on its own. contradicts,
// alternative_explanation and research_context exist in the enum for a
// later slice; nothing here has the standing to assign them.
export type EvidenceRole = 'supports' | 'user_reported';
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
const daysApart = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
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
  return o.metric;
}

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

type Group = { sides: [string, string]; occurrences: Map<string, Occurrence> };

export function buildThreads(input: ThreadInput): ThreadCandidate[] {
  const byId = new Map(input.observations.map((o) => [o.id, o]));
  const lengths = new Map(cycleLengths(input.observations).map((c) => [c.observationId, c.length]));
  const periodDay = new Map(cycleLengths(input.observations).map((c) => [c.observationId, c.end]));

  // Links in a fixed order, so which of two links between the same
  // observations is kept never depends on the order the rows arrived in.
  const links = [...input.links].sort((x, y) => cmp(x.occurred_on, y.occurred_on) || cmp(x.id, y.id));

  const groups = new Map<string, Group>();
  for (const link of links) {
    const a = byId.get(link.a_observation_id);
    const b = byId.get(link.b_observation_id);
    if (!a || !b) continue;
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
    const group = groups.get(key) ?? { sides, occurrences: new Map() };
    groups.set(key, group);
    // Two links between the same two observations (the pair recorded at
    // two relations across runs) are one occurrence.
    const pair = [a.id, b.id].sort().join('~');
    if (!group.occurrences.has(pair)) {
      group.occurrences.set(pair, { at: link.occurred_on, aObservationId: a.id, bObservationId: b.id, linkId: link.id });
    }
  }

  const out: ThreadCandidate[] = [];
  for (const [key, group] of groups) {
    const occurrences = [...group.occurrences.values()].sort(
      (x, y) => cmp(x.at, y.at) || cmp(x.aObservationId, y.aObservationId) || cmp(x.bObservationId, y.bObservationId)
    );
    const recurrence = recurrenceOf(occurrences);
    if (recurrence < MIN_RECURRENCE) continue;

    const members = occurrences.flatMap((o) => [byId.get(o.aObservationId)!, byId.get(o.bObservationId)!]);
    const domains = [...new Set(members.map((o) => o.domain))].sort();
    const memberOrigins = new Set(members.map((o) => o.origin_id).filter((id): id is string => !!id));

    const evidence: EvidenceRef[] = occurrences.map((o) => ({ role: 'supports', linkId: o.linkId }));

    // The finding: a change row for either side, detected near an
    // occurrence. Neither cycle_length nor a symptom has change rows (the
    // baselines run writes them for daily metrics only), so for those
    // pairs the finding can only come from the other side.
    const changes = input.changes.filter(
      (c) => group.sides.includes(c.metric) && near(c.detected_on, occurrences, CHANGE_PROXIMITY_DAYS)
    );
    for (const c of changes) evidence.push({ role: 'supports', changeId: c.id });

    // Her context: what she told the record around those days, leaving out
    // the rows the occurrences themselves were mirrored from.
    const contextIds = new Set(
      [...input.episodes, ...input.journals]
        .filter((r) => !memberOrigins.has(r.id) && near(r.occurred_on, occurrences, CONTEXT_DAYS))
        .map((r) => r.id)
    );
    for (const o of input.observations) {
      if (o.origin_id && contextIds.has(o.origin_id)) evidence.push({ role: 'user_reported', observationId: o.id });
    }

    const missing: Missing[] = [];
    if (!changes.length) missing.push('no_change_row');
    if (
      occurrences.every((o) => {
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
      occurrences,
      recurrence,
      firstObservedAt: occurrences[0].at,
      lastObservedAt: occurrences[occurrences.length - 1].at,
      evidence,
      missing,
    });
  }

  return out.sort((x, y) => cmp(x.key, y.key));
}
