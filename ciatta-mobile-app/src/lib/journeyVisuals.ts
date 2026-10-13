// What each Journey lane draws, each in the form its kind of record is
// read in rather than one chart shape for everything:
//
//   Cycle        Period blocks as long as she bled, shaded by flow, with the
//                cycle length between them; outside FIGO's 24 to 38 days is
//                marked (Munro et al., Int J Gynaecol Obstet 2018).
//   Pain         One cell per day (or hour) at her worst 0 to 10 rating, the
//                scale IMMPACT recommends (Dworkin et al., Pain 2005).
//   Flare ups    A bar from start to end, or a moment when there is no end.
//   Sleep        Above or below seven hours a night, the AASM and SRS
//                recommendation for adults (Watson et al., J Clin Sleep Med 2015).
//   Symptoms     A row per symptom she logs most, a cell per day or week,
//                shaded by severity, as symptom diaries are drawn.
//   Medications  Bars while taken, as LifeLines drew them (Plaisant et al. 1996).
//   Labs         A marker per lab visit, by whether its results sat inside
//                their ranges (Zikmund-Fisher et al., JMIR 2018).
//   Notes        A pin with her words.
//
// Nothing here invents a mark: a day with nothing logged is absent, never a
// zero, and a log with no severity is drawn lightly rather than given one.

import type { Day } from '../data/daily';
import type { CycleWindow } from './cycleModel';
import { labDraws, type LabResult } from './labs';
import type { Scale } from './timeAxis';

export type Bin = 'hour' | 'day' | 'week';

export const CYCLE_NORMAL = { min: 24, max: 38 } as const;
export const SLEEP_GUIDE_HOURS = 7;

export const binFor = (scale: Scale): Bin => (scale === 'day' ? 'hour' : scale === 'year' ? 'week' : 'day');

export function binStart(at: Date, bin: Bin): Date {
  if (bin === 'hour') return new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours());
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  if (bin === 'day') return day;
  // Weeks start on a Monday.
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
}

export function binEnd(start: Date, bin: Bin): Date {
  if (bin === 'hour') return new Date(start.getTime() + 3600000);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + (bin === 'day' ? 1 : 7));
}

const dayOf = (iso: string): Date | null => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// The parts of a logged signal these read. Kept narrow so the screen's own
// Signal type and a test's plain object both fit.
type EpisodeLike = {
  kinds: string[];
  periodStart: string | null;
  periodEnd: string | null;
  flow: string | null;
  severity: number | null;
  symptoms: string[];
  flareUpUserReported: boolean | null;
  allDay: boolean;
  start: number | null;
  end: number | null;
};
type SignalLike = { episode: EpisodeLike; date: Date; pain: boolean };

// ── Cycle ──────────────────────────────────────────────────────

const FLOW_LEVEL: Record<string, number> = { Light: 1, Moderate: 2, Heavy: 3, 'Very heavy': 4 };

export type PeriodBlock = { start: Date; end: Date; flow: number | null };

export function periodBlocks(signals: readonly SignalLike[]): PeriodBlock[] {
  return signals
    .filter((s) => s.episode.kinds.includes('Period') && s.episode.periodStart)
    .map((s) => {
      const start = dayOf(s.episode.periodStart!)!;
      const last = s.episode.periodEnd ? dayOf(s.episode.periodEnd) : null;
      return { start, end: nextDay(last && last >= start ? last : start), flow: FLOW_LEVEL[s.episode.flow ?? ''] ?? null };
    })
    .filter((b) => !Number.isNaN(b.start.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type CycleGap = { from: Date; to: Date; mid: Date; days: number; outside: boolean };

// Each finished cycle, from its first day to the next one's, with its
// length placed in the middle.
export function cycleGaps(windows: readonly CycleWindow[]): CycleGap[] {
  return windows
    .filter((w) => w.length != null)
    .map((w) => {
      const from = w.start;
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + w.length!);
      const mid = new Date((from.getTime() + to.getTime()) / 2);
      return { from, to, mid, days: w.length!, outside: w.length! < CYCLE_NORMAL.min || w.length! > CYCLE_NORMAL.max };
    });
}

// ── Pain ───────────────────────────────────────────────────────

export type Cell = { start: Date; end: Date; severity: number | null };

export function painCells(signals: readonly SignalLike[], bin: Bin): Cell[] {
  const worst = new Map<number, number>();
  for (const s of signals) {
    if (!s.pain || s.episode.severity == null) continue;
    const key = binStart(s.date, bin).getTime();
    worst.set(key, Math.max(worst.get(key) ?? 0, s.episode.severity));
  }
  return [...worst.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, severity]) => ({ start: new Date(t), end: binEnd(new Date(t), bin), severity }));
}

// ── Flare ups ──────────────────────────────────────────────────

export type FlareSpan = { at: Date; until: Date | null };

