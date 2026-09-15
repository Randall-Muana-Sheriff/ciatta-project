import { addDays, daysBetween, type Episode, isoDay, parseDay, shortDate, startOfDay } from '../data/cycleLog';
import type { Day } from '../data/daily';
import { type CycleSummary, type CycleWindow, type Observation, type Signal, tally } from './cyclePatterns';

// The shared insight layer. Every screen reads from here rather than running
// its own checks. For each measure it sets a personal baseline, looks for
// changes that last, lines events up in time across areas, counts how often
// a relationship recurs, records what the evidence does and doesn't show,
// and decides whether to ignore, watch, surface, investigate, or recommend.
// It never names a cause or a condition.

export type Domain =
  | 'Sleep'
  | 'Movement'
  | 'Recovery'
  | 'Cycle'
  | 'Pain'
  | 'Flare ups'
  | 'Stress'
  | 'Energy'
  | 'Nutrition'
  | 'Digestion'
  | 'Biomarkers'
  | 'Interventions';

export type Triage = 'Ignore' | 'Watch' | 'Surface' | 'Investigate' | 'Recommend';

export type Evidence = { supports: string[]; notEstablished: string[]; alternatives: string[] };

type Candidate = {
  id: string;
  title: string;
  // One sentence or a few, written to sit inside the daily brief.
  brief: string;
  domains: Domain[];
  evidence: Evidence;
  // How many separate times the relationship has been seen.
  recurrence: number;
  // 0 to 1: how far from usual.
  magnitude: number;
  ongoing: boolean;
  // A single measure that has stayed changed for days counts even without
  // repeats.
  sustained?: boolean;
  // Several areas changing together, or a result outside its range again.
  investigate?: boolean;
  // Insights this one already tells, so the brief doesn't repeat them.
  covers?: string[];
  action?: 'walk';
};

export type Insight = Candidate & { triage: Triage; score: number };

export type Intervention = { id: string; kind: 'walk'; date: string };

type Draw = { date: string; results: { name: string; value: string; range: string }[] };

export type EngineInput = {
  days: Day[];
  episodes: Episode[];
  windows: CycleWindow[];
  summaries: CycleSummary[];
  signals: Signal[];
  cycleObservations: Observation[];
  draws: Draw[];
  interventions: Intervention[];
  watching: Record<string, boolean>;
  // Used when nothing is ready to surface.
  opening: string;
  now?: Date;
};

export type Band = { usual: number; low: number; high: number };

export type MovementSummary = {
  steps: { recent: number; usual: number };
  active: { recent: number; usual: number };
  workouts: { recent: number; usual: number };
  series: { date: string; steps: number }[];
  band: Band;
};

export type Brief = { text: string; lead: Insight | null; recommendation: Insight | null; walkPlanned: boolean };

export type Insights = { ranked: Insight[]; today: Brief; movement: MovementSummary };

// ── Small helpers ──────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const word = (n: number) => WORDS[n] ?? String(n);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const nums = (xs: (number | null)[]) => xs.filter((v): v is number => v != null);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

export const fmtCount = (n: number) => Math.round(n).toLocaleString('en-US');

const spanText = (days: number) => (days >= 14 && days % 7 === 0 ? `${word(days / 7)} weeks` : `${word(days)} days`);

// Usual range: the median, widened by the spread of values (MAD), and never
// narrower than 8% either side.
function band(xs: number[]): Band {
  const usual = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - usual)));
  const spread = Math.max(1.5 * 1.4826 * mad, 0.08 * Math.abs(usual));
  return { usual, low: usual - spread, high: usual + spread };
}

// The baseline is days 35 to 90 back, so a recent change can't hide itself
// by becoming part of what's usual.
const baselineDays = (days: Day[]) => days.slice(Math.max(0, days.length - 91), days.length - 35);

type Change = { streak: number; recent: number; usual: Band; direction: 'lower' | 'higher' };

