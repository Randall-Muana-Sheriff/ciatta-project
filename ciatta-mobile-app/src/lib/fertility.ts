import { addDays, daysBetween, type Episode, isoDay, parseDay, shortDate } from '../data/cycleLog';
import type { Day } from '../data/daily';
import { completedLengths, countedWindows, type CycleWindow, medianLength, type Regularity, windowFor } from './cycleModel';
import { type CycleProfile, has } from './cycleProfile';

// An estimate of the fertile window and ovulation for the current cycle, from
// logged periods, nightly temperature and logged ovulation tests. It always
// says how sure it is, and it is never presented as birth control.

export const FERTILITY_DISCLAIMER = "This is an estimate, not birth control. Don't rely on it to prevent pregnancy.";

const DEFAULT_LUTEAL = 14;
const RISE = 0.2;

export type Confidence = 'Higher' | 'Medium' | 'Low';
export type Ovulation = { cycle: number; date: Date; source: 'temperature' | 'test' };
export type Span = { start: Date; end: Date };
export type Fertility = {
  show: boolean;
  hiddenReason: string | null;
  fertile: Span | null;
  ovulation: Span | null;
  confirmedThisCycle: boolean;
  confidence: Confidence | null;
  why: string | null;
  past: Ovulation[];
  luteal: number;
  notes: string[];
};

type Night = Pick<Day, 'date' | 'tempDeviation'>;

// Three nights in a row at least 0.2 °C above the average of the six nights
// before. Ovulation is the day before the rise. This confirms; it never predicts.
export function temperatureOvulation(days: Night[], w: CycleWindow): Date | null {
  const inside = days.filter((d) => {
    const t = parseDay(d.date);
    return d.tempDeviation != null && t >= w.start && (!w.end || t < w.end);
  });
  for (let i = 6; i + 2 < inside.length; i++) {
    const base = inside.slice(i - 6, i).reduce((a, d) => a + d.tempDeviation!, 0) / 6;
    const consecutive = [1, 2].every((k) => daysBetween(parseDay(inside[i].date), parseDay(inside[i + k].date)) === k);
    if (consecutive && [0, 1, 2].every((k) => inside[i + k].tempDeviation! >= base + RISE)) return addDays(parseDay(inside[i].date), -1);
  }
  return null;
}

// A positive ovulation test points to ovulation about a day later.
function testOvulations(episodes: Episode[], windows: CycleWindow[]): Ovulation[] {
  return episodes
    .filter((e) => e.symptoms.includes('Positive ovulation test'))
    .map((e): Ovulation | null => {
      const date = addDays(parseDay(e.date), 1);
      const w = windowFor(parseDay(e.date), windows);
      return w ? { cycle: w.index, date, source: 'test' } : null;
    })
    .filter((o): o is Ovulation => o != null);
}

// Her own gap from ovulation to the next period, once temperature has
// confirmed it in completed cycles.
export function lutealLength(windows: CycleWindow[], past: Ovulation[]): number {
  const gaps = windows
    .filter((w) => w.end)
    .map((w) => {
      const o = past.find((p) => p.cycle === w.index && p.source === 'temperature');
      return o ? daysBetween(o.date, w.end!) : null;
    })
    .filter((n): n is number => n != null && n >= 9 && n <= 17)
    .sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : DEFAULT_LUTEAL;
}

