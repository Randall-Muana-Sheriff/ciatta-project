import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../data/daily';
import { buildMetrics, headlineMetrics, recordedCount, recordedLine } from './allMetrics';
import { bloodOxygen, bloodPressure } from './vitals';

const empty: Day = {
  date: '2026-10-11',
  sleepHours: null,
  stages: { awake: null, rem: null, light: null, deep: null },
  timeInBed: null,
  steps: null,
  activeMinutes: null,
  workouts: [],
  restingHR: null,
  hrv: null,
  tempDeviation: null,
  energy: null,
  mood: null,
  stress: null,
  caffeine: null,
  alcohol: null,
  foods: [],
  digestion: [],
};

const find = (day: Day | null, label: string) =>
  buildMetrics(day)
    .flatMap((g) => g.rows)
    .find((r) => r.label === label);

// ── Missing is unknown, never zero ───────────────────────────────────

test('no row at all leaves every metric unrecorded', () => {
  const groups = buildMetrics(null);
  assert.ok(groups.length > 0);
  for (const g of groups) for (const r of g.rows) assert.equal(r.value, null, `${r.label} should be null`);
});

test('a row of nulls is unknown, and never prints a zero', () => {
  for (const g of buildMetrics(empty)) {
    for (const r of g.rows) {
      // Workouts is the one real zero: the day exists and lists none.
      if (r.label === 'Workouts') continue;
      assert.equal(r.value, null, `${r.label} should be null, got ${r.value}`);
    }
  }
});

test('zero steps is a measured zero and says so, unlike a missing one', () => {
  assert.equal(find({ ...empty, steps: 0 }, 'Steps')?.value, '0');
  assert.equal(find(empty, 'Steps')?.value, null);
});

test('a day with no workouts logged says none, but no day at all says nothing', () => {
  assert.equal(find(empty, 'Workouts')?.value, '0');
  assert.equal(find(null, 'Workouts')?.value, null);
});

// ── How each figure is said ──────────────────────────────────────────

test('sleep is hours and minutes, not a decimal', () => {
  assert.equal(find({ ...empty, sleepHours: 7.5 }, 'Time asleep')?.value, '7h 30m');
});

test('stages are minutes', () => {
  const day = { ...empty, stages: { awake: 22, rem: 95, light: 210, deep: 61 } };
  assert.equal(find(day, 'Deep')?.value, '61 min');
  assert.equal(find(day, 'REM')?.value, '95 min');
});

test('skin temperature says which way in words, never with a sign, and never as a body temperature', () => {
  const warm = find({ ...empty, tempDeviation: 0.42 }, 'Skin temperature');
  assert.equal(warm?.value, '0.4 °C above usual');
  assert.equal(warm?.note, 'Change from your own usual');
  // A minus sign is a dash to display copy, so cooler is said, not signed.
  assert.equal(find({ ...empty, tempDeviation: -0.3 }, 'Skin temperature')?.value, '0.3 °C below usual');
  assert.equal(find({ ...empty, tempDeviation: 0 }, 'Skin temperature')?.value, 'At your usual');
});

test('a check in is the number she chose, never relabelled', () => {
  const row = find({ ...empty, mood: 4 }, 'Mood');
  assert.equal(row?.value, '4 of 5');
  for (const word of ['good', 'poor', 'low', 'high']) {
    assert.ok(!(row?.value ?? '').toLowerCase().includes(word));
  }
});

// ── Measured and reported stay apart ─────────────────────────────────

test('instrument readings and her own check ins are labelled differently', () => {
  assert.equal(find(empty, 'Heart rate variability')?.from, 'measured');
  assert.equal(find(empty, 'Steps')?.from, 'measured');
  assert.equal(find(empty, 'Mood')?.from, 'reported');
  assert.equal(find(empty, 'Caffeine')?.from, 'reported');
});

// ── The count ────────────────────────────────────────────────────────

