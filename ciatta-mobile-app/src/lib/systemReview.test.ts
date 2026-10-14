import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildContext } from './agent/proactive';
import { defaultTopic, explorePrompt, systemReview, SYSTEM_TOPICS, topicsFor } from './systemReview';

const NOW = new Date(2026, 9, 20, 9);
const iso = (n: number) => {
  const d = new Date(2026, 9, 20 - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const day = (n: number, over: Record<string, unknown> = {}) => ({
  date: iso(n), sleepHours: null, stages: { awake: null, rem: null, light: null, deep: null }, timeInBed: null, steps: null,
  activeMinutes: null, workouts: [], restingHR: null, hrv: null, tempDeviation: null, energy: null, mood: null, stress: null,
  caffeine: null, alcohol: null, foods: [] as string[], digestion: [] as string[], ...over,
});
const lab = (over: Record<string, unknown>) => ({
  id: 'l', name: 'Ferritin', value: 12, valueText: null, unit: 'ng/mL', low: 15, high: 150, rangeText: '15 to 150',
  flag: null, status: 'final', source: 'report', lab: 'Quest', on: iso(8), ...over,
});
const base = { baselines: [], logs: [], signals: [], reported: null, insurance: null, referrals: [], now: NOW };

test('Reproductive gathers fertility, cycle, pregnancy and postpartum, menopause and endometriosis into one set of highlights', () => {
  assert.deepEqual(SYSTEM_TOPICS.Reproductive, ['Fertility', 'Cycle', 'Pregnancy and postpartum', 'Menopause', 'Endometriosis']);
  const context = buildContext({ ...base, days: [], labs: [], cycle: { day: 22, phase: 'Likely luteal' } });
  const r = systemReview('Reproductive', {
    context, points: [{ title: 'Pain you logged', detail: '', source: 'You reported', region: 'pelvis' }] as never,
    conditions: ['Endometriosis'], situations: ['Perimenopause'], insight: 'Logged on 4 days this month, up from 1 the month before.', now: NOW,
  });
  assert.deepEqual(r.highlights, [
    'Logged on 4 days this month, up from 1 the month before',
    'Cycle day 22, likely luteal',
    'Endometriosis on your record',
    'Perimenopause noted in your profile',
    'Pain you logged, pelvis and reproductive',
  ]);
  assert.ok(r.facts.length >= r.highlights.length);
});

test('Digestive reads the gut, the gut symptoms and the foods she actually logs, by name', () => {
  const days = [day(1, { foods: ['Jollof rice', 'Plantain'], digestion: ['Bloating'] }), day(2, { foods: ['Jollof rice'] }), day(3, { foods: ['Egusi soup'] })];
  const context = buildContext({
    ...base, days, labs: [],
    episodes: [{ date: iso(1), kinds: ['Bowel movement'], stool: 4, bowelPain: null, bowelFlags: [] }, { date: iso(3), kinds: ['Bowel movement'], stool: 6, bowelPain: null, bowelFlags: [] }],
  });
  const r = systemReview('Digestive', { context, points: [], conditions: [], situations: [], insight: null, now: NOW });
  assert.ok(r.highlights.includes('2 bowel movements in 4 weeks, 1 of 2 typical'), r.highlights.join(' | '));
  assert.ok(r.highlights.includes('Foods you log most: Jollof rice, Plantain, Egusi soup'));
});

test('labs belong to their system, outside range first', () => {
  const context = buildContext({ ...base, days: [], labs: [lab({}), lab({ id: 't', name: 'TSH', value: 2, unit: 'mIU/L', low: 0.4, high: 4, rangeText: '0.4 to 4.0' })] as never });
  const metabolic = systemReview('Metabolic', { context, points: [], conditions: [], situations: [], insight: null, now: NOW });
  assert.ok(metabolic.highlights.some((h) => h.startsWith('TSH')), metabolic.highlights.join(' | '));
  const circ = systemReview('Circulatory', { context, points: [], conditions: [], situations: [], insight: null, now: NOW });
  assert.ok(circ.highlights.some((h) => h.startsWith('Ferritin low')), circ.highlights.join(' | '));
});

test('nothing recorded says so; the Explore prompt names the system and the topic', () => {
  const context = buildContext({ ...base, days: [], labs: [] });
  assert.deepEqual(systemReview('Skin', { context, points: [], conditions: [], situations: [], insight: null, now: NOW }).highlights, []);
  assert.equal(
    explorePrompt('Reproductive', 'Endometriosis'),
    'I want the bigger picture of my reproductive health, especially endometriosis. Bring together what my wearables, provider records, labs, logs and the foods I eat show: what happened between visits, what still feels different even where results were normal, what is worth exploring, and what to bring to my next visit.',
  );
  assert.ok(explorePrompt('Whole Body').startsWith('I want the bigger picture of my whole body health.'));
});

test('Explore\'s prompt reaches its own capability, which answers from the same highlights, within the checks', async () => {
  const { classify } = await import('./agent/classify');
  const { respond } = await import('./agent/capabilities');
  const { checkAnswer } = await import('./agent/check');
  const prompt = explorePrompt('Reproductive', 'Endometriosis');
  assert.equal(classify(prompt), 'system');
  const context = buildContext({ ...base, days: [], labs: [], cycle: { day: 22, phase: 'Likely luteal' } });
  const r = { name: null, today: null, days: [], episodes: [], conditions: ['Endometriosis'], medications: [], insights: [], references: [], cycleDay: 22, cyclePhase: 'Likely luteal', clinical: [], context } as never;
  const a = respond(prompt, r, 'system');
  assert.equal(
    a.text,
    'The bigger picture of your reproductive health. Between visits: cycle day 22, likely luteal; endometriosis on your record. Worth exploring: keep logging pain and symptoms each day; across a few cycles, your own pattern shows what a single visit cannot. For your next visit, your visit prep gathers what to raise.',
  );
  assert.deepEqual(checkAnswer(a.text, a), []);
  assert.equal(a.suggestions[0].screen, 'visitPrep');
  const empty = respond(explorePrompt('Skin'), { ...(r as object), conditions: [], cycleDay: null, context: buildContext({ ...base, days: [], labs: [] }) } as never, 'system');
  assert.equal(empty.abstained, 'no_data');
});

test('her persona, managing endometriosis: it leads the topics, Explore focuses on it, and a normal result beside logged symptoms is named as worth exploring', () => {
  assert.deepEqual(topicsFor('Reproductive', ['Endometriosis']).slice(0, 2), ['Endometriosis', 'Fertility']);
  assert.equal(defaultTopic('Reproductive', ['Endometriosis']), 'Endometriosis');
  assert.equal(defaultTopic('Reproductive', []), undefined);
  assert.equal(defaultTopic('Digestive', ['Endometriosis']), undefined);
  const context = buildContext({
    ...base, days: [], cycle: { day: 3, phase: null },
    labs: [lab({ name: 'Estradiol', value: 120, unit: 'pg/mL', low: 30, high: 400, rangeText: '30 to 400', on: iso(10) })] as never,
  });
  const r = systemReview('Reproductive', {
    context, points: [{ title: 'Pain you logged', detail: '', source: 'You reported', region: 'pelvis' }] as never,
    conditions: ['Endometriosis'], situations: [], insight: 'Logged on 6 days this month, up from 2 the month before, 5 of them during your period.', now: NOW,
  });
  assert.deepEqual(r.explore, [
    'Your Estradiol came back within range, while you logged symptoms on 6 days this month. A normal result and a pattern you can feel can both be true, and the gap is worth exploring.',
    'Most of it came during your period. Tracked across your cycles, that timing is worth raising in your endometriosis care.',
  ]);
});
