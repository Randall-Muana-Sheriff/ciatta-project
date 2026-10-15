// Reading what the model wrote about a document, and checking it against
// the document and her record. Refused when it explains a term the
// document never used, names something in neither, carries a number in no
// fact, gives a dose the document did not print, gives medication advice
// that is not the document's own credited instruction, misses the
// document's own urgent words, or runs long. Pure; tested from the app.

import { changesMedication, doseMatches, escape, fold, medsNamed, numbersIn, URGENT_WORDS } from '../_shared/textChecks.ts';
import { type DocFacts, documentMedLines, documentMeds, documentText, urgentText } from './facts.ts';

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

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(s).filter((x): x is string => !!x) : []);
const objs = (v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []);

export function readDocAnalysis(json: unknown): DocAnalysis | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null;
  const summary = j ? s(j.summary) : null;
  if (!j || !summary) return null;
  return {
    summary,
    urgent: objs(j.urgent)
      .map((u) => ({ item: s(u.item), reason: s(u.reason), action: u.action }))
      .filter((u): u is DocAnalysis['urgent'][number] => !!u.item && !!u.reason && (u.action === 'contact_today' || u.action === 'urgent_care')),
    terms: objs(j.terms)
      .map((t) => ({ term: s(t.term), meaning: s(t.meaning) }))
      .filter((t): t is DocAnalysis['terms'][number] => !!t.term && !!t.meaning),
    findings: objs(j.findings)
      .map((f) => ({ item: s(f.item), explanation: s(f.explanation), relevance: s(f.relevance) }))
      .filter((f): f is DocAnalysis['findings'][number] => !!f.item && !!f.explanation),
    patterns: objs(j.patterns)
      .map((p) => ({ title: s(p.title), items: strs(p.items), explanation: s(p.explanation) }))
      .filter((p): p is DocAnalysis['patterns'][number] => !!p.title && p.items.length > 0 && !!p.explanation),
    considerations: objs(j.considerations)
      .map((c) => ({ condition: s(c.condition), items: strs(c.items), confidence: c.confidence, how_confirmed: s(c.how_confirmed) }))
      .filter(
        (c): c is DocAnalysis['considerations'][number] =>
          !!c.condition && c.items.length > 0 && !!c.how_confirmed && (c.confidence === 'low' || c.confidence === 'moderate' || c.confidence === 'high'),
      ),
    next_steps: objs(j.next_steps)
      .map((n) => ({ step: s(n.step), reason: s(n.reason) }))
      .filter((n): n is DocAnalysis['next_steps'][number] => !!n.step && !!n.reason),
    questions: strs(j.questions),
  };
}

const LIMITS = { terms: 12, findings: 12, patterns: 8, considerations: 6, next_steps: 8, questions: 10 } as const;
// A sentence that credits an instruction to the document or its clinician.
const CREDITED = /\b(this|your|the)\s+(visit summary|discharge (?:papers|summary|instructions)|summary|document|note|notes|report|prescription|clinician|doctor|care team)\b[^.]{0,80}?\b(say|says|said|state|states|instruct|instructs|instructed|list|lists|listed|record|records|recorded|start|starts|started|stop|stops|stopped|note|notes|noted|prescribe|prescribes|prescribed|tell|tells|told|recommend|recommends|recommended)\b|\baccording to (your|the|this)\b/i;

