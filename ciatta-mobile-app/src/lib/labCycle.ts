// Where she was in her cycle when a hormone was drawn, and which of the
// lab's phase ranges that points to.
//
// The cycle day is counted from the period she logged before the draw,
// and is not known when none lies within 45 days. The phase comes from the
// app's own rules: the observational one from phaseOf, and the clinical
// estimate from estimatedPhase, always shown as likely. Nothing here
// assumes a 28 day cycle when she has one of her own.

import { daysBetween, parseDay } from '../data/cycleLog';
import { type ClinicalPhase, type CycleWindow, estimatedPhase, type Phase, phaseOf, windowFor } from './cycleModel';
import { parseRange, testKey } from './labs';

const HORMONES = new Set(['estradiol', 'progesterone', 'lh', 'fsh', 'prolactin', 'testosterone', 'free testosterone', 'testosterone free']);

export const isCycleHormone = (name: string) => HORMONES.has(testKey(name));

export type CycleAt = { day: number; phase: Phase | null; likely: ClinicalPhase };

const MAX_DAYS = 45;

export function cycleDayAt(on: string, windows: CycleWindow[], usualLength: number | null): CycleAt | null {
  const date = parseDay(on);
  const w = windowFor(date, windows);
  if (!w) return null;
  const day = daysBetween(w.start, date) + 1;
  if (day < 1 || day > MAX_DAYS) return null;
  return { day, phase: phaseOf(date, w, usualLength), likely: estimatedPhase(day, usualLength) };
}

export function cycleLine(at: CycleAt | null): string {
  if (!at) return 'Cycle day at this test is not known. Log your periods to see it.';
  return at.phase ? `Cycle day ${at.day}, ${at.phase.toLowerCase()}` : `Cycle day ${at.day}`;
}

export type PhaseRange = { phase: string; text: string; low: number | null; high: number | null };

const PHASE_WORDS = ['follicular', 'ovulation', 'ovulatory', 'mid cycle', 'midcycle', 'luteal', 'postmenopausal', 'menopausal'];

// "Follicular 12.5 to 166 / Luteal 43.8 to 211": the lab's ranges by
// phase. Fewer than two named phases is one plain range, not this.
export function phaseRanges(text: string | null): PhaseRange[] {
  if (!text) return [];
  const out: PhaseRange[] = [];
  for (const part of text.split(/[\/;\n]/)) {
    const m = part.trim().match(/^([A-Za-z][A-Za-z ]*?)\s*(?:phase)?\s*[:\s]\s*([<>≤≥]?\s*\d.*)$/);
    if (!m) continue;
    const label = m[1].trim();
    if (!PHASE_WORDS.includes(label.toLowerCase())) continue;
    const range = m[2].trim();
    out.push({ phase: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), text: range, ...parseRange(range) });
  }
  return out.length >= 2 ? out : [];
}

const FOR_PHASE: Record<ClinicalPhase, string[]> = {
  Menstrual: ['follicular'],
  Follicular: ['follicular'],
  Ovulatory: ['ovulation', 'ovulatory', 'mid cycle', 'midcycle'],
  Luteal: ['luteal'],
};

export function chosenRange(ranges: PhaseRange[], likely: ClinicalPhase | null): PhaseRange | null {
  if (!likely) return null;
  return ranges.find((r) => FOR_PHASE[likely].includes(r.phase.toLowerCase())) ?? null;
}
