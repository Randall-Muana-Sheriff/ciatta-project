import assert from 'node:assert/strict';
import { test } from 'node:test';

import { respond } from './capabilities';
import { checkAnswer } from './check';
import { buildContext, interventions, latestVitals } from './proactive';
import { visitPrep } from './tasks';

const NOW = new Date(2026, 9, 20, 9);
const at = (daysAgo: number, h = 8) => new Date(2026, 9, 20 - daysAgo, h).toISOString();
const iso = (n: number) => {
  const d = new Date(2026, 9, 20 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const bm = (n: number, stool: number | null, flags: string[] = []) => ({ date: iso(n), kinds: ['Bowel movement'], stool, bowelPain: null, bowelFlags: flags });

const base = {
  days: [], baselines: [], labs: [], logs: [], signals: [], reported: null, insurance: null, referrals: [], now: NOW,
};

test('the newest blood pressure pair and blood oxygen, a fraction read as a percent', () => {
  const v = latestVitals([
    { metric: 'blood_pressure_systolic', value: 128, unit: 'mmHg', at: at(3) },
    { metric: 'blood_pressure_diastolic', value: 82, unit: 'mmHg', at: at(3) },
    { metric: 'blood_pressure_systolic', value: 146, unit: 'mmHg', at: at(1) },
    { metric: 'blood_pressure_diastolic', value: 93, unit: 'mmHg', at: at(1) },
    { metric: 'oxygen_saturation', value: 0.93, unit: '%', at: at(0) },
  ]);
  assert.deepEqual(v.bp, { systolic: 146, diastolic: 93, on: iso(1) });
  assert.deepEqual(v.spo2, { value: 93, on: iso(0) });
});

test('cards from the newly connected data: blood pressure, blood oxygen, blood in stool, stool form, a visit', () => {
  const c = buildContext({
    ...base,
    vitals: { bp: { systolic: 146, diastolic: 93, on: iso(1) }, spo2: { value: 93, on: iso(0) } },
    episodes: [bm(1, 6, ['Blood']), bm(2, 6), bm(4, 7), bm(6, 5), bm(8, 4)],
    cycle: { day: 22, phase: 'Likely luteal' },
    visit: { title: 'Dr Patel', when: 'Tomorrow, 9 am', location: null },
  });
  const cards = interventions(c, NOW, new Set());
  const by = (id: string) => cards.find((x) => x.id.startsWith(id));
  assert.equal(by('vital:bp')!.tone, 'attention');
  assert.equal(by('vital:bp')!.title, 'Blood pressure 146/93 on 19 Oct, in the high range');
  assert.equal(by('vital:spo2')!.title, 'Blood oxygen 93% on 20 Oct, under the typical 95 to 100%');
  assert.equal(by('gut:blood')!.tone, 'urgent');
  assert.equal(by('gut:form')!.title, 'Most of your logged movements were loose');
  assert.equal(by('visit')!.title, 'Prepare for Dr Patel');
  assert.equal(by('visit')!.action!.screen, 'visitPrep');
});

test('a crisis range blood pressure is urgent; a usual one raises nothing', () => {
  const card = (systolic: number, diastolic: number) =>
    interventions(buildContext({ ...base, vitals: { bp: { systolic, diastolic, on: iso(0) }, spo2: null } }), NOW, new Set()).find((x) => x.id.startsWith('vital:bp'));
  assert.equal(card(185, 100)!.tone, 'urgent');
  assert.equal(card(118, 76), undefined);
});

test('visit prep carries the vitals, the gut, the cycle and the visit it is for', () => {
  const c = buildContext({
    ...base,
    vitals: { bp: { systolic: 146, diastolic: 93, on: iso(1) }, spo2: null },
    episodes: [bm(1, 6, ['Blood']), bm(2, 6), bm(4, 7)],
    cycle: { day: 22, phase: 'Likely luteal' },
    visit: { title: 'Dr Patel', when: 'Tomorrow, 9 am', location: 'Riverside Clinic' },
  });
  const prep = visitPrep(c, NOW);
  const lines = (t: string) => prep.sections.find((s) => s.title === t)?.lines ?? [];
  assert.deepEqual(lines('This visit'), ['Dr Patel, tomorrow, 9 am, Riverside Clinic', 'Cycle day 22, likely luteal']);
  assert.ok(lines('What changed').includes('Blood pressure 146/93 on 19 Oct, in the high range'));
  assert.ok(lines('What changed').includes('Blood with a bowel movement on 1 occasion in the last 4 weeks'));
  assert.ok(prep.questions.some((q) => q.startsWith('My blood pressure was 146/93')));
  assert.ok(prep.questions.some((q) => q.startsWith('I saw blood with a bowel movement')));
});

test('asking about the gut or vitals answers from them, within what the agent may say', () => {
  const c = buildContext({
    ...base,
    vitals: { bp: { systolic: 122, diastolic: 79, on: iso(1) }, spo2: { value: 97, on: iso(0) } },
    episodes: [bm(1, 4), bm(3, 3), bm(5, 6)],
    today: [{ label: 'Heart Rate', range: '58 to 104 bpm' }],
  });
  const r = { name: null, today: null, days: [], episodes: [], conditions: [], medications: [], insights: [], references: [], cycleDay: null, cyclePhase: null, clinical: [], context: c } as never;
  const gut = respond('How has my gut been?', r, 'record');
  assert.equal(gut.text, 'In the last 4 weeks you logged 3 bowel movements, about 0.8 a week. 2 of the 3 with a type were in the typical range, Bristol types 3 and 4.');
  assert.deepEqual(checkAnswer(gut.text, gut), []);
  const v = respond('What was my blood pressure?', r, 'record');
  assert.equal(v.text, 'Your latest blood pressure was 122/79 on 19 Oct, and blood oxygen 97% on 20 Oct.');
  const today = respond('How is my heart rate today?', r, 'record');
  assert.ok(today.text.includes('heart rate 58 to 104 bpm'), today.text);
  assert.deepEqual(checkAnswer(today.text, today), []);
  assert.deepEqual(checkAnswer(v.text, v), []);
});
