// The summary she shares with a clinician, as a PDF made on her phone.
//
// Pure: her record in, sections and a page of HTML out. Every line is a
// count, an average with how many days it rests on, a value with its date,
// or her own words, and each section says whether it was measured by her
// devices or logged by her. A section with nothing in it says so rather
// than disappearing, because "no symptoms logged" tells a clinician
// something and a missing heading tells them nothing.
//
// Her notes are her own words and are left out unless she includes them.

import { NAME } from './metricNames';
import type { Day } from '../data/daily';
import type { Reported } from '../data/repo';
import { fmtHours } from './engine';
import { isOutside, type LabResult, labStatus } from './labs';
import { formatTempChange } from './units';

export type SectionId = 'cycle' | 'symptoms' | 'measurements' | 'labs' | 'conditions' | 'medications' | 'supplements' | 'notes';

export const SECTION_TITLES: Record<SectionId, string> = {
  cycle: 'Cycle',
  symptoms: 'Symptoms',
  measurements: 'Measurements',
  labs: 'Labs',
  conditions: 'Conditions and procedures',
  medications: 'Medications',
  supplements: 'Supplements',
  notes: 'In her own words',
};

export const DEFAULT_SECTIONS: SectionId[] = ['cycle', 'symptoms', 'measurements', 'labs', 'conditions', 'medications', 'supplements'];

export type ReportInput = {
  from: Date;
  to: Date;
  name: string | null;
  days: readonly Day[];
  episodes: readonly { date: Date; kinds: string[]; symptoms: string[]; severity: number | null }[];
  logs: readonly { at: Date; category: string; items: Partial<Record<string, string[]>>; text: string }[];
  cycles: readonly { start: Date; length: number }[];
  reported: Reported | null;
  labs?: readonly LabResult[];
};

export type ReportRow = { label: string; value: string; note?: string };
export type ReportSection = { id: SectionId; title: string; source: string; rows: ReportRow[]; empty: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const longDate = (d: Date) => `${short(d)} ${d.getFullYear()}`;
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
};
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Logged items that are actions or context, not something she felt.
const NOT_SYMPTOMS = new Set(['meds', 'supplements', 'note', 'context', 'nutrition']);

