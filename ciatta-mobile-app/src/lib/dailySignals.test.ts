import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { buildInsights } from './engine';

// A run of days where one measure sits in a tight band, then moves.
//
// Sixty baseline days, not thirty. The engine's baseline is days 35 to 90
// back, so a finding needs 35 excluded days plus 20 of baseline before it
// can exist at all. A shorter fixture produced no baseline and no
// finding, which is the engine being right rather than the candidate
// being wrong.
const series = (field: 'hrv' | 'restingHR' | 'tempDeviation', base: number[], recent: number[]): Day[] =>
  [...base, ...recent].map((v, i) => ({
    date: (() => {
      const d = new Date(2026, 0, 1 + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
    sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null,
    steps: null, activeMinutes: null, workouts: [], restingHR: field === 'restingHR' ? v : null,
    hrv: field === 'hrv' ? v : null, tempDeviation: field === 'tempDeviation' ? v : null,
    energy: null, mood: null, stress: null, caffeine: null, alcohol: null, foods: [], digestion: [],
  }));

const run = (days: Day[]) =>
  buildInsights({
    days, episodes: [], windows: [], summaries: [], signals: [], cycleObservations: [],
    draws: [], interventions: [], watching: [], opening: '', now: new Date(2026, 2, 1),
  });

const titles = (days: Day[]) => run(days).ranked.map((i) => i.title);

// ── A daily measure can produce a finding without waiting on cycles ───

test('a sustained drop in heart rate variability is found', () => {
  // This is the point: a cycle is one data point a month, so anything
  // compared against it needs most of a year. HRV arrives nightly.
  const days = series('hrv', Array.from({ length: 60 }, (_, i) => 60 + (i % 3)), [38, 37, 39, 36, 38]);
  assert.ok(titles(days).some((t) => t.includes('Heart rate variability')), titles(days).join(' | '));
});

test('a sustained rise is reported too, not only a fall', () => {
  // Lower is the one people watch, but saying so would be interpreting
  // it, and a run above her usual is equally a change she did not have.
  const days = series('hrv', Array.from({ length: 60 }, (_, i) => 40 + (i % 3)), [72, 71, 74, 70, 73]);
  assert.ok(titles(days).some((t) => t.includes('Heart rate variability')));
});

test('a steady measure produces nothing at all', () => {
  const days = series('hrv', Array.from({ length: 65 }, (_, i) => 55 + (i % 3)), []);
  assert.ok(!titles(days).some((t) => t.includes('Heart rate variability')), titles(days).join(' | '));
});

test('too little history produces nothing, however large the swing', () => {
  // A baseline needs enough days to be a baseline. Two weeks and a cliff
  // is not a pattern, it is a fortnight.
  const days = series('hrv', [60, 61, 59, 60, 62], [20, 21, 19]);
  assert.ok(!titles(days).some((t) => t.includes('Heart rate variability')));
});

// ── Skin temperature is a difference, never a temperature ─────────────

test('skin temperature is reported as a difference from her own usual', () => {
  const days = series('tempDeviation', Array.from({ length: 60 }, (_, i) => 0.0 + (i % 3) * 0.05), [0.8, 0.9, 0.85, 0.9]);
  const found = run(days).ranked.find((i) => i.title.includes('Skin temperature'));
  assert.ok(found, 'expected a skin temperature finding');
  assert.ok(found!.brief.includes('your own usual'), found!.brief);
  assert.ok(!/\b3[5-9](\.\d)? ?degrees\b/.test(found!.brief), 'must not read like a thermometer');
  assert.ok(found!.evidence.notEstablished.some((n) => n.includes('not a temperature reading')));
});

// ── What these findings may not claim ─────────────────────────────────

test('neither finding interprets itself or scores her', () => {
  const days = series('hrv', Array.from({ length: 60 }, (_, i) => 60 + (i % 3)), [38, 37, 39, 36, 38]);
  const found = run(days).ranked.find((i) => i.title.includes('Heart rate variability'))!;
  const text = `${found.title} ${found.brief} ${found.evidence.supports.join(' ')}`.toLowerCase();
  for (const w of ['poor', 'bad', 'low recovery', 'readiness', 'score', 'you should', 'because', 'caused']) {
    assert.ok(!text.includes(w), `${w} appeared: ${text}`);
  }
});

test('every daily finding carries what it does not show', () => {
  const days = series('hrv', Array.from({ length: 60 }, (_, i) => 60 + (i % 3)), [38, 37, 39, 36, 38]);
  const found = run(days).ranked.find((i) => i.title.includes('Heart rate variability'))!;
  assert.ok(found.evidence.notEstablished.length > 0);
  assert.ok(found.evidence.alternatives.length > 0, 'other explanations must be offered');
});

test('no daily finding carries a dash', () => {
  const days = series('hrv', Array.from({ length: 60 }, (_, i) => 60 + (i % 3)), [38, 37, 39, 36, 38]);
  for (const i of run(days).ranked) {
    assert.ok(!/[—–]/.test(`${i.title}${i.brief}`), i.brief);
  }
});
