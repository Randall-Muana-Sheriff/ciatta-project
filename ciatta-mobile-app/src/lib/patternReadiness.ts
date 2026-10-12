// Why there is no pattern yet, answered precisely.
//
// "Not enough data" is true and useless. A woman who has worn a ring for
// three weeks wants to know what is missing and when it stops being
// missing, and the engine can say exactly, because its requirements are
// arithmetic rather than judgement.
//
// Two gates, both in engine.ts:
//
//   sustained() takes its baseline from days 35 to 90 back, so a recent
//   change cannot become part of what is usual. Nothing in that window
//   means no baseline, and no baseline means no finding at any strength.
//
//   That window must hold at least 20 days with a value for the metric
//   being judged. Not 20 days of history: 20 days that actually carry
//   that number. A ring worn five nights a week fills it slower than the
//   calendar suggests.
//
// So a first pattern needs about 55 days of wearing the thing, and this
// says how far along that she is, per metric, from her own rows.

import type { Day } from '../data/daily';

// Mirrors sustained() in engine.ts. Duplicated rather than imported
// because engine.ts does not export them, and a test asserts the numbers
// still match what engine.ts uses.
export const BASELINE_FROM = 91;
export const BASELINE_TO = 35;
export const BASELINE_MIN = 20;

export type MetricReadiness = {
  key: string;
  label: string;
  // Days in the baseline window that carry a value for this metric.
  have: number;
  need: number;
  ready: boolean;
  // Days with a value anywhere in her history, which is the number she
  // recognises from the rest of the app.
  total: number;
};

const METRICS: { key: string; label: string; get: (d: Day) => number | null }[] = [
  { key: 'sleep', label: 'Sleep', get: (d) => d.sleepHours },
  { key: 'hrv', label: 'Heart rate variability', get: (d) => d.hrv },
  { key: 'restingHR', label: 'Resting heart rate', get: (d) => d.restingHR },
  { key: 'steps', label: 'Steps', get: (d) => d.steps },
  { key: 'temp', label: 'Skin temperature', get: (d) => d.tempDeviation },
];

// The same slice engine.ts takes, including the clamp that stops a short
// history producing a baseline made of the days being judged.
function baselineWindow(days: readonly Day[]): readonly Day[] {
  return days.slice(Math.max(0, days.length - BASELINE_FROM), Math.max(0, days.length - BASELINE_TO));
}

export function patternReadiness(days: readonly Day[]): MetricReadiness[] {
  const window = baselineWindow(days);
  return METRICS.map((m) => {
    const have = window.filter((d) => m.get(d) != null).length;
    return {
      key: m.key,
      label: m.label,
      have,
      need: BASELINE_MIN,
      ready: have >= BASELINE_MIN,
      total: days.filter((d) => m.get(d) != null).length,
    };
  });
}

// What the whole picture says in one line. Counted, and specific about
// which gate is not met.
export function readinessLine(days: readonly Day[], ready: readonly MetricReadiness[]): string {
  const can = ready.filter((r) => r.ready);
  if (!days.length) return 'No days have reached Ciatta yet.';
  if (can.length) {
    const names = can.map((r) => r.label.toLowerCase());
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${can.length} of ${ready.length} measures have enough history for a comparison: ${list}.`;
  }
  // No baseline anywhere. The useful number is how far off the window is,
  // not how many rows exist.
  // Assumes a reading every day from here on, so it is the soonest date,
  // not a promise.
  const short = BASELINE_TO + BASELINE_MIN - days.length;
  if (short > 0) {
    return `No measure has enough history yet. Ciatta compares against days 35 to 90 back, so the first comparison becomes possible about ${short} days from now.`;
  }
  return 'No measure has enough history yet. There are days in the window Ciatta compares against, but too few of them carry a reading.';
}

// Whether anything can produce a finding at all.
export const anyReady = (ready: readonly MetricReadiness[]) => ready.some((r) => r.ready);

// What a single metric is waiting for, said plainly.
export function metricLine(r: MetricReadiness): string {
  if (r.ready) return `${r.have} days in the comparison window. Enough to compare against.`;
  if (r.total === 0) return 'Nothing has arrived for this yet.';
  if (r.have === 0) {
    return `${r.total} days recorded, but none yet in the window Ciatta compares against, which is 35 to 90 days back.`;
  }
  return `${r.have} of ${r.need} days in the comparison window.`;
}
