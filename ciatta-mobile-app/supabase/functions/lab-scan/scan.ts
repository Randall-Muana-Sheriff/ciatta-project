// Reading a long report in pieces, and putting the pieces back together.
// Pure, so it is tested from the app's suite.

export const CHUNK_PAGES = 8;

export function chunkRanges(pageCount: number, size = CHUNK_PAGES): { first: number; last: number }[] {
  const out: { first: number; last: number }[] = [];
  for (let first = 1; first <= pageCount; first += size) out.push({ first, last: Math.min(pageCount, first + size - 1) });
  return out;
}

export type ChunkRead = { first: number; last: number; parsed: Record<string, unknown> | null };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

// Chunks in page order. Report details come from the first chunk that has
// them. A page number a chunk names is counted from that chunk's first
// page. A chunk that failed to read marks every one of its pages
// unreadable, so she is told exactly what to check.
export function mergeChunks(reads: ChunkRead[], pages: number): Record<string, unknown> {
  const ordered = [...reads].sort((a, b) => a.first - b.first);
  const pick = (key: string) => {
    for (const r of ordered) {
      const v = text(r.parsed?.[key]);
      if (v) return v;
    }
    return null;
  };
  const tests: unknown[] = [];
  const unreadable = new Set<number>();
  let anyLab = false;
  for (const r of ordered) {
    if (!r.parsed) {
      for (let p = r.first; p <= r.last; p++) unreadable.add(p);
      continue;
    }
    const chunkTests = Array.isArray(r.parsed.tests) ? r.parsed.tests : [];
    if (r.parsed.not_lab !== true || chunkTests.length) anyLab = true;
    tests.push(...chunkTests);
    for (const p of Array.isArray(r.parsed.unreadable_pages) ? r.parsed.unreadable_pages : []) {
      if (typeof p !== 'number' || !Number.isInteger(p) || p < 1) continue;
      const page = r.first + p - 1;
      if (page <= r.last) unreadable.add(page);
    }
  }
  return {
    not_lab: !anyLab,
    collected_on: pick('collected_on'),
    lab: pick('lab'),
    ordering_clinician: pick('ordering_clinician'),
    specimen: pick('specimen'),
    pages,
    unreadable_pages: [...unreadable].sort((a, b) => a - b),
    tests,
  };
}
