import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Day } from '../../data/daily';
import type { LabResult } from '../labs';
import { type AgentContext, buildContext, interventions, readingsStatus } from './proactive';

const NOW = new Date(2026, 9, 20, 9);

const day = (date: string, over: Partial<Day> = {}): Day => ({
  date, sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [], digestion: [], ...over,
});
const usual = (metric: string, low: number, high: number) => ({ metric, median: (low + high) / 2, low, high, n: 40, sufficient: true });

const lab = (over: Partial<LabResult>): LabResult => ({
  id: 'l', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150',
  flag: null, status: 'final', source: 'report', lab: 'Quest', on: '2026-10-12', ...over,
});

test('each reading against her usual, and how many recent days it has been outside', () => {
  const days = [
    day('2026-10-15', { restingHR: 60 }),
    day('2026-10-16', { restingHR: 71 }),
    day('2026-10-17', { restingHR: 72 }),
    day('2026-10-18', { restingHR: null }),
    day('2026-10-19', { restingHR: 74 }),
  ];
  const r = readingsStatus(days, [usual('resting_hr', 55, 68)]).find((x) => x.key === 'resting_hr')!;
  assert.deepEqual(r, { key: 'resting_hr', label: 'Resting heart rate', latest: '74 bpm', on: '2026-10-19', usual: '55 to 68 bpm', side: 'above', daysOutside: 3 });
  // Without a usual, nothing is judged.
  assert.equal(readingsStatus(days, []).find((x) => x.key === 'resting_hr')!.side, null);
});

const ctx = (over: Partial<AgentContext> = {}): AgentContext => ({
  readings: [],
  labs: [],
  symptoms: [],
  meds: { medications: [], supplements: [], month: [], changes: [] },
  insurance: null,
  referrals: [],
  severe: [],
  vitals: { bp: null, spo2: null },
  gut: null,
  cycle: null,
  visit: null,
  today: [],
  foods: [],
  ...over,
});

test('a lab outside its range in the last 90 days raises a card to decode it', () => {
  const cards = interventions(ctx({ labs: [lab({}), lab({ id: 'b', name: 'TSH', value: 2, low: 0.4, high: 4, unit: 'mIU/L' })] }), NOW, new Set());
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'lab:ferritin:2026-10-12');
  assert.equal(cards[0].title, 'Ferritin was low on 12 Oct');
  assert.deepEqual(cards[0].action, { label: 'Decode this lab', screen: 'labBrief', lab: 'Ferritin' });
  assert.equal(interventions(ctx({ labs: [lab({ on: '2026-05-01' })] }), NOW, new Set()).length, 0, 'older than 90 days');
});

test('a reading outside her usual three days running raises a visit card', () => {
  const c = interventions(
    ctx({ readings: [{ key: 'resting_hr', label: 'Resting heart rate', latest: '74 bpm', on: '2026-10-19', usual: '55 to 68 bpm', side: 'above', daysOutside: 3 }] }),
    NOW,
    new Set(),
  );
  assert.equal(c[0].title, 'Resting heart rate above your usual for 3 days');
  assert.equal(c[0].action?.screen, 'visitPrep');
});

test('symptoms more often, missed doses, stalled referrals and missing insurance each raise their own card', () => {
  const c = interventions(
    ctx({
      symptoms: [{ name: 'Bloating', group: 'Gut', days: 6, last: '18 Oct', worst: 7, versus: 'More often than the 30 days before' }],
      meds: { medications: [], supplements: [], month: [{ label: 'Missed a dose', days: 3 }], changes: [] },
      referrals: [{ id: 'r1', specialty: 'Gynecology', clinician: null, reason: null, referredBy: null, referredOn: '2026-10-01', steps: { referred: '2026-10-01' }, scheduledFor: null, notes: null }],
    }),
    NOW,
    new Set(),
  );
  assert.deepEqual(c.map((x) => x.kind), ['symptom', 'missed', 'referral', 'insurance']);
  assert.equal(c[2].title, 'Your Gynecology referral has not moved in 19 days');
});

test('a severe log in the last three days comes first, as urgent', () => {
  const c = interventions(ctx({ severe: [{ on: '2026-10-19', what: 'Pain', severity: 9 }], labs: [lab({})] }), NOW, new Set());
  assert.equal(c[0].tone, 'urgent');
  assert.equal(c[0].kind, 'urgent');
});

test('a card she dismissed stays dismissed', () => {
  assert.equal(interventions(ctx({ labs: [lab({})] }), NOW, new Set(['lab:ferritin:2026-10-12'])).length, 0);
});

test('the context gathers labs, symptoms, medications, insurance and referrals', () => {
  const c = buildContext({
    days: [],
    baselines: [],
    labs: [lab({})],
    logs: [],
    signals: [{ date: new Date(2026, 9, 19, 12), episode: { kinds: ['Pain'], symptoms: [], severity: 9 } }],
    reported: null,
    insurance: { provider: 'Anthem' },
    referrals: [],
    now: NOW,
  });
  assert.equal(c.labs.length, 1);
  assert.deepEqual(c.severe, [{ on: '2026-10-19', what: 'Pain', severity: 9 }]);
  assert.equal(c.insurance?.provider, 'Anthem');
});
