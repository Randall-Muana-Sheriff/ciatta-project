// A stand in for the model, for local tests only. good: built from the
// document's own words. bad: a dose and advice the document never gave.

import type { DocAnalysis } from './check.ts';
import type { DocFacts } from './facts.ts';

export function fakeDocAnalysis(facts: DocFacts, kind: 'good' | 'bad'): DocAnalysis {
  if (kind === 'bad') {
    return { urgent: [], summary: 'Take 900 mg daily and stop all your medications.', terms: [], findings: [], patterns: [], considerations: [], next_steps: [], questions: [] };
  }
  const v = (facts.document.extraction.visit ?? {}) as { diagnoses?: { name: string }[] };
  const first = v.diagnoses?.[0]?.name;
  return {
    urgent: [],
    summary: 'This document was read and filed into your record.',
    terms: [],
    findings: first ? [{ item: first, explanation: `${first} is named in this document.`, relevance: null }] : [],
    patterns: [],
    considerations: [],
    next_steps: [],
    questions: ['What does this document mean for me?'],
  };
}