// How many of the most recent days sit outside the usual range on the same
// side, allowing one day back inside.
function sustained(days: Day[], get: (d: Day) => number | null): Change | null {
  const base = nums(baselineDays(days).map(get));
  if (base.length < 20) return null;
  const b = band(base);
  const side = (v: number) => (v < b.low ? 'lower' : v > b.high ? 'higher' : null);
  let direction: 'lower' | 'higher' | null = null;
  let streak = 0;
  let pending = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const v = get(days[i]);
    if (v == null) continue;
    const s = side(v);
    if (!direction) {
      if (!s) break;
      direction = s;
      streak = 1;
      continue;
    }
    if (s === direction) {
      streak += 1 + pending;
      pending = 0;
    } else if (pending === 0) pending = 1;
    else break;
  }
  if (!direction) return null;
  return { streak, recent: mean(nums(days.slice(-streak).map(get))), usual: b, direction };
}

// ── Single measures that have changed ──────────────────────────

function sleepChange(c: Change | null): Candidate | null {
  if (!c || c.direction !== 'lower' || c.streak < 5) return null;
  return {
    id: 'sleepLow',
    title: 'Sleep lower than usual',
    brief: `Your sleep has been lower than usual for the last ${spanText(c.streak)}, averaging ${fmtHours(c.recent)} against your usual ${fmtHours(c.usual.usual)}.`,
    domains: ['Sleep'],
    evidence: {
      supports: [`${c.streak} nights below your usual range`, `Average ${fmtHours(c.recent)}; your usual is ${fmtHours(c.usual.usual)}`],
      notEstablished: ['It doesn’t show why your sleep changed.'],
      alternatives: ['Stress, pain, travel, caffeine, or a change in schedule can all shorten sleep.'],
    },
    recurrence: c.streak,
    magnitude: clamp(((c.usual.usual - c.recent) / c.usual.usual) * 4),
    ongoing: true,
    sustained: true,
  };
}

function activityChange(c: Change | null): Candidate | null {
  if (!c || c.direction !== 'lower' || c.streak < 7) return null;
  const below = Math.round((1 - c.recent / c.usual.usual) * 100);
  return {
    id: 'activityLow',
    title: 'Activity lower than usual',
    brief: `Your activity has been lower than usual for the last ${spanText(c.streak)}, about ${below}% below your usual ${fmtCount(c.usual.usual)} steps a day.`,
    domains: ['Movement'],
    evidence: {
      supports: [`${c.streak} days below your usual range`, `Average ${fmtCount(c.recent)} steps; your usual is ${fmtCount(c.usual.usual)}`],
      notEstablished: ['It doesn’t show why your activity dropped.'],
      alternatives: ['Pain, fatigue, weather, or a busy stretch can all lower activity.'],
    },
    recurrence: c.streak,
    magnitude: clamp(below / 50),
    ongoing: true,
    sustained: true,
  };
}

function restingHeartRate(c: Change | null): Candidate | null {
  if (!c || c.direction !== 'higher' || c.streak < 3) return null;
  return {
    id: 'rhrHigh',
    title: 'Resting heart rate above usual',
    brief: `Your resting heart rate has stayed above your usual range for ${word(c.streak)} days, around ${Math.round(c.recent)} bpm against your usual ${Math.round(c.usual.usual)}.`,
    domains: ['Recovery'],
    evidence: {
      supports: [`${c.streak} days above your usual range`, `Around ${Math.round(c.recent)} bpm; your usual is ${Math.round(c.usual.usual)} bpm`],
      notEstablished: ['A few days above range doesn’t point to any one cause.'],
      alternatives: ['Short sleep, stress, illness, alcohol, or hard training can all raise resting heart rate.'],
    },
    recurrence: c.streak,
    magnitude: clamp(((c.recent - c.usual.usual) / c.usual.usual) * 8),
    ongoing: true,
    sustained: true,
  };
}

