import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  daysBetween,
  emptyForm,
  type Episode,
  episodeTitle,
  formToEpisode,
  isoDay,
  normalizeEpisode,
  recordEpisodes,
  sampleCycleStarts,
  sampleEpisodes,
  summarize,
} from './cycleLog';
import { cycle } from './sample';

const NOW = new Date(2026, 8, 15);

test('sample cycles vary by more than a week', () => {
  const starts = sampleCycleStarts(NOW);
  const gaps = starts.slice(1).map((d, i) => daysBetween(starts[i], d));
  assert.deepEqual(gaps, [34, 41, 30, 26]);
  assert.equal(daysBetween(starts[starts.length - 1], NOW), cycle.day - 1);
});

test('sample record logs a period at each cycle start and three painful bowel movements', () => {
  const eps = sampleEpisodes(NOW);
  const periods = eps.filter((e) => e.kinds.includes('Period'));
  assert.deepEqual(periods.map((e) => e.periodStart), sampleCycleStarts(NOW).map(isoDay));
  assert.equal(eps.filter((e) => e.kinds.includes('Bowel movement') && e.bowelPain === 'During').length, 3);
});

test('a bowel movement is dated by its day and summarised', () => {
  const e = formToEpisode(
    { ...emptyForm(), kinds: ['Bowel movement'], day: 2, stool: 6, bowelPain: 'During', bowelFlags: ['Urgency'] },
    false,
    NOW,
  );
  assert.equal(e.date, isoDay(addDays(NOW, -2)));
  assert.equal(e.periodStart, null);
  assert.equal(episodeTitle(e), 'Bowel movement');
  const section = summarize(e, NOW).find((s) => s.label === 'Bowel movement');
  assert.deepEqual(section?.lines, ['Type 6, Mushy', 'Pain during', 'Urgency']);
});

test('an out of range stool type is skipped rather than crashing', () => {
  const e = formToEpisode({ ...emptyForm(), kinds: ['Bowel movement'], stool: 9, bowelPain: 'None' }, false, NOW);
  const section = summarize(e, NOW).find((s) => s.label === 'Bowel movement');
  assert.deepEqual(section?.lines, ['No pain']);
});

test('other bleeding kinds record dates and keep their own names', () => {
  const e = formToEpisode({ ...emptyForm(), kinds: ['Withdrawal bleed'], periodStart: 3 }, false, NOW);
  assert.equal(e.periodStart, isoDay(addDays(NOW, -3)));
  assert.equal(episodeTitle(e), 'Withdrawal bleed');
  assert.ok(summarize(e, NOW).some((s) => s.label === 'Withdrawal bleed'));
});

test('the sample record stands in until the person logs a period of their own', () => {
  const sample = sampleEpisodes(NOW);
  const pain = formToEpisode({ ...emptyForm(), kinds: ['Pain'], day: 1 }, false, NOW);
  const period = formToEpisode({ ...emptyForm(), kinds: ['Period'], periodStart: 2 }, false, NOW);
  assert.equal(recordEpisodes([], NOW).length, sample.length);
  assert.deepEqual(recordEpisodes([pain], NOW).map((e) => e.id), [...sample.map((e) => e.id), pain.id]);
  assert.deepEqual(recordEpisodes([pain, period], NOW), [pain, period]);
});

test('older saved episodes gain empty bowel fields', () => {
  const { stool, bowelPain, bowelFlags, ...old } = formToEpisode(emptyForm(), false, NOW);
  assert.deepEqual(normalizeEpisode(old as Episode), { ...old, stool: null, bowelPain: null, bowelFlags: [] });
});
