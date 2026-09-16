import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay, sampleEpisodes, shortDate, startOfDay } from '../data/cycleLog';
import { sampleDays, WALK_PLAN_AGO } from '../data/daily';
import { daysFromRows } from '../data/dailyRows';
import { records, today } from '../data/sample';
import { cycleWindows, medianLength, periodStarts, regularity } from './cycleModel';
import { cycleSummaries, observations, signals } from './cyclePatterns';
import { SAMPLE_PROFILE } from './cycleProfile';
import { buildInsights, cycleTrend, mostRecentValue } from './engine';

const NOW = new Date(2026, 8, 15);

// The same inputs useInsights builds from the sample record.
function sampleInsights(now = NOW) {
  const episodes = sampleEpisodes(now);
  const windows = cycleWindows(periodStarts(episodes));
  const reg = regularity(windows, SAMPLE_PROFILE);
  const sigs = signals(episodes, windows, reg === 'predictable' ? medianLength(windows) : null);
  const summaries = cycleSummaries(sigs, windows);
  return buildInsights({
    days: sampleDays(now),
    episodes,
    windows,
    summaries,
    signals: sigs,
    cycleObservations: observations(sigs, windows, summaries),
    draws: records.draws,
    interventions: [{ id: 'sample-walk', kind: 'walk', date: isoDay(addDays(startOfDay(now), -WALK_PLAN_AGO)) }],
    watching: {},
    opening: today.brief,
    now,
  });
}

test('the sample record leads Today with the combined story', () => {
  const { today: brief } = sampleInsights();
  assert.equal(brief.lead?.id, 'combined');
});

test('Today\'s trend is the real completed cycles, the two shortest after lower sleep weeks', () => {
  const episodes = sampleEpisodes(NOW);
  const trend = cycleTrend(cycleWindows(periodStarts(episodes)), sampleDays(NOW));
  assert.deepEqual(trend.map((p) => p.length), [34, 41, 30, 26]);
  assert.deepEqual(trend.map((p) => p.start.getMonth()), [3, 4, 6, 7]); // Apr, May, Jul, Aug
  const [a, b, c, d] = trend.map((p) => p.sleep!);
  assert.ok(Math.max(c, d) < Math.min(a, b), `${[a, b, c, d]}`);
  // The combined story names the shortest and one earlier match: the next shortest.
  const lead = sampleInsights().today.lead!;
  assert.match(lead.brief, /Your shortest cycle this year, 26 days/);
  assert.match(lead.brief, /appeared once before/);
  assert.ok(lead.evidence.supports.some((s) => s.includes(`cycle that ended ${shortDate(addDays(trend[2].start, 30))}`)));
});

test('the lead holds on other days too', () => {
  for (const now of [new Date(2026, 0, 10), new Date(2026, 5, 1), new Date(2026, 11, 31)]) {
    assert.equal(sampleInsights(now).today.lead?.id, 'combined', isoDay(now));
  }
});

test('with no data the engine says only the opening line', () => {
  const out = buildInsights({
    days: [], episodes: [], windows: [], summaries: [], signals: [], cycleObservations: [],
    draws: [], interventions: [], watching: {}, opening: 'Nothing to compare yet.',
  });
  assert.deepEqual(out.ranked, []);
  assert.equal(out.today.lead, null);
  assert.equal(out.today.text, 'Nothing to compare yet.');
  const m = out.movement;
  // recent and workouts.usual are unaffected by this review: with no days at
  // all there is nothing to average, so they fall back to the shared mean()/
  // 0 convention documented at movementSummary. steps.usual and active.usual
  // are different: with no baseline days, there is no usual, and it must
  // say so rather than fabricate one (Fix round 1, item 3).
  for (const v of [m.steps.recent, m.active.recent, m.workouts.recent, m.workouts.usual]) {
    assert.ok(Number.isFinite(v), 'movement figures stay finite with no days');
  }
  assert.equal(m.steps.usual, null, 'no baseline days means no usual, not a fabricated zero');
  assert.equal(m.active.usual, null);
  assert.equal(m.band, null, 'no baseline days means no band either');
  assert.deepEqual(m.series, []);
});

