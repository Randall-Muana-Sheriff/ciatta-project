// Today's Patterns: the day itself, from her wearable, two metrics at a
// time so she can see one move against the other through the hours. Labs
// are snapshots and the cycle runs in months, so neither belongs on a
// chart of a single day; heart rate, HRV, steps, blood oxygen and breathing
// rate are what a watch or ring reads through a day.

import { NAME, SHORT } from './metricNames';
import { hourLabel } from './timeAxis';

export type DayMetricKey = 'heart_rate' | 'hrv' | 'steps' | 'oxygen_saturation' | 'respiratory_rate';

const METRICS: { key: DayMetricKey; label: string; unit: string; sum?: boolean; percent?: boolean }[] = [
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
  { key: 'hrv', label: SHORT.hrv, unit: 'ms' },
  { key: 'steps', label: 'Steps', unit: 'steps', sum: true },
  { key: 'oxygen_saturation', label: NAME.spo2, unit: '%', percent: true },
  { key: 'respiratory_rate', label: 'Respiratory Rate', unit: 'br/min' },
];
export const DAY_METRICS = METRICS.map((m) => m.key);
export const DAY_READ = [...DAY_METRICS, 'sleep_analysis'];

export type DaySeries = {
  key: DayMetricKey;
  label: string;
  unit: string;
  values: (number | null)[];
  count: number;
  low: number;
  high: number;
  range: string;
};
export type DayView = { series: DaySeries[]; nowHour: number; wokeAt: number | null };

type Reading = { metric: string; value: number | null; at: string };
const iso = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const say = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString('en-US') : `${Math.round(v)}`);

export function dayPatterns(readings: readonly Reading[], now: Date): DayView {
  const today = readings.filter((r) => iso(new Date(r.at)) === iso(now));
  const series: DaySeries[] = [];
  for (const m of METRICS) {
    const hours = Array.from({ length: 24 }, () => [] as number[]);
    for (const r of today) if (r.metric === m.key && r.value != null) hours[new Date(r.at).getHours()].push(r.value);
    const values = hours.map((h) => {
      if (!h.length) return null;
      const v = m.sum ? h.reduce((a, b) => a + b, 0) : avg(h);
      return m.percent && v <= 1 ? Math.round(v * 1000) / 10 : Math.round(v * 10) / 10;
    });
    const got = values.filter((v): v is number => v != null);
    if (!got.length) continue;
    const low = Math.min(...got);
    const high = Math.max(...got);
    series.push({ key: m.key, label: m.label, unit: m.unit, values, count: got.length, low, high, range: low === high ? `${say(low)} ${m.unit}` : `${say(low)} to ${say(high)} ${m.unit}` });
  }
  const ends = today.filter((r) => r.metric === 'sleep_analysis').map((r) => new Date(r.at));
  const woke = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  return { series, nowHour: now.getHours(), wokeAt: woke ? woke.getHours() + woke.getMinutes() / 60 : null };
}

// The pair drawn first: heart rate against HRV when she has both, the
// classic pairing; otherwise the two with the most hours.
export function defaultPair(series: readonly Pick<DaySeries, 'key' | 'count'>[]): DayMetricKey[] {
  const has = (k: DayMetricKey) => series.some((s) => s.key === k);
  if (has('heart_rate') && has('hrv')) return ['heart_rate', 'hrv'];
  return [...series].sort((a, b) => b.count - a.count).slice(0, 2).map((s) => s.key);
}

// One line on how the two moved together: where the first peaked, where
// the second sat then. Only with at least four hours of each and a reading
// of the second in that hour.
export function pairLine(a: DaySeries, b: DaySeries): string | null {
  if (a.count < 4 || b.count < 4 || a.high === a.low || b.high === b.low) return null;
  const peak = a.values.indexOf(a.high);
  const other = b.values[peak];
  if (other == null) return null;
  const at = (other - b.low) / (b.high - b.low);
  const where = at <= 1 / 3 ? 'near its low' : at >= 2 / 3 ? 'near its high' : 'in its middle';
  const name = (s: DaySeries) => (s.key === 'hrv' ? 'HRV' : s.label.toLowerCase());
  return `When your ${name(a)} peaked, around ${hourLabel(peak)}, your ${name(b)} was ${where} for today.`;
}
