import {
  addDays,
  BLEEDING_KINDS,
  CONTEXT,
  daysBetween,
  type EpisodeForm,
  parseDay,
  shortDate,
  SYMPTOMS,
  WHAT_HAPPENED,
} from '../data/cycleLog';
import { completedLengths, countedWindows, type CycleWindow, medianLength, type Regularity } from './cycleModel';
import { type CycleProfile, FERTILITY_SIGNS, fertilityOn, has, type Situation } from './cycleProfile';

// How the Cycle experience reads for one person: the header, the chart, the
// extra things worth logging, and short notes. Every situation they chose
// adds to it; the header follows the one that most changes timing.

export type LensHeader = { value: string; label: string };
export type LensChart = 'none' | 'lengthDots' | 'postpartumTimeline' | 'monthsSince';

export type Lens = {
  header: LensHeader;
  secondary: LensHeader | null;
  chart: LensChart;
  kinds: string[];
  symptoms: string[];
  contexts: string[];
  predicts: boolean;
  painSplit: boolean;
  empty: boolean;
  notes: string[];
  tags: string[];
  lengths: number[];
  weeksSinceBirth: number | null;
  periodWeeks: number[];
  monthsSince: number | null;
};

const EXTRA_SYMPTOMS: Partial<Record<Situation, string[]>> = {
  'PCOS / PMOS': ['Acne', 'Hair growth', 'Hair loss'],
  Postpartum: ['Low mood', 'Anxious or on edge'],
  Perimenopause: ['Hot flashes', 'Night sweats', 'Brain fog', 'Joint pain'],
};

const EXTRA_CONTEXTS: Partial<Record<Situation, string[]>> = {
  Endometriosis: ['Pain with bowel movements', 'Pain when urinating', 'Pain during sex'],
};

const unique = (xs: string[]) => [...new Set(xs)];

function kindsFor(p: CycleProfile): string[] {
  const out: string[] = [];
  for (const k of WHAT_HAPPENED) {
    out.push(k);
    if (k === 'Spotting') {
      if (has(p, 'Postpartum')) out.push('Postpartum bleeding');
      if (has(p, 'Hormonal contraception')) out.push('Withdrawal bleed', 'Breakthrough bleeding');
    }
  }
  return out;
}

function symptomsFor(p: CycleProfile): string[] {
  const extra = [...p.situations.flatMap((s) => EXTRA_SYMPTOMS[s] ?? []), ...(fertilityOn(p) ? FERTILITY_SIGNS : [])];
  return unique([...SYMPTOMS.filter((s) => s !== 'Other'), ...extra, 'Other']);
}

function contextsFor(p: CycleProfile): string[] {
  const extra = p.situations.flatMap((s) => EXTRA_CONTEXTS[s] ?? []);
  if (has(p, 'Hormonal contraception') && p.contraception === 'Pill') extra.push('Missed pill');
  const base = CONTEXT.filter((c) => !(c === 'Ovulation' && has(p, 'Hormonal contraception')));
  return unique([...extra, ...base]);
}

