// Hormones across the cycle, and what each phase looks like in her own
// record.
//
// The curves are the typical shape of estradiol, progesterone, LH and FSH
// across an ovulatory cycle, as published reference ranges describe it
// (Stricker et al., Clin Chem Lab Med 2006, PubMed 16776599): estradiol
// rising to a peak just before ovulation with a smaller luteal rise, the LH
// surge the day before ovulation with a smaller FSH peak beside it, and
// progesterone rising after ovulation to a mid luteal peak. They are a
// typical pattern, not her levels: nothing here measures a hormone, and the
// screen says so. Each is scaled to its own peak, so the shapes compare and
// the units do not.
//
// The curves are fitted to her cycle: ovulation is placed where her own
// cycle puts it (her confirmed ovulation, or fourteen days before her usual
// end, as estimatedPhase does), so a long cycle stretches the follicular
// phase and keeps the luteal one, which is how cycles actually vary.
//
// phaseEffects is the part that is about her: her own sleep, HRV, resting
// heart rate and the stress she logged in each phase, against her own
// usual, from her completed cycles. Said only once two cycles back it.

import { NAME } from './metricNames';
import type { Day } from '../data/daily';
import { type ClinicalPhase, type CycleWindow, estimatedPhase } from './cycleModel';
import { fmtHours } from './engine';

export type PhaseSpan = { phase: ClinicalPhase; from: number; to: number };

export function phaseBounds(length: number, ovulationDay: number, periodDays = 5): PhaseSpan[] {
  const spans: PhaseSpan[] = [
    { phase: 'Menstrual', from: 1, to: Math.min(periodDays, length) },
    { phase: 'Follicular', from: periodDays + 1, to: ovulationDay - 2 },
    { phase: 'Ovulatory', from: Math.max(periodDays + 1, ovulationDay - 1), to: Math.min(length, ovulationDay + 1) },
    { phase: 'Luteal', from: ovulationDay + 2, to: length },
  ];
  return spans.filter((s) => s.to >= s.from);
}

export type HormoneKey = 'estradiol' | 'progesterone' | 'lh' | 'fsh';
export const HORMONE_LABEL: Record<HormoneKey, string> = { estradiol: 'Estrogen', progesterone: 'Progesterone', lh: 'LH', fsh: 'FSH' };

const bump = (d: number, centre: number, sigma: number, height: number) => height * Math.exp(-((d - centre) ** 2) / (2 * sigma ** 2));

export function hormoneCurves(length: number, ovulationDay: number): Record<HormoneKey, number[]> {
  const ov = ovulationDay;
  const raw: Record<HormoneKey, (d: number) => number> = {
    estradiol: (d) => 0.15 + bump(d, ov - 2, 2.2, 1) + bump(d, ov + 7, 3, 0.55),
    progesterone: (d) => 0.02 + bump(d, ov + 7, 3, 1),
    lh: (d) => 0.05 + bump(d, ov - 1, 0.8, 1),
    fsh: (d) => 0.15 + bump(d, 3, 3, 0.45) + bump(d, ov - 1, 1, 0.75),
  };
  const out = {} as Record<HormoneKey, number[]>;
  for (const k of Object.keys(raw) as HormoneKey[]) {
    const values = Array.from({ length }, (_, i) => raw[k](i + 1));
    const top = Math.max(...values);
    out[k] = values.map((v) => Math.round((v / top) * 1000) / 1000);
  }
  return out;
}

// What each phase is commonly like, said as common, never as hers.
export const PHASE_NOTE: Record<ClinicalPhase, string> = {
  Menstrual: 'Estrogen and progesterone are at their lowest. Many people feel more tired and notice cramps or lower energy in these days.',
  Follicular: 'Estrogen rises as a follicle grows. Many people notice energy and mood lifting through this phase.',
  Ovulatory: 'LH surges and an egg is released. Estrogen peaks just before. Some people notice a brief rise in energy, or one sided pain.',
  Luteal: 'Progesterone rises, then both hormones fall before the next period. Many people notice premenstrual symptoms, lighter sleep, lower energy or mood changes.',
};

// ── Her own phases ─────────────────────────────────────────────

export type PhaseRow = { key: 'sleep' | 'hrv' | 'rhr' | 'stress'; label: string; value: string; compare: string; cycles: number };

