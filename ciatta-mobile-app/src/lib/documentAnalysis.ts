// The document analysis as the app reads, dates and prints it, and the
// urgent banner, which shows the document's own urgent words whatever the
// analysis says.

import { labDay } from './labs';

export type DocAnalysis = {
  urgent: { item: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  terms: { term: string; meaning: string }[];
  findings: { item: string; explanation: string; relevance: string | null }[];
  patterns: { title: string; items: string[]; explanation: string }[];
  considerations: { condition: string; items: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_steps: { step: string; reason: string }[];
  questions: string[];
};

export type StoredDocAnalysis = { analysis: DocAnalysis; model: string; createdAt: string; factsHash: string };

const ACTION: Record<'contact_today' | 'urgent_care', string> = { contact_today: 'Contact your clinician today', urgent_care: 'Seek urgent care' };
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

export function readStoredDocAnalysis(row: unknown): StoredDocAnalysis | null {
  const r = (row && typeof row === 'object' ? row : null) as Record<string, unknown> | null;
  const a = (r?.analysis && typeof r.analysis === 'object' ? r.analysis : null) as Record<string, unknown> | null;
  if (!r || !a || typeof a.summary !== 'string' || !a.summary.trim() || typeof r.model !== 'string') return null;
  return {
    analysis: {
      summary: a.summary,
      urgent: arr(a.urgent) as DocAnalysis['urgent'],
      terms: arr(a.terms) as DocAnalysis['terms'],
      findings: arr(a.findings) as DocAnalysis['findings'],
      patterns: arr(a.patterns) as DocAnalysis['patterns'],
      considerations: arr(a.considerations) as DocAnalysis['considerations'],
      next_steps: arr(a.next_steps) as DocAnalysis['next_steps'],
      questions: arr(a.questions).filter((q): q is string => typeof q === 'string'),
    },
    model: r.model,
    createdAt: String(r.created_at ?? ''),
    factsHash: String(r.facts_hash ?? ''),
  };
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}
export const extractionFingerprint = (extraction: unknown) => JSON.stringify(stable(extraction));

const URGENT = /\b(urgent|urgently|critical|emergency|call 911|immediately|stat|seek (?:immediate|emergency) care)\b/i;
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => strings(x, out));
  return out;
}

// Where a document says something is urgent: its instructions, findings
// and impression, not names. The same as lab-analysis's urgentText.
function urgentSources(extraction: unknown): string[] {
  const x = (extraction && typeof extraction === 'object' ? extraction : {}) as Record<string, unknown>;
  const visit = (x.visit ?? {}) as Record<string, unknown>;
  const report = (x.report ?? {}) as Record<string, unknown>;
  return [...(Array.isArray(visit.instructions) ? visit.instructions : []), report.findings, report.impression].filter((t): t is string => typeof t === 'string');
}

export function documentUrgentLines(extraction: unknown, analysis: DocAnalysis | null): string[] {
  const lines = urgentSources(extraction)
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .filter((sentence) => URGENT.test(sentence))
    .map((sentence) => `The document says: ${sentence.trim()}`);
  for (const u of analysis?.urgent ?? []) lines.push(`${u.item}. ${u.reason} ${ACTION[u.action]}.`);
  return [...new Set(lines)];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function docAnalysisHtml(title: string, on: string, stored: StoredDocAnalysis): string {
  const a = stored.analysis;
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const section = (h: string, body: string) => (body ? `<h2>${h}</h2>${body}` : '');
  return `<html><body style="font-family: -apple-system, Helvetica; padding: 24px; color: #161616">
<h1>${esc(title)}, ${esc(labDay(on))}</h1>
<p><strong>Clinical AI analysis. Not a diagnosis. Discuss it with your clinician.</strong></p>
<p>Written by ${esc(stored.model)} on ${esc(labDay(stored.createdAt.slice(0, 10)))}.</p>
${section('Urgent', list(a.urgent.map((u) => `${u.item}: ${u.reason} ${ACTION[u.action]}.`)))}
${section('Summary', `<p>${esc(a.summary)}</p>`)}
${section('Terms explained', list(a.terms.map((t) => `${t.term}: ${t.meaning}`)))}
${section('Findings', list(a.findings.map((f) => `${f.item}: ${f.explanation}${f.relevance ? ` ${f.relevance}` : ''}`)))}
${section('Patterns', list(a.patterns.map((p) => `${p.title}: ${p.explanation}`)))}
${section('Conditions to consider', list(a.considerations.map((c) => `${c.condition} (${c.confidence} confidence): ${c.how_confirmed}`)))}
${section('Next steps', list(a.next_steps.map((n) => `${n.step}: ${n.reason}`)))}
${section('Questions for your clinician', list(a.questions))}
</body></html>`;
}
