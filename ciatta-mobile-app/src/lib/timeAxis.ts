// One axis, four scales. Geometry and labels only.
//
// Journey was built on a fixed run of months, so every lane positioned its
// marks by month. A day view cannot be expressed that way at all: an hour
// is not a fraction of a month anybody wants to compute at a call site.
//
// So position is a fraction of the window, 0 at the left edge and 1 at the
// right, and the axis owns what the window is and what the ticks under it
// say. A lane asks where a date sits and gets a number between 0 and 1, or
// null when the date is outside the window, which is the case that used to
// draw marks off the end of the chart.

export type Scale = 'day' | 'week' | 'month' | 'year';

export const SCALES: { key: Scale; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export type Tick = { label: string; at: number };

export type Axis = {
  scale: Scale;
  from: Date;
  to: Date;
  ticks: Tick[];
  // How many slots the window divides into: 24 hours, 7 days, the days of
  // that month, 12 months. Lanes that bin their data bin it by this.
  slots: number;
};

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// How an hour is written, in one place. The day axis labels every hour and
// slotLabel names one, and the two drifting apart would put a mark under a
// label that disagreed with its tooltip.
export const hourLabel = (h: number) =>
  h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// The window each scale covers, ending on the reference day.
//
// Week, month and year end today rather than on a calendar boundary, which
// is the honest choice for a health record: a woman opening this on the 3rd
// wants the last month of her life, not three days of a calendar month and
// a mostly empty chart.
export function axisFor(scale: Scale, now: Date): Axis {
  const today = startOfDay(now);

  if (scale === 'day') {
    const from = today;
    const to = addDays(today, 1);
    return {
      scale,
      from,
      to,
      slots: 24,
      // Every hour, not every sixth. A day read six hours at a time cannot
      // answer "when", which is the only question a day view is for: a mark
      // sat between 12p and 6p told her almost nothing. The plot already
      // scrolls, so the width this needs is width it can have.
      //
      // Centred in the slot, as week and month do, so a reading at 2pm sits
      // over the label 2p rather than over the line beside it.
      ticks: Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), at: (h + 0.5) / 24 })),
    };
  }

  if (scale === 'week') {
    const from = addDays(today, -6);
    const to = addDays(today, 1);
    return {
      scale,
      from,
      to,
      slots: 7,
      // One label per day, at the middle of its slot, so a mark on Tuesday
      // sits over the word Tue rather than over the line beside it.
      ticks: Array.from({ length: 7 }, (_, i) => ({
        label: WEEKDAY[addDays(from, i).getDay()],
        at: (i + 0.5) / 7,
      })),
    };
  }

  if (scale === 'month') {
    const from = addDays(today, -29);
    const to = addDays(today, 1);
    // Five labels across thirty days: every seventh day, by date, so she
    // can find a day she remembers rather than counting columns.
    const ticks: Tick[] = [];
    for (let i = 0; i <= 28; i += 7) {
      const d = addDays(from, i);
      ticks.push({ label: `${d.getDate()} ${MONTH[d.getMonth()]}`, at: i / 30 });
    }
    return { scale, from, to, slots: 30, ticks };
  }

  // A year, as the twelve months ending with this one.
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const to = addDays(today, 1);
  const ticks: Tick[] = [];
  for (let i = 0; i < 12; i += 1) {
    const m = new Date(from.getFullYear(), from.getMonth() + i, 1);
    // January carries its year, so a window spanning a new year says so
    // without a label on every column.
    ticks.push({ label: m.getMonth() === 0 ? `${MONTH[0]} ${String(m.getFullYear()).slice(2)}` : MONTH[m.getMonth()], at: (i + 0.5) / 12 });
  }
  return { scale, from, to, slots: 12, ticks };
}

// Where a moment sits in the window, as a fraction from 0 to 1, or null
// when it is outside. Null rather than a clamped edge value: a mark pinned
// to the edge reads as something that happened at the edge.
export function posIn(axis: Axis, at: Date): number | null {
  const span = axis.to.getTime() - axis.from.getTime();
  if (span <= 0) return null;
  const p = (at.getTime() - axis.from.getTime()) / span;
  return p < 0 || p > 1 ? null : p;
}

// Which slot a moment falls in, for lanes that count rather than plot.
export function slotIn(axis: Axis, at: Date): number | null {
  const p = posIn(axis, at);
  if (p == null) return null;
  return Math.min(axis.slots - 1, Math.floor(p * axis.slots));
}

// How the axis says a slot, for a label on a mark or in a tooltip.
export function slotLabel(axis: Axis, slot: number): string {
  if (axis.scale === 'day') return hourLabel(slot);
  if (axis.scale === 'year') {
    const m = new Date(axis.from.getFullYear(), axis.from.getMonth() + slot, 1);
    return `${MONTH[m.getMonth()]} ${m.getFullYear()}`;
  }
  const d = addDays(axis.from, slot);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

// Everything in the window, in order, with its position. The one place a
// lane needs to filter by window, so no lane forgets to.
export function within<T>(axis: Axis, items: readonly T[], when: (item: T) => Date): { item: T; at: number }[] {
  const out: { item: T; at: number }[] = [];
  for (const item of items) {
    const p = posIn(axis, when(item));
    if (p != null) out.push({ item, at: p });
  }
  return out.sort((a, b) => a.at - b.at);
}

// What the chart should say when the window holds nothing. The scale is
// named, because "nothing yet" is a different fact from "nothing this week".
export function emptyFor(scale: Scale): string {
  switch (scale) {
    case 'day':
      return 'Nothing recorded today yet.';
    case 'week':
      return 'Nothing recorded in the last seven days.';
    case 'month':
      return 'Nothing recorded in the last thirty days.';
    default:
      return 'Nothing recorded in the last twelve months.';
  }
}