function stressChange(days: Day[]): Candidate | null {
  const recent = nums(days.slice(-14).map((d) => d.stress));
  const usual = nums(baselineDays(days).map((d) => d.stress));
  if (recent.length < 7 || usual.length < 20 || mean(recent) - mean(usual) < 1) return null;
  return {
    id: 'stressHigh',
    title: 'Stress higher than usual',
    brief: `You’ve logged higher stress than usual over the last two weeks, ${mean(recent).toFixed(1)} of 5 against your usual ${mean(usual).toFixed(1)}.`,
    domains: ['Stress'],
    evidence: {
      supports: [`Average ${mean(recent).toFixed(1)} of 5 over 14 days`, `Your usual is ${mean(usual).toFixed(1)} of 5`],
      notEstablished: ['It doesn’t show what is behind it.'],
      alternatives: ['Work, sleep, pain, or life events can all raise stress.'],
    },
    recurrence: recent.length,
    magnitude: clamp((mean(recent) - mean(usual)) / 2),
    ongoing: true,
    sustained: true,
  };
}

// ── Relationships across areas ─────────────────────────────────

function fatigueAfterShortSleep(days: Day[]): Candidate | null {
  let short = 0;
  let shortTired = 0;
  let full = 0;
  let fullTired = 0;
  let lastShort = -1;
  for (let i = 0; i < days.length - 1; i++) {
    const e = days[i + 1].energy;
    if (e == null) continue;
    const s = days[i].sleepHours;
    if (s < 6) {
      short++;
      if (e <= 2) shortTired++;
      lastShort = i;
    } else if (s >= 6.5) {
      full++;
      if (e <= 2) fullTired++;
    }
  }
  const rateShort = short ? shortTired / short : 0;
  const rateFull = full ? fullTired / full : 0;
  if (shortTired < 3 || rateShort < 2 * rateFull + 0.1) return null;
  return {
    id: 'fatigueShortSleep',
    title: 'Fatigue after short nights',
    brief: `You’ve had more fatigue on days following less than six hours of sleep: your energy was low the next day after ${shortTired} of ${short} short nights, compared with ${pct(rateFull)} of days after a full night.`,
    domains: ['Sleep', 'Energy'],
    evidence: {
      supports: [
        `Low energy after ${shortTired} of ${short} nights under six hours`,
        `Low energy after ${pct(rateFull)} of nights over six and a half hours`,
      ],
      notEstablished: ['It doesn’t show that short sleep causes the fatigue; both could share another cause.'],
      alternatives: ['Pain or stress on the same nights could explain both.'],
    },
    recurrence: shortTired,
    magnitude: clamp(rateShort - rateFull),
    ongoing: lastShort >= days.length - 8,
  };
}

