// buildLinks lives beside the baselines edge function (a Deno file imports
// it by relative path) but is plain TypeScript with no Deno or Supabase
// imports, so this suite exercises it directly under node:test, the same
// arrangement as src/data/baselines.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildLinks, type LinkInput } from '../../supabase/functions/baselines/links';

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

test('the cap keeps the narrowest links and discards the weakest, not an arbitrary slice', () => {
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
