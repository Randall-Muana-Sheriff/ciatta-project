import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LabResult } from '../labs';
import { answerLabs, answerReferral, respond, type Record } from './capabilities';
import { checkAnswer } from './check';
import { classify, mentionsLab } from './classify';
import type { AgentContext } from './proactive';

const lab = (over: Partial<LabResult>): LabResult => ({
  id: 'l', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150',
  flag: null, status: 'final', source: 'report', lab: 'Quest', on: '2026-10-12', ...over,
});

const ctx: AgentContext = {
  readings: [{ key: 'resting_hr', label: 'Resting heart rate', latest: '74 bpm', on: '2026-10-19', usual: '55 to 68 bpm', side: 'above', daysOutside: 3 }],
  labs: [lab({}), lab({ id: 'p', on: '2026-06-01', value: 30 }), lab({ id: 't', name: 'TSH', value: 2, unit: 'mIU/L', low: 0.4, high: 4, rangeText: '0.4 to 4.0' })],
  symptoms: [],
  meds: { medications: [], supplements: [], month: [], changes: [] },
  insurance: null,
  referrals: [{ id: 'r1', specialty: 'Gynecology', clinician: null, reason: null, referredBy: null, referredOn: '2026-10-01', steps: { referred: '2026-10-01' }, scheduledFor: null, notes: null }],
  severe: [],
  vitals: { bp: null, spo2: null },
  gut: null,
  cycle: null,
  visit: null,
  today: [],
};

const record = (context: AgentContext | undefined): Record => ({
  name: null, today: null, days: [], episodes: [], conditions: [], medications: [], insights: [], references: [],
  cycleDay: null, cyclePhase: null, clinical: [], context,
});

test('lab and referral questions reach their own abilities', () => {
  assert.equal(classify('what did my labs show'), 'labs');
  assert.equal(classify('can you explain my blood test'), 'labs');
  assert.equal(classify('I was referred to a gynecologist'), 'referral');
  assert.equal(classify('where is my referral'), 'referral');
  assert.equal(mentionsLab('is my ferritin ok?', ['Ferritin', 'TSH']), 'Ferritin');
  assert.equal(mentionsLab('how was my sleep', ['Ferritin']), null);
});

test('a named lab is answered with its value against the lab\'s range, and passes the checker', () => {
  const a = answerLabs(record(ctx), 'is my ferritin ok?');
  assert.equal(a.text, 'Your ferritin was 12 ng/mL on 12 Oct 2026, low against the lab\'s range of 15 to 150. Lower than your previous result, 30 ng/mL on 1 Jun 2026.');
  assert.deepEqual(a.suggestions[0], { label: 'Decode this lab', screen: 'labBrief', lab: 'Ferritin' });
  assert.deepEqual(checkAnswer(a.text, a), []);
});

test('labs in general are her latest visit, what sat outside range first', () => {
  const a = answerLabs(record(ctx), 'what did my labs show');
  assert.equal(a.text, 'Your latest labs are from 12 Oct 2026: 1 of 2 outside the lab\'s range. Ferritin low.');
  assert.deepEqual(checkAnswer(a.text, a), []);
});

test('no labs is said plainly, with the way to add them', () => {
  const a = answerLabs(record({ ...ctx, labs: [] }), 'my labs');
  assert.equal(a.abstained, 'no_data');
  assert.equal(a.suggestions[0].screen, 'addLabs');
});

test('a referral she mentions is offered for tracking; one she tracks says what is next', () => {
  const draft = answerReferral(record({ ...ctx, referrals: [] }), 'my doctor referred me to an endocrinologist');
  assert.match(draft.text, /Endocrinology/);
  assert.deepEqual(draft.suggestions[0], { label: 'Track this referral', screen: 'referral', referralDraft: 'Endocrinology' });
  assert.deepEqual(checkAnswer(draft.text, draft), []);
  const known = answerReferral(record(ctx), 'where is my referral');
  assert.match(known.text, /Gynecology: insurance checked is next/);
  assert.deepEqual(checkAnswer(known.text, known), []);
});

test('preparing for a visit, with her context, counts what goes into the summary', () => {
  const a = respond('help me prepare for my appointment', record(ctx), 'prepare');
  assert.equal(a.text, 'Here is what I would bring: 1 thing that changed, 1 lab outside its range, 1 referral in progress and 3 questions to ask. Open it to read, change and share.');
  assert.deepEqual(a.suggestions[0], { label: 'Open your visit prep', screen: 'visitPrep' });
  assert.deepEqual(checkAnswer(a.text, a), []);
});