const METRICS: {
  key: PhaseRow['key'];
  label: string;
  get: (d: Day) => number | null;
  say: (v: number) => string;
  // How far from her usual counts as different: a share of it, or points.
  differs: (v: number, usual: number) => number;
  threshold: number;
}[] = [
  { key: 'sleep', label: 'Sleep', get: (d) => d.sleepHours, say: (v) => fmtHours(v), differs: (v, u) => (v - u) / u, threshold: 0.05 },
  { key: 'hrv', label: 'HRV', get: (d) => d.hrv, say: (v) => `${Math.round(v)} ms`, differs: (v, u) => (v - u) / u, threshold: 0.05 },
  { key: 'rhr', label: NAME.rhr, get: (d) => d.restingHR, say: (v) => `${Math.round(v)} bpm`, differs: (v, u) => (v - u) / u, threshold: 0.03 },
  { key: 'stress', label: 'Stress you logged', get: (d) => d.stress, say: (v) => `${v.toFixed(1)} of 5`, differs: (v, u) => v - u, threshold: 0.4 },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const PHASES: ClinicalPhase[] = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal'];

export function phaseEffects(days: readonly Day[], windows: readonly CycleWindow[]): Record<ClinicalPhase, PhaseRow[]> {
  const byDate = new Map(days.map((d) => [d.date, d]));
  // metric -> phase -> values, and the cycles each came from.
  const values = new Map<string, { v: number; cycle: number }[]>();
  const all = new Map<string, number[]>();
  for (const w of windows) {
    if (w.length == null) continue;
    for (let i = 0; i < w.length; i++) {
      const d = byDate.get(iso(new Date(w.start.getFullYear(), w.start.getMonth(), w.start.getDate() + i)));
      if (!d) continue;
      const phase = estimatedPhase(i + 1, w.length);
      for (const m of METRICS) {
        const v = m.get(d);
        if (v == null) continue;
        const k = `${m.key}|${phase}`;
        values.set(k, [...(values.get(k) ?? []), { v, cycle: w.index }]);
        all.set(m.key, [...(all.get(m.key) ?? []), v]);
      }
    }
  }
  const out = {} as Record<ClinicalPhase, PhaseRow[]>;
  for (const phase of PHASES) {
    out[phase] = [];
    for (const m of METRICS) {
      const here = values.get(`${m.key}|${phase}`) ?? [];
      const cycles = new Set(here.map((x) => x.cycle)).size;
      const overall = all.get(m.key) ?? [];
      if (cycles < 2 || here.length < 4 || !overall.length) continue;
      const mean = avg(here.map((x) => x.v));
      const usual = avg(overall);
      const diff = m.differs(mean, usual);
      const compare = Math.abs(diff) < m.threshold ? 'About your usual' : diff > 0 ? 'Higher than your usual' : 'Lower than your usual';
      out[phase].push({ key: m.key, label: m.label, value: m.say(mean), compare, cycles });
    }
  }
  return out;
}

// ── What the section shows ─────────────────────────────────────

// Situations whose hormones do not follow the typical ovulatory pattern:
// hormonal contraception suppresses it, and PCOS, perimenopause, the months
// after birth and absent periods change it in ways a typical curve would
// misdescribe.
const NOT_TYPICAL = ['Hormonal contraception', 'PCOS / PMOS', 'Perimenopause', 'Postpartum', 'No periods right now'];

export type HormoneView = {
  applies: boolean;
  length: number;
  ovulationDay: number;
  today: number;
  phase: ClinicalPhase;
  confirmed: boolean;
  // False when no cycle length of hers is known yet and 28 days stands in.
  ownLength: boolean;
};

export function hormoneView(input: {
  open: CycleWindow | null;
  usualLength: number | null;
  situations: readonly string[];
  confirmedOvulation: Date | null;
  now: Date;
}): HormoneView | null {
  if (!input.open) return null;
  const start = input.open.start;
  const today =
    Math.floor((new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000) + 1;
  const length = Math.max(input.usualLength ?? 28, today);
  const confirmedDay = input.confirmedOvulation
    ? Math.floor((input.confirmedOvulation.getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 86400000) + 1
    : null;
  const ovulationDay = confirmedDay != null && confirmedDay > 5 && confirmedDay < length ? confirmedDay : (input.usualLength ?? 28) - 14;
  const span = phaseBounds(length, ovulationDay).find((p) => today >= p.from && today <= p.to);
  return {
    applies: !input.situations.some((s) => NOT_TYPICAL.includes(s)),
    length,
    ovulationDay,
    today,
    phase: span?.phase ?? 'Luteal',
    confirmed: confirmedDay != null && ovulationDay === confirmedDay,
    ownLength: input.usualLength != null,
  };
}