test('an empty day counts only the workouts zero', () => {
  const counts = recordedCount(buildMetrics(empty));
  assert.equal(counts.recorded, 1);
  assert.ok(counts.total > 10);
});

test('the line states the count and does not editorialise', () => {
  assert.equal(recordedLine({ recorded: 0, total: 19 }), 'Nothing recorded today yet.');
  assert.equal(recordedLine({ recorded: 9, total: 19 }), '9 of 19 recorded today.');
});

test('no label or value carries a dash, which display copy forbids', () => {
  const day: Day = { ...empty, sleepHours: 7, hrv: 40, steps: 900, tempDeviation: -0.2, mood: 3 };
  for (const g of buildMetrics(day)) {
    assert.ok(!/[—–]/.test(g.title), g.title);
    for (const r of g.rows) {
      assert.ok(!/[—–]/.test(r.label), r.label);
      // A minus sign on a temperature is an arithmetic sign, not a dash.
      assert.ok(!/[—–]/.test(r.value ?? ''), r.value ?? '');
    }
  }
});

// ── The six on Today ─────────────────────────────────────────────────

test('six headline metrics, chosen by what her devices report', () => {
  // Not by what the schema happens to hold. Three come from the wearable
  // and three from the cuff, the ring and the watch.
  const keys = headlineMetrics([]).map((m) => m.key);
  assert.deepEqual(keys, ['sleep', 'hrv', 'steps', 'bp', 'temp', 'spo2']);
});

test('a vital with no reading is still a card, absent rather than missing', () => {
  // Its place on the grid is where that figure will appear, so the card
  // exists and says nothing.
  const bp = headlineMetrics([]).find((m) => m.key === 'bp')!;
  assert.equal(bp.value, null);
});

test('vitals passed in are used rather than recomputed', () => {
  const given = [{ key: 'bp', label: 'Blood pressure', value: '118/76', from: 'measured' as const }];
  const bp = headlineMetrics([], given).find((m) => m.key === 'bp')!;
  assert.equal(bp.value, '118/76');
});

test('the grid abbreviates where a third of a row cannot hold the name', () => {
  // BP and SpO2 are what she reads on the cuff and the watch anyway.
  const by = Object.fromEntries(headlineMetrics([]).map((m) => [m.key, m.label]));
  assert.equal(by.bp, 'BP');
  assert.equal(by.spo2, 'SpO2');
});

test('the full names survive for the screen that has room for them', () => {
  const now = new Date();
  assert.equal(bloodPressure([], now).label, 'Blood pressure');
  assert.equal(bloodOxygen([], now).label, 'Blood oxygen');
});

test('headline labels are short enough for a third of a row', () => {
  // A label that wraps or truncates is worse than one abbreviated on
  // purpose. The All screen keeps the full names.
  for (const m of headlineMetrics([])) {
    assert.ok(m.label.length <= 11, `${m.label} is ${m.label.length} characters`);
  }
});

test('with no day at all, every card is absent rather than zero', () => {
  for (const m of headlineMetrics([])) assert.equal(m.value, null, m.key);
});

test('heart rate variability carries its unit', () => {
  const by = Object.fromEntries(headlineMetrics([{ ...empty, hrv: 42.4 }]).map((m) => [m.key, m.value]));
  assert.equal(by.hrv, '42 ms');
});

test('resting heart rate moved to All, where there is room for every reading', () => {
  assert.ok(!headlineMetrics([]).some((m) => m.key === 'restingHR'));
  assert.ok(find({ ...empty, restingHR: 58.6 }, 'Resting heart rate')?.value === '59 bpm');
});

test('a measured zero still shows, unlike a missing figure', () => {
  const by = Object.fromEntries(headlineMetrics([{ ...empty, steps: 0 }]).map((m) => [m.key, m.value]));
  assert.equal(by.steps, '0');
  assert.equal(Object.fromEntries(headlineMetrics([empty]).map((m) => [m.key, m.value])).steps, null);
});

// The fixture day, so these do not depend on what day the suite runs.
const ON = new Date(2026, 9, 11, 12);

