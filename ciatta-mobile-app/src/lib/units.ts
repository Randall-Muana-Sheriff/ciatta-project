// Height and weight in the units she reads them in: metric (cm, kg), US
// (feet and inches, pounds) or UK (feet and inches, stones and pounds).
// Stored once, in centimetres and kilograms; shown and typed in hers, with
// the other system beside it so a clinician's units are never far away.

export type Units = 'metric' | 'us' | 'uk';

export const UNIT_LABEL: Record<Units, string> = { metric: 'Metric (cm, kg)', us: 'US (ft and in, lb)', uk: 'UK (ft and in, st and lb)' };

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.20462;

const oneDecimal = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

function feetInches(cm: number): string {
  const total = Math.round(cm / CM_PER_IN);
  return `${Math.floor(total / 12)} ft ${total % 12} in`;
}

export function formatHeight(cm: number, units: Units): { value: string; other: string } {
  const metric = `${Math.round(cm)} cm`;
  return units === 'metric' ? { value: metric, other: feetInches(cm) } : { value: feetInches(cm), other: metric };
}

function stonesPounds(kg: number): string {
  const lb = Math.round(kg * LB_PER_KG * 10) / 10;
  let st = Math.floor(lb / 14);
  let rest = Math.round((lb - st * 14) * 10) / 10;
  if (rest >= 14) {
    st += 1;
    rest = 0;
  }
  return `${st} st ${oneDecimal(rest)} lb`;
}

export function formatWeight(kg: number, units: Units): { value: string; other: string } {
  const metric = `${oneDecimal(kg)} kg`;
  const pounds = `${oneDecimal(kg * LB_PER_KG)} lb`;
  if (units === 'metric') return { value: metric, other: pounds };
  if (units === 'us') return { value: pounds, other: metric };
  return { value: stonesPounds(kg), other: metric };
}

const num = (s: string | undefined) => {
  const t = (s ?? '').trim().replace(',', '.');
  if (!t) return 0;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

// What she typed, in centimetres, or null when it is not a height.
export function heightFromInput(input: { cm?: string; ft?: string; in?: string }): number | null {
  let cm: number;
  if (input.cm !== undefined) cm = num(input.cm);
  else {
    const ft = num(input.ft);
    const inches = num(input.in);
    if (Number.isNaN(ft) || Number.isNaN(inches) || inches >= 12) return null;
    cm = (ft * 12 + inches) * CM_PER_IN;
  }
  return Number.isFinite(cm) && cm >= 50 && cm <= 260 ? cm : null;
}

// What she typed, in kilograms, or null when it is not a weight.
export function weightFromInput(input: { kg?: string; lb?: string; st?: string }): number | null {
  let kg: number;
  if (input.kg !== undefined) kg = num(input.kg);
  else {
    const st = num(input.st);
    const lb = num(input.lb);
    if (Number.isNaN(st) || Number.isNaN(lb) || (input.st !== undefined && lb >= 14)) return null;
    kg = (st * 14 + lb) / LB_PER_KG;
  }
  return Number.isFinite(kg) && kg >= 2 && kg <= 400 ? kg : null;
}

// A device reading in kilograms, from whatever unit it arrived in.
export function toKg(value: number, unit: string | null): number | null {
  switch ((unit ?? '').toLowerCase()) {
    case 'kg':
      return value;
    case 'g':
      return value / 1000;
    case 'lb':
    case 'lbs':
      return value / LB_PER_KG;
    case 'st':
      return (value * 14) / LB_PER_KG;
    default:
      return null;
  }
}

// Until she chooses: the US reads in pounds and inches, the UK in stones,
// everywhere else in metric.
export function defaultUnits(locale: string | undefined): Units {
  const region = (locale ?? '').split(/[-_]/)[1]?.toUpperCase();
  if (region === 'US' || region === 'LR' || region === 'MM') return 'us';
  if (region === 'GB') return 'uk';
  return 'metric';
}
