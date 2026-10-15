// The clinical AI analysis as the app reads, dates and prints it. The
// analysis itself is written and checked by the lab-analysis function;
// this only reads what was stored, says whether it is out of date, and
// finds the critical results from the lab's own flags.

import { type LabResult, labDay, testKey } from './labs';

export type Analysis = {
  urgent: { test: string; value: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  findings: { test: string; value: string; explanation: string; common_causes: string[]; relevance: string | null }[];
  patterns: { title: string; tests: string[]; explanation: string }[];
  considerations: { condition: string; tests: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_tests: { test: string; reason: string }[];
  questions: string[];
};

export type StoredAnalysis = { analysis: Analysis; model: string; createdAt: string; factsHash: string };

export const ANALYSIS_LABEL = 'Clinical AI analysis. Not a diagnosis. Discuss it with your clinician.';

export const ACTION_WORDS: Record<'contact_today' | 'urgent_care', string> = {
  contact_today: 'Contact your clinician today',
  urgent_care: 'Seek urgent care',
};

const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function readStoredAnalysis(row: unknown): StoredAnalysis | null {
  const r = (row && typeof row === 'object' ? row : null) as Record<string, unknown> | null;
  const a = (r?.analysis && typeof r.analysis === 'object' ? r.analysis : null) as Record<string, unknown> | null;
  if (!r || !a || typeof a.summary !== 'string' || !a.summary.trim() || typeof r.model !== 'string') return null;
  return {
    analysis: {
      summary: a.summary,
      urgent: arr(a.urgent) as Analysis['urgent'],
      findings: arr(a.findings) as Analysis['findings'],
      patterns: arr(a.patterns) as Analysis['patterns'],
      considerations: arr(a.considerations) as Analysis['considerations'],
      next_tests: arr(a.next_tests) as Analysis['next_tests'],
      questions: arr(a.questions).filter((q): q is string => typeof q === 'string'),
    },
    model: r.model,
    createdAt: String(r.created_at ?? ''),
    factsHash: String(r.facts_hash ?? ''),
  };
}

// The same fingerprint the function stores (lab-analysis/facts.ts): the
// report's results, and the first five earlier results of each of its
// tests from `earlier`, which is her results before the draw, newest first
// by time then id (repo.loadLabsBefore), the same rows the function reads.
export function reportFingerprint(report: LabResult[], earlier: LabResult[]): string {
  const keys = new Set(report.map((t) => testKey(t.name)));
  const kept = new Map<string, number>();
  const picked: LabResult[] = [];
  for (const e of earlier) {
    const k = testKey(e.name);
    if (!keys.has(k) || (kept.get(k) ?? 0) >= 5) continue;
    kept.set(k, (kept.get(k) ?? 0) + 1);
    picked.push(e);
  }
  return [...report, ...picked]
    .map((t) => `${testKey(t.name)}|${t.value ?? t.valueText ?? ''}|${(t.unit ?? '').trim().toLowerCase()}|${t.on}`)
    .sort()
    .join('\n');
}

export const analysisStale = (stored: StoredAnalysis, report: LabResult[], earlier: LabResult[]) => stored.factsHash !== reportFingerprint(report, earlier);

// What the urgent banner says. Every result the lab flagged as critical,
// always, from the lab's own flags; the analysis adds its reason where it
// has one, and its other urgent items after. The banner never depends on
// the model to know a result is critical.
export function urgentLines(results: LabResult[], analysis: Analysis | null): string[] {
  const value = (r: LabResult) => `${r.value ?? r.valueText ?? ''}${r.value != null && r.unit ? ` ${r.unit}` : ''}`;
  const said = new Map((analysis?.urgent ?? []).map((u) => [testKey(u.test), u]));
  const critical = criticalResults(results);
  const keys = new Set(critical.map((r) => testKey(r.name)));
  const lines = critical.map((r) => {
    const u = said.get(testKey(r.name));
    return u ? `${r.name} ${value(r)}. ${u.reason} ${ACTION_WORDS[u.action]}.` : `${r.name} ${value(r)} was flagged as critical by the lab. Contact your clinician today.`;
  });
  for (const u of analysis?.urgent ?? []) {
    if (!keys.has(testKey(u.test))) lines.push(`${u.test} ${u.value}. ${u.reason} ${ACTION_WORDS[u.action]}.`);
  }
  return lines;
}

export const criticalResults = (results: LabResult[]) => results.filter((r) => r.flag === 'HH' || r.flag === 'LL' || r.flag === 'AA');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function analysisHtml(title: string, on: string, stored: StoredAnalysis): string {
  const a = stored.analysis;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const section = (heading: string, body: string) => (body ? `<h2>${heading}</h2>${body}` : '');
  return `<html><body style="font-family: -apple-system, Helvetica; padding: 24px; color: #161616">
<h1>${esc(title)}, ${esc(labDay(on))}</h1>
<p><strong>${ANALYSIS_LABEL}</strong></p>
<p>Written by ${esc(stored.model)} on ${esc(labDay(stored.createdAt.slice(0, 10)))} from the results on this report.</p>
${section('Urgent', list(a.urgent.map((u) => `${u.test} ${u.value}: ${u.reason} ${ACTION_WORDS[u.action]}.`)))}
${section('Summary', `<p>${esc(a.summary)}</p>`)}
${section('Findings', list(a.findings.map((f) => `${f.test} ${f.value}: ${f.explanation}${f.relevance ? ` ${f.relevance}` : ''}`)))}
${section('Patterns', list(a.patterns.map((p) => `${p.title}: ${p.explanation}`)))}
${section('Conditions to consider', list(a.considerations.map((c) => `${c.condition} (${c.confidence} confidence): ${c.how_confirmed}`)))}
${section('Suggested next tests', list(a.next_tests.map((n) => `${n.test}: ${n.reason}`)))}
${section('Questions for your clinician', list(a.questions))}
</body></html>`;
}