export function checkDocumentAnalysis(a: DocAnalysis, facts: DocFacts): string[] {
  const problems: string[] = [];
  const docText = documentText(facts.document.extraction);
  const docFold = fold(docText);
  const docMeds = documentMeds(facts.document.extraction);
  const r = facts.record;
  const recordNames = [...r.conditions, ...r.medications, ...r.supplements, ...r.procedures.map((p) => p.name), ...r.labs.map((l) => l.name)].map(fold);

  // Whole words only: "PE" is not found in "pelvic", and a one letter item
  // is never known.
  const inText = (needle: string, hay: string) => needle.length >= 2 && new RegExp(`(?<![a-z0-9])${escape(needle)}(?![a-z0-9])`, 'i').test(hay);
  const known = (item: string) => {
    const f = fold(item);
    if (f.length < 3) return false;
    return inText(f, docFold) || recordNames.some((n) => n === f || inText(f, n) || inText(n, f));
  };

  const allowed = new Set<number>(numbersIn(docText));
  for (const l of r.labs) {
    for (const n of [l.value]) if (n != null) allowed.add(n);
    for (const n of numbersIn(l.range ?? '')) allowed.add(n);
    for (const part of l.on.split('-').map(Number)) allowed.add(part);
  }
  for (const d of [facts.document.date, ...r.procedures.map((p) => p.on)]) for (const part of (d ?? '').split('-').filter(Boolean).map(Number)) allowed.add(part);
  if (r.cycle) {
    allowed.add(r.cycle.day);
    if (r.cycle.usual_length != null) allowed.add(r.cycle.usual_length);
  }
  for (const n of numbersIn(r.profile.age_range ?? '')) allowed.add(n);
  for (const sym of r.symptoms) allowed.add(sym.count);
  for (let i = 1; i <= 12; i++) allowed.add(i);

  for (const t of a.terms) if (!inText(fold(t.term), docFold)) problems.push(`the term ${t.term} is not in the document`);
  for (const u of a.urgent) if (!known(u.item)) problems.push(`urgent names ${u.item}, which is in neither the document nor her record`);
  for (const f of a.findings) if (!known(f.item)) problems.push(`a finding names ${f.item}, which is in neither the document nor her record`);
  for (const p of a.patterns) for (const i of p.items) if (!known(i)) problems.push(`a pattern names ${i}, which is in neither the document nor her record`);
  for (const c of a.considerations) for (const i of c.items) if (!known(i)) problems.push(`a consideration names ${i}, which is in neither the document nor her record`);

  const medLines = documentMedLines(facts.document.extraction);
  const allMeds = [...new Set([...docMeds, ...r.medications, ...r.supplements])];
  // A dose is allowed only as the document printed it, for that medication
  // when the sentence names one.
  const doseAllowed = (dose: string, sentence: string) => {
    const named = medsNamed(sentence, allMeds);
    const lines = named.length ? medLines.filter((l) => named.some((n) => fold(l.name) === fold(n) || (!l.name && fold(l.text).includes(fold(n))))) : medLines.length ? medLines : [{ name: '', text: docText }];
    return lines.some((l) => doseMatches(l.text).includes(dose));
  };
  const texts: { text: string; question: boolean }[] = [
    a.summary,
    ...a.urgent.flatMap((u) => [u.item, u.reason]),
    ...a.terms.flatMap((t) => [t.term, t.meaning]),
    ...a.findings.flatMap((f) => [f.item, f.explanation, f.relevance ?? '']),
    ...a.patterns.flatMap((p) => [p.title, p.explanation]),
    ...a.considerations.flatMap((c) => [c.condition, c.how_confirmed]),
    ...a.next_steps.flatMap((n) => [n.step, n.reason]),
  ].map((text) => ({ text, question: false }));
  for (const q of a.questions) texts.push({ text: q, question: true });
  for (const { text, question } of texts) {
    for (const n of numbersIn(text)) if (!allowed.has(n)) problems.push(`the number ${n} is in no fact`);
    for (const sentence of text.split(/(?<=[.!?;])\s+/)) {
      for (const dose of doseMatches(sentence)) if (!doseAllowed(dose, sentence)) problems.push(`it gives a dose (${dose}) the document did not print for that medication`);
      // A question for her clinician asks; it does not advise.
      if (question && sentence.trim().endsWith('?')) continue;
      if (!changesMedication(sentence, allMeds)) continue;
      const named = medsNamed(sentence, allMeds);
      const credited = CREDITED.test(sentence);
      const fromDocument = named.length > 0 && named.every((m) => docMeds.some((d) => fold(d) === fold(m)));
      if (!credited || !fromDocument) problems.push('it tells her to change a medication that the document does not instruct');
    }
  }

  const urgentInDocument = URGENT_WORDS.test(urgentText(facts.document.extraction));
  if (urgentInDocument && !a.urgent.length) problems.push('the document uses urgent words and nothing is marked urgent');

  for (const [key, max] of Object.entries(LIMITS)) {
    if ((a[key as keyof typeof LIMITS] as unknown[]).length > max) problems.push(`more than ${max} ${key}`);
  }
  return [...new Set(problems)];
}

const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };
const OBJ = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

export const DOC_ANALYSIS_SCHEMA = {
  name: 'document_analysis',
  strict: true,
  schema: OBJ({
    urgent: { type: 'array', items: OBJ({ item: STR, reason: STR, action: { type: 'string', enum: ['contact_today', 'urgent_care'] } }) },
    summary: STR,
    terms: { type: 'array', items: OBJ({ term: STR, meaning: STR }) },
    findings: { type: 'array', items: OBJ({ item: STR, explanation: STR, relevance: { type: ['string', 'null'] } }) },
    patterns: { type: 'array', items: OBJ({ title: STR, items: STRS, explanation: STR }) },
    considerations: { type: 'array', items: OBJ({ condition: STR, items: STRS, confidence: { type: 'string', enum: ['low', 'moderate', 'high'] }, how_confirmed: STR }) },
    next_steps: { type: 'array', items: OBJ({ step: STR, reason: STR }) },
    questions: STRS,
  }),
};
