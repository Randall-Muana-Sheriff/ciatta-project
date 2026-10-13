// What her record did on either side of a procedure.
//
// A procedure is a line drawn through her record. This counts what is on
// each side of it, six weeks before against six weeks after, from her own
// logs and devices only. It never says the procedure caused anything, and
// a side with too little record says so instead of comparing.

import type { Day } from '../data/daily';
import { band } from './engine';

const SIDE = 42;
const ENOUGH = 21;
const USUAL_FROM = 90;
const USUAL_MIN = 20;

export type Side = { from: string; to: string; symptomDays: number | null; covered: number; enough: boolean };

export type ProcedureEffect = {
  before: Side;
  after: Side;
  // Whole weeks of the after window that have passed, 0 to 6.
  weeksAfter: number;
  sentence: string | null;
  measures: string[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (iso: string, days: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return key(d);
};

export const rangeLine = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  return `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}`;
};

// A date she typed, as a day, or null when it is not a real past day.
export function dayFromParts(day: string, month: string, year: string, now = new Date()): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (![d, m, y].every((n) => Number.isInteger(n) && n > 0)) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (date > now || y < 1900) return null;
  return key(date);
}

const MEASURES: { label: string; get: (d: Day) => number | null }[] = [
  { label: 'Sleep', get: (d) => d.sleepHours },
  { label: 'Heart rate variability', get: (d) => d.hrv },
  { label: 'Resting heart rate', get: (d) => d.restingHR },
  { label: 'Steps', get: (d) => d.steps },
];

const hasReading = (d: Day) => MEASURES.some((m) => m.get(d) != null);

export function procedureEffect(input: {
  date: string;
  days: readonly Day[];
  episodes: readonly { date: string; kinds: string[] }[];
  journalSymptomDates: readonly string[];
  now: Date;
}): ProcedureEffect {
  const { date } = input;
  const symptomDates = new Set<string>([
    ...input.episodes.filter((e) => e.kinds.includes('Pain') || e.kinds.includes('Symptoms')).map((e) => e.date.slice(0, 10)),
    ...input.journalSymptomDates.map((d) => d.slice(0, 10)),
  ]);
  const logged = new Set<string>([...input.episodes.map((e) => e.date.slice(0, 10)), ...input.journalSymptomDates.map((d) => d.slice(0, 10))]);
  const byDate = new Map(input.days.map((d) => [d.date.slice(0, 10), d]));

  const side = (from: string, to: string, last: string): Side => {
    let covered = 0;
    let symptoms = 0;
    for (let k = from; k <= to && k <= last; k = shift(k, 1)) {
      const d = byDate.get(k);
      if ((d && hasReading(d)) || logged.has(k)) covered += 1;
      if (symptomDates.has(k)) symptoms += 1;
    }
    const enough = covered >= ENOUGH;
    return { from, to, symptomDays: enough ? symptoms : null, covered, enough };
  };

  const todayKey = key(input.now);
  const before = side(shift(date, -SIDE), shift(date, -1), todayKey);
  const after = side(shift(date, 1), shift(date, SIDE), todayKey);
  const elapsed = Math.floor((parse(todayKey).getTime() - parse(date).getTime()) / 86400000);
  const weeksAfter = Math.max(0, Math.min(6, Math.floor(elapsed / 7)));
  const finished = weeksAfter === 6 && todayKey > after.to;

  let sentence: string | null = null;
  if (finished && before.enough && after.enough) {
    const b = before.symptomDays!;
    const a = after.symptomDays!;
    sentence =
      a === b
        ? `Your symptom days stayed at ${b} in the six weeks before and after.`
        : `Your symptom days ${a < b ? 'fell' : 'rose'} from ${b} in the six weeks before to ${a} in the six weeks after.`;
  }

  const measures: string[] = [];
  for (const m of MEASURES) {
    const usualValues: number[] = [];
    for (let k = shift(date, -USUAL_FROM); k < date; k = shift(k, 1)) {
      const d = byDate.get(k);
      const v = d ? m.get(d) : null;
      if (v != null) usualValues.push(v);
    }
    if (usualValues.length < USUAL_MIN) continue;
    const b = band(usualValues);
    const weekMean = (w: number) => {
      const vals: number[] = [];
      for (let i = 1 + (w - 1) * 7; i <= w * 7; i += 1) {
        const d = byDate.get(shift(date, i));
        const v = d ? m.get(d) : null;
        if (v != null) vals.push(v);
      }
      return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    };
    const inside = (v: number) => v >= b.low && v <= b.high;
    const first = weekMean(1);
    if (first == null || inside(first)) continue;
    let back: number | null = null;
    for (let w = 2; w <= weeksAfter; w += 1) {
      const v = weekMean(w);
      if (v != null && inside(v)) {
        back = w;
        break;
      }
    }
    if (back) measures.push(`${m.label} returned to your usual in week ${back}.`);
    else if (finished) measures.push(`${m.label} had not returned to your usual by week 6.`);
  }

  return { before, after, weeksAfter, sentence, measures };
}

export type ProcedureEntry = { id: string; name: string; date: string; source: 'Imported' | 'You added' };

// Every dated procedure, newest first: the ones her providers sent
// (Imported) and the ones she added. Surgeries she named at onboarding
// carry no date, so they are listed apart, asking for one, unless she has
// already added that name with a date.
export function procedureList(
  added: readonly { id: string; name: string; date: string }[],
  clinical: readonly { sourceId: string; kind: string; name: string; effectiveOn: string | null }[],
  surgeries: readonly string[],
): { dated: ProcedureEntry[]; undated: string[] } {
  const dated: ProcedureEntry[] = [
    ...clinical
      .filter((c) => c.kind === 'procedure' && c.effectiveOn)
      .map((c) => ({ id: c.sourceId, name: c.name, date: c.effectiveOn!.slice(0, 10), source: 'Imported' as const })),
    ...added.map((a) => ({ id: a.id, name: a.name, date: a.date, source: 'You added' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const known = new Set(dated.map((d) => d.name.trim().toLowerCase()));
  const undated = surgeries.filter((s) => s.trim() && !known.has(s.trim().toLowerCase()));
  return { dated, undated };
}
