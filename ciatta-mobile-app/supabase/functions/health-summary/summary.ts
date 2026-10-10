// Her health profile, written by a model and checked by this file.
//
// The division of labour is the whole safety argument, and it is the same
// one wording.ts makes: the record decides what is true, and the model only
// decides how it is said. Facts are gathered in code from her own rows. The
// model is given those facts and nothing else, is told it may not add to
// them, and its answer is then checked against them before anybody sees it.
// A summary that fails the check is thrown away and the deterministic
// sentence is used instead. There is no path where unchecked model text
// reaches her.
//
// What that buys: the model cannot invent a reading, a diagnosis, a cause,
// or a number. What it cannot buy is a guarantee that the prose is good, so
// the fallback has to stay a real sentence rather than an apology.
//
// No Deno or Supabase imports, the same arrangement as wording.ts and
// threads.ts, so src/data/healthSummary.test.ts can exercise every rule
// here under node:test.

import { FORBIDDEN, offending } from '../intelligence/wording.ts';

// Everything the model is allowed to know. Built in code from her rows, so
// the prompt can never contain a fact the record does not hold.
export type SummaryFacts = {
  name: string | null;
  ageRange: string | null;
  lifeStage: string | null;
  // Her own words from onboarding, verbatim.
  opening: string | null;
  intents: string[];
  conditions: string[];
  surgeries: string[];
  medications: string[];
  supplements: string[];
  symptoms: string[];
  goals: string[];
  // Measured, from Apple Health. Each is the newest value with its day.
  readings: { label: string; value: string; on: string }[];
  // How many observations exist at all, so the model can say how much there
  // is without being told to guess.
  observationCount: number;
  // Days of history. Zero means today is the first day.
  daysOfHistory: number;
};

// Numbers the model may use. Anything numeric in its answer that is not in
// here is a number it made up.
//
// Digits are pulled out of every fact rather than listed by hand, because a
// hand list drifts the moment a fact is added and the check silently starts
// passing things it should catch.
export function groundedNumbers(facts: SummaryFacts): Set<string> {
  const out = new Set<string>();
  const add = (text: string | null) => {
    if (!text) return;
    for (const match of text.matchAll(/\d[\d,.]*/g)) {
      out.add(match[0].replace(/[,.]+$/, '').replace(/,/g, ''));
    }
  };
  add(facts.ageRange);
  add(facts.lifeStage);
  add(facts.opening);
  for (const list of [facts.intents, facts.conditions, facts.surgeries, facts.medications, facts.supplements, facts.symptoms, facts.goals]) {
    for (const item of list) add(item);
  }
  for (const r of facts.readings) {
    add(r.value);
    add(r.on);
    add(r.label);
  }
  add(String(facts.observationCount));
  add(String(facts.daysOfHistory));
  return out;
}

// Names she gave. The model may repeat these and may not introduce others:
// a medication or condition appearing in the summary that is not in her
// record is the most dangerous thing this file exists to stop.
export function groundedTerms(facts: SummaryFacts): string[] {
  return [
    ...facts.conditions,
    ...facts.surgeries,
    ...facts.medications,
    ...facts.supplements,
    ...facts.symptoms,
  ].map((t) => t.toLowerCase().trim()).filter(Boolean);
}

export type Rejection = { reason: string; detail: string };

// Everything that disqualifies a summary. Returns every reason rather than
// the first, so a prompt that is going wrong can be seen going wrong.
export function checkSummary(text: string, facts: SummaryFacts): Rejection[] {
  const out: Rejection[] = [];
  const trimmed = text.trim();

  if (!trimmed) {
    return [{ reason: 'empty', detail: 'the model returned nothing' }];
  }
  if (trimmed.length > 900) {
    out.push({ reason: 'too_long', detail: `${trimmed.length} characters` });
  }

  // The same forbidden list the deterministic sentences are held to. A model
  // writing "this may be caused by" is the exact failure the list was
  // written for.
  const banned = offending(trimmed);
  if (banned) out.push({ reason: 'forbidden_word', detail: banned });

  // The copy rule, which a model will break on its own every time.
  for (const dash of ['—', '–']) {
    if (trimmed.includes(dash)) out.push({ reason: 'dash', detail: dash });
  }

  // Every number must come from her record.
  const allowed = groundedNumbers(facts);
  for (const match of trimmed.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0].replace(/,/g, '');
    if (!allowed.has(raw)) {
      out.push({ reason: 'invented_number', detail: match[0] });
    }
  }

  // A medical term she never gave. Checked against a small vocabulary
  // rather than open ended, because the goal is catching a model that names
  // a drug or a diagnosis, not policing every noun.
  const lower = trimmed.toLowerCase();
  const grounded = groundedTerms(facts);
  for (const term of WATCHED_TERMS) {
    if (lower.includes(term) && !grounded.some((g) => g.includes(term))) {
      out.push({ reason: 'ungrounded_term', detail: term });
    }
  }

  return out;
}

// Terms that must never appear unless she put them there. Short and
// deliberately boring: common conditions and drug classes a model reaches
// for when it is pattern matching rather than reading.
export const WATCHED_TERMS: readonly string[] = [
  'endometriosis',
  'pcos',
  'thyroid',
  'anaemia',
  'anemia',
  'diabetes',
  'depression',
  'anxiety',
  'ibs',
  'migraine',
  'fibroid',
  'insulin',
  'metformin',
  'levothyroxine',
  'ssri',
  'hrt',
];

// What the model is told. Facts as data, rules as rules, and no room to be
// helpful in the ways that would hurt.
export function summaryPrompt(facts: SummaryFacts): { system: string; user: string } {
  const system = [
    'You write one short paragraph for a woman about her own health record in a women’s health app.',
    '',
    'You are given every fact you may use. You may not add anything else.',
    '',
    'Rules, all absolute:',
    '1. Never diagnose, never name a condition she did not name, never name a medication she did not name.',
    '2. Never say one thing caused, explains, or led to another. You may say two things were both recorded.',
    '3. Never state a number that is not in the facts. Do not round, estimate, or total anything.',
    '4. Never present anything as measured unless it appears under readings. Everything else she told you.',
    '5. Say plainly what is not known yet rather than filling the gap.',
    '6. No dashes of any kind. Write compound words as separate words.',
    '7. Plain second person. No greeting, no sign off, no bullet points, no headings.',
    '8. Never write the words "you have". Write "your record holds" or "you told Ciatta" instead. This one is checked literally, including in sentences like "you have not", so avoid the phrase entirely.',
    '9. At most 120 words, one paragraph.',
    '',
    'If the facts are thin, write a short honest paragraph about how thin they are. That is a good answer, not a failure.',
  ].join('\n');

  const user = JSON.stringify(
    {
      name: facts.name,
      sheToldCiatta: {
        inHerWords: facts.opening,
        cameFor: facts.intents,
        ageRange: facts.ageRange,
        lifeStage: facts.lifeStage,
        conditions: facts.conditions,
        surgeries: facts.surgeries,
        medications: facts.medications,
        supplements: facts.supplements,
        symptoms: facts.symptoms,
        wants: facts.goals,
      },
      measuredFromAppleHealth: facts.readings,
      howMuchThereIs: {
        observations: facts.observationCount,
        daysOfHistory: facts.daysOfHistory,
      },
    },
    null,
    2,
  );

  return { system, user };
}

// Re exported so the edge function holds one import and the test can prove
// the summary gate and the sentence gate are the same gate.
export { FORBIDDEN };
