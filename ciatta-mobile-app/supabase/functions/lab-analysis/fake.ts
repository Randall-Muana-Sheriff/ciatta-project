// A stand in for the model, for local tests only (see index.ts for when it
// is allowed). good: a faithful analysis built from the facts. bad: one
// that quotes a value wrong and gives a dose, which the check must refuse.

import type { Analysis } from './check.ts';
import type { Facts } from './facts.ts';

export function fakeAnalysis(facts: Facts, kind: 'good' | 'bad'): Analysis {
  const first = facts.tests.find((t) => t.value != null) ?? facts.tests[0];
  const critical = facts.tests.filter((t) => t.flag === 'HH' || t.flag === 'LL' || t.flag === 'AA');
  const value = (t: typeof first) => `${t.value ?? t.value_text}${t.unit ? ` ${t.unit}` : ''}`;
  if (kind === 'bad') {
    return {
      urgent: [],
      summary: `Your ${first.name} is ${(first.value ?? 0) * 10}. Take 65 mg of iron daily.`,
      findings: [{ test: first.name, value: `${(first.value ?? 0) * 10}`, explanation: 'x', common_causes: [], relevance: null }],
      patterns: [],
      considerations: [],
      next_tests: [],
      questions: [],
    };
  }
  return {
    urgent: critical.map((t) => ({ test: t.name, value: value(t), reason: 'The lab flagged this as critical.', action: 'contact_today' as const })),
    summary: `This report has ${facts.tests.length} results.`,
    findings: facts.tests.filter((t) => t.flag).map((t) => ({ test: t.name, value: value(t), explanation: `${t.name} was flagged by the lab.`, common_causes: [], relevance: null })),
    patterns: [],
    considerations: [],
    next_tests: [],
    questions: ['What do these results mean for me?'],
  };
}