export function flareSpans(signals: readonly SignalLike[]): FlareSpan[] {
  return signals
    .filter((s) => s.episode.flareUpUserReported)
    .map((s) => {
      const day = new Date(s.date.getFullYear(), s.date.getMonth(), s.date.getDate());
      const { allDay, start, end } = s.episode;
      if (allDay || start == null) return { at: day, until: nextDay(day) };
      const at = new Date(day.getTime() + start * 3600000);
      return { at, until: end != null && end > start ? new Date(day.getTime() + end * 3600000) : null };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ── Measured levels ────────────────────────────────────────────

export type LevelBin = { start: Date; end: Date; value: number };

// One measured figure per day (HRV, resting heart rate, skin temperature,
// steps), or each week's average over a year. A day it was not measured
// is absent.
export function levelBins(days: readonly Day[], get: (d: Day) => number | null, bin: Bin): LevelBin[] {
  const unit: Bin = bin === 'hour' ? 'day' : bin;
  const sums = new Map<number, { sum: number; n: number }>();
  for (const d of days) {
    const v = get(d);
    const at = dayOf(d.date);
    if (v == null || !at) continue;
    const key = binStart(at, unit).getTime();
    const s = sums.get(key) ?? { sum: 0, n: 0 };
    sums.set(key, { sum: s.sum + v, n: s.n + 1 });
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, { sum, n }]) => ({ start: new Date(t), end: binEnd(new Date(t), unit), value: Math.round((sum / n) * 100) / 100 }));
}

// ── Which lanes ────────────────────────────────────────────────

export type LaneKey = 'cycle' | 'pain' | 'flare' | 'symptoms' | 'sleep' | 'hrv' | 'heart' | 'temp' | 'steps' | 'medications' | 'records' | 'notes';

export type LaneCounts = {
  periods: number;
  pain: number;
  flares: number;
  symptoms: number;
  sleep: number;
  hrv: number;
  heart: number;
  temp: number;
  steps: number;
  medications: number;
  records: number;
  notes: number;
};

const LANE_ORDER: [LaneKey, keyof LaneCounts][] = [
  ['cycle', 'periods'],
  ['pain', 'pain'],
  ['flare', 'flares'],
  ['symptoms', 'symptoms'],
  ['sleep', 'sleep'],
  ['hrv', 'hrv'],
  ['heart', 'heart'],
  ['temp', 'temp'],
  ['steps', 'steps'],
  ['medications', 'medications'],
  ['records', 'records'],
  ['notes', 'notes'],
];

// Only what she has given Ciatta, whether logged or synced from a device.
// Counted over her whole record rather than the window in view, so a lane
// does not appear and vanish as she changes from a week to a month.
export const lanesWithData = (counts: LaneCounts): LaneKey[] => LANE_ORDER.filter(([, k]) => counts[k] > 0).map(([lane]) => lane);

// ── Sleep ──────────────────────────────────────────────────────

export type SleepBin = { start: Date; end: Date; hours: number };

// Nights, or weekly averages over a year. A day window shows nights too:
// sleep has no hours of its own to spread across a day.
export function sleepBins(days: readonly Day[], bin: Bin): SleepBin[] {
  const unit: Bin = bin === 'hour' ? 'day' : bin;
  const sums = new Map<number, { sum: number; n: number }>();
  for (const d of days) {
    if (d.sleepHours == null) continue;
    const at = dayOf(d.date);
    if (!at) continue;
    const key = binStart(at, unit).getTime();
    const s = sums.get(key) ?? { sum: 0, n: 0 };
    sums.set(key, { sum: s.sum + d.sleepHours, n: s.n + 1 });
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, { sum, n }]) => ({ start: new Date(t), end: binEnd(new Date(t), unit), hours: Math.round((sum / n) * 100) / 100 }));
}

// ── Symptoms ───────────────────────────────────────────────────

export type SymptomRow = { symptom: string; cells: Cell[] };

export function symptomGrid(signals: readonly SignalLike[], bin: Bin, rows = 4): SymptomRow[] {
  const counts = new Map<string, number>();
  for (const s of signals) for (const name of s.episode.symptoms ?? []) counts.set(name, (counts.get(name) ?? 0) + 1);
  // Most logged first; a tie keeps the order she first logged them in.
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, rows).map(([name]) => name);
  return top.map((symptom) => {
    const cells = new Map<number, number | null>();
    for (const s of signals) {
      if (!(s.episode.symptoms ?? []).includes(symptom)) continue;
      const key = binStart(s.date, bin).getTime();
      const was = cells.get(key);
      const sev = s.episode.severity;
      cells.set(key, sev == null ? (was ?? null) : Math.max(was ?? 0, sev));
    }
    return {
      symptom,
      cells: [...cells.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, severity]) => ({ start: new Date(t), end: binEnd(new Date(t), bin), severity })),
    };
  });
}

// ── Records ────────────────────────────────────────────────────

export type DrawMarker = { at: Date; lab: string | null; outside: boolean; outsideCount: number; count: number };

// One marker per lab visit, by how many of its results sat outside their
// range, using the same statuses as Labs.
export function labMarkers(labs: readonly LabResult[]): DrawMarker[] {
  return labDraws(labs).map((d) => {
    const [y, m, day] = d.on.split('-').map(Number);
    return { at: new Date(y, m - 1, day, 12), lab: d.lab, outside: d.outside > 0, outsideCount: d.outside, count: d.results.length };
  });
}

// ── Shading ────────────────────────────────────────────────────

// One colour, darker as severity rises, which reads the same to colour
// blind eyes. A log with no number is shown lightly, never as a guess.
export const severityOpacity = (severity: number | null) =>
  severity == null ? 0.22 : 0.18 + (Math.min(10, Math.max(0, severity)) / 10) * 0.82;
