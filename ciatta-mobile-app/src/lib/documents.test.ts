import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildFilings, foldName, insuranceFrom, readDocumentScan, reviewItems, TARGET_HEADING, toSnake } from './documents';

const med = (name: string, extra: Record<string, unknown> = {}) => ({ name, strength: null, dose: null, frequency: null, route: null, prescriber: null, date: null, ...extra });

const visitJson = {
  not_medical: false,
  doc_type: 'visit',
  title: 'After Visit Summary',
  date: '2026-09-02',
  clinician: 'Dr A Rivera',
  facility: 'Mercy Clinic',
  multiple_dates: false,
  unreadable_pages: [],
  visit: {
    reason: 'Pelvic pain',
    diagnoses: [{ name: 'Endometriosis', status: 'new' }, { name: 'Iron deficiency anemia', status: 'existing' }, { name: '', status: 'new' }],
    medications_started: [med('Ferrous sulfate', { strength: '325 mg', frequency: 'once daily' })],
    medications_stopped: [med('Ibuprofen')],
    medications_changed: [],
    procedures: [{ name: 'Pelvic ultrasound', date: '2026-09-02' }],
    follow_ups: [{ specialty: 'Gynecology', clinician: 'Dr Chen', reason: 'Discuss laparoscopy', when: 'in 4 weeks' }],
    instructions: ['Stop ibuprofen and use acetaminophen for pain.'],
    allergies: [{ substance: 'Penicillin', reaction: 'Hives' }],
  },
  report: null,
  prescription: null,
  referral: null,
  insurance: null,
  other: null,
};

test('a visit summary is read into shape, and empty items are dropped', () => {
  const s = readDocumentScan(visitJson);
  assert.equal(s.docType, 'visit');
  assert.equal(s.date, '2026-09-02');
  assert.equal(s.clinician, 'Dr A Rivera');
  assert.deepEqual(s.visit?.diagnoses.map((d) => d.name), ['Endometriosis', 'Iron deficiency anemia']);
  assert.equal(s.visit?.medicationsStarted[0].strength, '325 mg');
  assert.equal(s.visit?.allergies[0].substance, 'Penicillin');
});

test('an unknown type is read as other, and nonsense is not medical', () => {
  assert.equal(readDocumentScan({ ...visitJson, doc_type: 'poem' }).docType, 'other');
  const n = readDocumentScan('x');
  assert.equal(n.notMedical, true);
  assert.equal(n.docType, 'other');
});

test('names fold so the same thing written two ways matches', () => {
  assert.equal(foldName('  Ferrous  Sulfate '), foldName('ferrous sulfate'));
  assert.notEqual(foldName('Ferrous sulfate'), foldName('Ferrous gluconate'));
});

test('review items say where each thing will go, and mark what she already has', () => {
  const items = reviewItems(readDocumentScan(visitJson), {
    conditions: [{ id: 'c1', name: 'iron deficiency anemia' }],
    medications: [{ id: 'm1', name: 'Ibuprofen', stoppedOn: null }],
  });
  const by = (t: string) => items.filter((i) => i.target === t);
  assert.deepEqual(by('conditions').map((i) => [i.title, i.existingId]), [['Endometriosis', null], ['Iron deficiency anemia', 'c1']]);
  assert.deepEqual(by('allergies').map((i) => i.title), ['Penicillin']);
  assert.deepEqual(by('medications').map((i) => i.title), ['Ferrous sulfate']);
  assert.deepEqual(by('stop_medications').map((i) => [i.title, i.existingId]), [['Ibuprofen', 'm1']]);
  assert.deepEqual(by('procedures').map((i) => i.title), ['Pelvic ultrasound']);
  assert.deepEqual(by('referrals').map((i) => i.title), ['Gynecology']);
  assert.ok(items.every((i) => i.keep));
  assert.equal(TARGET_HEADING.stop_medications, 'Marks as stopped in Medications');
});

