import assert from 'node:assert/strict';
import { test } from 'node:test';

import { careTeam, draftRequest, latestActivity, openPlan, openRequests, prescriptions, type CareRequest } from './care';

const NOW = new Date(2026, 9, 15, 10);

test('her care team: clinicians from her providers, referrals and calendar, and the ones she added, each once', () => {
  const team = careTeam({
    added: [{ id: 'c1', name: 'Dr Kim', role: 'Gynecologist', organization: 'Riverside Health', phone: null, email: null, notes: null }],
    providers: [{ organization: 'Riverside Health' }, { organization: 'Quest Diagnostics' }],
    referrals: [{ specialty: 'Gastroenterology', clinician: 'Dr Osei', referredBy: 'Dr Kim' }],
    visits: ['Dr Patel', 'Dentist', 'dr kim follow up'],
  });
  assert.deepEqual(
    team.map((c) => [c.name, c.role, c.source]),
    [
      ['Dr Kim', 'Gynecologist', 'added'],
      ['Dr Osei', 'Gastroenterology', 'referral'],
      ['Dr Patel', null, 'visit'],
      ['Quest Diagnostics', 'Provider', 'provider'],
    ],
  );
  // A title is not an initial.
  assert.equal(team.find((c) => c.name === 'Dr Kim')!.initials, 'K');
});

test('prescriptions: her medications from her providers and her own list, each once, with when she last logged it', () => {
  const rx = prescriptions({
    reported: ['Levothyroxine'],
    clinical: [{ kind: 'medication', name: 'Levothyroxine 50 mcg', effectiveOn: '2026-08-01' }, { kind: 'medication', name: 'Norethindrone', effectiveOn: '2026-09-01' }, { kind: 'lab', name: 'TSH', effectiveOn: '2026-09-01' }],
    logged: [{ name: 'Levothyroxine', last: '14 Oct', days: 9 }],
    missed: 2,
  });
  assert.deepEqual(rx.items, [
    { name: 'Levothyroxine 50 mcg', from: 'Provider', last: '14 Oct' },
    { name: 'Norethindrone', from: 'Provider', last: null },
  ]);
  assert.equal(rx.missed, 2);
});

test('a request is drafted from her record for her to send herself, never sent by Ciatta', () => {
  const refill = draftRequest('refill', { name: 'Maya', clinician: 'Dr Kim', medication: 'Levothyroxine 50 mcg', last: '14 Oct' });
  assert.equal(refill.title, 'Refill: Levothyroxine 50 mcg');
  assert.equal(
    refill.body,
    'Hello Dr Kim,\n\nI would like to request a refill of Levothyroxine 50 mcg. I last took it on 14 Oct.\n\nThank you,\nMaya',
  );
  const labs = draftRequest('labs', { name: 'Maya', clinician: null, tests: ['Ferritin', 'TSH'], reasons: ['fatigue on 6 days this month'] });
  assert.equal(labs.title, 'Labs: Ferritin and TSH');
  assert.ok(labs.body.startsWith('Hello,\n\nI would like to ask about checking Ferritin and TSH. I have logged fatigue on 6 days this month.'));
  assert.equal(draftRequest('records', { name: null, clinician: 'Riverside Health' }).title, 'Records request: Riverside Health');
});

test('open requests: drafts and sent ones, newest first; answered and closed ones are done', () => {
  const r = (id: string, status: CareRequest['status'], createdAt: string): CareRequest => ({
    id, kind: 'refill', title: id, body: '', clinician: null, status, sentOn: null, answeredOn: null, createdAt,
  });
  assert.deepEqual(openRequests([r('a', 'draft', '2026-10-10'), r('b', 'sent', '2026-10-12'), r('c', 'answered', '2026-10-14'), r('d', 'closed', '2026-10-01')]).map((x) => x.id), ['b', 'a']);
});

test('the open plan: what is next for her, from the agent\'s cards, her referrals and her next visit', () => {
  const plan = openPlan({
    cards: [{ id: 'lab:ferritin', title: 'Ferritin was low on 12 Oct', action: { label: 'Decode this lab', screen: 'labBrief', lab: 'Ferritin' } }],
    referrals: [{ id: 'r1', specialty: 'Gastroenterology', next: 'Check your insurance covers it' }],
    visit: { title: 'Dr Kim', when: 'Thu, Oct 16, 9 am' },
    requests: 1,
  });
  assert.deepEqual(plan.map((p) => p.title), ['Prepare for Dr Kim', 'Ferritin was low on 12 Oct', 'Gastroenterology referral', 'Follow up on 1 open request']);
  assert.equal(plan[2].sub, 'Check your insurance covers it');
});

test('latest activity: what happened in her record, newest first, six at most', () => {
  const a = latestActivity({
    labs: [{ name: 'Ferritin', on: '2026-10-12', source: 'provider' }, { name: 'TSH', on: '2026-10-12', source: 'provider' }],
    logs: [{ at: '2026-10-14T08:00:00Z', items: { body: ['Fatigue'], mind: ['Brain fog'] } }],
    episodes: [{ date: '2026-10-13', kinds: ['Pain'] }],
    meals: [{ eatenAt: '2026-10-14T19:00:00Z' }],
    requests: [{ title: 'Refill: Levothyroxine', status: 'sent', sentOn: '2026-10-11', createdAt: '2026-10-10' }],
    referrals: [{ specialty: 'Gastroenterology', steps: { insurance: '2026-10-09' } }],
    now: NOW,
  });
  assert.deepEqual(a.map((x) => x.title), [
    'Logged a meal',
    'Logged fatigue and brain fog',
    'Logged pain',
    '2 lab results arrived from your provider',
    'Sent: Refill: Levothyroxine',
    'Gastroenterology referral: insurance checked',
  ]);
});

test('a clinician is named first and last, with their specialty, and split back for editing', async () => {
  const { clinicianName, splitName } = await import('./care');
  assert.equal(clinicianName('Maria', 'Rivera'), 'Maria Rivera');
  assert.equal(clinicianName(' Maria ', ''), 'Maria');
  assert.deepEqual(splitName('Maria Rivera'), { first: 'Maria', last: 'Rivera' });
  assert.deepEqual(splitName('Dr Ama Osei Bonsu'), { first: 'Ama', last: 'Osei Bonsu' });
  const team = careTeam({
    added: [{ id: 'c1', name: 'Maria Rivera', role: 'Gynecologist', organization: 'Riverside Health', phone: null, email: null, notes: null }],
    providers: [], referrals: [], visits: [],
  });
  assert.deepEqual([team[0].name, team[0].role, team[0].initials], ['Maria Rivera', 'Gynecologist', 'MR']);
});