function activityAndWeeks(days: Day[]): Candidate[] {
  const weeks: Day[][] = [];
  for (let end = days.length; end - 7 >= 0; end -= 7) weeks.unshift(days.slice(end - 7, end));
  if (weeks.length < 9) return [];
  const rows = weeks
    .map((w) => ({ steps: mean(w.map((d) => d.steps)), energy: mean(nums(w.map((d) => d.energy))), sleep: mean(w.map((d) => d.sleepHours)) }))
    .sort((a, b) => b.steps - a.steps);
  const k = Math.floor(rows.length / 3);
  const top = rows.slice(0, k);
  const bottom = rows.slice(-k);
  const out: Candidate[] = [];

  const eTop = mean(top.map((r) => r.energy));
  const eBottom = mean(bottom.map((r) => r.energy));
  if (eTop - eBottom >= 0.4) {
    out.push({
      id: 'activityEnergy',
      title: 'Energy and activity',
      brief: `Your reported energy was higher during weeks when your activity was higher, about ${eTop.toFixed(1)} of 5 against ${eBottom.toFixed(1)} in your least active weeks.`,
      domains: ['Movement', 'Energy'],
      evidence: {
        supports: [`Your ${k} most active weeks averaged ${eTop.toFixed(1)} of 5 for energy`, `Your ${k} least active weeks averaged ${eBottom.toFixed(1)} of 5`],
        notEstablished: ['It doesn’t show which came first; more energy can lead to more activity too.'],
        alternatives: ['Stressful or unwell weeks can lower both.'],
      },
      recurrence: k,
      magnitude: clamp((eTop - eBottom) / 1.5),
      ongoing: false,
    });
  }

  const sTop = mean(top.map((r) => r.sleep));
  const sBottom = mean(bottom.map((r) => r.sleep));
  if (sTop - sBottom >= 0.25) {
    out.push({
      id: 'activitySleep',
      title: 'Sleep and activity',
      brief: `Your sleep was better during weeks when your activity was higher, ${fmtHours(sTop)} against ${fmtHours(sBottom)} in your least active weeks.`,
      domains: ['Movement', 'Sleep'],
      evidence: {
        supports: [`Your ${k} most active weeks averaged ${fmtHours(sTop)} of sleep`, `Your ${k} least active weeks averaged ${fmtHours(sBottom)}`],
        notEstablished: ['It doesn’t show whether activity helped sleep or better sleep made activity easier.'],
        alternatives: ['A calmer week can mean both more movement and more sleep.'],
      },
      recurrence: k,
      magnitude: clamp((sTop - sBottom) / 1.2),
      ongoing: false,
    });
  }
  return out;
}

function hardWorkoutsAndPelvicPain(days: Day[], episodes: Episode[]): Candidate | null {
  const pelvic = new Set(
    episodes.filter((e) => e.kinds.includes('Pain') && e.locations.some((l) => l.toLowerCase().includes('pelvi'))).map((e) => e.date),
  );
  const hard = days.filter((d) => d.workouts.some((w) => w.intensity === 'High'));
  const followed = hard.filter((d) => pelvic.has(isoDay(addDays(parseDay(d.date), 1))));
  if (followed.length < 2) return null;
  return {
    id: 'hardWorkoutPelvic',
    title: 'Pelvic pain after hard workouts',
    brief: `You reported pelvic pain on ${word(followed.length)} days following higher intensity workouts.`,
    domains: ['Movement', 'Pain'],
    evidence: {
      supports: followed.map((d) => `Hard workout on ${shortDate(parseDay(d.date))}, pelvic pain the next day`),
      notEstablished: [`${followed.length} occasions can’t separate the workouts from where you were in your cycle.`],
      alternatives: ['Both happened in the days around your period, when pain is already more common for you.'],
    },
    recurrence: followed.length,
    magnitude: 0.5,
    ongoing: false,
  };
}

function foodAndBloating(days: Day[]): Candidate[] {
  const out: Candidate[] = [];
  const bloated = (d: Day) => d.digestion.includes('Bloating');
  for (const { label } of tally(days.map((d) => d.foods))) {
    const withFood = days.filter((d) => d.foods.includes(label));
    const hits = withFood.filter(bloated).length;
    const others = days.filter((d) => !d.foods.includes(label));
    const otherRate = others.length ? others.filter(bloated).length / others.length : 0;
    if (hits < 3 || hits / withFood.length < 2 * otherRate + 0.2) continue;
    const food = label.toLowerCase();
    out.push({
      id: `food:${label}`,
      title: `Bloating after ${food}`,
      brief: `You’ve reported bloating after meals with ${food} ${word(hits)} times, on ${hits} of the ${withFood.length} days you noted it.`,
      domains: ['Nutrition', 'Digestion'],
      evidence: {
        supports: [`Bloating on ${hits} of ${withFood.length} days with ${food}`, `Bloating on ${pct(otherRate)} of other days`],
        notEstablished: [`It doesn’t show that ${food} causes the bloating; these are days you noted both.`],
        alternatives: ['Where you are in your cycle can affect bloating too.'],
      },
      recurrence: hits,
      magnitude: 0.5,
      ongoing: days.slice(-30).some((d) => d.foods.includes(label) && bloated(d)),
    });
  }
  return out;
}

