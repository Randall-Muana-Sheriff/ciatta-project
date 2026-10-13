// Today's Patterns, as stacked lanes on one shared run of days: sleep, her
// heart, how she felt, the symptoms she logged and her cycle, a column per
// day for the last fourteen, today at the right. A pattern is the same
// days lining up across lanes, which one axis shows without a sentence.
//
// Only the lanes she has data for are drawn, so a record of sleep alone is
// one lane, not five with four empty. Under them, one sentence when her own
// days show something worth reading, with the counts it rests on; nothing
// when they do not.

import type { Day } from '../data/daily';
import { fmtHours } from './engine';

export type Band = { low: number; high: number };

export type Lane =
  | { key: 'sleep'; label: string; kind: 'bars'; values: (number | null)[]; usual: number | null }
  | { key: 'heart' | 'mood'; label: string; kind: 'dots'; values: (number | null)[]; band: Band | null; min: number; max: number; unit: string }
  | { key: 'symptoms'; label: string; kind: 'heat'; rows: { name: string; cells: (number | null)[] }[] }
  | { key: 'cycle'; label: string; kind: 'cycle'; period: boolean[]; cycleDay: (number | null)[] };

export type PatternView = { days: string[]; lanes: Lane[]; pattern: string | null };

type EpisodeLike = { date: string; kinds: string[]; symptoms: string[]; severity: number | null };

const SPAN = 14;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const known = (xs: (number | null)[]) => xs.filter((v): v is number => v != null);

export function patternLanes(input: {
  days: readonly Day[];
  episodes: readonly EpisodeLike[];
  periodDays: ReadonlySet<string>;
  usual: { sleep?: number | null; hrv?: Band | null; rhr?: Band | null };
  // Her cycle day today, when a cycle is open; earlier days count back.
  cycleDayToday: number | null;
  now: Date;
}): PatternView {
  const { now } = input;
  const days = Array.from({ length: SPAN }, (_, n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SPAN - 1 - n))));
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const col = (get: (d: Day) => number | null) => days.map((k) => {
    const d = byDate.get(k);
    return d ? get(d) : null;
  });
  const lanes: Lane[] = [];

  const sleep = col((d) => d.sleepHours);
  if (known(sleep).length) lanes.push({ key: 'sleep', label: 'Sleep', kind: 'bars', values: sleep, usual: input.usual.sleep ?? null });

  // HRV when she has it; resting heart rate stands in when she does not.
  const hrv = col((d) => d.hrv);
  const rhr = col((d) => d.restingHR);
  const heart = known(hrv).length
    ? { label: 'HRV', values: hrv, band: input.usual.hrv ?? null, unit: 'ms' }
    : known(rhr).length
      ? { label: 'Resting HR', values: rhr, band: input.usual.rhr ?? null, unit: 'bpm' }
      : null;
  if (heart) {
    const all = [...known(heart.values), ...(heart.band ? [heart.band.low, heart.band.high] : [])];
    lanes.push({ key: 'heart', kind: 'dots', ...heart, min: Math.min(...all), max: Math.max(...all) });
  }

  const mood = col((d) => d.mood);
  if (known(mood).length) lanes.push({ key: 'mood', label: 'Mood', kind: 'dots', values: mood, band: null, min: 1, max: 5, unit: 'of 5' });

  // Symptoms, the three she logged most in the window, a row each; a cell
  // is the day's worst severity out of ten, or present when none was given.
  const inWindow = input.episodes.filter((e) => days.includes(e.date));
  const named = (e: EpisodeLike) => [...e.symptoms, ...(e.kinds.includes('Pain') ? ['Pain'] : [])];
  const counts = new Map<string, number>();
  for (const e of inWindow) for (const s of new Set(named(e))) counts.set(s, (counts.get(s) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  if (top.length) {
    lanes.push({
      key: 'symptoms',
      label: 'Symptoms',
      kind: 'heat',
      rows: top.map((name) => ({
        name,
        cells: days.map((k) => {
          const hits = inWindow.filter((e) => e.date === k && named(e).includes(name));
          if (!hits.length) return null;
          const sev = known(hits.map((e) => e.severity));
          return sev.length ? Math.max(...sev) / 10 : 0.5;
        }),
      })),
    });
  }

  const period = days.map((k) => input.periodDays.has(k));
  const cycleDay = days.map((_, n) => {
    if (input.cycleDayToday == null) return null;
    const v = input.cycleDayToday - (SPAN - 1 - n);
    return v >= 1 ? v : null;
  });
  if (period.some(Boolean) || cycleDay.some((v) => v != null)) lanes.push({ key: 'cycle', label: 'Cycle', kind: 'cycle', period, cycleDay });

  // The one sentence: sleep on the days she logged symptoms against the
  // rest, when each side has enough days and the gap is worth naming.
  const symptomDays = new Set(inWindow.filter((e) => named(e).length).map((e) => e.date));
  const on = known(days.map((k, n) => (symptomDays.has(k) ? sleep[n] : null)));
  const off = known(days.map((k, n) => (!symptomDays.has(k) ? sleep[n] : null)));
  let pattern: string | null = null;
  if (on.length >= 2 && off.length >= 2) {
    const gap = avg(off) - avg(on);
    if (Math.abs(gap) >= 0.5) {
      pattern = `On the ${on.length} days you logged symptoms, you slept ${fmtHours(Math.abs(gap))} ${gap > 0 ? 'less' : 'more'} than on the other ${off.length}.`;
    }
  }
  return { days, lanes, pattern };
}
