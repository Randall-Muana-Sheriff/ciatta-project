import assert from 'node:assert/strict';
import { test } from 'node:test';

import { currentStep, nextAction, type Referral, REFERRAL_STEPS, referralFromMessage, stalled } from './referrals';

const ref = (steps: Referral['steps'], over: Partial<Referral> = {}): Referral => ({
  id: 'r1',
  specialty: 'Gynecology',
  clinician: null,
  reason: 'Pelvic pain',
  referredBy: 'Dr Kim',
  referredOn: '2026-10-01',
  steps,
  scheduledFor: null,
  notes: null,
  ...over,
});

test('five steps, from referred to seen', () => {
  assert.deepEqual(REFERRAL_STEPS.map((s) => s.key), ['referred', 'insurance', 'requested', 'scheduled', 'seen']);
});

test('the current step is the first one not yet marked', () => {
  assert.equal(currentStep(ref({ referred: '2026-10-01' }))?.key, 'insurance');
  assert.equal(currentStep(ref({ referred: '2026-10-01', insurance: '2026-10-03' }))?.key, 'requested');
  assert.equal(currentStep(ref({ referred: '2026-10-01', insurance: '2026-10-03', requested: '2026-10-04', scheduled: '2026-10-05', seen: '2026-11-02' })), null);
});

test('each next step is prepared for her to do, never done for her', () => {
  const insurance = nextAction(ref({ referred: '2026-10-01' }), true)!;
  assert.match(insurance.text, /Gynecology/);
  assert.match(insurance.text, /prior authorization/);
  assert.match(nextAction(ref({ referred: '2026-10-01' }), false)!.text, /Add your insurance/);
  assert.match(nextAction(ref({ referred: '2026-10-01', insurance: '2026-10-03' }), true)!.text, /Pelvic pain/);
  assert.equal(nextAction(ref({ referred: '2026-10-01', insurance: '2026-10-03', requested: '2026-10-04', scheduled: '2026-10-05', seen: '2026-11-02' }), true), null);
});

test('stalled when the last step was marked 14 days ago or more and it is not finished', () => {
  const now = new Date(2026, 9, 20);
  assert.equal(stalled(ref({ referred: '2026-10-01' }), now), 19);
  assert.equal(stalled(ref({ referred: '2026-10-10' }), now), null);
  // Waiting for a visit that is booked is not stalled.
  assert.equal(stalled(ref({ referred: '2026-09-01', insurance: '2026-09-02', requested: '2026-09-03', scheduled: '2026-09-04' }, { scheduledFor: '2026-11-02' }), now), null);
});

test('a referral named in what she wrote is drafted, never saved', () => {
  assert.deepEqual(referralFromMessage('My GP referred me to a gynecologist for the pain'), { specialty: 'Gynecology' });
  assert.deepEqual(referralFromMessage('I got a referral to endocrinology'), { specialty: 'Endocrinology' });
  assert.deepEqual(referralFromMessage('referred to a pelvic floor physio'), { specialty: 'Pelvic floor physiotherapy' });
  assert.equal(referralFromMessage('what did my labs show'), null);
});
