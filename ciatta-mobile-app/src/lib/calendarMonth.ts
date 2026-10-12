// Her record as a month.
//
// A calendar is the one view that shows absence as clearly as presence.
// Every other screen draws what arrived; this draws the shape of what did
// not, which on a health record is often the more useful half: three weeks
// of nothing before a flare is a fact about her life.
//
// So the rules here are mostly about what a day is allowed to claim.
//
//   A day with nothing is blank. Not a zero, not a grey dot meaning fine.
//   Blank, because nothing was recorded and that is all anyone knows.
//
//   A period day comes from a period she logged. Nothing here predicts
//   one. Prediction belongs to cycleModel, which has rules about when it
//   may and may not, and a calendar quietly shading next month would be
//   telling her something no one established.
//
//   A future day holds nothing at all. The record stops at today.

export type DayMark = {
  date: string;
  day: number;
  // Outside the month being shown, so the grid can draw it faintly or not
  // at all rather than pretending the month has 35 days.
  outside: boolean;
  today: boolean;
  future: boolean;
  // She logged bleeding on this day.
  period: boolean;
  // She logged an episode: pain, symptoms, a bowel movement.
  logged: boolean;
  // Something was measured, from a device or a provider.
  measured: boolean;
};

export type MonthGrid = {
  year: number;
  // 0 to 11.
  month: number;
  label: string;
  weeks: DayMark[][];
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type MonthInput = {
  year: number;
  month: number;
  // Days she bled, as ISO days. Logged, never predicted.
  periodDays: ReadonlySet<string>;
  // Days with an episode of any kind.
  loggedDays: ReadonlySet<string>;
  // Days something was measured.
  measuredDays: ReadonlySet<string>;
  now: Date;
};

// Six weeks, always.
//
// A grid that changes height between months makes the whole screen jump as
// she pages through it, and the one thing a calendar must do is hold still
// while she scans it.
export function monthGrid(input: MonthInput): MonthGrid {
  const { year, month, now } = input;
  const first = new Date(year, month, 1);
  const todayIso = iso(now);
  const todayMs = startOfDay(now).getTime();

  // Back up to the Sunday on or before the first.
  const start = new Date(year, month, 1 - first.getDay());

  const weeks: DayMark[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: DayMark[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const key = iso(date);
      const future = startOfDay(date).getTime() > todayMs;
      week.push({
        date: key,
        day: date.getDate(),
        outside: date.getMonth() !== month,
        today: key === todayIso,
        future,
        // The record stops at today. A future day shows nothing whatever
        // the sets happen to contain.
        period: !future && input.periodDays.has(key),
        logged: !future && input.loggedDays.has(key),
        measured: !future && input.measuredDays.has(key),
      });
    }
    weeks.push(week);
  }

  return { year, month, label: `${MONTHS[month]} ${year}`, weeks };
}

// Whether a day has anything at all to show.
export const hasMarks = (d: DayMark) => d.period || d.logged || d.measured;

// Stepping between months, without running past the record into months
// that cannot hold anything.
export function stepMonth(year: number, month: number, by: 1 | -1): { year: number; month: number } {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// Whether there is a next month worth going to. The record ends at today,
// so paging into next month shows a page of blanks.
export function canGoForward(year: number, month: number, now: Date): boolean {
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
}

// What a day says when she taps it. Counted and named, never characterised.
export function dayLine(mark: DayMark): string {
  if (mark.future) return 'This day has not happened yet.';
  const parts: string[] = [];
  if (mark.period) parts.push('you logged bleeding');
  if (mark.logged) parts.push('you logged an experience');
  if (mark.measured) parts.push('something was measured');
  if (!parts.length) return 'Nothing was recorded on this day.';
  if (parts.length === 1) return `On this day ${parts[0]}.`;
  return `On this day ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

// How many days in the month hold anything, for the line above the grid.
export function monthSummary(grid: MonthGrid): string {
  const inMonth = grid.weeks.flat().filter((d) => !d.outside && !d.future);
  const withAny = inMonth.filter(hasMarks).length;
  if (!inMonth.length) return '';
  if (!withAny) return 'Nothing recorded this month.';
  return `${withAny} of ${inMonth.length} days have something recorded.`;
}