function biomarkers(draws: Draw[]): Candidate[] {
  const series = new Map<string, { date: string; value: number; unit: string; low: number; high: number }[]>();
  for (const draw of [...draws].reverse()) {
    for (const r of draw.results) {
      const value = parseFloat(r.value);
      const [low, high] = r.range.split(' to ').map(Number);
      if (Number.isNaN(value) || Number.isNaN(low)) continue;
      const list = series.get(r.name) ?? [];
      list.push({ date: draw.date, value, unit: r.value.replace(/^[\d.,]+\s*/, ''), low, high });
      series.set(r.name, list);
    }
  }
  const out: Candidate[] = [];
  for (const [name, list] of series) {
    if (list.length < 2 || !list.every((x) => x.value < x.low)) continue;
    const unit = list[0].unit;
    out.push({
      id: `bio:${name}`,
      title: `${name} below range`,
      brief: `${name} has been below its reference range on your last ${word(list.length)} tests, ${list.map((x) => x.value).join(' then ')} ${unit}.`,
      domains: ['Biomarkers'],
      evidence: {
        supports: list.map((x) => `${x.date}: ${x.value} ${unit}, range ${x.low} to ${x.high}`),
        notEstablished: ['Two results can show a direction, not a trend.', 'A result below range doesn’t on its own point to a condition.'],
        alternatives: ['Season, time of day, and supplement timing can all shift this result.'],
      },
      recurrence: list.length,
      magnitude: 0.6,
      ongoing: true,
      investigate: true,
    });
  }
  return out;
}

function cyclePatterns(found: Observation[]): Candidate[] {
  const meta: Record<Observation['id'], { title: string; domains: Domain[]; recurrence: number }> = {
    beforePeriod: { title: 'Pain before your period', domains: ['Pain', 'Cycle'], recurrence: 4 },
    flareSleep: { title: 'Flare ups and disrupted sleep', domains: ['Flare ups', 'Sleep'], recurrence: 3 },
    duration: { title: 'Pain lasting longer', domains: ['Pain'], recurrence: 3 },
    bowelPain: { title: 'Pain with bowel movements', domains: ['Pain', 'Cycle'], recurrence: 3 },
  };
  return found.map((o) => ({
    id: o.id,
    title: meta[o.id].title,
    brief: o.brief,
    domains: meta[o.id].domains,
    evidence: {
      supports: [o.text, o.detail, o.context].filter((x): x is string => !!x),
      notEstablished: ['It doesn’t explain why this is happening.'],
      alternatives: ['Changes in routine, treatment, or other symptoms could play a part.'],
    },
    recurrence: meta[o.id].recurrence,
    magnitude: 0.6,
    ongoing: true,
  }));
}

// ── Several changes told as one story ──────────────────────────

