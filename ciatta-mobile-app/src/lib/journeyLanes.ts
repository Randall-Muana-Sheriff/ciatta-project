// The Journey lanes, from her own rows.
//
// Journey's sleep and symptom lanes were drawn from sample.journey, which
// positions points by month index on a seven month strip. That model went
// away when Journey got a real time axis, so in real mode both lanes
// returned null and the screen drew a cycle ribbon over empty space.
//
// These produce dates, which is what the axis already takes. Nothing here
// invents a point: a day with no sleep figure contributes nothing rather
// than a zero, and the lanes are simply shorter on the days she did not
// wear anything.

import type { Day } from '../data/daily';
import { fmtHours } from './engine';

export type SleepPoint = { at: Date; hours: number; label: string };
export type SymptomPoint = { at: Date; severity: number | null };

function dayAt(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  // Midday, so a point sits inside its day at every scale rather than on
  // the boundary between two of them.
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

// Sleep, one point per night that was actually measured.
//
// Null is skipped rather than plotted at zero. A night she did not wear
// her ring is not a night of no sleep, and a zero would draw a bar to the
// floor and read as exactly that.
export function sleepPoints(days: readonly Day[]): SleepPoint[] {
  const out: SleepPoint[] = [];
  for (const d of days) {
    if (d.sleepHours == null) continue;
    out.push({ at: dayAt(d.date), hours: d.sleepHours, label: fmtHours(d.sleepHours) });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// Where a sleep bar's top sits, for a lane of a given height.
//
// Scaled to her own range rather than to a fixed six to nine hours, so a
// woman who sleeps five to six sees a lane with shape in it instead of a
// flat line at the bottom. A single point, or a run with no spread, sits
// in the middle: there is nothing to compare it to yet and putting it at
// the top or bottom would imply there were.
export function sleepScale(points: readonly SleepPoint[], height: number) {
  const hours = points.map((p) => p.hours);
  const lo = Math.min(...hours);
  const hi = Math.max(...hours);
  return (h: number) => {
    if (!points.length || hi === lo) return height / 2;
    const t = (h - lo) / (hi - lo);
    // Leaving a margin at both ends, so the longest night does not touch
    // the lane's edge and look clipped.
    return height - (0.15 + t * 0.7) * height;
  };
}

// What she logged, placed by when she logged it.
//
// Severity is carried rather than averaged away, because the dot's size
// says how much and a mean across a day would flatten a nine to a four.
export function symptomPoints(
  signals: readonly { date: Date; episode: { severity?: number | null } }[],
): SymptomPoint[] {
  return signals
    .map((s) => ({ at: s.date, severity: s.episode?.severity ?? null }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

// Where a symptom dot sits in its lane, and how big it is.
//
// Height carries severity, so the worst days are lowest. A log with no
// severity sits at the midline and draws small: she recorded that it
// happened without saying how much, and the dot must not imply a number
// she did not give.
export function symptomPlacement(point: SymptomPoint, height: number): { y: number; r: number } {
  if (point.severity == null) return { y: height / 2, r: 2.5 };
  const t = Math.min(10, Math.max(0, point.severity)) / 10;
  return { y: height * (0.2 + t * 0.6), r: 2.5 + t * 2.5 };
}

// Whether a lane has anything to draw. Asked by the screen so an empty
// lane can say so rather than rendering as a blank strip that looks like
// a rendering fault.
export const hasPoints = (points: readonly unknown[]) => points.length > 0;
