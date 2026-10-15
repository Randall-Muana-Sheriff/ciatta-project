// The facts a document analysis may use, and the fingerprint that says
// when the document has changed. Pure; tested from the app's suite.

export type DocFacts = {
  document: { type: string; date: string | null; title: string | null; clinician: string | null; facility: string | null; extraction: Record<string, unknown> };
  record: {
    conditions: string[];
    medications: string[];
    supplements: string[];
    procedures: { name: string; on: string | null }[];
    labs: { name: string; value: number | null; value_text: string | null; unit: string | null; range: string | null; flag: string | null; on: string }[];
    cycle: { day: number; phase: string | null; usual_length: number | null } | null;
    symptoms: { name: string; count: number }[];
    profile: { age_range: string | null; life_stage: string | null; gender: string | null };
  };
};

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => strings(x, out));
  return out;
}

// Everything the document says, as one text.
export const documentText = (extraction: Record<string, unknown>) => strings(extraction).join(' \n ');

// Every medication the document names, in any list.
export function documentMeds(extraction: Record<string, unknown>): string[] {
  const names = new Set<string>();
  const visit = (extraction.visit ?? {}) as Record<string, unknown>;
  const rx = (extraction.prescription ?? {}) as Record<string, unknown>;
  for (const list of [visit.medications_started, visit.medications_stopped, visit.medications_changed, rx.medications]) {
    for (const m of Array.isArray(list) ? list : []) if (typeof m?.name === 'string' && m.name.trim()) names.add(m.name.trim());
  }
  return [...names];
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}

// The same in the app (src/lib/documentAnalysis.ts).
export const extractionFingerprint = (extraction: unknown) => JSON.stringify(stable(extraction));

const PHASES = ['During period', 'Before period', 'After period', 'Between periods'];
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
export function readCycle(raw: unknown): DocFacts['record']['cycle'] {
  const c = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  const day = c ? int(c.day, 1, 45) : null;
  if (!c || day == null) return null;
  return { day, phase: typeof c.phase === 'string' && PHASES.includes(c.phase) ? c.phase : null, usual_length: int(c.usual_length, 15, 90) };
}