test('the skin temperature card gives the size, and says above or below usual in words', () => {
  const m = headlineMetrics([{ ...empty, tempDeviation: 0.42 }], [], ON).find((x) => x.key === 'temp')!;
  assert.equal(m.value, '0.4 °C');
  assert.equal(m.note, 'Above usual');
  const cool = headlineMetrics([{ ...empty, tempDeviation: -0.3 }], [], ON).find((x) => x.key === 'temp')!;
  assert.equal(cool.value, '0.3 °C');
  assert.equal(cool.note, 'Below usual');
  for (const v of [m.value!, cool.value!]) assert.ok(!/[-–—−]/.test(v), v);
});

test('an older reading keeps its direction and says how old', () => {
  // With no sign on the figure, the note carries both: which way, and when.
  const later = new Date(2026, 9, 13, 12);
  const m = headlineMetrics([{ ...empty, tempDeviation: -0.42 }], [], later).find((x) => x.key === 'temp')!;
  assert.equal(m.note, 'Below usual, 2 days ago');
});

test('the latest reading is shown, not only today, with its age', () => {
  // Ciatta syncs when she asks and at no other time, so today's row is
  // often simply absent while last night's reading sits one row back.
  const days = [
    { ...empty, date: '2026-10-09', hrv: 44 },
    { ...empty, date: '2026-10-10', hrv: 51 },
  ];
  const m = headlineMetrics(days, [], new Date(2026, 9, 11, 12)).find((x) => x.key === 'hrv')!;
  assert.equal(m.value, '51 ms', 'the newest reading, not the oldest');
  assert.equal(m.note, 'Yesterday');
});

test('a reading from today carries no age note', () => {
  const m = headlineMetrics([{ ...empty, hrv: 51 }], [], ON).find((x) => x.key === 'hrv')!;
  assert.equal(m.note, undefined);
});

test('nothing anywhere in the series is still absent', () => {
  const m = headlineMetrics([empty, empty], [], ON).find((x) => x.key === 'hrv')!;
  assert.equal(m.value, null);
});

test('an absent skin temperature carries no note either', () => {
  assert.equal(headlineMetrics([empty]).find((x) => x.key === 'temp')!.note, undefined);
});

test('every headline is measured, so none is confused with what she reported', () => {
  for (const m of headlineMetrics([empty])) assert.equal(m.from, 'measured', m.key);
});

test('each daily card carries the trend of her own readings', () => {
  const days = [48, 50, 52, 49, 51, 50, 56].map((hrv, i) => ({ ...empty, date: `2026-10-0${i + 1}`, hrv }));
  const m = headlineMetrics(days, [], new Date(2026, 9, 7, 12)).find((x) => x.key === 'hrv')!;
  assert.deepEqual(m.trend?.points, [48, 50, 52, 49, 51, 50, 56]);
  assert.equal(m.trend?.change, '↑ 12%');
});

test('skin temperature trends in degrees', () => {
  const days = [0.1, 0.0, -0.1, 0.4].map((t, i) => ({ ...empty, date: `2026-10-0${i + 1}`, tempDeviation: t }));
  const m = headlineMetrics(days, [], new Date(2026, 9, 4, 12)).find((x) => x.key === 'temp')!;
  assert.equal(m.trend?.change, '↑ 0.4 °C');
});

test('a card with too little history has no trend rather than an invented one', () => {
  const m = headlineMetrics([{ ...empty, hrv: 50 }], [], ON).find((x) => x.key === 'hrv')!;
  assert.equal(m.trend, undefined);
});

test('a vital passes its trend through to the card', () => {
  const trend = { points: [97, 98, 98], change: '→ 0%', spoken: 'level with your recent average' };
  const given = [{ key: 'spo2', label: 'Blood oxygen', value: '98%', from: 'measured' as const, trend }];
  assert.deepEqual(headlineMetrics([], given).find((m) => m.key === 'spo2')!.trend, trend);
});
