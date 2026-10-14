import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LabResult } from '../labs';
import type { AgentContext } from './proactive';
import { labBrief, labBriefHtml, visitPrep, visitPrepHtml } from './tasks';

const NOW = new Date(2026, 9, 20, 9);
const lab = (over: Partial<LabResult>): LabResult => ({
  id: 'l', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150',
  flag: null, status: 'final', source: 'report', lab: 'Quest', on: '2026-10-12', ...over,
});

const ctx: AgentContext = {
  readings: [{ key: 'resting_hr', label: 'Resting heart rate', latest: '74 bpm', on: '2026-10-19', usual: '55 to 68 bpm', side: 'above', daysOutside: 3 }],
  labs: [lab({}), lab({ id: 'p', on: '2026-06-01', value: 30 }), lab({ id: 't', name: 'TSH', value: 2, unit: 'mIU/L', low: 0.4, high: 4, rangeText: '0.4 to 4.0' })],
  symptoms: [{ name: 'Bloating', group: 'Gut', days: 6, last: '18 Oct', worst: 7, versus: 'More often than the 30 days before' }],
  meds: {
    medications: [{ name: 'Levothyroxine', last: '18 Oct', days: 9 }],
    supplements: [{ name: 'Magnesium', last: null, days: 0 }],
    month: [{ label: 'Missed a dose', days: 3 }],
    changes: [],
  },
  insurance: { provider: 'Anthem', plan: 'PPO' },
  referrals: [{ id: 'r1', specialty: 'Gynecology', clinician: null, reason: 'Pelvic pain', referredBy: null, referredOn: '2026-10-01', steps: { referred: '2026-10-01' }, scheduledFor: null, notes: null }],
  severe: [],
  vitals: { bp: null, spo2: null },
  gut: null,
  cycle: null,
  visit: null,
  today: [],
  foods: [],
};

test('a visit prep summary: what changed, labs outside range, what she takes, referrals', () => {
  const p = visitPrep(ctx, NOW);
  const section = (t: string) => p.sections.find((s) => s.title === t)!.lines;
  assert.deepEqual(section('What changed'), [
    'Resting heart rate above my usual for 3 days, latest 74 bpm against 55 to 68 bpm',
    'Bloating on 6 days in the last 90, more often lately, worst 7 of 10',
  ]);
  assert.deepEqual(section('Labs outside range'), ['Ferritin low, 12 ng/mL on 12 Oct (lab range 15 to 150)']);
  assert.deepEqual(section('What I take'), ['Levothyroxine (medication)', 'Magnesium (supplement)', 'Missed a dose on 3 days in the last 30']);
  assert.deepEqual(section('Referrals'), ['Gynecology: next, insurance checked']);
});

test('questions to ask, one for each thing that changed, written as hers to ask', () => {
  const q = visitPrep(ctx, NOW).questions;
  assert.deepEqual(q, [
    'My resting heart rate has been above my usual for 3 days. Is that worth looking into?',
    'I have had bloating on 6 days in the last 90, more often lately. What could be behind it?',
    'My ferritin was low (12 ng/mL) on 12 Oct. What could explain that, and should it be rechecked?',
    'I missed my medication on 3 days this month. Is there a time or form that would be easier?',
    'Where does my referral to Gynecology stand, and is there anything I need to do?',
  ]);
});

test('a lab decoding brief: the result against the lab\'s range, its trend, and questions, never a diagnosis', () => {
  const b = labBrief(ctx.labs, 'Ferritin')!;
  assert.equal(b.title, 'Ferritin');
  assert.deepEqual(b.rows, [
    { label: 'Latest', value: '12 ng/mL', note: '12 Oct 2026' },
    { label: 'Status', value: 'Low', note: 'Compared with the lab\'s range' },
    { label: 'Lab range', value: '15 to 150' },
    { label: 'Results on record', value: '2' },
  ]);
  assert.equal(b.trend, 'Lower than your previous result, 30 ng/mL on 1 Jun 2026.');
  assert.ok(b.questions.length >= 2 && b.questions.every((x) => x.endsWith('?')));
  assert.match(b.note, /not a diagnosis/);
  assert.equal(labBrief(ctx.labs, 'Nothing'), null);
  assert.equal(labBrief(ctx.labs, 'TSH')!.trend, null, 'one result has no trend');
});

test('the visit prep page carries her sections and chosen questions, escaped, with the caveat', () => {
  const html = visitPrepHtml({ sections: [{ title: 'What changed', lines: ['Pain <8> & cramps'] }], questions: ['Is this normal?'] }, { name: 'Jen', made: new Date(2026, 9, 20) });
  assert.ok(html.includes('Pain &lt;8&gt; &amp; cramps'));
  assert.ok(html.includes('<li>Is this normal?</li>'));
  assert.ok(html.includes('Visit prep for Jen'));
  assert.ok(html.includes('20 Oct 2026'));
  assert.match(html, /not a diagnosis/);
});

test('the lab brief page carries the rows, the trend and the questions', () => {
  const html = labBriefHtml(labBrief(ctx.labs, 'Ferritin')!, { made: new Date(2026, 9, 20) });
  assert.ok(html.includes('<h1>Ferritin</h1>'));
  assert.ok(html.includes('15 to 150'));
  assert.ok(html.includes('Lower than your previous result'));
});
