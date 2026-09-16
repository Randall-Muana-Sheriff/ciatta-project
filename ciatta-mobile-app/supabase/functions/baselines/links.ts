// Which of her measurements happened near which others. Proximity in time
// and nothing else: this file computes no correlation, ranks no
// relationship by strength, and says nothing about cause. A link is the
// raw material a thread is built from, and the wording that reaches her
// belongs to a later slice.
//
// No Deno or Supabase imports on purpose, the same arrangement as
// compute.ts: plain TypeScript so a Node test can exercise it directly
// while the edge function imports it by relative path.

export type Relation = 'same_day' | 'within_24h' | 'within_3d' | 'within_7d';

export type LinkInput = { id: string; metric: string; occurredAt: string };

export type BuiltLink = {
  a_observation_id: string;
  b_observation_id: string;
  relation: Relation;
  gap_hours: number;
  occurred_on: string;
};

const HOUR_MS = 60 * 60 * 1000;

// Narrowest first. The cap below keeps this order, so what it discards is
// the weakest evidence rather than an arbitrary slice.
const RANK: Record<Relation, number> = { same_day: 0, within_24h: 1, within_3d: 2, within_7d: 3 };

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// The narrowest relation that fits, or null when the two are further apart
// than a week. Same calendar day is checked before the 24 hour window
// because two readings at 23:00 and 01:00 are two hours apart but on
// different days, and "same day" would be the wrong word for them.
function relationFor(earlierMs: number, laterMs: number): Relation | null {
  const gapHours = (laterMs - earlierMs) / HOUR_MS;
  if (gapHours > 24 * 7) return null;
  if (isoDay(earlierMs) === isoDay(laterMs)) return 'same_day';
  if (gapHours <= 24) return 'within_24h';
  if (gapHours <= 24 * 3) return 'within_3d';
  return 'within_7d';
}

export function buildLinks(observations: LinkInput[], maxPairs = 2000): BuiltLink[] {
  // The comparator is total on purpose: the instant first, then the id.
  // Equal instants are ordinary in her record (a device posts a night's
  // readings with one timestamp), and with only the instant to go on the
  // pair would come out (A, B) on one run and (B, A) on the next, depending
  // on the order the rows arrived in. The database catches that now, via
  // temporal_links_pair_once, by raising 23505 rather than storing the pair
  // twice, so an unstable order here would turn into a failed run.
  const parsed = observations
    .map((o) => ({ ...o, ms: Date.parse(o.occurredAt) }))
    .filter((o) => Number.isFinite(o.ms))
    .sort((x, y) => x.ms - y.ms || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const out: BuiltLink[] = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      // Sorted ascending, so once b is out of range every later b is too.
      if (b.ms - a.ms > 24 * 7 * HOUR_MS) break;
      // Two readings of the same metric are a series, not a relationship.
      if (a.metric === b.metric) continue;
      const relation = relationFor(a.ms, b.ms);
      if (!relation) continue;
      out.push({
        a_observation_id: a.id,
        b_observation_id: b.id,
        relation,
        gap_hours: (b.ms - a.ms) / HOUR_MS,
        occurred_on: isoDay(b.ms),
      });
    }
  }

  out.sort((x, y) => RANK[x.relation] - RANK[y.relation] || x.gap_hours - y.gap_hours);
  return out.slice(0, maxPairs);
}
