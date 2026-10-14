import assert from 'node:assert/strict';
import { test } from 'node:test';

import { respond } from './capabilities';
import { checkAnswer } from './check';
import { classify } from './classify';
import { CONNECT_SYMPTOMS, REFILL } from './connect';
import { buildContext } from './proactive';

const NOW = new Date(2026, 9, 28, 10);
const iso = (n: number) => {
  const d = new Date(2026, 9, 28 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const day = (n: number, over: Record<string, unknown> = {}) => ({
  date: iso(n), sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [] as string[], digestion: [] as string[], ...over,
});
const lab = { id: 'f', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150', flag: null, status: 'final', source: 'provider', lab: 'Quest', on: iso(10) };
const record = (context: unknown) =>
  ({ name: 'Jennifer', today: null, days: [], episodes: [], conditions: [], medications: [], insights: [], references: [], cycleDay: null, cyclePhase: null, clinical: [], context }) as never;

test('how several symptoms may connect: what stands out, how they line up, testing, what is easy to miss, safety, and one question', () => {
  const headache = [1, 3, 6, 9, 12];
  const days = Array.from({ length: 28 }, (_, n) => day(n, { sleepHours: headache.includes(n) ? 5.5 : 7.2, digestion: [1, 3, 6, 20].includes(n) ? ['Bloating'] : [] }));
  const logs = headache.map((n) => ({ at: new Date(2026, 9, 28 - n, 9).toISOString(), category: 'mind', items: { mind: ['Headache'] }, text: '' }))
    .concat([2, 5, 8].map((n) => ({ at: new Date(2026, 9, 28 - n, 9).toISOString(), category: 'body', items: { body: ['Fatigue'] }, text: '' })));
  const context = buildContext({
    days: days as never, baselines: [], labs: [lab] as never, logs, signals: [], reported: { conditions: [], surgeries: [], medications: ['Levothyroxine'], supplements: [] },
    insurance: null, referrals: [], now: NOW,
  });
  assert.equal(classify(CONNECT_SYMPTOMS), 'connect');
  const a = respond(CONNECT_SYMPTOMS, record(context), 'connect');
  const parts = a.text.split('\n\n');
  assert.equal(parts[0], 'Jennifer, here is what your record shows, and how it may fit together.');
  assert.ok(a.text.includes('What stands out in your records\n• Ferritin was low, 12 ng/mL on 18 Oct, against the lab’s range of 15 to 150.'), a.text);
  assert.ok(a.text.includes('How they may connect\n• Bloating came on 3 of the 5 days you logged headache, against 1 of the other 23 days.'), a.text);
  assert.ok(a.text.includes('• On the 5 days you logged headache, you slept 5h 30m on average, against 7h 12m on the other 23.'), a.text);
  // Ferritin already has a result this year, so it is not suggested again.
  assert.ok(a.text.includes('Worth asking your clinician about\n• TSH, since you logged fatigue on 3 days\n• Complete blood count, since you logged fatigue on 3 days'), a.text);
  assert.ok(a.text.includes('Get care right away if\n• A sudden, severe headache, the worst of your life'), a.text);
  assert.ok(a.text.endsWith('To narrow this down: when did these begin, and are they better, worse or about the same since? Your visit prep gathers all of this for your clinician to review.'), a.text);
  const problems = checkAnswer(a.text, a).filter((p) => p.reason !== 'too_long');
  assert.deepEqual(problems, []);
  assert.equal(a.suggestions[0].screen, 'visitPrep');
});

test('nothing logged yet: it asks for the symptoms first', () => {
  const context = buildContext({ days: [], baselines: [], labs: [], logs: [], signals: [], reported: null, insurance: null, referrals: [], now: NOW });
  const a = respond(CONNECT_SYMPTOMS, record(context), 'connect');
  assert.equal(a.abstained, 'no_data');
  assert.ok(a.text.startsWith('Tell me which symptoms you have been having'));
});

test('a refill: her medications on file, and the request drafted for her to send', () => {
  const context = buildContext({
    days: [], baselines: [], labs: [], signals: [], reported: { conditions: [], surgeries: [], medications: ['Levothyroxine'], supplements: ['Magnesium'] },
    logs: [{ at: new Date(2026, 9, 26, 8).toISOString(), category: 'meds', items: { meds: ['Levothyroxine'] }, text: '' }],
    insurance: null, referrals: [], now: NOW,
  });
  assert.equal(classify(REFILL), 'record');
  const a = respond(REFILL, record(context), 'record');
  assert.equal(a.text, 'Your medications on file: Levothyroxine, last logged 26 Oct. Also on file: Magnesium. I can draft a refill request for you to send to your clinician.');
  assert.deepEqual(checkAnswer(a.text, a), []);
  assert.deepEqual([a.suggestions[0].label, a.suggestions[0].requestKind, a.suggestions[0].requestFor], ['Draft a refill request', 'refill', 'Levothyroxine']);
});