export function reportSections(input: ReportInput, include: readonly SectionId[]): ReportSection[] {
  const inRange = (d: Date) => d >= input.from && d <= input.to;
  const out: ReportSection[] = [];
  const add = (id: SectionId, source: string, rows: ReportRow[], empty: string) => {
    if (include.includes(id)) out.push({ id, title: SECTION_TITLES[id], source, rows, empty: rows.length ? '' : empty });
  };

  // Cycle: lengths of the cycles that started in the period.
  const cycles = input.cycles.filter((c) => inRange(c.start)).sort((a, b) => a.start.getTime() - b.start.getTime());
  const lengths = cycles.map((c) => c.length);
  add(
    'cycle',
    'Logged by her',
    cycles.length
      ? [
          { label: 'Cycles recorded', value: String(cycles.length) },
          { label: 'Average length', value: `${Math.round(avg(lengths))} days` },
          ...(cycles.length > 1 ? [{ label: 'Shortest and longest', value: `${Math.min(...lengths)} and ${Math.max(...lengths)} days` }] : []),
          ...cycles.map((c) => ({ label: `Started ${short(c.start)}`, value: `${c.length} days` })),
        ]
      : [],
    'No complete cycles logged in this period.',
  );

  // Symptoms: every time she logged each one, with the worst rating she gave.
  const tally = new Map<string, { count: number; worst: number | null }>();
  const count = (name: string, severity: number | null) => {
    const was = tally.get(name) ?? { count: 0, worst: null };
    tally.set(name, { count: was.count + 1, worst: severity == null ? was.worst : Math.max(was.worst ?? 0, severity) });
  };
  for (const e of input.episodes) {
    if (!inRange(e.date)) continue;
    for (const k of e.kinds) if (k === 'Pain') count('Pain', e.severity);
    for (const s of e.symptoms) count(s, e.severity);
  }
  for (const l of input.logs) {
    if (!inRange(l.at) || NOT_SYMPTOMS.has(l.category)) continue;
    for (const [cat, items] of Object.entries(l.items)) {
      if (NOT_SYMPTOMS.has(cat)) continue;
      for (const item of items ?? []) count(item, null);
    }
  }
  add(
    'symptoms',
    'Logged by her',
    [...tally.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, t]) => ({
        label: name,
        value: `${t.count} ${t.count === 1 ? 'time' : 'times'}`,
        ...(t.worst != null ? { note: `worst ${t.worst} of 10` } : {}),
      })),
    'No symptoms logged in this period.',
  );

  // Measurements: averages over the days that have a reading, and how many.
  const days = input.days.filter((d) => inRange(dayOf(d.date)));
  const measured: ReportRow[] = [];
  const measure = (label: string, get: (d: Day) => number | null, say: (v: number) => string) => {
    const vs = days.map(get).filter((v): v is number => v != null);
    if (vs.length) measured.push({ label, value: `${say(avg(vs))} average`, note: `${vs.length} ${vs.length === 1 ? 'day' : 'days'} recorded` });
  };
  measure('Sleep', (d) => d.sleepHours, fmtHours);
  measure(NAME.rhr, (d) => d.restingHR, (v) => `${Math.round(v)} bpm`);
  measure(NAME.hrv, (d) => d.hrv, (v) => `${Math.round(v)} ms`);
  measure('Steps', (d) => d.steps, (v) => Math.round(v).toLocaleString('en-US'));
  measure(`${NAME.temp} from usual`, (d) => d.tempDeviation, (v) => `${formatTempChange(v)} ${v >= 0 ? 'above' : 'below'}`);
  add('measurements', 'Synced from her devices', measured, 'No device readings in this period.');

  // Labs: the latest result of each test in the period, outside its range
  // first, each with its status and the lab's own range.
  const latestByTest = new Map<string, LabResult>();
  for (const l of input.labs ?? []) {
    if (!inRange(dayOf(l.on))) continue;
    const key = l.name.trim().toLowerCase();
    const was = latestByTest.get(key);
    if (!was || l.on > was.on) latestByTest.set(key, l);
  }
  add(
    'labs',
    'From her providers and lab reports',
    [...latestByTest.values()]
      .sort((a, b) => Number(isOutside(b)) - Number(isOutside(a)) || a.name.localeCompare(b.name))
      .map((l) => ({
        label: l.name,
        value: l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? ''),
        note: `${labStatus(l).label}${l.rangeText ? `, range ${l.rangeText}` : ''}, ${short(dayOf(l.on))}`,
      })),
    'No labs in this period.',
  );

  const r = input.reported;
  add(
    'conditions',
    'Reported by her',
    [
      ...(r?.conditions ?? []).map((c) => ({ label: c, value: 'Condition' })),
      ...(r?.surgeries ?? []).map((c) => ({ label: c, value: 'Surgery or procedure' })),
    ],
    'No conditions or procedures recorded.',
  );
  add('medications', 'Reported by her', (r?.medications ?? []).map((m) => ({ label: m, value: 'Reported' })), 'No medications recorded.');
  add('supplements', 'Reported by her', (r?.supplements ?? []).map((m) => ({ label: m, value: 'Reported' })), 'No supplements recorded.');

  add(
    'notes',
    'Her own words',
    input.logs
      .filter((l) => inRange(l.at) && l.text.trim())
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 10)
      .map((l) => ({ label: short(l.at), value: l.text.trim() })),
    'No notes written in this period.',
  );
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function reportHtml(sections: readonly ReportSection[], meta: { from: Date; to: Date; name: string | null; made: Date }): string {
  const body = sections
    .map(
      (s) => `
  <section>
    <h2>${esc(s.title)}<span class="src">${esc(s.source)}</span></h2>
    ${
      s.rows.length
        ? `<table>${s.rows
            .map(
              (r) =>
                `<tr><td class="l">${esc(r.label)}</td><td class="v">${esc(r.value)}${r.note ? `<span class="n">${esc(r.note)}</span>` : ''}</td></tr>`,
            )
            .join('')}</table>`
        : `<p class="empty">${esc(s.empty)}</p>`
    }
  </section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 36px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; margin: 0 0 18px; }
  h2 { font-size: 14px; margin: 22px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .src { float: right; font-weight: normal; color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .l { width: 45%; color: #333; }
  .v { font-weight: 600; }
  .n { font-weight: normal; color: #666; margin-left: 8px; }
  .empty { color: #666; }
  footer { margin-top: 28px; color: #666; font-size: 10.5px; line-height: 1.5; }
</style></head><body>
  <h1>Health summary${meta.name ? ` for ${esc(meta.name)}` : ''}</h1>
  <p class="meta">${esc(`${longDate(meta.from)} to ${longDate(meta.to)}`)}. Made on ${esc(longDate(meta.made))} with Ciatta.</p>
  ${body}
  <footer>
    Prepared from her own record in Ciatta: what she logged and what her devices measured. Each section says which.
    Counts and averages only, with the days they rest on; nothing here is estimated beyond what is labelled.
    This summary is not a diagnosis and is not a substitute for clinical assessment.
  </footer>
</body></html>`;
}