export function lensFor({
  profile,
  windows,
  regularity,
  now = new Date(),
}: {
  profile: CycleProfile;
  windows: CycleWindow[];
  regularity: Regularity;
  now?: Date;
}): Lens {
  // Lengths come only from cycles that count: after a birth, the ones since it.
  const counted = countedWindows(windows, profile);
  const lengths = completedLengths(counted);
  const nextNote = (start: Date) => {
    const median = medianLength(counted)!;
    return `Your cycles usually run about ${median} days, so your next period may start around ${shortDate(addDays(start, median))}.`;
  };
  const current = windows[windows.length - 1] ?? null;
  const since = current ? daysBetween(current.start, now) : 0;
  const birth = has(profile, 'Postpartum') && profile.birthDate ? parseDay(profile.birthDate) : null;
  const periLast = has(profile, 'Perimenopause') ? current?.start ?? (profile.lastPeriod ? parseDay(profile.lastPeriod) : null) : null;
  const notes: string[] = [];
  let header: LensHeader;
  let secondary: LensHeader | null = null;
  let chart: LensChart = 'none';
  let weeksSinceBirth: number | null = null;
  let periodWeeks: number[] = [];
  let monthsSince: number | null = null;

  if (birth) {
    weeksSinceBirth = Math.floor(daysBetween(birth, now) / 7);
    const back = windows.filter((w) => w.start >= birth);
    periodWeeks = back.map((w) => Math.floor(daysBetween(birth, w.start) / 7));
    header = { value: `Week ${weeksSinceBirth}`, label: 'Since birth' };
    secondary = { value: back.length ? String(back.length) : 'None yet', label: 'Periods since birth' };
    chart = 'postpartumTimeline';
    // Once post birth cycles are steady, the next period is estimated as usual.
    notes.push(
      regularity === 'predictable' && current
        ? nextNote(current.start)
        : profile.breastfeeding
          ? 'Periods often stay away while breastfeeding, so no next period date is shown.'
          : 'Cycles often take a few months to settle after birth, so no next period date is shown yet.',
    );
  } else if (periLast) {
    monthsSince = Math.floor(daysBetween(periLast, now) / 30.44);
    header = {
      value: monthsSince === 0 ? 'Under a month' : monthsSince === 1 ? '1 month' : `${monthsSince} months`,
      label: 'Since your last period',
    };
    secondary = lengths.length ? { value: `${lengths[lengths.length - 1]} days`, label: 'Last cycle' } : null;
    chart = 'monthsSince';
    notes.push('12 months in a row without a period marks menopause.');
  } else if (has(profile, 'No periods right now')) {
    header = { value: 'No periods', label: 'Tracking symptoms by month' };
  } else if (!current) {
    header = { value: 'No period logged yet', label: 'Log a period to see your cycle here' };
  } else if (regularity === 'predictable') {
    const recent = lengths.slice(-6);
    header = { value: `Day ${since + 1}`, label: 'Current cycle' };
    secondary = { value: `${Math.min(...recent)} to ${Math.max(...recent)} days`, label: 'Recent range' };
    notes.push(nextNote(current.start));
  } else {
    header = { value: `Day ${since + 1}`, label: 'Since your last period' };
    secondary = lengths.length ? { value: `${Math.max(...lengths)} days`, label: 'Longest gap' } : null;
    chart = lengths.length ? 'lengthDots' : 'none';
    notes.push('Your cycle lengths vary, so no next period date is shown.');
  }

  if (has(profile, 'Postpartum') && !birth) notes.push('Add when you gave birth in Your Cycle to see weeks since birth.');
  if (has(profile, 'Hormonal contraception')) {
    notes.push('Bleeding on hormonal contraception is often a withdrawal bleed, so only bleeds you log as a period start a new cycle.');
  }

  return {
    header,
    secondary,
    chart,
    kinds: kindsFor(profile),
    symptoms: symptomsFor(profile),
    contexts: contextsFor(profile),
    predicts: regularity === 'predictable' && !!current && !periLast,
    painSplit: has(profile, 'Endometriosis'),
    empty: !current && !birth && !periLast && !has(profile, 'No periods right now'),
    notes,
    tags: [...profile.situations],
    lengths,
    weeksSinceBirth,
    periodWeeks,
    monthsSince,
  };
}

// Care prompts on the review step, only when what was logged calls for one.
export function safetyNotes(form: Pick<EpisodeForm, 'kinds' | 'flow' | 'bowelFlags'>, profile: CycleProfile): string[] {
  const out: string[] = [];
  const bleeding = form.kinds.some((k) => BLEEDING_KINDS.includes(k));
  const heavy = form.flow === 'Heavy' || form.flow === 'Very heavy';
  if (bleeding && has(profile, 'Postpartum') && heavy) {
    out.push('Heavy bleeding after birth needs urgent care. Call your clinician or emergency services now.');
  } else if (bleeding && form.flow === 'Very heavy') {
    out.push('Soaking through a pad or tampon in about an hour is worth a call to a clinician today.');
  }
  if (form.kinds.includes('Bowel movement') && form.bowelFlags.includes('Blood')) {
    out.push('Blood in your stool is worth telling a clinician about soon.');
  }
  return out;
}
