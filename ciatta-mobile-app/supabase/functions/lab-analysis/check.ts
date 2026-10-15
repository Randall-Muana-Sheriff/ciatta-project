// Reading what the model returned, and checking it against her record.
//
// Nothing the model says reaches her unchecked. An analysis is refused if
// it names a test she does not have, quotes a value that is not hers,
// carries a number that is in no fact, gives a dose, tells her to start or
// stop a medication, leaves a critical result out of urgent, or runs long.
// Pure; tested from the app's suite.

import type { Facts } from './facts.ts';
import { testKey } from './keys.ts';

export type Analysis = {
  urgent: { test: string; value: string; reason: string; action: 'contact_today' | 'urgent_care' }[];
  summary: string;
  findings: { test: string; value: string; explanation: string; common_causes: string[]; relevance: string | null }[];
  patterns: { title: string; tests: string[]; explanation: string }[];
  considerations: { condition: string; tests: string[]; confidence: 'low' | 'moderate' | 'high'; how_confirmed: string }[];
  next_tests: { test: string; reason: string }[];
  questions: string[];
};

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(s).filter((x): x is string => !!x) : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[] : []);

export function readAnalysis(json: unknown): Analysis | null {
  const j = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null;
  const summary = j ? s(j.summary) : null;
  if (!j || !summary) return null;
  return {
    summary,
    urgent: objs(j.urgent)
      .map((u) => ({ test: s(u.test), value: s(u.value), reason: s(u.reason), action: u.action }))
      .filter((u): u is Analysis['urgent'][number] => !!u.test && !!u.value && !!u.reason && (u.action === 'contact_today' || u.action === 'urgent_care')),
    findings: objs(j.findings)
      .map((f) => ({ test: s(f.test), value: s(f.value), explanation: s(f.explanation), common_causes: strs(f.common_causes), relevance: s(f.relevance) }))
      .filter((f): f is Analysis['findings'][number] => !!f.test && !!f.value && !!f.explanation),
    patterns: objs(j.patterns)
      .map((p) => ({ title: s(p.title), tests: strs(p.tests), explanation: s(p.explanation) }))
      .filter((p): p is Analysis['patterns'][number] => !!p.title && p.tests.length > 0 && !!p.explanation),
    considerations: objs(j.considerations)
      .map((c) => ({ condition: s(c.condition), tests: strs(c.tests), confidence: c.confidence, how_confirmed: s(c.how_confirmed) }))
      .filter(
        (c): c is Analysis['considerations'][number] =>
          !!c.condition && c.tests.length > 0 && !!c.how_confirmed && (c.confidence === 'low' || c.confidence === 'moderate' || c.confidence === 'high'),
      ),
    next_tests: objs(j.next_tests)
      .map((n) => ({ test: s(n.test), reason: s(n.reason) }))
      .filter((n): n is Analysis['next_tests'][number] => !!n.test && !!n.reason),
    questions: strs(j.questions),
  };
}

const LIMITS = { findings: 12, patterns: 8, considerations: 6, next_tests: 8, questions: 10 } as const;

// A number standing on its own, not part of a name like T4, B12 or A1c.
const NUMBER = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?(?![A-Za-z0-9])/g;
const DOSE = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?\s?(?:mg|mcg|µg|iu|units?|g)\b(?!\s*\/)/i;
const CHANGE_MED = /\b(?:start|stop|begin|discontinue|increase|decrease|reduce|raise|double|halve)\s+(?:taking\s+|using\s+|your\s+|the\s+|a\s+)*(?:\w+\s+){0,2}(?:medication|medicine|dose|dosage|prescription|pills?|tablets?)\b/i;

// Names that carry a number of their own ("25 hydroxy vitamin D",
// "1,25 dihydroxy") are taken out first, so the number is not read as a
// value.
const NAMED_NUMBER = /(?<![A-Za-z0-9.])\d+(?:,\s*\d+)?\s*(?:hydroxy|dihydroxy|oh)\b/gi;
const numbersIn = (text: string) => [...text.replace(NAMED_NUMBER, ' ').matchAll(NUMBER)].map((m) => Number(m[0]));

