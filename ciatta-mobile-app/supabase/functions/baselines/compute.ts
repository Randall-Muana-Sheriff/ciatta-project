// Pure maths for personal baselines and change detection: what is usual
// for one metric from her own history, and whether the most recent days
// have moved away from it, sustained. No Deno or Supabase imports here on
// purpose: this file is plain TypeScript so a Node test can exercise it
// directly, and the edge function (Deno) imports it with a relative path.
//
// median() and band() reproduce src/lib/engine.ts's own median()/band()
// (around lines 98-121) verbatim: that is the code the screens already run
// to show "what is usual", so if this file and the engine ever disagree,
// the engine is the reference. They are copied rather than imported
// because engine.ts's median()/band() were private module helpers (now
// exported there only so src/data/baselines.test.ts can assert this copy
// produces the same numbers for the same input) and because engine.ts's
// window/run helpers, baselineDays() and sustained(), are hard typed to
// its own Day[] plus a getter closure, not reusable for a sparse per
// metric value array the way daily_metrics reads. Reshaping engine.ts's
// module boundary to fit one caller would ripple into the screens that
// depend on it, so baselineWindow() and detectRun() below reproduce the
// same windowing and streak/pending algorithm generically over a plain
// (number | null)[], one entry per calendar day, oldest first, with today
// last.

export type Band = { median: number; low: number; high: number; mad: number };

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Usual range: the median, widened by the spread of values (MAD), and
// never narrower than 8% either side, exactly as src/lib/engine.ts band()
// does. `mad` (the median absolute deviation) is carried alongside the
// widened low/high because it is the number `baselines.variability`
// stores: low and high already encode the widened spread, and the 8%
// floor on that spread can't be inverted back to the MAD once it binds, so
// the MAD is the primitive we'd otherwise lose.
export function band(xs: number[]): Band {
  const med = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - med)));
  const spread = Math.max(1.5 * 1.4826 * mad, 0.08 * Math.abs(med));
  return { median: med, low: med - spread, high: med + spread, mad };
}

// One entry per calendar day for `size` days ending at `today` (today
// included, oldest first), reading `byDay` for each day and leaving a day
// with no entry as null rather than skipping it -- skipping would shift
// every later index's calendar meaning, which is exactly what the window
// arithmetic below depends on staying stable.
const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildDenseWindow(
  byDay: Map<string, number>,
  today: Date,
  size: number
): { dates: string[]; values: (number | null)[] } {
  const dates: string[] = [];
  const values: (number | null)[] = [];
  const start = new Date(today.getTime() - (size - 1) * DAY_MS);
  for (let i = 0; i < size; i++) {
    const day = isoDay(new Date(start.getTime() + i * DAY_MS));
    dates.push(day);
    values.push(byDay.has(day) ? byDay.get(day)! : null);
  }
  return { dates, values };
}

// The full window this function fetches: today plus 90 days back, which is
// exactly enough to hold both the baseline window (35 to 90 days back) and
// the recent window (0 to 34 days back) it is compared against.
export const WINDOW_SIZE = 91;
// Stored on both baselines and changes rows as the size of history a
// baseline rests on. There is only ever one window in this slice; the
// column exists so a future window size doesn't collide with this one.
export const WINDOW_DAYS = 90;
export const MIN_BASELINE_N = 20;
export const MIN_RUN_STREAK = 5;

export const METRICS = ['sleep_hours', 'steps', 'resting_hr', 'hrv', 'active_minutes'] as const;
export type Metric = (typeof METRICS)[number];

// Baseline window: days 35 to 90 back from today, exactly as
// src/lib/engine.ts baselineDays() slices a Day[]
// (`days.slice(days.length - 91, days.length - 35)`). `values` here is one
// entry per calendar day, oldest first, with today last, so the same slice
// arithmetic applies to a single metric's numbers.
export function baselineWindow<T>(values: T[]): T[] {
  return values.slice(Math.max(0, values.length - 91), values.length - 35);
}

// The complement of baselineWindow within the same fetched window: the 35
// most recent days (today back through 34 days ago), which is what a
// change is measured against and where temp_deviation is written.
export function recentWindow<T>(values: T[]): T[] {
  return values.slice(Math.max(0, values.length - 35));
}

export type Run = { streak: number; direction: 'lower' | 'higher'; recent: number; firstIndex: number; endIndex: number };

