// buildLinks lives beside the baselines edge function (a Deno file imports
// it by relative path) but is plain TypeScript with no Deno or Supabase
// imports, so this suite exercises it directly under node:test, the same
// arrangement as src/data/baselines.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildLinks,
  linksAreAffordable,
  MAX_LINKED_OBSERVATIONS,
  type LinkInput,
} from '../../supabase/functions/baselines/links';

const at = (id: string, metric: string, iso: string): LinkInput => ({ id, metric, occurredAt: iso });

test('two different metrics on the same calendar day are linked as same_day', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T06:00:00.000Z'),
    at('b', 'resting_hr', '2026-09-10T07:30:00.000Z'),
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'same_day');
  assert.equal(links[0].a_observation_id, 'a');
  assert.equal(links[0].b_observation_id, 'b');
  assert.equal(links[0].occurred_on, '2026-09-10');
});

test('the same metric is never linked to itself across days: that is a series, not a relationship', () => {
  const links = buildLinks([
    at('a', 'steps', '2026-09-10T06:00:00.000Z'),
    at('b', 'steps', '2026-09-11T06:00:00.000Z'),
  ]);
  assert.deepEqual(links, []);
});

test('a pair is recorded once, at the narrowest relation that fits', () => {
  // 20 hours apart but on different calendar days: within_24h, not same_day.
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T20:00:00.000Z'),
    at('b', 'hrv', '2026-09-11T16:00:00.000Z'),
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'within_24h');
});

test('gap_hours is a magnitude and a is always the earlier observation', () => {
  const links = buildLinks([
    at('later', 'hrv', '2026-09-12T00:00:00.000Z'),
    at('earlier', 'sleep_hours', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.equal(links[0].a_observation_id, 'earlier');
  assert.equal(links[0].b_observation_id, 'later');
  assert.equal(links[0].gap_hours, 48);
  assert.ok(links[0].gap_hours >= 0);
});

test('occurred_on is the day of the later observation, not the earlier', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-12T00:00:00.000Z'),
  ]);
  assert.equal(links[0].occurred_on, '2026-09-12');
});

test('more than seven days apart is not a link at all', () => {
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-01T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.deepEqual(links, []);
});

