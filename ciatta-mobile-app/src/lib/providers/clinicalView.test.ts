import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { chartLine, chartView, dayLabel, flagLabel, isEmpty, statusNote } from './clinicalView';
import type { ClinicalRecord } from './fhirMap';

const r = (over: Partial<ClinicalRecord> = {}): ClinicalRecord => ({
  sourceId: `Observation/${Math.random()}`,
  kind: 'lab',
  name: 'TSH',
  value: '4.2 mIU/L',
  flag: null,
  effectiveOn: '2026-03-14',
  status: 'final',
  ...over,
});

// ── Absence is never turned into normal ──────────────────────────────

test('a result the lab did not flag gets no label at all', () => {
  assert.equal(flagLabel(r({ flag: null })), null);
});

test('no code path can turn a missing flag into in range', () => {
  // The lab may have had no reference range, the range may not apply to
  // her, or the flag may simply not have been sent. None of those is
  // normal, and the source must contain no word that says so.
  const source = readFileSync(new URL('./clinicalView.ts', import.meta.url), 'utf8');
  const code = source.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').toLowerCase();
  // Whole words: "abnormal" is a flag the lab sent and legitimately
  // contains "normal", which a substring check would trip on.
  for (const word of ['in range', 'normal', 'healthy', 'fine', 'good', 'within range']) {
    assert.ok(!new RegExp(`\\b${word}\\b`).test(code), `clinicalView says "${word}"`);
  }
});

test('the lab flags it sent are named, and nothing else is', () => {
  assert.equal(flagLabel(r({ flag: 'high' })), 'High');
  assert.equal(flagLabel(r({ flag: 'low' })), 'Low');
  assert.equal(flagLabel(r({ flag: 'abnormal' })), 'Flagged');
});

// ── Retracted results do not appear ──────────────────────────────────

test('a withdrawn result is removed and counted, never shown greyed', () => {
  const view = chartView([r(), r({ status: 'entered-in-error', name: 'Wrong' })]);
  assert.equal(view.retracted, 1);
  assert.deepEqual(view.days.flatMap((d) => d.results.map((x) => x.name)), ['TSH']);
});

// ── Grouping ─────────────────────────────────────────────────────────

test('results gather by the day they were drawn, newest first', () => {
  const view = chartView([
    r({ effectiveOn: '2024-01-01', name: 'Old' }),
    r({ effectiveOn: '2026-03-14', name: 'New' }),
    r({ effectiveOn: '2026-03-14', name: 'Also new' }),
  ]);
  assert.deepEqual(view.days.map((d) => d.on), ['2026-03-14', '2024-01-01']);
  assert.deepEqual(view.days[0].results.map((x) => x.name), ['Also new', 'New']);
});

test('undated results are their own group and sort last', () => {
  // They have no place on a timeline, and putting them first would imply
  // they are the most recent thing that happened to her.
  const view = chartView([r({ effectiveOn: null, name: 'Undated' }), r({ effectiveOn: '2020-01-01' })]);
  assert.equal(view.days[view.days.length - 1].on, null);
  assert.equal(dayLabel(null), 'No date given');
});

test('vitals are grouped with results, and the standing lists are separate', () => {
  const view = chartView([
    r({ kind: 'vital', name: 'Heart rate' }),
    r({ kind: 'condition', name: 'Endometriosis', value: null }),
    r({ kind: 'medication', name: 'Naproxen', value: null }),
    r({ kind: 'allergy', name: 'Penicillin', value: null }),
    r({ kind: 'immunization', name: 'Influenza', value: null }),
    r({ kind: 'procedure', name: 'Laparoscopy', value: null }),
  ]);
  assert.deepEqual(view.days[0].results.map((x) => x.name), ['Heart rate', 'TSH'].slice(0, 1));
  assert.deepEqual(view.conditions.map((x) => x.name), ['Endometriosis']);
  assert.deepEqual(view.medications.map((x) => x.name), ['Naproxen']);
  assert.deepEqual(view.allergies.map((x) => x.name), ['Penicillin']);
  assert.deepEqual(view.immunizations.map((x) => x.name), ['Influenza']);
  assert.deepEqual(view.procedures.map((x) => x.name), ['Laparoscopy']);
});

// ── Status ───────────────────────────────────────────────────────────

test('final says nothing and anything else is named', () => {
  assert.equal(statusNote(r({ status: 'final' })), null);
  assert.equal(statusNote(r({ status: 'preliminary' })), 'Preliminary');
  assert.equal(statusNote(r({ status: 'corrected' })), 'Corrected');
  assert.equal(statusNote(r({ status: 'amended' })), 'Amended');
});

// ── What the chart says about itself ─────────────────────────────────

test('the chart counts and never characterises', () => {
  const view = chartView([r(), r({ name: 'B' }), r({ effectiveOn: '2024-01-01', name: 'C' })]);
  assert.equal(chartLine(view), '3 results across 2 days.');
  assert.equal(chartLine(chartView([])), 'No results have arrived yet.');
});

test('an empty chart knows it is empty', () => {
  assert.ok(isEmpty(chartView([])));
  assert.ok(!isEmpty(chartView([r({ kind: 'condition', value: null })])));
});

test('nothing rendered carries a dash', () => {
  const view = chartView([r()]);
  assert.ok(!/[—–]/.test(chartLine(view)));
  assert.ok(!/[—–]/.test(dayLabel('2026-03-14')));
});
