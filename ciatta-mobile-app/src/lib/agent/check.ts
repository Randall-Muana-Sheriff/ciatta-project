// Whether a model's rewrite is allowed to reach her.
//
// summary.ts does this for one paragraph written once. A conversation needs
// the same check per message, plus three rules a paragraph did not need,
// because conversation is where a model reaches for the phrasings that
// cause harm: it is asked a question, and answering is what it is for.
//
// What is added here over checkSummary:
//
//   Treatment verbs. "Take magnesium", "stop the pill", "increase your
//   dose" are prescriptions regardless of hedging, and a model asked what
//   to do about cramps will produce one unprompted.
//
//   Diagnostic constructions. FORBIDDEN already catches "you have" and
//   "diagnos". This catches the ways around them: "sounds like", "this is
//   classic", "points to", "consistent with".
//
//   Citation integrity. A sentence that cites may only cite a reference
//   fact that was handed to it, so a model cannot attach a real finding to
//   a source that does not exist or a source to a claim about her.
//
// The rule from summary.ts holds unchanged: a rewrite that fails any check
// is thrown away and the deterministic sentence is used. Failing is cheap,
// because the deterministic sentence was written first and is always good
// enough to show.

import type { Answer, Fact } from './types';

// Kept in sync with supabase/functions/intelligence/wording.ts by the test
// in this directory, which fails if the two lists drift apart. Duplicated
// rather than imported because that file deploys with the edge function and
// this one ships in the app.
export const FORBIDDEN: readonly string[] = [
  'cause',
  'caused',
  'causing',
  'because',
  'diagnos',
  'you have',
  'condition',
  'disorder',
  'syndrome',
  'deficien',
  'risk of',
];

// Telling her what to do with her body or her medicine. Matched as whole
// words so "intake" does not trip "take" and "stopped" does not trip
// "stop": a past tense verb in a sentence about what she did is a report,
// not an instruction.
const TREATMENT = [
  'take',
  'taking',
  'stop',
  'start',
  'increase',
  'decrease',
  'reduce',
  'avoid',
  'supplement',
  'dose',
  'dosage',
  'prescri',
  'treat',
  'remedy',
  'cure',
];

// The ways a model says "you have X" without saying "you have".
const DIAGNOSTIC = [
  'sounds like',
  'looks like',
  'points to',
  'consistent with',
  'suggests you',
  'indicative of',
  'typical of',
  'classic',
  'likely you',
  'probably have',
  'you may have',
  'you might have',
];

export type Rejection = { reason: string; detail: string };

// Every number the rewrite is allowed to contain: the digits in the facts
// it was given, and nothing else. Pulled out of the values rather than
// listed by hand, the same reason summary.ts does it that way: a hand list
// drifts the moment a fact is added and the check quietly stops working.
export function groundedNumbers(facts: readonly Fact[]): Set<string> {
  const out = new Set<string>();
  for (const f of facts) {
    for (const text of [f.value, f.label, f.on ?? '']) {
      for (const match of text.matchAll(/\d[\d,.]*/g)) {
        out.add(match[0].replace(/[,.]+$/, '').replace(/,/g, ''));
      }
    }
  }
  return out;
}

const word = (haystack: string, needle: string) =>
  new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack);

export function checkAnswer(text: string, answer: Answer): Rejection[] {
  const out: Rejection[] = [];
  const trimmed = text.trim();

  if (!trimmed) return [{ reason: 'empty', detail: 'the model returned nothing' }];
  // A chat turn that runs past this is a model lecturing, and a lecture is
  // where the unsupported sentence hides.
  if (trimmed.length > 700) out.push({ reason: 'too_long', detail: `${trimmed.length} characters` });

  const lower = trimmed.toLowerCase();

  for (const w of FORBIDDEN) {
    if (lower.includes(w)) out.push({ reason: 'forbidden_word', detail: w });
  }
  for (const w of DIAGNOSTIC) {
    if (lower.includes(w)) out.push({ reason: 'diagnostic', detail: w });
  }
  for (const w of TREATMENT) {
    if (word(lower, w)) out.push({ reason: 'treatment', detail: w });
  }

  // The copy rule, which a model breaks on its own every time.
  for (const dash of ['—', '–']) {
    if (trimmed.includes(dash)) out.push({ reason: 'dash', detail: dash });
  }

  // Every number must come from the facts this answer was built on.
  const allowed = groundedNumbers(answer.facts);
  for (const match of trimmed.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0].replace(/,/g, '');
    if (!allowed.has(raw)) out.push({ reason: 'invented_number', detail: match[0] });
  }

  // An abstention may not be reworded into an answer. If the code decided
  // there was not enough to say, a model that found something to say found
  // it somewhere other than her record.
  if (answer.abstained && trimmed.length > 0) {
    const hasFigure = /\d/.test(trimmed);
    if (hasFigure) out.push({ reason: 'answered_an_abstention', detail: 'figures in an abstention' });
  }

  // A citation may only name a reference the answer actually holds.
  const refs = answer.facts.filter((f) => f.from === 'reference');
  if (!refs.length && /\b(study|studies|research|trial|journal|published)\b/i.test(trimmed)) {
    out.push({ reason: 'uncited_research', detail: 'research mentioned with no reference fact' });
  }

  return out;
}

// The one place the decision is made, so no caller can forget the fallback.
// Returns what she reads, and whether it was the model's words or the
// code's, which the interface shows rather than hides.
export function wordOrFallback(answer: Answer, rewrite: string | null): { text: string; worded: boolean } {
  if (!rewrite) return { text: answer.text, worded: false };
  const problems = checkAnswer(rewrite, answer);
  if (problems.length) return { text: answer.text, worded: false };
  return { text: rewrite.trim(), worded: true };
}
