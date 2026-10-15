// The clinical AI analysis as the app reads, dates and prints it. The
// analysis itself is written and checked by the lab-analysis function;
// this only reads what was stored, says whether it is out of date, and
// finds the critical results from the lab's own flags.

import { type LabResult, labDay, labHistory, testKey } from './labs';

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
// report's results, and up to five earlier results for each of its tests.
export function reportFingerprint(report: LabResult[], all: LabResult[]): string {
  const on = report[0]?.on ?? '';
  const earlier: LabResult[] = [];
  const seen = new Set<string>();
  for (const t of report) {
    const k = testKey(t.name);
    if (seen.has(k)) continue;
    seen.add(k);
    earlier.push(...labHistory(all, t.name).filter((h) => h.on < on).reverse().slice(0, 5));
  }
  return [...report, ...earlier]
    .map((t) => `${testKey(t.name)}|${t.value ?? t.valueText ?? ''}|${(t.unit ?? '').trim().toLowerCase()}|${t.on}`)
    .sort()
    .join('\n');
}

export const analysisStale = (stored: StoredAnalysis, report: LabResult[], all: LabResult[]) => stored.factsHash !== reportFingerprint(report, all);

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
