import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { DEFAULT_SECTIONS, type ReportInput, reportHtml, reportSections } from './clinicianReport';

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date, sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});

const input: ReportInput = {
  from: new Date(2026, 6, 16),
  to: new Date(2026, 9, 14),
  name: 'Jennifer',
  days: [
    day('2026-10-12', { sleepHours: 6, restingHR: 60, hrv: 40 }),
    day('2026-10-13', { sleepHours: 7, restingHR: 62, hrv: 50 }),
    day('2026-01-01', { sleepHours: 9 }),
  ],
  episodes: [
    { date: new Date(2026, 9, 1), kinds: ['Pain'], symptoms: ['Bloating'], severity: 7 },
    { date: new Date(2026, 9, 5), kinds: ['Pain'], symptoms: ['Bloating', 'Fatigue'], severity: 4 },
    { date: new Date(2026, 0, 5), kinds: ['Pain'], symptoms: ['Nausea'], severity: 9 },
  ],
  logs: [
    { at: new Date(2026, 9, 10), category: 'gut', items: { gut: ['Bloating'] }, text: 'bloated after lunch' },
    { at: new Date(2026, 9, 11), category: 'meds', items: { meds: ['Took medication'] }, text: '' },
  ],
  cycles: [
    { start: new Date(2026, 6, 20), length: 27 },
    { start: new Date(2026, 7, 16), length: 31 },
    { start: new Date(2025, 11, 1), length: 40 },
  ],
  reported: { conditions: ['Endometriosis'], surgeries: ['Laparoscopy'], medications: ['Levothyroxine'], supplements: ['Magnesium'] },
};

const rows = (id: string, include = DEFAULT_SECTIONS) => reportSections(input, include).find((s) => s.id === id)!;

test('her notes are left out unless she includes them', () => {
  assert.ok(!DEFAULT_SECTIONS.includes('notes'));
  assert.equal(reportSections(input, DEFAULT_SECTIONS).some((s) => s.id === 'notes'), false);
  const notes = rows('notes', [...DEFAULT_SECTIONS, 'notes']);
  assert.deepEqual(notes.rows, [{ label: '10 Oct', value: 'bloated after lunch' }]);
});

test('cycles in the period, with their range', () => {
  assert.deepEqual(rows('cycle').rows, [
    { label: 'Cycles recorded', value: '2' },
    { label: 'Average length', value: '29 days' },
    { label: 'Shortest and longest', value: '27 and 31 days' },
    { label: 'Started 20 Jul', value: '27 days' },
    { label: 'Started 16 Aug', value: '31 days' },
  ]);
  assert.equal(rows('cycle').source, 'Logged by her');
});

test('symptoms counted across her logs, with the worst rating she gave', () => {
  assert.deepEqual(rows('symptoms').rows, [
    { label: 'Bloating', value: '3 times', note: 'worst 7 of 10' },
    { label: 'Pain', value: '2 times', note: 'worst 7 of 10' },
    { label: 'Fatigue', value: '1 time', note: 'worst 4 of 10' },
  ]);
});

test('measurements are averages over the days recorded, labelled measured', () => {
  const m = rows('measurements');
  assert.equal(m.source, 'Synced from her devices');
  assert.deepEqual(m.rows.slice(0, 3), [
    { label: 'Sleep', value: '6h 30m average', note: '2 days recorded' },
    { label: 'Resting heart rate', value: '61 bpm average', note: '2 days recorded' },
    { label: 'Heart rate variability', value: '45 ms average', note: '2 days recorded' },
  ]);
});

test('medications and supplements are separate sections', () => {
  assert.deepEqual(rows('medications').rows, [{ label: 'Levothyroxine', value: 'Reported' }]);
  assert.deepEqual(rows('supplements').rows, [{ label: 'Magnesium', value: 'Reported' }]);
  assert.deepEqual(rows('conditions').rows, [
    { label: 'Endometriosis', value: 'Condition' },
    { label: 'Laparoscopy', value: 'Surgery or procedure' },
  ]);
});

test('an empty section says so instead of disappearing', () => {
  const empty = reportSections({ ...input, days: [], episodes: [], logs: [], cycles: [] }, DEFAULT_SECTIONS);
  assert.equal(empty.find((s) => s.id === 'symptoms')!.empty, 'No symptoms logged in this period.');
});

test('the page escapes her words and carries the period, the source of each section and the caveat', () => {
  const html = reportHtml(
    reportSections({ ...input, logs: [{ at: new Date(2026, 9, 10), category: 'note', items: {}, text: '<b>pain</b> & cramps' }] }, [...DEFAULT_SECTIONS, 'notes']),
    { from: input.from, to: input.to, name: 'Jennifer', made: new Date(2026, 9, 14) },
  );
  assert.ok(html.includes('&lt;b&gt;pain&lt;/b&gt; &amp; cramps'));
  assert.ok(!html.includes('<b>pain</b>'));
  assert.ok(html.includes('16 Jul 2026 to 14 Oct 2026'));
  assert.ok(html.includes('Synced from her devices'));
  assert.ok(html.includes('not a diagnosis'));
  assert.ok(!/[–—]/.test(html.replace(/<style>[\s\S]*<\/style>/, '')));
});
