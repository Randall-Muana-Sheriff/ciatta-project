import { addDays, daysBetween, type Episode, parseDay } from '../data/cycleLog';
import { type CycleProfile, has, type Situation } from './cycleProfile';

// Cycles come from the periods someone actually logged. A next period is only
// predicted when recent cycles are steady and nothing they told us makes
// timing unreliable. Completed cycles keep their phases, because the next
// start is already known; that is a fact, not a prediction.

export type Phase = 'Before period' | 'During period' | 'After period' | 'Between periods';
export const PHASES: Phase[] = ['Before period', 'During period', 'After period', 'Between periods'];

export type CycleWindow = { index: number; start: Date; end: Date | null; length: number | null };
export type Regularity = 'predictable' | 'unpredictable';

// Period starts closer together than this are the same period logged twice.
const MERGE_DAYS = 10;
const STEADY_SPREAD = 7;
const UNPREDICTABLE: Situation[] = ['Irregular', 'PCOS / PMOS', 'Perimenopause', 'No periods right now'];

// Only a logged Period starts a cycle. Spotting, postpartum bleeding and
// withdrawal or breakthrough bleeds never do.
export function periodStarts(episodes: Episode[]): Date[] {
  return episodes
    .filter((e) => e.kinds.includes('Period'))
    .map((e) => parseDay(e.periodStart ?? e.date))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function cycleWindows(starts: Date[]): CycleWindow[] {
  const kept: Date[] = [];
  for (const d of [...starts].sort((a, b) => a.getTime() - b.getTime())) {
    if (!kept.length || daysBetween(kept[kept.length - 1], d) >= MERGE_DAYS) kept.push(d);
  }
  return kept.map((start, index) => {
    const end = kept[index + 1] ?? null;
    return { index, start, end, length: end ? daysBetween(start, end) : null };
  });
}

export function windowFor(date: Date, windows: CycleWindow[]): CycleWindow | null {
  for (let i = windows.length - 1; i >= 0; i--) if (date >= windows[i].start) return windows[i];
  return null;
}

export const completedLengths = (windows: CycleWindow[]) =>
  windows.map((w) => w.length).filter((n): n is number => n != null);

export function medianLength(windows: CycleWindow[]): number | null {
  const xs = completedLengths(windows).slice(-6).sort((a, b) => a - b);
  return xs.length ? xs[Math.floor(xs.length / 2)] : null;
}

// The cycles whose lengths count toward anything shown. After a birth only
// cycles that started on or after it count; otherwise every window does.
export function countedWindows(windows: CycleWindow[], profile: CycleProfile): CycleWindow[] {
  if (!has(profile, 'Postpartum') || !profile.birthDate) return windows;
  const birth = parseDay(profile.birthDate);
  return windows.filter((w) => w.start >= birth);
}

export function regularity(windows: CycleWindow[], profile: CycleProfile): Regularity {
  if (profile.situations.some((s) => UNPREDICTABLE.includes(s))) return 'unpredictable';
  if (has(profile, 'Postpartum') && !profile.birthDate) return 'unpredictable';

  const recent = completedLengths(countedWindows(windows, profile)).slice(-6);
  if (recent.length < 3) return 'unpredictable';
  return Math.max(...recent) - Math.min(...recent) <= STEADY_SPREAD ? 'predictable' : 'unpredictable';
}

// `predicted` is the expected length of an open cycle, or null when timing
// isn't predictable. Then an open cycle only has phases in its first week.
export function phaseOf(date: Date, w: CycleWindow, predicted: number | null): Phase | null {
  const since = daysBetween(w.start, date);
  if (since <= 4) return 'During period';
  const next = w.end ?? (predicted != null ? addDays(w.start, predicted) : null);
  if (next) {
    const until = daysBetween(date, next);
    if (until >= 1 && until <= 3) return 'Before period';
  }
  if (since <= 7) return 'After period';
  return next ? 'Between periods' : null;
}

// Where an event falls when there is no phase: days since a period started.
export const BANDS = [
  { max: 7, label: '0 to 7 days', phrase: 'in the first week after a period started' },
  { max: 21, label: '8 to 21 days', phrase: '8 to 21 days after a period started' },
  { max: 35, label: '22 to 35 days', phrase: '22 to 35 days after a period started' },
  { max: Infinity, label: 'Over 35 days', phrase: 'more than 35 days after a period started' },
] as const;

export const bandOf = (days: number) => BANDS.find((b) => days <= b.max)!;
