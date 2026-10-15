// Labs: how a result is read, labelled and drawn.
//
// The status follows HL7's ObservationInterpretation codes, the ones labs
// send, in the words patient portals use for them:
//
//   N         In range
//   H / L     High / Low
//   HH / LL   Critically high / Critically low (only when the lab says so)
//   A / AA    Abnormal (a result that is not a number)
//
// The lab's own flag always wins. Without one, a number is compared with the
// range that lab printed, and the label says it was compared rather than
// flagged. Ciatta never brings a range of its own: a lab's reference
// interval belongs to that lab's method and population. With no range and no
// flag, nothing is judged ("No range given").

export type LabFlag = 'N' | 'H' | 'L' | 'HH' | 'LL' | 'A' | 'AA';
const FLAGS: LabFlag[] = ['N', 'H', 'L', 'HH', 'LL', 'A', 'AA'];

export type LabResult = {
  id: string;
  name: string;
  value: number | null;
  // A result that is not a number: "Negative", "Non reactive".
  valueText: string | null;
  unit: string | null;
  low: number | null;
  high: number | null;
  // The range as the lab printed it.
  rangeText: string | null;
  flag: LabFlag | null;
  // final, preliminary, corrected, as the lab sent it.
  status: string | null;
  source: 'provider' | 'report';
  lab: string | null;
  // ISO day it was collected.
  on: string;
  // The report it was read from, and the panel heading it was printed
  // under. Absent for provider results and anything saved before reports.
  documentId?: string | null;
  panel?: string | null;
};

export type StatusKey = 'inRange' | 'high' | 'low' | 'criticalHigh' | 'criticalLow' | 'abnormal' | 'noRange';
export type LabStatus = { key: StatusKey; label: string; basis: string | null };

const LABEL: Record<StatusKey, string> = {
  inRange: 'In range',
  high: 'High',
  low: 'Low',
  criticalHigh: 'Critically high',
  criticalLow: 'Critically low',
  abnormal: 'Abnormal',
  noRange: 'No range given',
};

const FROM_FLAG: Record<LabFlag, StatusKey> = { N: 'inRange', H: 'high', L: 'low', HH: 'criticalHigh', LL: 'criticalLow', A: 'abnormal', AA: 'abnormal' };

const status = (key: StatusKey, basis: string | null): LabStatus => ({ key, label: LABEL[key], basis });

export function labStatus(r: LabResult): LabStatus {
  if (r.flag) return status(FROM_FLAG[r.flag], 'Flagged by the lab');
  if (r.value == null || (r.low == null && r.high == null)) return status('noRange', null);
  const basis = 'Compared with the lab\'s range';
  if (r.low != null && r.value < r.low) return status('low', basis);
  if (r.high != null && r.value > r.high) return status('high', basis);
  return status('inRange', basis);
}

export const isOutside = (r: LabResult) => !['inRange', 'noRange'].includes(labStatus(r).key);

// A printed range as numbers, when it is one: "15 to 150", "15-150",
// "0.4 - 4.0", "<5", "> 60". Anything else ("Negative") has no numbers.
export function parseRange(text: string | null | undefined): { low: number | null; high: number | null } {
  const t = (text ?? '').trim();
  const both = t.match(/^(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)/i);
  if (both) return { low: Number(both[1]), high: Number(both[2]) };
  const below = t.match(/^(?:<|≤|<=|less than|under)\s*(\d+(?:\.\d+)?)/i);
  if (below) return { low: null, high: Number(below[1]) };
  const above = t.match(/^(?:>|≥|>=|greater than|over)\s*(\d+(?:\.\d+)?)/i);
  if (above) return { low: Number(above[1]), high: null };
  return { low: null, high: null };
}

// Where her value sits on a bar whose middle third is the lab's range.
// Far outside stays on the bar at its end rather than off it.
export function rangePosition(r: LabResult): { value: number; low: number; high: number } | null {
  if (r.value == null || (r.low == null && r.high == null)) return null;
  const lo = r.low ?? 0;
  const hi = r.high ?? lo * 2;
  if (hi <= lo) return null;
  const at = 1 / 3 + ((r.value - lo) / (hi - lo)) / 3;
  return { value: Math.min(1, Math.max(0, at)), low: 1 / 3, high: 2 / 3 };
}

export type LabDraw = { on: string; lab: string | null; results: LabResult[]; outside: number };

