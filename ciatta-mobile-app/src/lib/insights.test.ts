import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildContext } from './agent/proactive';
import { INSIGHTS, matchInsights } from './insights';

const NOW = new Date(2026, 9, 28, 10);
const iso = (n: number) => {
  const d = new Date(2026, 9, 28 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const base = { days: [], baselines: [], labs: [], logs: [], signals: [], reported: null, insurance: null, referrals: [], now: NOW };

test('every insight carries its title, highlights, a body, an image and named sources', () => {
  assert.ok(INSIGHTS.length >= 9);
  for (const i of INSIGHTS) {
    assert.ok(i.title && i.body && i.image, i.id);
    assert.ok(i.highlights.length >= 3 && i.highlights.length <= 5, i.id);
    assert.ok(i.sources.length >= 1, i.id);
    for (const s of i.sources) assert.ok(s.title && s.publisher && s.year, `${i.id} source`);
    assert.ok(!/[—–]/.test(`${i.title} ${i.body} ${i.highlights.join(' ')}`), `${i.id} has no dashes`);
  }
});

test('an insight shows only when it connects to her record, and says how', () => {
  // Nothing in her record: nothing to connect.
  assert.deepEqual(matchInsights(INSIGHTS, buildContext(base), [], NOW), []);

  const lab = { id: 'f', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150', flag: null, status: 'final', source: 'provider', lab: 'Quest', on: iso(10) };
  const logs = [1, 3, 5].map((n) => ({ at: new Date(2026, 9, 28 - n, 9).toISOString(), category: 'body', items: { body: ['Fatigue'] }, text: '' }));
  const context = buildContext({ ...base, labs: [lab] as never, logs, vitals: { bp: { systolic: 142, diastolic: 91, on: iso(1) }, spo2: null } });
  const m = matchInsights(INSIGHTS, context, [], NOW);
  const iron = m.find((x) => x.insight.id === 'iron-fatigue')!;
  assert.deepEqual(iron.connections, ['Ferritin was low, 12 ng/mL on 18 Oct.', 'You logged fatigue on 3 days in the last 90.']);
  const bp = m.find((x) => x.insight.id === 'bp-categories')!;
  assert.deepEqual(bp.connections, ['Blood pressure 142/91 on 27 Oct, in the high range.']);
  assert.equal(m[0].insight.id, 'iron-fatigue', 'the one with the most connections leads');
  assert.ok(!m.some((x) => x.insight.id === 'headache-red-flags'), 'no headaches logged, no headache insight');
});

test('endometriosis on her record brings its insight; logged headaches bring the warning signs', () => {
  const logs = [1, 2].map((n) => ({ at: new Date(2026, 9, 28 - n, 9).toISOString(), category: 'mind', items: { mind: ['Headache'] }, text: '' }));
  const m = matchInsights(INSIGHTS, buildContext({ ...base, logs }), ['Endometriosis'], NOW);
  assert.deepEqual(m.find((x) => x.insight.id === 'endo-gut')!.connections, ['Endometriosis is on your record.']);
  assert.deepEqual(m.find((x) => x.insight.id === 'headache-red-flags')!.connections, ['You logged headache on 2 days in the last 90.']);
});

test('Discuss asks the concierge how the insight relates to her record, and it answers from her record', async () => {
  const { classify } = await import('./agent/classify');
  const { respond } = await import('./agent/capabilities');
  const { checkAnswer } = await import('./agent/check');
  const { discussPrompt } = await import('./careHandoff');
  const iron = INSIGHTS.find((i) => i.id === 'iron-fatigue')!;
  const prompt = discussPrompt(iron.title);
  assert.equal(classify(prompt), 'insight');
  const lab = { id: 'f', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150', flag: null, status: 'final', source: 'provider', lab: 'Quest', on: iso(10) };
  const context = buildContext({ ...base, labs: [lab] as never });
  const r = { name: null, today: null, days: [], episodes: [], conditions: [], medications: [], insights: [], references: [], cycleDay: null, cyclePhase: null, clinical: [], context } as never;
  const a = respond(prompt, r, 'insight');
  assert.equal(
    a.text,
    'How it connects to your record:\n• Ferritin was low, 12 ng/mL on 18 Oct.\n\nThe research behind it is in the insight, with its sources. Worth raising with your clinician; your visit prep can carry it.',
  );
  assert.deepEqual(checkAnswer(a.text, a), []);
});

test('every source names its publisher\'s logo, and every insight its topics', async () => {
  const { PUBLISHER_LOGOS } = await import('./insights');
  for (const i of INSIGHTS) {
    assert.ok(i.topics.length >= 1, i.id);
    for (const s of i.sources) assert.ok(PUBLISHER_LOGOS.includes(s.logo), `${i.id}: ${s.logo}`);
  }
});

test('Ciatta learns from her reactions: liked and saved topics rise, a thumbs down hides that insight and lowers its topics', async () => {
  const { rankInsights } = await import('./insights');
  const pick = (id: string) => ({ insight: INSIGHTS.find((i) => i.id === id)!, connections: ['x'] });
  const matches = [pick('bp-categories'), pick('sleep-cycle'), pick('hormones-cycle'), pick('bristol')];
  // No reactions: as matched.
  assert.deepEqual(rankInsights(matches, {}).map((m) => m.insight.id), ['bp-categories', 'sleep-cycle', 'hormones-cycle', 'bristol']);
  // She liked sleep and saved the hormones one: cycle topics rise.
  const liked = rankInsights(matches, { 'sleep-cycle': { reaction: 'up', saved: false }, 'hormones-cycle': { reaction: null, saved: true } });
  assert.deepEqual(liked.slice(0, 2).map((m) => m.insight.id), ['hormones-cycle', 'sleep-cycle']);
  // A thumbs down hides that insight.
  assert.ok(!rankInsights(matches, { bristol: { reaction: 'down', saved: false } }).some((m) => m.insight.id === 'bristol'));
});
