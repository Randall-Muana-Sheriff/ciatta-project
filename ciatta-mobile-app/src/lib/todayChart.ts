// The day, drawn. Geometry only: no React, no colours, no device calls.
//
// Ported from the concept on the landing page, with one rule added that the
// concept did not need and this does: Ciatta does not draw a day it has not
// seen. The concept had eleven readings because someone wrote eleven
// readings. Here the line is whatever actually arrived, the curve stops at
// the last reading rather than at an assumed now, and when nothing arrived
// there is no chart at all rather than a flat line implying a flat day.
//
// The shape is a Catmull Rom spline written as cubic beziers, which is the
// concept's own choice and worth keeping: it passes through every reading
// rather than near it, so no drawn point is in a place no reading was.

import { smooth } from './curve';

// Re exported, so this module's own callers are unchanged by the move.
export { smooth };

export type Reading = { at: Date; value: number };
export type Asleep = { from: Date; to: Date };
export type Mark = { at: Date; weight: number };

export type DayChart = {
  // The curve through her readings, as an SVG path in the viewBox below.
  line: string;
  // The same curve closed to the baseline, for the wash underneath.
  area: string;
  // Where each reading landed, so the caller can dot them.
  points: { x: number; y: number }[];
  // The blocks she was asleep for, in viewBox units.
  asleep: { x: number; width: number }[];
  // Her own usual across the hours she was awake, or null when there is
  // not enough of a history to have a usual.
  usual: { y: number; from: number; to: number } | null;
  // Where now is, and whether the last reading is recent enough that a dot
  // on it means anything.
  nowX: number;
  // Logged marks on their own rail, so they do not fight the line.
  marks: { x: number; r: number }[];
  // What the vertical range actually spans, for a caller that wants to say.
  low: number;
  high: number;
};

export const VIEW = { w: 132, h: 40, top: 3, base: 30, rail: 36 } as const;

function hoursInto(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function px(hour: number): number {
  return (hour / 24) * VIEW.w;
}

export function buildDay(input: {
  readings: readonly Reading[];
  asleep?: readonly Asleep[];
  marks?: readonly Mark[];
  // Her own usual for this metric, from her history. Omitted when there is
  // no history to take one from, and never substituted with a population
  // figure: the dashed line says "your usual" and must mean it.
  usual?: number | null;
  now: Date;
}): DayChart | null {
  const readings = [...input.readings].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Two readings is the floor. One reading is a dot, and a line drawn
  // through a single point is a line Ciatta invented.
  if (readings.length < 2) return null;

  const values = readings.map((r) => r.value);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (high === low) {
    // A flat day is real and must not divide by zero. Open the range around
    // it so the line sits in the middle rather than on the floor.
    low -= 1;
    high += 1;
  }
  const usual = input.usual ?? null;
  // The usual has to fit on the same scale or the dashed line leaves the
  // chart, which would read as her being off the scale rather than as the
  // chart being too small.
  if (usual != null) {
    low = Math.min(low, usual);
    high = Math.max(high, usual);
  }

  const y = (v: number) => VIEW.base - ((v - low) / (high - low)) * (VIEW.base - VIEW.top);
  const points = readings.map((r) => ({ x: px(hoursInto(r.at)), y: y(r.value) }));

  const line = smooth(points);
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(2)},${VIEW.base} L${first.x.toFixed(2)},${VIEW.base} Z`;

  const asleep = (input.asleep ?? [])
    .map((a) => {
      const from = px(hoursInto(a.from));
      const to = px(hoursInto(a.to));
      // A block that crosses midnight is clipped to this day rather than
      // wrapped: the chart is one day wide and a wrapped block would draw
      // sleep at both ends of it.
      const x = Math.max(0, Math.min(from, to));
      const width = Math.min(VIEW.w, Math.max(from, to)) - x;
      return { x, width };
    })
    .filter((a) => a.width > 0.3);

  const wokeAt = asleep.length ? Math.max(...asleep.map((a) => a.x + a.width)) : first.x;

  return {
    line,
    area,
    points,
    asleep,
    usual: usual == null ? null : { y: y(usual), from: wokeAt, to: VIEW.w },
    nowX: px(hoursInto(input.now)),
    marks: (input.marks ?? []).map((m) => ({
      x: px(hoursInto(m.at)),
      // Severity as radius, bounded so a 10 does not swallow the rail.
      r: 1 + Math.max(0, Math.min(4, m.weight)) * 0.75,
    })),
    low,
    high,
  };
}

// The hour labels under the chart, at the quarters the concept uses.
export const AXIS = ['12a', '6a', '12p', '6p', '12a'] as const;
