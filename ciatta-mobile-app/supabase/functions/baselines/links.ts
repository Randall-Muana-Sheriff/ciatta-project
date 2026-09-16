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

// Narrowest first, and narrowness is all this is. The cap keeps this order
// so that what it discards is the pairs furthest apart in time rather than
// an arbitrary slice. Nothing here establishes that a wider gap is a weaker
// anything: the ordering is over the size of a time gap, which is measured,
// and not over how much a pair is worth, which is not.
const RANK: Record<Relation, number> = { same_day: 0, within_24h: 1, within_3d: 2, within_7d: 3 };

// The one total order used for both the running compaction and the final
// selection. They have to be the same comparator or compacting early could
// discard a pair the final sort would have kept.
function byNarrowness(x: BuiltLink, y: BuiltLink): number {
  // The ids are part of this comparator on purpose, overruling the brief
  // that specified rank and gap alone. The cap makes this sort load
  // bearing: which links survive must not depend on the sort's
  // implementation. Rank and gap alone leave two links that tie on both in
  // whatever order the sort happens to produce, so a later run over the
  // same window can keep a different pair at the cutoff and strand a row
  // that nothing removes. With the ids the order is total, and the same
  // window yields the same rows every time.
  return (
    RANK[x.relation] - RANK[y.relation] ||
    x.gap_hours - y.gap_hours ||
    (x.a_observation_id < y.a_observation_id ? -1 : x.a_observation_id > y.a_observation_id ? 1 : 0) ||
    (x.b_observation_id < y.b_observation_id ? -1 : x.b_observation_id > y.b_observation_id ? 1 : 0)
  );
}

// The most observations in one window this will generate pairs over at all.
//
// maxPairs bounds the memory and nothing else: every pair inside the seven
// day window is still formed and compared before the cap discards any of
// it. That work is the other axis, and it was left unbounded. Over a 91 day
// window the inner loop runs about n * (7/91) * n times, or n squared over
// thirteen, so a wearable posting overnight wrist temperature at roughly
// 500 readings a day reaches 45,500 rows in the window and upwards of 150
// million iterations: seconds of CPU against a per request budget.
//
// That matters more than it would elsewhere because of WHERE it happens.
// The links step runs after her baselines and temperature deviations are
// already written, so a run killed here retries, writes them again, is
// killed again, and ends as a permanently failed job. It is the same
// outcome the memory bound was added to prevent, reached along the other
// axis, by the same heavy user.
//
// 10,000 keeps the loop under about eight million iterations, which is
// milliseconds. It is roughly 110 observations a day averaged over the
// window, well above anyone logging by hand or syncing ordinary daily
// metrics, and below the density only a high frequency device produces.
//
// Past it the step is SKIPPED, never computed over a truncated input.
// Truncating would compute over part of her record and then write the
// result as though it were the whole of it, which is an inference
// presented as a measured fact. Skipping writes nothing, and nothing
// written is at least not something false.
export const MAX_LINKED_OBSERVATIONS = 10000;

export function linksAreAffordable(observationCount: number): boolean {
  return observationCount <= MAX_LINKED_OBSERVATIONS;
}

// How many times maxPairs may accumulate before the working set is sorted
// and cut back. Four is a compromise: compacting at exactly maxPairs would
// re-sort on nearly every push once the cap is reached, and a large
// multiple gives most of the memory back to the problem this bounds.
const COMPACTION_HEADROOM = 4;

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

// maxPairs bounds the output, and headroom bounds the work in progress.
// headroom is a parameter only so a test can set it high enough never to
// fire and compare the two paths; nothing in the function should pass it.
export function buildLinks(
  observations: LinkInput[],
  maxPairs = 2000,
  headroom = COMPACTION_HEADROOM
): BuiltLink[] {
  const limit = Math.max(0, Math.floor(maxPairs));
  if (limit === 0) return [];
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

  // The pair count grows with the square of how much she has logged: 1001
  // observations in the window is 63,700 pairs, 4550 is 1,338,925, and 9100
  // is 5,358,150, each one a fresh object carrying its own occurred_on
  // string. Materialising all of them before sorting would exhaust the
  // isolate's memory for the woman who has logged the most, and because the
  // baselines and deviations above are already written by then, the job
  // would die, retry, and die again. So the generation is bounded, not only
  // the read.
  //
  // Discarding early is exact rather than approximate, and this is why: the
  // result is the first `limit` links under byNarrowness, which is a total
  // order over every pair. Once `limit` links already rank above some pair,
  // that pair cannot reach the final set no matter what is generated later,
  // because nothing generated later can displace links that already beat
  // it. Cutting back to exactly `limit` therefore removes only pairs that
  // could never have been returned, and the output is identical to sorting
  // the whole set at the end. links.test.ts pins that equivalence.
  const threshold = Math.max(limit, Math.floor(limit * headroom));
  const out: BuiltLink[] = [];
  const compact = () => {
    out.sort(byNarrowness);
    // Truncates in place: the discarded objects become garbage here rather
    // than being copied into a second array.
    out.length = limit;
  };

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
      if (out.length > threshold) compact();
    }
  }

  out.sort(byNarrowness);
  return out.slice(0, limit);
}