export function checkAnalysis(a: Analysis, facts: Facts): string[] {
  const problems: string[] = [];
  const known = new Map<string, number[]>();
  const add = (name: string, v: number | null) => {
    const k = testKey(name);
    known.set(k, [...(known.get(k) ?? []), ...(v != null ? [v] : [])]);
  };
  for (const t of facts.tests) add(t.name, t.value);
  for (const e of facts.earlier) for (const r of e.results) add(e.name, r.value);

  // Every number the text may carry: values, ranges, dates, the cycle.
  const allowed = new Set<number>();
  for (const t of facts.tests) {
    for (const n of [t.value, t.low, t.high]) if (n != null) allowed.add(n);
    for (const n of numbersIn(t.range ?? '')) allowed.add(n);
  }
  for (const e of facts.earlier) for (const r of e.results) if (r.value != null) allowed.add(r.value);
  for (const d of [facts.collected_on, ...facts.earlier.flatMap((e) => e.results.map((r) => r.on))]) {
    for (const part of d.split('-').map(Number)) allowed.add(part);
  }
  if (facts.cycle) {
    allowed.add(facts.cycle.day);
    if (facts.cycle.usual_length != null) allowed.add(facts.cycle.usual_length);
  }
  for (const sym of facts.symptoms) allowed.add(sym.count);
  for (let i = 1; i <= 12; i++) allowed.add(i);

  const testNamed = (name: string, where: string) => {
    if (!known.has(testKey(name))) problems.push(`${where} names ${name}, which is not in her record`);
  };
  const valueQuoted = (name: string, value: string, where: string) => {
    const quoted = numbersIn(value)[0];
    const hers = known.get(testKey(name)) ?? [];
    if (quoted == null || !hers.includes(quoted)) problems.push(`${where} quotes ${value} for ${name}, which is not her value`);
  };

  for (const u of a.urgent) {
    testNamed(u.test, 'urgent');
    valueQuoted(u.test, u.value, 'urgent');
  }
  for (const f of a.findings) {
    testNamed(f.test, 'a finding');
    valueQuoted(f.test, f.value, 'a finding');
  }
  for (const p of a.patterns) for (const t of p.tests) testNamed(t, 'a pattern');
  for (const c of a.considerations) for (const t of c.tests) testNamed(t, 'a consideration');

  const texts = [
    a.summary,
    ...a.urgent.map((u) => u.reason),
    ...a.findings.flatMap((f) => [f.explanation, ...f.common_causes, f.relevance ?? '']),
    ...a.patterns.flatMap((p) => [p.title, p.explanation]),
    ...a.considerations.flatMap((c) => [c.condition, c.how_confirmed]),
    ...a.next_tests.flatMap((n) => [n.test, n.reason]),
    ...a.questions,
  ];
  for (const text of texts) {
    for (const n of numbersIn(text)) if (!allowed.has(n)) problems.push(`the number ${n} is in no fact`);
    if (DOSE.test(text)) problems.push('it gives a dose');
    if (CHANGE_MED.test(text)) problems.push('it tells her to change a medication');
    for (const med of [...facts.medications, ...facts.supplements]) {
      const m = new RegExp(`\\b(?:start|stop|discontinue|increase|decrease|reduce|raise)\\b[^.]{0,30}\\b${med.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (m.test(text)) problems.push('it tells her to change a medication');
    }
  }

  if (facts.tests.some((t) => t.flag === 'HH' || t.flag === 'LL' || t.flag === 'AA') && !a.urgent.length) {
    problems.push('a critical result is not marked urgent');
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if ((a[key as keyof typeof LIMITS] as unknown[]).length > max) problems.push(`more than ${max} ${key}`);
  }
  return [...new Set(problems)];
}

const NULLABLE = (type: string) => ({ type: [type, 'null'] });
const STR = { type: 'string' };
const STRS = { type: 'array', items: STR };

export const ANALYSIS_SCHEMA = {
  name: 'lab_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['urgent', 'summary', 'findings', 'patterns', 'considerations', 'next_tests', 'questions'],
    properties: {
      urgent: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['test', 'value', 'reason', 'action'],
          properties: { test: STR, value: STR, reason: STR, action: { type: 'string', enum: ['contact_today', 'urgent_care'] } },
        },
      },
      summary: STR,
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['test', 'value', 'explanation', 'common_causes', 'relevance'],
          properties: { test: STR, value: STR, explanation: STR, common_causes: STRS, relevance: NULLABLE('string') },
        },
      },
      patterns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'tests', 'explanation'],
          properties: { title: STR, tests: STRS, explanation: STR },
        },
      },
      considerations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['condition', 'tests', 'confidence', 'how_confirmed'],
          properties: { condition: STR, tests: STRS, confidence: { type: 'string', enum: ['low', 'moderate', 'high'] }, how_confirmed: STR },
        },
      },
      next_tests: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['test', 'reason'], properties: { test: STR, reason: STR } },
      },
      questions: STRS,
    },
  },
};
