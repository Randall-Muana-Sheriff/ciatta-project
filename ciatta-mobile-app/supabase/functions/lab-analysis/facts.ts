// The facts an analysis may use, and the fingerprint that says when they
// have changed. Pure; tested from the app's suite.

import { testKey } from './keys.ts';

export type FactTest = {
  name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  range: string | null;
  low: number | null;
  high: number | null;
  flag: string | null;
  panel: string | null;
};

export type Facts = {
  collected_on: string;
  lab: string | null;
  tests: FactTest[];
  earlier: { name: string; results: { on: string; value: number | null; value_text: string | null; unit: string | null }[] }[];
  cycle: { day: number; phase: string | null; usual_length: number | null } | null;
  profile: { age_range: string | null; life_stage: string | null; gender: string | null };
  conditions: string[];
  medications: string[];
  supplements: string[];
  symptoms: { name: string; count: number }[];
};

const PHASES = ['During period', 'Before period', 'After period', 'Between periods'];
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

// The cycle the app computed at the draw, taken only in its exact shape.
export function readCycle(raw: unknown): Facts['cycle'] {
  const c = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  const day = c ? int(c.day, 1, 45) : null;
  if (!c || day == null) return null;
  return {
    day,
    phase: typeof c.phase === 'string' && PHASES.includes(c.phase) ? c.phase : null,
    usual_length: int(c.usual_length, 15, 90),
  };
}

// What the analysis was written from: each result's test, value, unit and
// day, in a stable order. The same in the app (src/lib/labAnalysis.ts).
export function fingerprint(tests: { name: string; value: number | null; value_text: string | null; unit: string | null; on: string }[]): string {
  return tests
    .map((t) => `${testKey(t.name)}|${t.value ?? t.value_text ?? ''}|${(t.unit ?? '').trim().toLowerCase()}|${t.on}`)
    .sort()
    .join('\n');
}

type EarlierRow = { name: string; value: number | null; value_text: string | null; unit: string | null; on: string };

// Her earlier results for the report's tests: the first five of each in the
// order given, which is newest first by time and then id, the same query the
// app makes (repo.loadLabsBefore). Which five are kept depends on that order
// alone, so both sides keep the same five.
export function pickEarlier(rows: EarlierRow[], keys: Set<string>): Facts['earlier'] {
  const by = new Map<string, { name: string; results: Facts['earlier'][number]['results'] }>();
  for (const r of rows) {
    const k = testKey(r.name);
    if (!keys.has(k)) continue;
    const entry = by.get(k) ?? { name: r.name, results: [] };
    if (entry.results.length < 5) entry.results.push({ on: r.on, value: r.value, value_text: r.value_text, unit: r.unit });
    by.set(k, entry);
  }
  return [...by.values()];
}