// The most recent run of days sitting outside the band on the same side,
// allowing a single day back inside without breaking it. This reproduces
// src/lib/engine.ts sustained()'s streak/pending loop verbatim, adapted
// from a Day[] plus getter closure to a plain per metric value array: a
// null day is skipped in place (it neither extends nor breaks a run,
// matching `if (v == null) continue;`), one day back inside the band is
// tolerated (`pending`), and a second one in a row ends the run.
//
// `endIndex` is the last (most recent) index in the whole array that
// carries a value, which is always the very first non-null value this
// loop finds scanning backward from today -- everything after it was
// skipped as null on the way in. It's tracked separately from `firstIndex`
// because a review of a live run caught runQuality() (below) measuring the
// run's span all the way to `values.length - 1` (calendar today), even
// when today has no daily_metrics row yet because the day isn't over: that
// trailing, not-yet-measured null was being counted as missing evidence,
// understating quality for every complete run until the day ended.
// `endIndex` lets the caller measure the span against the last day that
// actually has a value instead.
export function detectRun(values: (number | null)[], b: Band): Run | null {
  const side = (v: number): 'lower' | 'higher' | null => (v < b.low ? 'lower' : v > b.high ? 'higher' : null);
  let direction: 'lower' | 'higher' | null = null;
  let streak = 0;
  let pending = 0;
  let firstIndex = -1;
  let endIndex = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v == null) continue;
    if (endIndex === -1) endIndex = i;
    const s = side(v);
    if (!direction) {
      if (!s) break;
      direction = s;
      streak = 1;
      firstIndex = i;
      continue;
    }
    if (s === direction) {
      streak += 1 + pending;
      pending = 0;
      firstIndex = i;
    } else if (pending === 0) {
      pending = 1;
    } else {
      break;
    }
  }
  if (!direction || firstIndex === -1) return null;
  const span = values.slice(firstIndex);
  const nonNullSpan = span.filter((v): v is number => v != null);
  const recent = nonNullSpan.reduce((a, x) => a + x, 0) / nonNullSpan.length;
  return { streak, direction, recent, firstIndex, endIndex };
}

export type MetricBaseline = {
  median: number | null;
  low: number | null;
  high: number | null;
  variability: number | null;
  n: number;
  sufficient: boolean;
};

export type Quality = 'ok' | 'partial' | 'low';

export type MetricChange = {
  fromValue: number;
  toValue: number;
  direction: 'lower' | 'higher';
  deviation: number;
  detectedOn: string;
  quality: Quality;
};

export type MetricResult = { baseline: MetricBaseline; change: MetricChange | null };

// Every day in the run this change covers, from the earliest day that
// contributed to the streak through the last day that actually carries a
// value (not necessarily calendar today: today may have no reading yet
// because the day isn't over). Quality describes how complete the
// evidence for that span is, never how strong the change is: ok when
// every day has a value, low when fewer than half do, partial otherwise.
// Deliberately ends the span at `endIndex` rather than trimming trailing
// nulls off `values` first: `detectRun` already finds that index for free
// while walking backward, so this stays a plain slice instead of a second
// scan.
function runQuality(values: (number | null)[], firstIndex: number, endIndex: number): Quality {
  const span = values.slice(firstIndex, endIndex + 1);
  const total = span.length;
  const missing = span.filter((v) => v == null).length;
  const present = total - missing;
  if (missing === 0) return 'ok';
  return present < total / 2 ? 'low' : 'partial';
}

// Computes one metric's baseline and, where warranted, the change against
// it. `dates` and `values` line up one per calendar day, oldest first,
// with today last (see buildDenseWindow). Returns null when there is no
// data at all for this metric in the window: a metric never measured gets
// no row, not an insufficient one full of nulls.
export function computeMetric(dates: string[], values: (number | null)[]): MetricResult | null {
  if (dates.length !== values.length) throw new Error('dates and values must line up one per day');
  if (values.every((v) => v == null)) return null;

  const baselineValues = baselineWindow(values).filter((v): v is number => v != null);
  const n = baselineValues.length;
  const sufficient = n >= MIN_BASELINE_N;

  if (!sufficient) {
    return { baseline: { median: null, low: null, high: null, variability: null, n, sufficient: false }, change: null };
  }

  const b = band(baselineValues);
  const baseline: MetricBaseline = { median: b.median, low: b.low, high: b.high, variability: b.mad, n, sufficient: true };

  const run = detectRun(values, b);
  if (!run || run.streak < MIN_RUN_STREAK) {
    return { baseline, change: null };
  }

  return {
    baseline,
    change: {
      fromValue: b.median,
      toValue: run.recent,
      direction: run.direction,
      deviation: run.recent - b.median,
      detectedOn: dates[dates.length - 1],
      quality: runQuality(values, run.firstIndex, run.endIndex),
    },
  };
}

export type TempDeviation = { day: string; value: number };

// The night's wrist temperature reading minus her median wrist temperature
// across the baseline window (35 to 90 days back), for each day in the
// recent window (0 to 34 days back) that has a reading. Returns no entries
// at all when the baseline is insufficient (fewer than 20 baseline
// readings): temp_deviation stays null rather than resting on too little
// history.
export function computeTempDeviations(dates: string[], values: (number | null)[]): TempDeviation[] {
  const baselineValues = baselineWindow(values).filter((v): v is number => v != null);
  if (baselineValues.length < MIN_BASELINE_N) return [];
  const baselineMedian = median(baselineValues);

  const recentDates = recentWindow(dates);
  const recentValues = recentWindow(values);
  const out: TempDeviation[] = [];
  for (let i = 0; i < recentValues.length; i++) {
    const v = recentValues[i];
    if (v == null) continue;
    out.push({ day: recentDates[i], value: v - baselineMedian });
  }
  return out;
}
