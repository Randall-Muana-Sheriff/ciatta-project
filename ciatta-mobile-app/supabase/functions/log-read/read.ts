// What the model returned, made safe: only words from the vocabulary the
// app sent, each once, in the app's own spelling, and a day back between
// today and two weeks. Anything else is dropped, so the model can never
// add a category or a word the record does not keep.

export const MAX_DAYS_AGO = 14;

export function readLogResult(raw: unknown, vocabulary: readonly string[]): { items: string[]; daysAgo: number } {
  const byLower = new Map(vocabulary.map((v) => [v.toLowerCase(), v]));
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const items: string[] = [];
  for (const x of Array.isArray(r.items) ? r.items : []) {
    if (typeof x !== 'string') continue;
    const hit = byLower.get(x.trim().toLowerCase());
    if (hit && !items.includes(hit)) items.push(hit);
  }
  const d = typeof r.daysAgo === 'number' && Number.isFinite(r.daysAgo) ? Math.round(r.daysAgo) : 0;
  return { items, daysAgo: Math.min(MAX_DAYS_AGO, Math.max(0, d)) };
}
