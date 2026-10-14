import assert from 'node:assert/strict';
import { test } from 'node:test';

import { respond } from './capabilities';
import { checkAnswer } from './check';
import { classify } from './classify';
import { buildContext } from './proactive';
import { labSuggestions, SUGGEST_LABS } from './labSuggest';

const NOW = new Date(2026, 9, 15, 10);
const sym = (name: string, days: number, group = 'Body') => ({ name, group, days, last: '14 Oct', worst: null, versus: null });

test('labs worth asking about: from symptoms she logged repeatedly, skipping any result she already has from the last year', () => {
  const s = labSuggestions({
    symptoms: [sym('Fatigue', 6), sym('Hair shedding', 3, 'Skin'), sym('Brain fog', 4, 'Mind'), sym('Acne', 1, 'Skin')],
    labs: [{ name: 'Vitamin D', on: '2026-03-01' }, { name: 'TSH', on: '2025-01-10' }],
    now: NOW,
  });
  assert.deepEqual(s, [
    { test: 'Ferritin', reasons: ['fatigue on 6 days', 'hair shedding on 3 days'] },
    { test: 'TSH', reasons: ['fatigue on 6 days', 'brain fog on 4 days', 'hair shedding on 3 days'] },
    { test: 'Complete blood count', reasons: ['fatigue on 6 days'] },
  ]);
  assert.deepEqual(labSuggestions({ symptoms: [sym('Acne', 1, 'Skin')], labs: [], now: NOW }), [], 'once is not a pattern');
});

test('asked from Care, the agent answers with the suggestions and offers to draft the request, within its checks', () => {
  assert.equal(classify(SUGGEST_LABS), 'labs');
  const context = buildContext({
    days: [], baselines: [], labs: [], logs: [], reported: null, insurance: null, referrals: [], now: NOW,
    signals: [6, 5, 4, 3, 2, 1].map((n) => ({ date: new Date(2026, 9, 15 - n, 9), episode: { kinds: [], symptoms: ['Fatigue'], severity: null } })),
  });
  const r = { name: null, today: null, days: [], episodes: [], conditions: [], medications: [], insights: [], references: [], cycleDay: null, cyclePhase: null, clinical: [], context } as never;
  const a = respond(SUGGEST_LABS, r, 'labs');
  assert.equal(
    a.text,
    'Worth asking your clinician about: Ferritin, since you logged fatigue on 6 days; TSH, since you logged fatigue on 6 days; Complete blood count, since you logged fatigue on 6 days. None has a result in your record from the last year. I can draft the request for you to send.',
  );
  assert.deepEqual(checkAnswer(a.text, a), []);
  assert.equal(a.suggestions[0].label, 'Draft the request');
});
