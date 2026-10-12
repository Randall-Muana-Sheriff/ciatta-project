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

// Where today sits in the open cycle: the day number and the phase, when
// there is one.
//
// The concept's header reads "Menstrual, day 5". Both halves have to be
// earned: the day is counted from the period she logged, and the phase
// comes from phaseOf, which returns null when an open cycle has run past
// the point its phases can be known. A header that guessed either would be
// telling her where she is in a cycle Ciatta cannot see.
export type CycleToday = { day: number; phase: Phase | null };

export function cycleToday(open: CycleWindow | null, predicted: number | null, now: Date): CycleToday | null {
  if (!open) return null;
  const day = daysBetween(open.start, now) + 1;
  // A cycle that started in the future, or one so long it has clearly been
  // left open by a period she never logged, is not a day count worth
  // showing. Ninety days is well past any real cycle.
  if (day < 1 || day > 90) return null;
  return { day, phase: phaseOf(now, open, predicted) };
}

// The header line. Phase first when it is known, because it is the part
// that means something to her.
export function cycleTodayLabel(t: CycleToday | null): string | null {
  if (!t) return null;
  return t.phase ? `${t.phase} · day ${t.day}` : `Day ${t.day}`;
}

// ── The clinical phase names ─────────────────────────────────────────
//
// Follicular and luteal are not positions on a calendar. They are defined
// by ovulation: follicular runs from bleeding to ovulation, luteal from
// ovulation to the next bleed. Which means they can only be named once
// ovulation is known.
//
// Most apps name them anyway, by assuming a 28 day cycle ovulating on day
// 14. For a woman with PCOS, an irregular cycle or in perimenopause, who
// is who Ciatta is for, that assumption is wrong often enough to be
// worthless and confident enough to be believed. A woman told she is in
// her luteal phase on day 15 of a 45 day cycle has been told something
// nobody knows.
//
// So these names are returned only when ovulation has actually been
// established, from a logged test or a temperature shift. Without one the
// caller keeps the observational label, which describes where she is
// relative to bleeding Ciatta watched her log.

export type ClinicalPhase = 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal';

// Either side of ovulation day counts as ovulatory, which is the window
// the egg is actually viable in rather than a single day.
const OVULATORY_DAYS = 1;

export function clinicalPhase(input: {
  date: Date;
  // True when she logged bleeding on this day.
  bleeding: boolean;
  // Established for this cycle, from a test or a temperature shift. Null
  // when nothing established it, which is the common case.
  ovulation: Date | null;
}): ClinicalPhase | null {
  // Bleeding is observed rather than inferred, so it can be named whether
  // or not ovulation is known.
  if (input.bleeding) return 'Menstrual';
  if (!input.ovulation) return null;

  const days = daysBetween(input.ovulation, input.date);
  if (Math.abs(days) <= OVULATORY_DAYS) return 'Ovulatory';
  return days < 0 ? 'Follicular' : 'Luteal';
}

// What the phase is called on screen, with the word "phase" attached
// where it reads naturally.
export function clinicalPhaseLabel(phase: ClinicalPhase): string {
  return phase === 'Menstrual' ? 'Menstrual' : `${phase} phase`;
}

// The line Today shows: the clinical name when it is earned, and the
// observational one when it is not. Never both, and never a clinical name
// hedged into meaninglessness.
export function phaseLine(clinical: ClinicalPhase | null, observed: Phase | null): string | null {
  if (clinical) return clinicalPhaseLabel(clinical);
  return observed;
}
