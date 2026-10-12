import assert from 'node:assert/strict';
import { test } from 'node:test';

import { axisFor, emptyFor, posIn, SCALES, slotIn, slotLabel, within } from './timeAxis';

// Friday 10 October 2026, 2pm.
const NOW = new Date(2026, 9, 10, 14, 0, 0);

test('four scales, in the order they are offered', () => {
  assert.deepEqual(SCALES.map((s) => s.key), ['day', 'week', 'month', 'year']);
});

// ── What each window covers ──────────────────────────────────────────

test('a day is this day, midnight to midnight', () => {
  const a = axisFor('day', NOW);
  assert.equal(a.from.getHours(), 0);
  assert.equal(a.from.getDate(), 10);
  assert.equal(a.to.getDate(), 11);
  assert.equal(a.slots, 24);
});

test('week, month and year end today rather than on a calendar boundary', () => {
  // A woman opening this on the 3rd wants the last month of her life, not
  // three days of a calendar month and a mostly empty chart.
  for (const scale of ['week', 'month', 'year'] as const) {
    const a = axisFor(scale, NOW);
    assert.equal(a.to.getDate(), 11, `${scale} does not end today`);
    assert.ok(a.from < a.to);
  }
  assert.equal(axisFor('week', NOW).from.getDate(), 4, 'a week is seven days including today');
  assert.equal(axisFor('year', NOW).from.getMonth(), 10, 'a year is the twelve months ending with this one');
  assert.equal(axisFor('year', NOW).from.getFullYear(), 2025);
});

// ── Position ─────────────────────────────────────────────────────────

test('position is a fraction of the window', () => {
  const a = axisFor('day', NOW);
  assert.equal(posIn(a, new Date(2026, 9, 10, 0, 0)), 0);
  assert.equal(posIn(a, new Date(2026, 9, 10, 12, 0)), 0.5);
});

test('a moment outside the window is null, never pinned to the edge', () => {
  // A mark clamped to the edge reads as something that happened at the
  // edge, which is a different claim from something that did not happen
  // in this window at all.
  const a = axisFor('week', NOW);
  assert.equal(posIn(a, new Date(2026, 8, 1)), null);
  assert.equal(posIn(a, new Date(2027, 0, 1)), null);
});

test('within keeps only what is in the window, in order', () => {
  const a = axisFor('week', NOW);
  const items = [
    { at: new Date(2026, 9, 9, 12) },
    { at: new Date(2020, 0, 1) },
    { at: new Date(2026, 9, 5, 9) },
  ];
  const kept = within(a, items, (i) => i.at);
  assert.equal(kept.length, 2, 'something outside the window survived');
  assert.ok(kept[0].at < kept[1].at, 'the result is not in time order');
});

// ── Slots and labels ─────────────────────────────────────────────────

test('a day bins by the hour', () => {
  const a = axisFor('day', NOW);
  assert.equal(slotIn(a, new Date(2026, 9, 10, 0, 30)), 0);
  assert.equal(slotIn(a, new Date(2026, 9, 10, 23, 59)), 23);
  assert.equal(slotLabel(a, 0), '12a');
  assert.equal(slotLabel(a, 12), '12p');
  assert.equal(slotLabel(a, 15), '3p');
});

test('a year bins by the month and names it with its year', () => {
  const a = axisFor('year', NOW);
  assert.equal(a.slots, 12);
  assert.match(slotLabel(a, 11), /Oct 2026/);
  assert.match(slotLabel(a, 0), /Nov 2025/);
});

test('the last moment of the window still lands in a real slot', () => {
  // A fraction of exactly 1 would otherwise floor into a slot that does
  // not exist and draw nothing.
  for (const scale of ['day', 'week', 'month', 'year'] as const) {
    const a = axisFor(scale, NOW);
    const last = slotIn(a, new Date(a.to.getTime() - 1));
    assert.equal(last, a.slots - 1, `${scale} lost its last slot`);
  }
});

// ── Ticks ────────────────────────────────────────────────────────────

test('every tick sits inside the chart', () => {
  for (const { key } of SCALES) {
    const a = axisFor(key, NOW);
    assert.ok(a.ticks.length >= 5, `${key} has too few labels to read`);
    for (const t of a.ticks) {
      assert.ok(t.at >= 0 && t.at <= 1, `${key} has a label off the chart`);
      assert.ok(t.label.length > 0);
    }
  }
});

test('a day is labelled every hour, so a mark can be placed to the hour', () => {
  const labels = axisFor('day', NOW).ticks.map((t) => t.label);
  assert.equal(labels.length, 24);
  assert.deepEqual(labels.slice(0, 4), ['12a', '1a', '2a', '3a']);
  assert.equal(labels[12], '12p');
  assert.equal(labels[23], '11p');
});

test('every hour label sits in the middle of its own hour', () => {
  // Centred, as week and month are, so a reading at 2pm sits over the
  // label 2p rather than over the line beside it.
  const ticks = axisFor('day', NOW).ticks;
  ticks.forEach((t, h) => assert.equal(t.at, (h + 0.5) / 24, `hour ${h}`));
});

test('an hour tick and the same hour from slotLabel agree', () => {
  // They are written by one function for this reason: a mark under a label
  // that disagreed with its own tooltip is the kind of wrong nobody checks.
  const axis = axisFor('day', NOW);
  axis.ticks.forEach((t, h) => assert.equal(t.label, slotLabel(axis, h), `hour ${h}`));
});

test('week labels read as weekdays', () => {
  assert.deepEqual(axisFor('week', NOW).ticks.map((t) => t.label), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
});

test('no label holds a dash of any kind', () => {
  for (const { key } of SCALES) {
    for (const t of axisFor(key, NOW).ticks) {
      for (const dash of ['—', '–', '-']) {
        assert.ok(!t.label.includes(dash), `${key} label "${t.label}" contains ${dash}`);
      }
    }
  }
});

// ── Empty ────────────────────────────────────────────────────────────

test('an empty window names its own scale', () => {
  // "Nothing yet" and "nothing this week" are different facts, and the
  // second one is not discouraging.
  assert.match(emptyFor('day'), /today/);
  assert.match(emptyFor('week'), /seven days/);
  assert.match(emptyFor('month'), /thirty days/);
  assert.match(emptyFor('year'), /twelve months/);
});
