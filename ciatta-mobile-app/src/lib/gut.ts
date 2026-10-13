// The gut, in and out, as the standard measures read it.
//
// Out is bowel movements by the Bristol Stool Form Scale (Lewis and
// Heaton, 1997): types 1 and 2 are hard, 3 and 4 typical, 5 to 7 loose. A
// movement is placed by its day and type, the mix is counted, and how often
// is said against the common reference of three a week to three a day.
// Pain, urgency, straining and a sense of incomplete emptying are counted
// as she logged them; blood is counted on its own, because it is the one
// the screen says is worth raising.
//
// In is when she ate: meals by weekday and time window over four weeks, as
// a grid, with meals a day and the usual time of the last one.
//
// Everything is from what she logged, so a movement she did not log is not
// here, and the screen says the figures are from her logs.

export type BristolGroup = 'hard' | 'typical' | 'loose';
export const bristolGroup = (type: number): BristolGroup => (type <= 2 ? 'hard' : type <= 4 ? 'typical' : 'loose');

const SPAN = 28;
const BOWEL = 'Bowel movement';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lastDays = (now: Date) => Array.from({ length: SPAN }, (_, n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SPAN - 1 - n))));
const round1 = (n: number) => String(Math.round(n * 10) / 10);

type EpisodeLike = { date: string; kinds: string[]; stool: number | null; bowelPain: string | null; bowelFlags: string[] };
type DayLike = { date: string; digestion?: string[] };

export type GutOut = {
  days: string[];
  // Per day, the types of each movement that day (null where unrated).
  types: (number | null)[][];
  counts: number[];
  count: number;
  mix: Record<BristolGroup | 'unrated', number>;
  perDay: string | null;
  pain: number;
  flags: { name: string; count: number }[];
  blood: number;
  symptoms: { name: string; days: number }[];
};

export function gutOut(input: { episodes: readonly EpisodeLike[]; days: readonly DayLike[]; now: Date }): GutOut {
  const days = lastDays(input.now);
  const moves = input.episodes.filter((e) => (e.kinds.includes(BOWEL) || e.stool != null) && days.includes(e.date));
  const types = days.map((d) => moves.filter((m) => m.date === d).map((m) => m.stool));
  const mix = { hard: 0, typical: 0, loose: 0, unrated: 0 };
  for (const m of moves) mix[m.stool == null ? 'unrated' : bristolGroup(m.stool)] += 1;
  const rate = moves.length / SPAN;
  const flagCount = (name: string) => moves.filter((m) => m.bowelFlags.includes(name)).length;
  const flags = ['Urgency', 'Straining', 'Felt incomplete'].map((name) => ({ name, count: flagCount(name) })).filter((f) => f.count);
  const tally = new Map<string, number>();
  for (const d of input.days) if (days.includes(d.date)) for (const s of new Set(d.digestion ?? [])) tally.set(s, (tally.get(s) ?? 0) + 1);
  return {
    days,
    types,
    counts: types.map((t) => t.length),
    count: moves.length,
    mix,
    perDay: moves.length ? (rate >= 1 ? `${round1(rate)} a day` : `${round1(rate * 7)} a week`) : null,
    pain: moves.filter((m) => m.bowelPain && m.bowelPain !== 'None').length,
    flags,
    blood: flagCount('Blood'),
    symptoms: [...tally].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, days: n })),
  };
}

export type GutIn = {
  windows: string[];
  weekdays: string[];
  // grid[window][weekday], Monday first.
  grid: number[][];
  count: number;
  perDay: string | null;
  lastMeal: string | null;
};

const WINDOWS: [number, number][] = [[6, 11], [11, 15], [15, 19], [19, 24]];

export function gutIn(input: { meals: readonly { eatenAt: string }[]; now: Date }): GutIn {
  const days = lastDays(input.now);
  const meals = input.meals.map((m) => new Date(m.eatenAt)).filter((d) => days.includes(iso(d)));
  const grid = WINDOWS.map(() => Array(7).fill(0) as number[]);
  for (const d of meals) {
    const h = d.getHours();
    const w = WINDOWS.findIndex(([a, b]) => h >= a && h < b);
    if (w >= 0) grid[w][(d.getDay() + 6) % 7] += 1;
  }
  const byDay = new Map<string, Date[]>();
  for (const d of meals) byDay.set(iso(d), [...(byDay.get(iso(d)) ?? []), d]);
  const lasts = [...byDay.values()].map((list) => Math.max(...list.map((d) => d.getHours() * 60 + d.getMinutes())));
  let lastMeal: string | null = null;
  if (lasts.length) {
    const m = Math.round(lasts.reduce((a, b) => a + b, 0) / lasts.length);
    const h = Math.floor(m / 60);
    lastMeal = `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }
  return {
    windows: WINDOWS.map(([a, b]) => `${a} to ${b}`),
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    grid,
    count: meals.length,
    perDay: byDay.size ? `${round1(meals.length / byDay.size)} a day` : null,
    lastMeal,
  };
}
