import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, isoDay, sampleEpisodes, shortDate, startOfDay } from '../data/cycleLog';
import { sampleDays, WALK_PLAN_AGO } from '../data/daily';
import { records, today } from '../data/sample';
import { cycleWindows, medianLength, periodStarts, regularity } from './cycleModel';
import { cycleSummaries, observations, signals } from './cyclePatterns';
import { SAMPLE_PROFILE } from './cycleProfile';
import { buildInsights, cycleTrend } from './engine';

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
  for (const v of [m.steps.recent, m.steps.usual, m.active.recent, m.active.usual, m.workouts.recent, m.workouts.usual]) {
    assert.ok(Number.isFinite(v), 'movement figures stay finite with no days');
  }
  assert.deepEqual(m.series, []);
});
