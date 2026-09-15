import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, emptyForm, type EpisodeForm, formToEpisode } from '../data/cycleLog';
import { cycleWindows } from './cycleModel';
import { cycleSummaries, monthSummary, observations, painSplit, signals } from './cyclePatterns';

const NOW = new Date(2026, 8, 15);
const day = (ago: number) => addDays(NOW, -ago);
const episode = (form: Partial<EpisodeForm>) => formToEpisode({ ...emptyForm(), ...form }, false, NOW);
const windows = cycleWindows([day(60), day(30), day(5)]);

test('signals carry days since period and bowel pain', () => {
  const [s] = signals([episode({ kinds: ['Bowel movement'], day: 2, bowelPain: 'After' })], windows, null);
  assert.equal(s.daysSincePeriod, 3);
  assert.equal(s.bowel, true);
  assert.equal(s.bowelPain, true);
  assert.equal(s.phase, 'During period');
});

test('pain with bowel movements chosen as context counts as bowel pain', () => {
  const [s] = signals([episode({ kinds: ['Pain'], day: 1, context: ['Pain with bowel movements'] })], windows, null);
  assert.equal(s.bowelPain, true);
});

test('three painful bowel movements make an observation grouped by phase', () => {
  const eps = [2, 3, 32].map((d) => episode({ kinds: ['Bowel movement'], day: d, bowelPain: 'During' }));
  const sigs = signals(eps, windows, null);
  const found = observations(sigs, windows, cycleSummaries(sigs, windows), NOW).find((o) => o.id === 'bowelPain');
  assert.equal(found?.text, 'Pain with bowel movements showed up most during your period: 2 of the 3 times you logged it.');
});

test('without a phase, bowel pain is grouped by days since a period', () => {
  const open = cycleWindows([day(50)]);
  const eps = [10, 12, 15].map((d) => episode({ kinds: ['Bowel movement'], day: d, bowelPain: 'During' }));
  const sigs = signals(eps, open, null);
  const found = observations(sigs, open, cycleSummaries(sigs, open), NOW).find((o) => o.id === 'bowelPain');
  assert.equal(
    found?.text,
    'Pain with bowel movements showed up most more than 35 days after a period started: 2 of the 3 times you logged it.',
  );
});

test('painSplit counts pain days in and outside a period', () => {
  const eps = [3, 15, 16].map((d) => episode({ kinds: ['Pain'], day: d }));
  assert.deepEqual(painSplit(signals(eps, windows, null), NOW), { during: 1, outside: 2 });
});

test('monthSummary counts bowel movements and painful ones', () => {
  const eps = [
    episode({ kinds: ['Bowel movement'], day: 1, bowelPain: 'None' }),
    episode({ kinds: ['Bowel movement'], day: 2, bowelPain: 'During' }),
  ];
  const ms = monthSummary(signals(eps, windows, null), NOW.getFullYear(), NOW.getMonth());
  assert.equal(ms.bowel, 2);
  assert.equal(ms.bowelPain, 1);
});