// Fix round 1, item 1: median()/band() return 0/all zeros for an empty
// input, which is correct for those two shared, cross checked helpers, but
// wrong as a "usual" to show her: a real day above "Usual 0h 00m" reads as a
// false claim, not an absent one. A short history (here, far short of the
// 35 to 90 day baseline window) must report no usual at all.
test('with too little history for a baseline, the usual is absent rather than a fabricated zero', () => {
  const now = new Date(2026, 8, 16);
  const rows = Array.from({ length: 10 }, (_, i) => ({
    day: isoDay(addDays(now, -(9 - i))),
    steps: 8000,
    active_minutes: 40,
  }));
  const days = daysFromRows(rows, now);

  const out = buildInsights({
    days, episodes: [], windows: [], summaries: [], signals: [], cycleObservations: [],
    draws: [], interventions: [], watching: {}, opening: 'x', now,
  });
  assert.equal(out.movement.steps.usual, null);
  assert.equal(out.movement.active.usual, null);
  assert.equal(out.movement.band, null);
  assert.ok(Number.isFinite(out.movement.steps.recent), 'recent still reports over the days that exist');
});

// Fix round 1, item 2: daysFromRows always extends the array through today,
// so days[days.length - 1] is often an empty placeholder from midnight
// until her first sync of the day. A card must read whatever she last
// measured, not "today", which mostRecentValue provides.
test('mostRecentValue finds the latest day carrying a field, skipping trailing empty days', () => {
  const now = new Date(2026, 8, 16);
  const rows = [{ day: isoDay(addDays(now, -2)), sleep_hours: 7.5 }];
  // today and yesterday have no row at all: an empty placeholder each.
  const days = daysFromRows(rows, now);
  assert.equal(days.length, 3);
  assert.equal(days[days.length - 1].sleepHours, null, 'today has not synced yet');

  const entry = mostRecentValue(days, (d) => d.sleepHours);
  assert.ok(entry);
  assert.equal(entry!.day.date, isoDay(addDays(now, -2)));
  assert.equal(entry!.value, 7.5);
});

test('mostRecentValue returns null when a field has never once been measured', () => {
  const now = new Date(2026, 8, 16);
  const days = daysFromRows([{ day: isoDay(now), steps: 100 }], now);
  assert.equal(mostRecentValue(days, (d) => d.sleepHours), null);
});

// Real Apple Health data leaves most fields of most days null; the engine
// must never crash on that, and must never claim something about a measure
// it has no numbers for.
test('the engine tolerates real days where only sleep is present', () => {
  const now = new Date(2026, 8, 16);
  const rows = Array.from({ length: 90 }, (_, i) => ({
    day: isoDay(addDays(now, -(89 - i))),
    sleep_hours: 7,
  }));
  const days = daysFromRows(rows, now);
  assert.equal(days.length, 90);

  const out = buildInsights({
    days,
    episodes: [],
    windows: [],
    summaries: [],
    signals: [],
    cycleObservations: [],
    draws: [],
    interventions: [],
    watching: {},
    opening: 'Nothing to compare yet.',
    now,
  });
  assert.ok(out.today.text.length > 0);
  assert.doesNotMatch(out.today.text, /steps/i, 'nothing measured about steps, so nothing is said about it');
  for (const v of [out.movement.steps.recent, out.movement.active.recent]) {
    assert.ok(Number.isFinite(v));
  }
});

test('a day with every measured field null contributes nothing to any average the engine reports', () => {
  const now = new Date(2026, 8, 16);
  const rowsComplete = Array.from({ length: 10 }, (_, i) => ({
    day: isoDay(addDays(now, -(9 - i))),
    steps: 8000,
  }));
  const rowsWithGap = rowsComplete.filter((_, i) => i !== 5);

  const complete = daysFromRows(rowsComplete, now);
  const withGap = daysFromRows(rowsWithGap, now);
  assert.equal(complete.length, withGap.length, 'the gap day still gets a calendar entry');

  const insightsFor = (days: typeof complete) =>
    buildInsights({
      days, episodes: [], windows: [], summaries: [], signals: [], cycleObservations: [],
      draws: [], interventions: [], watching: {}, opening: 'x', now,
    });

  const full = insightsFor(complete).movement.steps.recent;
  const gapped = insightsFor(withGap).movement.steps.recent;
  assert.equal(full, 8000);
  assert.equal(gapped, 8000, 'the missing day is skipped, not averaged in as a zero');
});
