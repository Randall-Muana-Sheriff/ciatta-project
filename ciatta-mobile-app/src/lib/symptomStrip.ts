// Symptoms side by side, the way a symptom tracker lays them out: a row per
// symptom she logged in the window, a dot per day, filled on the days she
// logged it, with her latest rating beside the name. Seven and twenty eight
// days go a day at a time; three months a week at a time. Compare says how
// often two of them came on the same day, and nothing about why.

export type Range = '7' | '28' | '90';
export type Cell = { severity: number | null } | null;
export type StripRow = { name: string; severity: number | null; cells: Cell[] };
export type Strip = { range: Range; cols: string[]; labels: string[]; rows: StripRow[] };

const DAY = 86400000;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function symptomStrip(seen: ReadonlyMap<string, ReadonlyMap<string, number | null>>, range: Range, now: Date, max = 4): Strip {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekly = range === '90';
  const n = weekly ? 13 : Number(range);
  const cols = Array.from({ length: n }, (_, i) => key(new Date(today.getTime() - (n - 1 - i) * (weekly ? 7 : 1) * DAY)));
  // A column's days: itself, or the week ending on it.
  const daysOf = (c: string) => (weekly ? Array.from({ length: 7 }, (_, i) => key(new Date(parse(c).getTime() - i * DAY))) : [c]);
  const labels = range === '7' ? cols.map((c) => WEEKDAY[parse(c).getDay()]) : [];

  const rows: (StripRow & { hits: number })[] = [];
  for (const [name, days] of seen) {
    const cells: Cell[] = cols.map((c) => {
      const hit = daysOf(c).filter((d) => days.has(d));
      if (!hit.length) return null;
      const rated = hit.map((d) => days.get(d)).filter((v): v is number => v != null);
      return { severity: rated.length ? Math.max(...rated) : null };
    });
    const hits = cells.filter(Boolean).length;
    if (!hits) continue;
    const latest = [...days.entries()].filter(([, v]) => v != null).sort((a, b) => b[0].localeCompare(a[0]))[0];
    rows.push({ name, severity: latest ? (latest[1] as number) : null, cells, hits });
  }
  rows.sort((a, b) => b.hits - a.hits);
  return { range, cols, labels, rows: rows.slice(0, max).map(({ hits: _h, ...r }) => r) };
}

export function together(strip: Strip, a: string, b: string): string {
  const ra = strip.rows.find((r) => r.name === a);
  const rb = strip.rows.find((r) => r.name === b);
  const both = ra && rb ? ra.cells.filter((c, i) => c && rb.cells[i]).length : 0;
  const unit = strip.range === '90' ? 'weeks' : 'days';
  return `${a} and ${b} were logged together on ${both} of ${strip.cols.length} ${unit}.`;
}
