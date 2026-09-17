// The vocabulary this function is allowed to write, compiled in.
//
// This is a copy of src/lib/conceptMap.ts. The duplication is deliberate and
// it is guarded: only this directory deploys with the function, the same
// reason umls.ts lives here rather than in src/lib, and src/data/seed.test.ts
// asserts these three lists deep equal the ones in conceptMap.ts so that a
// term added, removed or reworded there without the same edit here fails the
// suite rather than quietly seeding a different vocabulary than the app
// believes in.
//
// Why a static list at all, rather than seeding a concept when one is needed:
// public.concepts has no RLS and no owner, which is only safe while every row
// in it is reference data that is identical for every person alive. A concept
// created because one woman logged an unmapped term would turn the table into
// an aggregate activity log, since a rare code next to a readable created_at
// tells any signed in user that somebody logged that symptom at that hour.
// On a small user base that is close to identifying. So the set of writable
// terms is fixed here, at compile time, and a term from anywhere else is
// refused.

export type CodeSystem = 'loinc' | 'snomed' | 'rxnorm' | 'ucum';

export type ConceptSeed = {
  system: CodeSystem;
  code: string;
  display: string;
  domain: string;
  term: string;
};

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