test('the filings add what is new, link what she has, and stop what the document stopped', () => {
  const items = reviewItems(readDocumentScan(visitJson), {
    conditions: [{ id: 'c1', name: 'Iron deficiency anemia' }],
    medications: [{ id: 'm1', name: 'Ibuprofen', stoppedOn: null }],
  });
  const f = buildFilings(items, '2026-09-02');
  assert.deepEqual(f.conditions, [{ name: 'Endometriosis', status: 'active' }]);
  assert.deepEqual(f.linked, [{ table: 'conditions', id: 'c1' }, { table: 'medications', id: 'm1' }]);
  assert.deepEqual(f.stop_medications, [{ id: 'm1' }]);
  assert.equal(f.medications[0].name, 'Ferrous sulfate');
  assert.equal(f.medications[0].dose, '325 mg, once daily');
  assert.equal(f.medications[0].started_on, '2026-09-02');
  assert.deepEqual(f.procedures, [{ name: 'Pelvic ultrasound', performed_on: '2026-09-02' }]);
  assert.deepEqual(f.referrals[0], { specialty: 'Gynecology', clinician: 'Dr Chen', reason: 'Discuss laparoscopy', referred_by: 'Dr A Rivera', referred_on: '2026-09-02' });
  assert.deepEqual(f.allergies, [{ name: 'Penicillin', reaction: 'Hives' }]);
});

test('a medication the document stops that she does not have is added already stopped', () => {
  const items = reviewItems(readDocumentScan(visitJson), { conditions: [], medications: [] });
  const f = buildFilings(items, '2026-09-02');
  assert.deepEqual(f.stop_medications, []);
  const ibu = f.medications.find((m) => m.name === 'Ibuprofen')!;
  assert.equal(ibu.stopped_on, '2026-09-02');
});

test('items she switched off are not filed', () => {
  const items = reviewItems(readDocumentScan(visitJson), { conditions: [], medications: [] }).map((i) => (i.target === 'procedures' ? { ...i, keep: false } : i));
  assert.deepEqual(buildFilings(items, '2026-09-02').procedures, []);
});

test('a prescription files its medications, and an insurance card becomes a plan', () => {
  const rx = readDocumentScan({ ...visitJson, doc_type: 'prescription', visit: null, prescription: { medications: [med('Levothyroxine', { strength: '50 mcg', frequency: 'daily', prescriber: 'Dr Kim', date: '2026-08-01' })] } });
  const f = buildFilings(reviewItems(rx, { conditions: [], medications: [] }), rx.date);
  assert.equal(f.medications[0].started_on, '2026-08-01', 'the prescription date wins over the document date');
  assert.equal(f.medications[0].prescriber, 'Dr Kim');
  const card = readDocumentScan({ ...visitJson, doc_type: 'insurance', visit: null, insurance: { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123456789' } });
  assert.deepEqual(insuranceFrom(reviewItems(card, { conditions: [], medications: [] })), { provider: 'Aetna', plan: 'Choice POS II', member_id: 'W123456789' });
});

test('imaging and pathology offer the conditions they name, and file nothing else', () => {
  const img = readDocumentScan({
    ...visitJson,
    doc_type: 'imaging',
    visit: null,
    report: { study: 'Pelvic ultrasound', body_site: 'Pelvis', findings: 'A 3 cm cyst on the left ovary.', impression: 'Likely endometrioma.', named_conditions: ['Endometrioma'] },
  });
  assert.equal(img.report?.impression, 'Likely endometrioma.');
  const items = reviewItems(img, { conditions: [], medications: [] });
  assert.deepEqual(items.map((i) => [i.target, i.title]), [['conditions', 'Endometrioma']]);
});

test('a scan stored in snake case reads back the same', () => {
  const s = readDocumentScan(visitJson);
  assert.deepEqual(readDocumentScan(toSnake(s)), s);
});
