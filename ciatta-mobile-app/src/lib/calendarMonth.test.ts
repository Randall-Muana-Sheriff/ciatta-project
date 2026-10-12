import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canGoForward,
  dayLine,
  hasMarks,
  iso,
  monthGrid,
  type MonthInput,
  monthSummary,
  stepMonth,
  WEEKDAYS,
} from './calendarMonth';

// Thursday 15 October 2026.
const NOW = new Date(2026, 9, 15, 10, 0);

const input = (over: Partial<MonthInput> = {}): MonthInput => ({
  year: 2026,
  month: 9,
  periodDays: new Set<string>(),
  loggedDays: new Set<string>(),
  measuredDays: new Set<string>(),
  now: NOW,
  ...over,
});

const flat = (g: ReturnType<typeof monthGrid>) => g.weeks.flat();
const dayOf = (g: ReturnType<typeof monthGrid>, d: string) => flat(g).find((x) => x.date === d)!;

// ── The grid holds still ─────────────────────────────────────────────

test('every month is six weeks, so the screen does not jump when she pages', () => {
  for (let m = 0; m < 12; m += 1) {
    const g = monthGrid(input({ month: m }));
    assert.equal(g.weeks.length, 6, `month ${m}`);
    for (const w of g.weeks) assert.equal(w.length, 7);
  }
});

test('the grid starts on a Sunday and the weekday row has seven', () => {
  const g = monthGrid(input());
  // Parsed as local parts: new Date('2026-09-27') is UTC midnight, which
  // is the previous day in a negative offset and would fail here for a
  // reason that has nothing to do with the grid.
  const [y, m, d] = g.weeks[0][0].date.split('-').map(Number);
  assert.equal(new Date(y, m - 1, d).getDay(), 0);
  assert.equal(WEEKDAYS.length, 7);
});

test('days from the neighbouring months are marked as outside', () => {
  const g = monthGrid(input());
  // 1 October 2026 is a Thursday, so the row starts in September.
  assert.equal(g.weeks[0][0].outside, true);
  assert.equal(dayOf(g, '2026-10-01').outside, false);
});

test('the label names the month and year', () => {
  assert.equal(monthGrid(input()).label, 'October 2026');
});

// ── The record stops at today ────────────────────────────────────────

test('a future day holds nothing, whatever the data says', () => {
  // Shading a day she has not lived would be telling her something nobody
  // established.
  const g = monthGrid(input({ periodDays: new Set(['2026-10-28']), loggedDays: new Set(['2026-10-28']) }));
  const future = dayOf(g, '2026-10-28');
  assert.equal(future.future, true);
  assert.equal(future.period, false);
  assert.equal(future.logged, false);
  assert.equal(hasMarks(future), false);
});

test('today is marked, and is not in the future', () => {
  const t = dayOf(monthGrid(input()), '2026-10-15');
  assert.equal(t.today, true);
  assert.equal(t.future, false);
});

test('paging forward stops at the current month', () => {
  assert.equal(canGoForward(2026, 8, NOW), true);
  assert.equal(canGoForward(2026, 9, NOW), false);
  assert.equal(canGoForward(2026, 10, NOW), false);
  assert.equal(canGoForward(2025, 11, NOW), true);
});

test('stepping wraps the year correctly in both directions', () => {
  assert.deepEqual(stepMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(stepMonth(2026, 11, 1), { year: 2027, month: 0 });
});

// ── A day claims only what was recorded ──────────────────────────────

test('a day with nothing is blank rather than marked as fine', () => {
  const d = dayOf(monthGrid(input()), '2026-10-02');
  assert.equal(hasMarks(d), false);
  assert.equal(dayLine(d), 'Nothing was recorded on this day.');
});

test('the three kinds of mark are kept apart', () => {
  const g = monthGrid(
    input({
      periodDays: new Set(['2026-10-02']),
      loggedDays: new Set(['2026-10-03']),
      measuredDays: new Set(['2026-10-04']),
    }),
  );
  assert.equal(dayOf(g, '2026-10-02').period, true);
  assert.equal(dayOf(g, '2026-10-02').logged, false);
  assert.equal(dayOf(g, '2026-10-03').logged, true);
  assert.equal(dayOf(g, '2026-10-04').measured, true);
});

test('a day says what happened and judges none of it', () => {
  const g = monthGrid(input({ periodDays: new Set(['2026-10-02']), measuredDays: new Set(['2026-10-02']) }));
  const line = dayLine(dayOf(g, '2026-10-02'));
  assert.ok(line.includes('you logged bleeding'));
  assert.ok(line.includes('something was measured'));
  for (const w of ['good', 'bad', 'normal', 'heavy', 'should']) {
    assert.ok(!line.toLowerCase().includes(w), line);
  }
});

test('a future day says so rather than saying nothing was recorded', () => {
  assert.equal(dayLine(dayOf(monthGrid(input()), '2026-10-31')), 'This day has not happened yet.');
});

// ── The summary counts, and counts only lived days ───────────────────

test('the summary ignores days she has not lived yet', () => {
  // October has 31 days but only 15 have happened by the 15th.
  const g = monthGrid(input({ loggedDays: new Set(['2026-10-02', '2026-10-03']) }));
  assert.equal(monthSummary(g), '2 of 15 days have something recorded.');
});

test('an empty month says so plainly', () => {
  assert.equal(monthSummary(monthGrid(input())), 'Nothing recorded this month.');
});

test('nothing rendered carries a dash or a forbidden word', () => {
  const g = monthGrid(input({ periodDays: new Set(['2026-10-02']) }));
  for (const line of [monthSummary(g), g.label, ...flat(g).map(dayLine)]) {
    assert.ok(!/[—–]/.test(line), line);
    for (const w of ['cause', 'because', 'diagnos', 'you have', 'condition']) {
      assert.ok(!line.toLowerCase().includes(w), `${line} says ${w}`);
    }
  }
});

test('iso formats a date as the key everything else uses', () => {
  assert.equal(iso(new Date(2026, 0, 5)), '2026-01-05');
});
