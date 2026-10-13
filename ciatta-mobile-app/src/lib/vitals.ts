// The readings that never reached daily_metrics.
//
// Blood pressure, blood oxygen and weight all sync from Apple Health and
// all land in observations, because healthMetricsAll's specs are stored
// per reading and never folded into a daily row. So the Day object the
// whole app reads has no idea they exist, and a woman whose cuff and ring
// have been feeding Ciatta for weeks sees none of it.
//
// This reads them as what they are: the latest reading, with the day it
// was taken. That date is the point. A blood pressure from eleven days
// ago is not today's blood pressure, and a card that showed it without
// saying so would be presenting an old number as a current one, which is
// the same failure as inventing it.

import { type Trend, trendOf } from './trend';

export type Reading = {
  metric: string;
  value: number;
  unit: string | null;
  at: string;
};

export type VitalCard = {
  key: string;
  label: string;
  value: string | null;
  note?: string;
  from: 'measured';
  // Her recent readings of it and which way they move, when there are
  // enough of them. See lib/trend.ts.
  trend?: Trend;
};

// Every reading of one metric, oldest first. Readings arrive newest first.
const series = (readings: readonly Reading[], metric: string, scale: (v: number) => number = (v) => v) =>
  readings.filter((x) => x.metric === metric).map((x) => scale(x.value)).reverse();

const withTrend = (card: VitalCard, values: number[], usual?: number | null): VitalCard => {
  const t = trendOf(values, 'percent', usual);
  return t ? { ...card, trend: t } : card;
};

const DAY_MS = 86400000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// How long ago, in her words. Today says nothing: a reading from today is
// what a card is assumed to hold, so saying so is noise.
export function whenNote(at: string, now: Date): string | null {
  const taken = Date.parse(at);
  if (Number.isNaN(taken)) return null;
  const days = Math.round((startOfDay(now) - startOfDay(new Date(taken))) / DAY_MS);
  if (days <= 0) return null;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

// A reading older than this is not shown as a current figure at all. Two
// months of nothing is not a blood pressure; it is a gap, and a card that
// filled the gap with the last thing it saw would be lying quietly.
const STALE_DAYS = 60;

function fresh(r: Reading | undefined, now: Date): Reading | null {
  if (!r) return null;
  const taken = Date.parse(r.at);
  if (Number.isNaN(taken)) return null;
  return (startOfDay(now) - startOfDay(new Date(taken))) / DAY_MS > STALE_DAYS ? null : r;
}

const find = (readings: readonly Reading[], metric: string) => readings.find((r) => r.metric === metric);

// Blood pressure, which is two numbers and one fact.
//
// Shown only when both halves are present and were taken on the same day.
// A systolic from Tuesday over a diastolic from Friday is not a blood
// pressure reading, it is two numbers printed with a slash between them.
export function bloodPressure(readings: readonly Reading[], now: Date, usual?: number | null): VitalCard {
  const sys = fresh(find(readings, 'blood_pressure_systolic'), now);
  const dia = fresh(find(readings, 'blood_pressure_diastolic'), now);
  const sameDay = sys && dia && startOfDay(new Date(sys.at)) === startOfDay(new Date(dia.at));
  // The trend follows the systolic, the number a cuff leads with.
  return withTrend({
    key: 'bp',
    label: 'Blood pressure',
    value: sameDay ? `${Math.round(sys.value)}/${Math.round(dia.value)}` : null,
    note: sameDay ? (whenNote(sys.at, now) ?? undefined) : undefined,
    from: 'measured',
  }, series(readings, 'blood_pressure_systolic'), usual);
}

export function bloodOxygen(readings: readonly Reading[], now: Date, usual?: number | null): VitalCard {
  const r = fresh(find(readings, 'oxygen_saturation'), now);
  // HealthKit reports saturation as a fraction. A 0.98 printed as 0.98
  // would read as nothing at all to anyone who has seen a pulse oximeter.
  const pct = r ? (r.value <= 1 ? r.value * 100 : r.value) : null;
  return withTrend({
    key: 'spo2',
    label: 'Blood oxygen',
    value: pct == null ? null : `${Math.round(pct)}%`,
    note: r ? (whenNote(r.at, now) ?? undefined) : undefined,
    from: 'measured',
  }, series(readings, 'oxygen_saturation', (v) => (v <= 1 ? v * 100 : v)), usual);
}

export function weight(readings: readonly Reading[], now: Date): VitalCard {
  const r = fresh(find(readings, 'body_mass'), now);
  return {
    key: 'weight',
    label: 'Weight',
    // The unit comes from the reading rather than being assumed. A figure
    // shown in the wrong unit is a wrong figure.
    value: r ? `${Math.round(r.value * 10) / 10}${r.unit ? ` ${r.unit}` : ''}` : null,
    note: r ? (whenNote(r.at, now) ?? undefined) : undefined,
    from: 'measured',
  };
}

// Every metric this module reads, so the query asks for exactly these.
export const VITAL_METRICS = [
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'oxygen_saturation',
  'body_mass',
] as const;