test('exactly seven days apart is still within_7d, and eight days is nothing', () => {
  const seven = buildLinks([
    at('a', 'sleep_hours', '2026-09-03T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.equal(seven.length, 1);
  assert.equal(seven[0].relation, 'within_7d');

  const eight = buildLinks([
    at('a', 'sleep_hours', '2026-09-02T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T00:00:00.000Z'),
  ]);
  assert.deepEqual(eight, []);
});

test('the cap keeps the narrowest links and discards the furthest apart, not an arbitrary slice', () => {
  const input: LinkInput[] = [
    at('s1', 'sleep_hours', '2026-09-10T06:00:00.000Z'),
    at('h1', 'hrv', '2026-09-10T07:00:00.000Z'),        // same_day with s1
    at('r1', 'resting_hr', '2026-09-16T06:00:00.000Z'), // within_7d with s1
  ];
  const links = buildLinks(input, 1);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, 'same_day');
});

test('an empty input produces no links rather than throwing', () => {
  assert.deepEqual(buildLinks([]), []);
});

// The ordering rule is the guard on temporal_links_pair_once, the unique
// index over (user_id, least(a, b), greatest(a, b), relation) added in
// 20260917100300_temporal_links_gap_and_pair.sql. If the same pair can come
// out (A, B) from one input order and (B, A) from another, then two runs
// over the same window disagree about the row, and the second one raises
// 23505 rather than reproducing what the first wrote. So the output has to
// be identical field for field, not merely one link either way.
test('the same pair in either input order produces the identical link, field for field', () => {
  const earlier = at('11111111-1111-1111-1111-111111111111', 'sleep_hours', '2026-09-10T06:00:00.000Z');
  const later = at('00000000-0000-0000-0000-000000000000', 'hrv', '2026-09-10T18:00:00.000Z');

  const forwards = buildLinks([earlier, later]);
  const backwards = buildLinks([later, earlier]);

  assert.equal(forwards.length, 1);
  assert.deepEqual(forwards, backwards);
  // Spelled out as well as deepEqual: the id that is smaller sorts first as
  // a string, so a comparator that reached for the id before the instant
  // would pass deepEqual on symmetry while putting the wrong one in a.
  assert.equal(forwards[0].a_observation_id, earlier.id);
  assert.equal(forwards[0].b_observation_id, later.id);
  assert.equal(backwards[0].a_observation_id, earlier.id);
  assert.equal(backwards[0].b_observation_id, later.id);
});

// The tie is the case most likely to be wrong: with equal instants, a sort
// that is not total leaves the order to the sort's implementation, and the
// pair then lands one way round on one run and the other way round on the
// next.
test('two observations at the same instant tie on the smaller id, in either input order', () => {
  const sameInstant = '2026-09-10T06:00:00.000Z';
  const smaller = at('00000000-0000-0000-0000-00000000000a', 'sleep_hours', sameInstant);
  const bigger = at('ffffffff-ffff-ffff-ffff-ffffffffffff', 'hrv', sameInstant);

  const forwards = buildLinks([smaller, bigger]);
  const backwards = buildLinks([bigger, smaller]);

  assert.equal(forwards.length, 1);
  assert.deepEqual(forwards, backwards);
  assert.equal(forwards[0].a_observation_id, smaller.id);
  assert.equal(forwards[0].b_observation_id, bigger.id);
  assert.equal(forwards[0].gap_hours, 0);
  assert.equal(forwards[0].relation, 'same_day');
});

// The cap makes the output sort load bearing, so the sort has to be total.
// Two links that tie on both relation and gap must be separated by the ids
// rather than by the sort's implementation, or a later run over the same
// window keeps a different pair at the cutoff and strands a row.
//
// This case is built so that stability alone cannot produce the right
// answer: the tying pair that the double loop reaches FIRST is the one with
// the larger a id, so a comparator that returns 0 for the tie leaves it in
// front and the wrong pair survives the cap. Only the id clauses reorder it.
test('the cap is decided by a total order, not by where a tie happened to sit', () => {
  const p = at('99999999-9999-9999-9999-999999999999', 'sleep_hours', '2026-09-10T00:00:00.000Z');
  const q = at('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'steps', '2026-09-10T00:00:00.000Z');
  const r = at('11111111-1111-1111-1111-111111111111', 'hrv', '2026-09-10T01:00:00.000Z');
  const s = at('22222222-2222-2222-2222-222222222222', 'active_minutes', '2026-09-10T01:00:00.000Z');
  const input = [p, q, r, s];

  // Six pairs in all, well over the cap. Two of them tie exactly: (p, q)
  // and (r, s) are both same_day with a zero hour gap.
  assert.equal(buildLinks(input).length, 6);

  const one = buildLinks(input, 1);
  assert.equal(one.length, 1);
  assert.equal(one[0].gap_hours, 0);
  assert.equal(one[0].a_observation_id, r.id);
  assert.equal(one[0].b_observation_id, s.id);

  // And the tie is ordered, not merely resolved: both zero gap links come
  // out ahead of every one hour link, smaller a id first.
  const two = buildLinks(input, 2);
  assert.deepEqual(
    two.map((link) => [link.a_observation_id, link.b_observation_id]),
    [
      [r.id, s.id],
      [p.id, q.id],
    ]
  );
});

// The pair count grows with the square of how much she has logged, so
// buildLinks compacts its working set as it goes rather than materialising
// every pair and sorting at the end. That is only allowed because it cannot
// change the answer: the result is the top maxPairs under a total order, so
// a pair already ranking below maxPairs others can never reach the final
// set and discarding it early is invisible. This pins that claim. If the
// two paths ever diverge the optimisation is wrong, and this test is what
// should say so.
test('compacting while generating changes only the memory used, never the result', () => {
  // Twenty observations on one day, every metric distinct, so all 190 pairs
  // qualify and none is dropped as a series.
  const input: LinkInput[] = [];
  for (let i = 0; i < 20; i++) {
    const hour = String(i).padStart(2, '0');
    input.push(at(`obs${hour}`, `metric_${i}`, `2026-09-10T${hour}:00:00.000Z`));
  }

  const everyPair = buildLinks(input, Number.MAX_SAFE_INTEGER);
  assert.equal(everyPair.length, 190);

  const cap = 5;
  const headroom = 4;
  // Compaction fires whenever the working set passes cap * headroom, which
  // is 20, and 190 pairs are generated, so it fires far more than the two
  // times this needs to be a real exercise of the path.
  assert.ok(everyPair.length > cap * headroom * 2);

  const compacted = buildLinks(input, cap, headroom);
  // A headroom this large cannot be reached, so this path sorts once at the
  // end exactly as the unbounded version did.
  const uncompacted = buildLinks(input, cap, Number.MAX_SAFE_INTEGER);

  assert.equal(compacted.length, cap);
  assert.deepEqual(compacted, uncompacted);
  // And both agree with the head of the fully sorted set.
  assert.deepEqual(compacted, everyPair.slice(0, cap));
});

// maxPairs bounds the memory and nothing else. The generation loop is
// untouched by it: every pair inside the seven day window is still formed
// and compared before the cap discards any of it, so the work grows with
// the count of observations in the window times how many of them fall
// within the following week of each. That is a CPU cost, it lands on the
// same heavy user the memory bound protects, and it lands AFTER her
// baselines and deviations are written, so a run killed there retries,
// fails and retries into a permanently failed job.
//
// So the count is checked before the loop is entered at all. Truncating the
// input instead would be worse than skipping: it would compute over part of
// her record and write the result as though it were the whole of it.
test('a window too dense to afford is refused before the loop, rather than computed over part of it', () => {
  assert.equal(linksAreAffordable(0), true);
  assert.equal(linksAreAffordable(1), true);
  assert.equal(linksAreAffordable(MAX_LINKED_OBSERVATIONS - 1), true);
  // The threshold itself is affordable; only past it is refused.
  assert.equal(linksAreAffordable(MAX_LINKED_OBSERVATIONS), true);
  assert.equal(linksAreAffordable(MAX_LINKED_OBSERVATIONS + 1), false);
});

// The threshold is a budget, not a preference, so the arithmetic behind it
// is pinned here rather than left in a comment nobody re-checks. The inner
// loop runs once per pair within seven days of each other, which over a 91
// day window is about n * 7/91 * n, or n squared over thirteen. At the
// threshold that is under ten million iterations; a wearable posting
// overnight temperature at roughly 500 readings a day reaches 45,500 rows
// in the window, which is over 150 million and is what this refuses.
test('the threshold keeps the pair loop inside the budget it was chosen for', () => {
  const iterations = (n: number) => (n * n) / 13;
  assert.ok(iterations(MAX_LINKED_OBSERVATIONS) <= 10_000_000);
  assert.ok(iterations(500 * 91) > 100_000_000);
  assert.equal(linksAreAffordable(500 * 91), false);
});

test('a cap of zero or less produces no links rather than a negative slice', () => {
  const input = [
    at('a', 'sleep_hours', '2026-09-10T06:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T07:00:00.000Z'),
  ];
  assert.deepEqual(buildLinks(input, 0), []);
  assert.deepEqual(buildLinks(input, -1), []);
});

// Every relation the generator can emit has to satisfy
// temporal_links_gap_matches_relation, or the upsert fails at the end of a
// run that otherwise did all its work.
test('every relation emitted carries a gap the database check will accept', () => {
  const ceiling: Record<string, number> = { within_24h: 24, within_3d: 72, within_7d: 168 };
  const links = buildLinks([
    at('a', 'sleep_hours', '2026-09-10T00:00:00.000Z'),
    at('b', 'hrv', '2026-09-10T23:00:00.000Z'),   // same_day
    at('c', 'resting_hr', '2026-09-11T00:00:00.000Z'), // within_24h with a
    at('d', 'steps', '2026-09-13T00:00:00.000Z'), // within_3d with a
    at('e', 'active_minutes', '2026-09-17T00:00:00.000Z'), // within_7d with a
  ]);
  assert.ok(links.length > 0);
  for (const link of links) {
    assert.ok(link.gap_hours >= 0);
    const cap = ceiling[link.relation];
    if (cap != null) assert.ok(link.gap_hours <= cap, `${link.relation} carried ${link.gap_hours} hours`);
  }
});
