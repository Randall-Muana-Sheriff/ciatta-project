import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkDocumentAnalysis, type DocAnalysis, readDocAnalysis } from '../../supabase/functions/document-analysis/check.ts';
import { type DocFacts, documentMeds, documentText, extractionFingerprint, readCycle } from '../../supabase/functions/document-analysis/facts.ts';

const extraction = {
  doc_type: 'visit',
  date: '2026-09-02',
  clinician: 'Dr Rivera',
  visit: {
    reason: 'Pelvic pain',
    diagnoses: [{ name: 'Endometriosis', status: 'new' }],
    medications_started: [{ name: 'Ferrous sulfate', strength: '325 mg', dose: null, frequency: 'once daily', route: 'oral', prescriber: null, date: null }],
    medications_stopped: [{ name: 'Ibuprofen', strength: null, dose: null, frequency: null, route: null, prescriber: null, date: null }],
    medications_changed: [],
    procedures: [{ name: 'Transvaginal ultrasound', date: '2026-09-02' }],
    follow_ups: [{ specialty: 'Gynecology', clinician: null, reason: 'Discuss laparoscopy', when: 'in 4 weeks' }],
    instructions: ['Stop ibuprofen and use acetaminophen for pain.', 'Hypoechoic lesion noted on ultrasound.'],
    allergies: [],
  },
};

const facts: DocFacts = {
  document: { type: 'visit', date: '2026-09-02', title: 'After Visit Summary', clinician: 'Dr Rivera', facility: 'Mercy', extraction },
  record: {
    conditions: ['Iron deficiency anemia'],
    medications: ['Ibuprofen'],
    supplements: [],
    procedures: [],
    labs: [{ name: 'Ferritin', value: 8, value_text: null, unit: 'ng/mL', range: '15 to 150', flag: 'L', on: '2026-08-20' }],
    cycle: { day: 3, phase: 'During period', usual_length: 29 },
    symptoms: [{ name: 'Fatigue', count: 6 }],
    profile: { age_range: '30 to 39', life_stage: null, gender: 'woman' },
  },
};

const good = (): DocAnalysis => ({
  urgent: [],
  summary: 'This visit summary records a new diagnosis of endometriosis, starts ferrous sulfate 325 mg once daily, and refers you to gynecology in 4 weeks.',
  terms: [{ term: 'Hypoechoic', meaning: 'An area that looks darker on ultrasound because it reflects less sound.' }],
  findings: [{ item: 'Endometriosis', explanation: 'Endometriosis was diagnosed at this visit.', relevance: 'Your ferritin of 8 ng/mL was low in August, which heavy periods can cause.' }],
  patterns: [{ title: 'Pain and low iron', items: ['Endometriosis', 'Ferritin'], explanation: 'Heavy bleeding from endometriosis can lower iron stores.' }],
  considerations: [{ condition: 'Iron deficiency anemia', items: ['Ferritin'], confidence: 'moderate', how_confirmed: 'A complete blood count and iron panel.' }],
  next_steps: [{ step: 'Keep the gynecology follow up', reason: 'To discuss laparoscopy, as the summary says.' }],
  questions: ['Should I recheck my iron after starting ferrous sulfate?'],
});

test('a faithful analysis passes', () => {
  assert.deepEqual(checkDocumentAnalysis(good(), facts), []);
});

test('a term the document never used is refused', () => {
  const a = good();
  a.terms = [{ term: 'Adenomyosis', meaning: 'x' }];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /Adenomyosis/);
});

test('an item that is in neither the document nor her record is refused', () => {
  const a = good();
  a.findings[0].item = 'Thyroid nodule';
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /Thyroid nodule/);
});

test('a dose the document never printed is refused, and one it printed passes', () => {
  const a = good();
  a.questions = ['Should I take 650 mg of ferrous sulfate?'];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /dose/i);
  assert.deepEqual(checkDocumentAnalysis(good(), facts), [], 'the summary quotes 325 mg as printed');
});

test('a medication change as advice is refused; the document’s own instruction, credited to it, passes', () => {
  const a = good();
  a.next_steps = [{ step: 'Stop taking ibuprofen', reason: 'It may worsen bleeding.' }];
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /medication/i);
  const b = good();
  b.next_steps = [{ step: 'Your visit summary says to stop ibuprofen and use acetaminophen for pain', reason: 'That is your clinician’s instruction.' }];
  assert.deepEqual(checkDocumentAnalysis(b, facts), []);
});

test('a number in no fact is refused', () => {
  const a = good();
  a.summary = 'Your risk is 40 percent higher.';
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /40/);
});

test('urgent words in the document require something marked urgent', () => {
  const urgent: DocFacts = { ...facts, document: { ...facts.document, type: 'imaging', extraction: { doc_type: 'imaging', report: { study: 'CT', body_site: 'Abdomen', findings: 'Free fluid.', impression: 'Urgent surgical consultation recommended.', named_conditions: [] } } } };
  const a: DocAnalysis = { ...good(), terms: [], findings: [], patterns: [], considerations: [], next_steps: [], questions: [], summary: 'The CT shows free fluid.' };
  assert.match(checkDocumentAnalysis(a, urgent).join(' '), /urgent/i);
});

test('too many items is refused', () => {
  const a = good();
  a.questions = Array.from({ length: 11 }, () => 'Should I recheck my iron after starting ferrous sulfate?');
  assert.match(checkDocumentAnalysis(a, facts).join(' '), /questions/);
});

test('what the model returned is read into shape', () => {
  assert.equal(readDocAnalysis(null), null);
  assert.equal(readDocAnalysis({ ...good(), considerations: [{ condition: 'X', items: ['Ferritin'], confidence: 'sure', how_confirmed: 'y' }] })?.considerations.length, 0);
});

test('the document text, its medications, and a stable fingerprint', () => {
  assert.match(documentText(extraction), /hypoechoic lesion/i);
  assert.deepEqual(documentMeds(extraction).sort(), ['Ferrous sulfate', 'Ibuprofen']);
  const reordered = { visit: extraction.visit, clinician: 'Dr Rivera', date: '2026-09-02', doc_type: 'visit' };
  assert.equal(extractionFingerprint(extraction), extractionFingerprint(reordered));
  assert.notEqual(extractionFingerprint(extraction), extractionFingerprint({ ...extraction, date: '2026-09-03' }));
  assert.deepEqual(readCycle({ day: 3, phase: 'During period', usual_length: 29 }), { day: 3, phase: 'During period', usual_length: 29 });
});
