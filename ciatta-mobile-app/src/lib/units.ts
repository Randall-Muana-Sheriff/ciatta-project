// Her units: Metric or Imperial, and nothing finer. She chooses the system
// once (at onboarding, or in Settings); every measure follows it: height,
// weight, temperature and distance. Stored once, in centimetres, kilograms
// and Celsius; shown and typed in hers, with the other system beside it so
// a clinician's units are never far away.

export type Units = 'metric' | 'imperial';

export const UNIT_LABEL: Record<Units, string> = { metric: 'Metric', imperial: 'Imperial' };
export const UNIT_SUB: Record<Units, string> = { metric: 'Centimetres, kilograms, Celsius, kilometres', imperial: 'Feet and inches, pounds, Fahrenheit, miles' };

// A stored choice, read as one of the two. US and UK were once separate
// choices; both read as imperial now.
export function unitsOf(stored: string | null | undefined): Units | null {
  if (stored === 'metric') return 'metric';
  if (stored === 'imperial' || stored === 'us' || stored === 'uk') return 'imperial';
  return null;
}

// The system the app is showing right now. Set once her choice is read,
// and when she changes it; formatting reads it when no system is passed.
let active: Units = 'metric';
export const setActiveUnits = (u: Units) => {
  active = u;
};
export const activeUnits = () => active;

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


export function formatWeight(kg: number, units: Units): { value: string; other: string } {
  const metric = `${oneDecimal(kg)} kg`;
  const pounds = `${oneDecimal(kg * LB_PER_KG)} lb`;
  return units === 'metric' ? { value: metric, other: pounds } : { value: pounds, other: metric };
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
export function weightFromInput(input: { kg?: string; lb?: string }): number | null {
  const kg = input.kg !== undefined ? num(input.kg) : num(input.lb) / LB_PER_KG;
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

// Until she chooses: imperial where it is the everyday system (the US,
// Liberia, Myanmar), metric everywhere else.
export function defaultUnits(locale: string | undefined): Units {
  const region = (locale ?? '').split(/[-_]/)[1]?.toUpperCase();
  return region === 'US' || region === 'LR' || region === 'MM' ? 'imperial' : 'metric';
}

// A temperature, from Celsius.
export function formatTemp(c: number, units: Units = active): string {
  return units === 'metric' ? `${Math.round(c)} °C` : `${Math.round(c * 1.8 + 32)} °F`;
}

// A change in temperature, from Celsius, unsigned: a change scales by 1.8
// and never shifts by 32.
export function formatTempChange(c: number, units: Units = active): string {
  const v = Math.abs(c) * (units === 'metric' ? 1 : 1.8);
  return `${v.toFixed(1)} ${units === 'metric' ? '°C' : '°F'}`;
}

// A distance, from kilometres.
export function formatDistance(km: number, units: Units = active): string {
  if (units === 'metric') return `${oneDecimal(km)} km`;
  const miles = Math.round(km * 0.621371);
  return `${miles} ${miles === 1 ? 'mile' : 'miles'}`;
}

// A temperature as a number in her system, and its symbol, for copy that
// has to word a minus itself.
export const tempValue = (c: number, units: Units = active) => (units === 'metric' ? c : c * 1.8 + 32);
export const tempSymbol = (units: Units = active) => (units === 'metric' ? '°C' : '°F');