function combined(input: EngineInput, sleep: Change | null, steps: Change | null, now: Date): Candidate | null {
  const { days, windows, signals } = input;
  const done = windows.filter((w) => w.length != null && w.end);
  const last = done[done.length - 1];
  if (!last || !sleep || !steps || sleep.direction !== 'lower' || steps.direction !== 'lower') return null;
  if (sleep.streak < 5 || steps.streak < 5 || last.length !== Math.min(...done.map((w) => w.length!))) return null;

  const span = Math.min(sleep.streak, steps.streak);
  const stretchStart = addDays(startOfDay(now), -(span - 1));
  if (stretchStart >= last.end!) return null;

  const recent = days.slice(-span);
  const usualStress = mean(nums(baselineDays(days).map((d) => d.stress)));
  const recentStress = mean(nums(recent.map((d) => d.stress)));
  const higherStress = recentStress - usualStress >= 1;
  const tired = recent.filter((d) => d.energy != null && d.energy <= 2).length;
  const note = recent.find((d) => d.note)?.note;
  const locs = tally(signals.filter((s) => s.pain && s.date >= stretchStart).map((s) => s.episode.locations))
    .slice(0, 2)
    .map((x) => x.label.toLowerCase());
  const sleepAvg = mean(recent.map((d) => d.sleepHours));
  const stepsAvg = mean(recent.map((d) => d.steps));
  const below = Math.round((1 - stepsAvg / steps.usual.usual) * 100);

  // Earlier cycles whose final week carried the same combination.
  const byDate = new Map(days.map((d) => [d.date, d]));
  const matches = done.slice(0, -1).filter((w) => {
    const week = Array.from({ length: 7 }, (_, k) => byDate.get(isoDay(addDays(w.end!, -(k + 1))))).filter((d): d is Day => !!d);
    if (week.length < 5) return false;
    return (
      mean(week.map((d) => d.sleepHours)) < sleep.usual.low &&
      mean(week.map((d) => d.steps)) < steps.usual.low &&
      mean(nums(week.map((d) => d.stress))) >= usualStress + 1
    );
  });

  const also = [higherStress ? 'higher stress' : null, tired >= 3 ? 'fatigue' : null].filter((x): x is string => !!x);
  const painText = locs.length ? `pain in your ${locs.join(' and ')}` : '';
  const alsoText = also.length
    ? ` You also reported ${also.join(' and ')} during that period${painText ? `, along with ${painText}` : ''}.`
    : painText
      ? ` You also reported ${painText} during that period.`
      : '';
  const earlierText =
    matches.length === 0
      ? ' This combination hasn’t appeared in your earlier cycles.'
      : matches.length === 1
        ? ` A similar combination appeared once before, in early ${MONTHS[addDays(matches[0].end!, -7).getMonth()]}.`
        : ` A similar combination has appeared ${word(matches.length)} times before.`;
  const when = last.start.getFullYear() === now.getFullYear() ? 'this year' : 'recently';

  const domains: Domain[] = ['Cycle', 'Sleep', 'Movement'];
  if (higherStress) domains.push('Stress');
  if (tired >= 3) domains.push('Energy');
  if (locs.length) domains.push('Pain');

  return {
    id: 'combined',
    title: 'Several changes at once',
    brief: `Your shortest cycle ${when}, ${last.length} days, ended during a stretch when your sleep and activity were both lower than usual. Over the last ${spanText(span)}, your sleep has averaged ${fmtHours(sleepAvg)} against your usual ${fmtHours(sleep.usual.usual)}, and your activity has run about ${below}% below your usual.${alsoText}${earlierText}`,
    domains,
    evidence: {
      supports: [
        `Cycle length ${last.length} days, the shortest of your last ${done.length}`,
        `Sleep averaged ${fmtHours(sleepAvg)} over ${span} days; your usual is ${fmtHours(sleep.usual.usual)}`,
        `Steps averaged ${fmtCount(stepsAvg)} a day; your usual is ${fmtCount(steps.usual.usual)}`,
        ...(higherStress ? [`Stress averaged ${recentStress.toFixed(1)} of 5; usually ${usualStress.toFixed(1)}`] : []),
        ...(tired >= 3 ? [`Low energy on ${tired} of ${span} days`] : []),
        ...(note ? [`You wrote “${note}”`] : []),
        ...(painText ? [`You reported ${painText}`] : []),
        ...matches.map((w) => `The same combination in the final week of the cycle that ended ${shortDate(w.end!)}`),
      ],
      notEstablished: [
        'It doesn’t show that lower sleep or activity shortened your cycle.',
        matches.length < 2 ? 'One earlier match isn’t enough to call this a recurring pattern.' : 'Changes that recur together still don’t show which came first.',
      ],
      alternatives: [
        'A busy or stressful stretch can lower sleep and activity at the same time.',
        'Illness, travel, or a change in routine can shift several of these at once.',
      ],
    },
    recurrence: matches.length + 1,
    magnitude: 0.8,
    ongoing: true,
    investigate: true,
    covers: ['sleepLow', 'activityLow', 'stressHigh'],
  };
}