export function fmtRange(a: Date, b: Date): string {
  if (isoDay(a) === isoDay(b)) return shortDate(a);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} to ${shortDate(b)}` : `${shortDate(a)} to ${shortDate(b)}`;
}

export function estimateFertility({
  profile,
  windows,
  regularity,
  days,
  episodes,
}: {
  profile: CycleProfile;
  windows: CycleWindow[];
  regularity: Regularity;
  days: Night[];
  episodes: Episode[];
}): Fertility {
  const hidden = (reason: string | null): Fertility => ({
    show: false,
    hiddenReason: reason,
    fertile: null,
    ovulation: null,
    confirmedThisCycle: false,
    confidence: null,
    why: null,
    past: [],
    luteal: DEFAULT_LUTEAL,
    notes: [],
  });
  if (profile.showFertility === false) return hidden(null);
  if (has(profile, 'Hormonal contraception')) return hidden('Most hormonal contraception stops ovulation, so no fertile window is shown.');
  if (has(profile, 'No periods right now')) return hidden('A fertile window isn’t shown while your periods have stopped.');
  // Only cycles since a birth count toward lengths. With no period since the
  // birth, the birth opens a window that is used to look for signs only.
  const birth = has(profile, 'Postpartum') && profile.birthDate ? parseDay(profile.birthDate) : null;
  const counted = countedWindows(windows, profile);
  const searched: CycleWindow[] =
    birth && !counted.length ? [...windows, { index: windows.length, start: birth, end: null, length: null }] : windows;
  const current = searched[searched.length - 1];
  if (!current) return hidden('Log a period to see a fertile window.');

  const past: Ovulation[] = [
    ...searched
      .map((w): Ovulation | null => {
        const date = temperatureOvulation(days, w);
        return date ? { cycle: w.index, date, source: 'temperature' } : null;
      })
      .filter((o): o is Ovulation => o != null),
    ...testOvulations(episodes, searched),
  ];
  const luteal = lutealLength(windows, past);
  const notes: string[] = [];
  if (has(profile, 'PCOS / PMOS')) {
    notes.push('With PCOS / PMOS, ovulation tests can read positive without ovulation, so a temperature rise is the stronger sign.');
  }
  const base = { show: true, hiddenReason: null, past, luteal, notes };

  // This cycle already has a sign.
  const mine = past.filter((o) => o.cycle === current.index);
  const temp = mine.find((o) => o.source === 'temperature');
  if (temp) {
    return {
      ...base,
      fertile: { start: addDays(temp.date, -5), end: addDays(temp.date, 1) },
      ovulation: { start: temp.date, end: temp.date },
      confirmedThisCycle: true,
      confidence: 'Higher',
      why: 'your temperature rise confirmed ovulation this cycle',
    };
  }
  const test = mine.find((o) => o.source === 'test');
  if (test) {
    return {
      ...base,
      fertile: { start: addDays(test.date, -5), end: addDays(test.date, 2) },
      ovulation: { start: test.date, end: addDays(test.date, 1) },
      confirmedThisCycle: false,
      confidence: 'Higher',
      why: 'you logged a positive ovulation test',
    };
  }

  // After birth, no calendar estimate until two periods have returned.
  if (has(profile, 'Postpartum')) {
    const back = birth ? counted.length : 0;
    if (back < 2) {
      return {
        ...base,
        notes: [
          'Fertility can return before your first period after birth, so only a positive ovulation test or a temperature rise is shown until two periods have returned.',
          ...notes,
        ],
        fertile: null,
        ovulation: null,
        confirmedThisCycle: false,
        confidence: null,
        why: null,
      };
    }
  }

  if (regularity === 'predictable') {
    const ov = addDays(current.start, medianLength(counted)! - luteal);
    const confirmed = new Set(past.filter((o) => o.source === 'temperature' && o.cycle !== current.index).map((o) => o.cycle)).size;
    return {
      ...base,
      fertile: { start: addDays(ov, -5), end: addDays(ov, 1) },
      ovulation: { start: addDays(ov, -1), end: addDays(ov, 1) },
      confirmedThisCycle: false,
      confidence: confirmed >= 2 ? 'Higher' : 'Medium',
      why: confirmed >= 2 ? 'your cycles are steady and your temperature confirmed ovulation in past cycles' : 'your cycles are steady',
    };
  }

  const lengths = completedLengths(counted).slice(-6);
  const ovStart = addDays(current.start, (lengths.length ? Math.min(...lengths) : 21) - luteal);
  const ovEnd = addDays(current.start, (lengths.length ? Math.max(...lengths) : 35) - luteal);
  return {
    ...base,
    fertile: { start: addDays(ovStart, -5), end: addDays(ovEnd, 1) },
    ovulation: { start: ovStart, end: ovEnd },
    confirmedThisCycle: false,
    confidence: 'Low',
    why: lengths.length ? 'your cycles vary, so the window is wide' : 'there are no full cycles logged yet',
  };
}
