// Putting a long document's pieces back together. Pure, tested from the
// app's suite. Details come from the first piece that has them, every list
// is joined in page order, and the type is the one most pieces agree on.

import type { ChunkRead } from '../_shared/chunks.ts';

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const SECTIONS = ['visit', 'report', 'prescription', 'referral', 'insurance', 'other'] as const;

function mergeSection(parts: (Record<string, unknown> | null)[]): Record<string, unknown> | null {
  const present = parts.filter((p): p is Record<string, unknown> => !!p);
  if (!present.length) return null;
  const out: Record<string, unknown> = {};
  for (const key of new Set(present.flatMap((p) => Object.keys(p)))) {
    const values = present.map((p) => p[key]);
    out[key] = values.some(Array.isArray) ? values.flatMap((v) => (Array.isArray(v) ? v : [])) : (values.find((v) => text(v) != null) ?? null);
  }
  return out;
}

export function mergeDocumentChunks(reads: ChunkRead[], pages: number): Record<string, unknown> {
  const ordered = [...reads].sort((a, b) => a.first - b.first);
  const ok = ordered.filter((r) => r.parsed) as { first: number; last: number; parsed: Record<string, unknown> }[];
  const unreadable = new Set<number>();
  for (const r of ordered) {
    if (!r.parsed) {
      for (let p = r.first; p <= r.last; p++) unreadable.add(p);
      continue;
    }
    for (const p of Array.isArray(r.parsed.unreadable_pages) ? r.parsed.unreadable_pages : []) {
      if (typeof p === 'number' && Number.isInteger(p) && p >= 1 && r.first + p - 1 <= r.last) unreadable.add(r.first + p - 1);
    }
  }
  const votes = new Map<string, number>();
  for (const r of ok) {
    const t = text(r.parsed.doc_type);
    if (t && r.parsed.not_medical !== true) votes.set(t, (votes.get(t) ?? 0) + 1);
  }
  const docType = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
  const pick = (key: string) => ok.map((r) => text(r.parsed[key])).find((v) => v != null) ?? null;
  const dates = new Set(ok.map((r) => text(r.parsed.date)).filter(Boolean));
  const out: Record<string, unknown> = {
    not_medical: ok.length > 0 && ok.every((r) => r.parsed.not_medical === true),
    doc_type: docType,
    title: pick('title'),
    date: pick('date'),
    clinician: pick('clinician'),
    facility: pick('facility'),
    multiple_dates: dates.size > 1 || ok.some((r) => r.parsed.multiple_dates === true),
    unreadable_pages: [...unreadable].sort((a, b) => a - b),
    pages,
  };
  for (const s of SECTIONS) out[s] = mergeSection(ok.map((r) => obj(r.parsed[s])));
  return out;
}