// The last few completed cycles with the sleep of their final week, the pair
// Today's chart draws. Sleep is null when that week has no nights recorded.
export type CyclePoint = { start: Date; length: number; sleep: number | null };

export function cycleTrend(windows: CycleWindow[], days: Day[], n = 4): CyclePoint[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return windows
    .filter((w) => w.length != null && w.end)
    .slice(-n)
    .map((w) => {
      const week = Array.from({ length: 7 }, (_, k) => byDate.get(isoDay(addDays(w.end!, -(k + 1))))).filter((d): d is Day => !!d);
      return { start: w.start, length: w.length!, sleep: week.length ? mean(week.map((d) => d.sleepHours)) : null };
    });
}

// ── Actions and what happened after ────────────────────────────

function walkOutcomes(days: Day[], interventions: Intervention[]): Candidate | null {
  const index = new Map(days.map((d, i) => [d.date, i]));
  const results = interventions
    .filter((v) => v.kind === 'walk')
    .map((v) => {
      const i = index.get(v.date);
      if (i == null || i < 3 || i + 3 > days.length) return null;
      const before = days.slice(i - 3, i);
      const after = days.slice(i, i + 3);
      return {
        date: v.date,
        steps: mean(after.map((d) => d.steps)) / mean(before.map((d) => d.steps)) - 1,
        energy: mean(nums(after.map((d) => d.energy))) - mean(nums(before.map((d) => d.energy))),
      };
    })
    .filter((x): x is { date: string; steps: number; energy: number } => !!x && x.steps > 0.1);
  if (!results.length) return null;
  const last = results[results.length - 1];
  return {
    id: 'walkOutcome',
    title: 'After your planned walks',
    brief: `After you planned a short walk on ${shortDate(parseDay(last.date))}, your steps rose about ${pct(last.steps)} and your reported energy was ${last.energy >= 0.5 ? 'higher' : 'about the same'} over the next three days.`,
    domains: ['Movement', 'Energy', 'Interventions'],
    evidence: {
      supports: results.map((r) => `${shortDate(parseDay(r.date))}: steps up ${pct(r.steps)}, energy ${r.energy >= 0 ? 'up' : 'down'} ${Math.abs(r.energy).toFixed(1)} of 5`),
      notEstablished: [results.length < 2 ? 'One walk can’t show that walking lifts your energy.' : 'A few walks still can’t show that walking lifts your energy.'],
      alternatives: ['Energy often recovers on its own after a low stretch.'],
    },
    recurrence: results.length,
    magnitude: 0.4,
    ongoing: false,
  };
}

function walkSuggestion(days: Day[], steps: Change | null, signals: Signal[], now: Date): Candidate | null {
  const energy = mean(nums(days.slice(-7).map((d) => d.energy)));
  const inPain = signals.some((s) => s.pain && (s.episode.severity ?? 0) >= 8 && daysBetween(s.date, now) <= 2);
  if (!steps || steps.direction !== 'lower' || steps.streak < 7 || energy > 2.8 || inPain) return null;
  return {
    id: 'walk',
    title: 'A short walk today',
    brief: 'If it feels appropriate, a short walk today could be worth trying, and the next few days will show whether your energy or sleep follow.',
    domains: ['Movement', 'Energy', 'Interventions'],
    evidence: {
      supports: [`Activity below your usual for ${steps.streak} days`, `Energy averaged ${energy.toFixed(1)} of 5 over the last week`],
      notEstablished: ['It isn’t known yet whether walking changes your energy; that is what the next few days will show.'],
      alternatives: ['If you’re in pain or unwell, rest may be the better choice.'],
    },
    recurrence: 1,
    magnitude: 0.4,
    ongoing: true,
    action: 'walk',
  };
}

// ── Triage and ranking ─────────────────────────────────────────

