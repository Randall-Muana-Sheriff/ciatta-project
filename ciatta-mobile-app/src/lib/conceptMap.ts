// What her record's own vocabulary is called in the standard ones.
//
// Two different things live here and the difference matters. A `code` is an
// assertion that a specific LOINC or SNOMED identifier is the right one. A
// `term` is a phrase handed to UMLS so that it can tell us the code. Only
// codes that are stable and well established are written down; everything
// else carries a term and is resolved against UMLS in the seeding task.
//
// Writing down a guessed code would be an inference recorded as a fact,
// which is the one thing this record must never do. An unresolved term is
// honest: it says we do not know yet.

export type CodeSystem = 'loinc' | 'snomed' | 'rxnorm' | 'ucum';

export type ConceptSeed = {
  system: CodeSystem;
  code: string;
  display: string;
  domain: string;
  // The phrase to confirm this code against UMLS at seed time. A code that
  // cannot be confirmed is reported rather than written.
  term: string;
};

// LOINC codes for the device measurements. These are the observation codes
// LOINC publishes for exactly these quantities, and each is confirmed
// against UMLS during seeding rather than trusted because it is written
// here.
export const METRIC_CONCEPTS: ConceptSeed[] = [
  { system: 'loinc', code: '8867-4',  display: 'Heart rate',                     domain: 'vitals',   term: 'Heart rate' },
  { system: 'loinc', code: '40443-4', display: 'Heart rate resting',             domain: 'vitals',   term: 'Heart rate --resting' },
  { system: 'loinc', code: '9279-1',  display: 'Respiratory rate',               domain: 'vitals',   term: 'Respiratory rate' },
  { system: 'loinc', code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry', domain: 'vitals', term: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
  { system: 'loinc', code: '8310-5',  display: 'Body temperature',               domain: 'vitals',   term: 'Body temperature' },
  { system: 'loinc', code: '41950-7', display: 'Number of steps in 24 hour Measured', domain: 'activity', term: 'Number of steps in 24 hour Measured' },
  { system: 'loinc', code: '55423-8', display: 'Number of steps in unspecified time Pedometer', domain: 'activity', term: 'Number of steps in unspecified time Pedometer' },
  { system: 'loinc', code: '93832-4', display: 'Sleep duration',                 domain: 'sleep',    term: 'Sleep duration' },
];

// Units, so a value carries a machine readable unit rather than a label.
// UCUM codes are short and stable.
export const UNIT_CONCEPTS: ConceptSeed[] = [
  { system: 'ucum', code: '/min',  display: 'per minute', domain: 'unit', term: 'per minute' },
  { system: 'ucum', code: 'ms',    display: 'millisecond', domain: 'unit', term: 'millisecond' },
  { system: 'ucum', code: 'Cel',   display: 'degree Celsius', domain: 'unit', term: 'degree Celsius' },
  { system: 'ucum', code: '%',     display: 'percent', domain: 'unit', term: 'percent' },
  { system: 'ucum', code: 'min',   display: 'minute', domain: 'unit', term: 'minute' },
  { system: 'ucum', code: 'h',     display: 'hour', domain: 'unit', term: 'hour' },
  { system: 'ucum', code: 'kcal',  display: 'kilocalorie', domain: 'unit', term: 'kilocalorie' },
  { system: 'ucum', code: '{count}', display: 'count', domain: 'unit', term: 'count' },
];

// The phrases she picks from when she logs. No codes here on purpose: SNOMED
// identifiers for these are resolved against UMLS, never recalled. The
// strings are exactly the ones in src/data/cycleLog.ts, so that a mapping is
// a mapping of what she actually chose rather than of a paraphrase.
export const SYMPTOM_TERMS: { term: string; domain: string }[] = [
  { term: 'Fatigue',             domain: 'symptom' },
  { term: 'Bloating',            domain: 'symptom' },
  { term: 'Sleep disruption',    domain: 'symptom' },
  { term: 'Nausea',              domain: 'symptom' },
  { term: 'Headache',            domain: 'symptom' },
  { term: 'Mood changes',        domain: 'symptom' },
  { term: 'Breast tenderness',   domain: 'symptom' },
  { term: 'Digestive changes',   domain: 'symptom' },
  { term: 'Bowel changes',       domain: 'symptom' },
  { term: 'Abdominal discomfort', domain: 'symptom' },
  { term: 'Dizziness',           domain: 'symptom' },
  // 'Other' is deliberately absent. It is a prompt for her own words, not a
  // clinical finding, and mapping it to any concept would assert a meaning
  // she did not give it.
];

// Everything seedable, grouped by domain, for the seeding function to walk.
const ALL_TERMS: { term: string; domain: string }[] = [
  ...METRIC_CONCEPTS.map((c) => ({ term: c.term, domain: c.domain })),
  ...UNIT_CONCEPTS.map((c) => ({ term: c.term, domain: c.domain })),
  ...SYMPTOM_TERMS,
];

export function seedTermsFor(domain: string): { term: string; domain: string }[] {
  return ALL_TERMS.filter((t) => t.domain === domain);
}