// One visit: the results collected on one day at one lab, newest first.
export function labDraws(results: readonly LabResult[]): LabDraw[] {
  const groups = new Map<string, LabResult[]>();
  for (const r of results) {
    const key = `${r.on}|${r.lab ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()]
    .map((rs) => ({ on: rs[0].on, lab: rs[0].lab, results: rs, outside: rs.filter(isOutside).length }))
    .sort((a, b) => b.on.localeCompare(a.on));
}

// Every result for one test, oldest first.
export function labHistory(results: readonly LabResult[], name: string): LabResult[] {
  const key = name.trim().toLowerCase();
  return results.filter((r) => r.name.trim().toLowerCase() === key).sort((a, b) => a.on.localeCompare(b.on));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const labDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
};

export function latestSummary(results: readonly LabResult[]): string | null {
  const latest = labDraws(results)[0];
  if (!latest) return null;
  return `${latest.outside} of ${latest.results.length} outside range in your latest labs, ${labDay(latest.on)}`;
}

// ── Reading a report ───────────────────────────────────────────

export type ScannedTest = {
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  low: number | null;
  high: number | null;
  rangeText: string | null;
  flag: LabFlag | null;
  // The heading it is printed under: "Complete Blood Count", "Lipid Panel".
  panel: string | null;
};

export type LabScan = {
  notLab: boolean;
  on: string | null;
  lab: string | null;
  orderingClinician: string | null;
  specimen: string | null;
  pages: number | null;
  // Pages of the report the model could not read, so she can check them.
  unreadablePages: number[];
  tests: ScannedTest[];
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pageNumber = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null);

// A long portal export can carry a few hundred results; past this it is not
// one report.
const MAX_TESTS = 300;

// What the model returned, checked. A test with no name, or with neither a
// number nor words for its result, is dropped; a flag that is not an HL7
// code is dropped; nothing is filled in. She checks every line after this.
export function readLabScan(json: unknown): LabScan {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const day = str(j.collected_on);
  const pages = pageNumber(j.pages);
  const tests: ScannedTest[] = [];
  for (const raw of Array.isArray(j.tests) ? j.tests : []) {
    const t = (raw ?? {}) as Record<string, unknown>;
    const name = str(t.name);
    const value = num(t.value);
    const valueText = str(t.value_text);
    if (!name || (value == null && !valueText)) continue;
    const rangeText = str(t.range);
    const flag = str(t.flag)?.toUpperCase() as LabFlag | undefined;
    tests.push({
      name,
      value,
      valueText: value == null ? valueText : null,
      unit: str(t.unit),
      ...parseRange(rangeText),
      rangeText,
      flag: flag && FLAGS.includes(flag) ? flag : null,
      panel: str(t.panel),
    });
  }
  const unreadable = new Set<number>();
  for (const p of Array.isArray(j.unreadable_pages) ? j.unreadable_pages : []) {
    const n = pageNumber(p);
    if (n != null && (pages == null || n <= pages)) unreadable.add(n);
  }
  return {
    notLab: j.not_lab === true,
    on: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    lab: str(j.lab),
    orderingClinician: str(j.ordering_clinician),
    specimen: str(j.specimen),
    pages,
    unreadablePages: [...unreadable].sort((a, b) => a - b),
    tests: tests.slice(0, MAX_TESTS),
  };
}

// A line she checked on the review screen, read back. A value that is a
// number is kept as one; anything else is kept as her words. A line with no
// name or no result is not a result.
export function testFromFields(f: {
  name: string;
  value: string;
  unit: string;
  range: string;
  flag: LabFlag | null;
  panel?: string | null;
}): ScannedTest | null {
  const name = f.name.trim();
  const raw = f.value.trim();
  if (!name || !raw) return null;
  const n = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
  const rangeText = f.range.trim() || null;
  return {
    name,
    value: n,
    valueText: n == null ? raw : null,
    unit: f.unit.trim() || null,
    ...parseRange(rangeText),
    rangeText,
    flag: f.flag,
    panel: f.panel?.trim() || null,
  };
}

export const OTHER_RESULTS = 'Other results';

// Lines under the panel heading they were printed under, panels in the
// order they first appear, and anything without one last.
export function groupByPanel<T extends { panel: string | null }>(items: readonly T[]): { title: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const loose: T[] = [];
  for (const item of items) {
    if (!item.panel) {
      loose.push(item);
      continue;
    }
    const list = groups.get(item.panel) ?? [];
    list.push(item);
    groups.set(item.panel, list);
  }
  const out = [...groups].map(([title, list]) => ({ title, items: list }));
  return loose.length ? [...out, { title: OTHER_RESULTS, items: loose }] : out;
}

// Her labs as the visits the insight engine and the body view read, in the
// shape the example person's draws always had: "12 Jun 2026", "12 ng/mL",
// "15 to 150". Only numbers with both ends of a range, since that is all
// those two compare; the status is the one Labs shows.
export type DrawLike = { date: string; lab: string | null; results: { name: string; value: string; range: string; status: 'In' | 'Low' | 'High' }[] };

export function drawsFromLabs(labs: readonly LabResult[]): DrawLike[] {
  return labDraws(labs)
    .map((d) => ({
      date: labDay(d.on),
      lab: d.lab,
      results: d.results
        .filter((r) => r.value != null && r.low != null && r.high != null)
        .map((r) => {
          const k = labStatus(r).key;
          const status: 'In' | 'Low' | 'High' = k === 'low' || k === 'criticalLow' ? 'Low' : k === 'high' || k === 'criticalHigh' ? 'High' : 'In';
          return { name: r.name, value: `${r.value}${r.unit ? ` ${r.unit}` : ''}`, range: `${r.low} to ${r.high}`, status };
        }),
    }))
    .filter((d) => d.results.length);
}