function scoreOf(c: Candidate): number {
  return (
    0.35 * c.magnitude +
    0.3 * Math.min(c.recurrence / 5, 1) +
    0.2 * (c.ongoing ? 1 : 0.3) +
    0.15 * Math.min(c.domains.length / 4, 1)
  );
}

function triageOf(c: Candidate, score: number, watching: Record<string, boolean>): Triage {
  if (watching[c.id] === false) return 'Ignore';
  if (c.action) return 'Recommend';
  if (score < 0.25) return 'Ignore';
  if (c.investigate) return 'Investigate';
  if (c.recurrence < 3 && !c.sustained) return 'Watch';
  return score >= 0.45 ? 'Surface' : 'Watch';
}

function movementSummary(days: Day[]): MovementSummary {
  const base = baselineDays(days);
  const last7 = days.slice(-7);
  const b = band(base.map((d) => d.steps));
  return {
    steps: { recent: mean(last7.map((d) => d.steps)), usual: b.usual },
    active: { recent: mean(last7.map((d) => d.activeMinutes)), usual: median(base.map((d) => d.activeMinutes)) },
    workouts: {
      recent: last7.reduce((n, d) => n + d.workouts.length, 0),
      usual: base.reduce((n, d) => n + d.workouts.length, 0) / (base.length / 7),
    },
    series: days.slice(-28).map((d) => ({ date: d.date, steps: d.steps })),
    band: b,
  };
}

export function buildInsights(input: EngineInput): Insights {
  const now = input.now ?? new Date();
  const { days, episodes, signals, watching, interventions } = input;
  const sleep = sustained(days, (d) => d.sleepHours);
  const steps = sustained(days, (d) => d.steps);
  const rhr = sustained(days, (d) => d.restingHR);

  const candidates = [
    combined(input, sleep, steps, now),
    sleepChange(sleep),
    activityChange(steps),
    restingHeartRate(rhr),
    stressChange(days),
    fatigueAfterShortSleep(days),
    ...activityAndWeeks(days),
    hardWorkoutsAndPelvicPain(days, episodes),
    ...foodAndBloating(days),
    ...biomarkers(input.draws),
    ...cyclePatterns(input.cycleObservations),
    walkOutcomes(days, interventions),
    walkSuggestion(days, steps, signals, now),
  ].filter((c): c is Candidate => !!c);

  const ranked: Insight[] = candidates
    .map((c) => {
      const score = scoreOf(c);
      return { ...c, score, triage: triageOf(c, score, watching) };
    })
    .sort((a, b) => b.score - a.score);

  // Today: the combined story if there is one, then the two strongest other
  // patterns it doesn't already tell, then any suggestion.
  const visible = ranked.filter((i) => i.triage === 'Surface' || i.triage === 'Investigate');
  const lead = visible.find((i) => i.id === 'combined') ?? visible[0] ?? null;
  const told = new Set([lead?.id, ...(lead?.covers ?? [])]);
  const rest = visible.filter((i) => !told.has(i.id)).slice(0, 2);
  const recommendation = ranked.find((i) => i.triage === 'Recommend') ?? null;
  const walkPlanned = interventions.some((v) => v.kind === 'walk' && v.date === isoDay(now));
  // Only what Today actually tells counts as surfaced; everything else that
  // qualified keeps being watched rather than competing for attention.
  const onToday = new Set([...told, ...rest.map((i) => i.id)]);
  const final: Insight[] = ranked.map((i) => (i.triage === 'Surface' && !onToday.has(i.id) ? { ...i, triage: 'Watch' } : i));

  const parts = lead ? [lead.brief, ...rest.map((i) => i.brief)] : [input.opening];
  if (recommendation) {
    parts.push(
      walkPlanned
        ? 'You planned a short walk today, and the next few days will show whether your energy or sleep follow.'
        : recommendation.brief,
    );
  }
  if (lead) parts.push('Still watching whether these changes keep happening together.');

  return {
    ranked: final,
    today: { text: parts.join(' '), lead, recommendation, walkPlanned },
    movement: movementSummary(days),
  };
}
