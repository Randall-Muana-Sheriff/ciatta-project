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

// measured marks a continuous device reading (provenance MEASURED): a step
// count, a heart rate sample, a night's sleep stage. Everything else is an
// event: something she reported, a workout the device recorded, a result
// from a document. The flag is optional and absent means event, so a
// caller that does not know says nothing and every pair is considered.
export type LinkInput = { id: string; metric: string; occurredAt: string; measured?: boolean };

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

// The most pair comparisons one run may make. The loop below scans outward
// from each EVENT only, so its work is the number of events times the
// readings inside their two week reach, not the square of everything she
// has. Eight million is the iteration count the threshold above was chosen
// to stay under.
export const MAX_PAIR_COMPARISONS = 8_000_000;
// An event reaches a week back and a week forward, out of a 91 day window.
const REACH_SHARE = 14 / 91;

// With one argument this is the original rule, a ceiling on the window.
// With the event count as well it is the real one: a wearable can post
// tens of thousands of readings and still be cheap to link, because only
// her events anchor a scan.
export function linksAreAffordable(observationCount: number, eventCount?: number): boolean {
  if (eventCount == null) return observationCount <= MAX_LINKED_OBSERVATIONS;
  return eventCount * observationCount * REACH_SHARE <= MAX_PAIR_COMPARISONS;
}

// How many times maxPairs may accumulate before the working set is sorted
// and cut back. Four is a compromise: compacting at exactly maxPairs would
// re-sort on nearly every push once the cap is reached, and a large
// multiple gives most of the memory back to the problem this bounds.
const COMPACTION_HEADROOM = 4;

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

type Parsed = LinkInput & { ms: number; day: string };

// The narrowest relation that fits, or null when the two are further apart
// than a week. Same calendar day is checked before the 24 hour window
// because two readings at 23:00 and 01:00 are two hours apart but on
// different days, and "same day" would be the wrong word for them. The
// day is worked out once per observation, not once per pair: building a
// date for every comparison was most of what this step cost, and on a real
// record it cost more CPU than one request is given.
function relationFor(earlier: Parsed, later: Parsed): Relation | null {
  const gapHours = (later.ms - earlier.ms) / HOUR_MS;
  if (gapHours > 24 * 7) return null;
  if (earlier.day === later.day) return 'same_day';
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
  const parsed: Parsed[] = observations
    .map((o) => ({ ...o, ms: Date.parse(o.occurredAt), day: '' }))
    .filter((o) => Number.isFinite(o.ms))
    .sort((x, y) => x.ms - y.ms || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  for (const o of parsed) o.day = isoDay(o.ms);

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

  const WEEK_MS = 24 * 7 * HOUR_MS;
  // a is the earlier of the two, as the table requires.
  const consider = (a: Parsed, b: Parsed) => {
    // Two readings of the same metric are a series, not a relationship.
    if (a.metric === b.metric) return;
    const relation = relationFor(a, b);
    if (!relation) return;
    out.push({
      a_observation_id: a.id,
      b_observation_id: b.id,
      relation,
      gap_hours: (b.ms - a.ms) / HOUR_MS,
      occurred_on: b.day,
    });
    if (out.length > threshold) compact();
  };

  // Every link has at least one event in it. Two continuous device
  // readings near each other are two series running side by side, which
  // they do every day of her life: pairing them says nothing, and on a
  // real record there are about a million such pairs. So the scan starts
  // from each event and looks a week forward and a week back. Forward
  // takes every partner; backward takes device readings only, because an
  // earlier EVENT already met this one on its own forward scan, and taking
  // it again would record the pair twice.
  for (let i = 0; i < parsed.length; i++) {
    const anchor = parsed[i];
    if (anchor.measured) continue;
    for (let j = i + 1; j < parsed.length; j++) {
      // Sorted ascending, so once one is out of range every later one is.
      if (parsed[j].ms - anchor.ms > WEEK_MS) break;
      consider(anchor, parsed[j]);
    }
    for (let j = i - 1; j >= 0; j--) {
      if (anchor.ms - parsed[j].ms > WEEK_MS) break;
      if (!parsed[j].measured) continue;
      consider(parsed[j], anchor);
    }
  }

  out.sort(byNarrowness);
  return out.slice(0, limit);
}
