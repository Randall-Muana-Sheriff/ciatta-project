import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AGE_RANGES,
  buildReflection,
  cycleIsRelevant,
  emptyAnswers,
  hasAnything,
  INTENTS,
  LIFE_STAGES,
  stepsFor,
  type Answers,
} from '../lib/onboarding';

function answers(over: Partial<Answers> = {}): Answers {
  return { ...emptyAnswers(), ...over };
}

// ── The rule the whole first session rests on ──────────────────────────

test('a first session states no findings, however much she told it', () => {
  // Everything filled in. There is still nothing measured, nothing compared,
  // and no second occurrence of anything, so there is nothing to interpret.
  const full = answers({
    opening: 'My cycles got shorter and I am tired all the time.',
    intents: ['noticing_change', 'cycle', 'symptoms'],
    ageRange: '35_44',
    lifeStage: 'cycle_irregular',
    cycleLength: 26,
    conditions: ['Endometriosis'],
    surgeries: ['Laparoscopy'],
    medications: ['Levothyroxine'],
    supplements: ['Magnesium'],
    symptoms: ['Fatigue', 'Bloating'],
    goals: ['Understand the tiredness'],
  });
  const r = buildReflection(full);
  assert.deepEqual(r.findings, [], 'a first session has nothing to interpret and must say so');
});

test('every known line is something she reported, never a combination of answers', () => {
  const r = buildReflection(
    answers({ ageRange: '45_54', lifeStage: 'perimenopause', symptoms: ['Hot flushes'] }),
  );
  for (const k of r.known) {
    assert.equal(k.source, 'reported', `"${k.label}" claims a source other than her own report`);
  }
  // Age 45 to 54 plus perimenopause plus hot flushes is exactly the shape an
  // engine would be tempted to turn into a conclusion. It must not.
  const text = r.known.map((k) => `${k.label} ${k.value}`).join(' ').toLowerCase();
  for (const word of ['likely', 'suggests', 'consistent with', 'indicates', 'caused']) {
    assert.ok(!text.includes(word), `reflection used the inferring word "${word}"`);
  }
});

test('her own words are carried through verbatim', () => {
  const words = 'I have been waking at 3am and my period came twice this month.';
  const r = buildReflection(answers({ opening: words }));
  const line = r.known.find((k) => k.label === 'In your words');
  assert.ok(line, 'her opening was dropped');
  assert.equal(line.value, words, 'her words were edited');
});

// ── Gaps: named, explained, and honest about which can be closed ───────

test('every gap says why it matters', () => {
  const r = buildReflection(answers({ intents: ['cycle'] }));
  assert.ok(r.gaps.length > 0);
  for (const g of r.gaps) {
    assert.ok(g.why.trim().length > 0, `gap "${g.label}" was listed with no reason`);
  }
});

test('time is always named as a gap, and as one that asking cannot close', () => {
  const r = buildReflection(
    answers({ opening: 'x', symptoms: ['Fatigue'], cycleLength: 28, intents: ['cycle'] }),
  );
  const time = r.gaps.find((g) => g.label === 'Time');
  assert.ok(time, 'the one gap that is always true was not named');
  assert.equal(time.fillable, false, 'time was offered as something she could supply now');
});

test('a question she skipped is not reported back as a gap Ciatta could fill', () => {
  const skipped = buildReflection(answers({ skipped: ['symptoms'] }));
  assert.ok(
    !skipped.gaps.some((g) => g.label === 'What you have been feeling'),
    'a declined question was listed as missing data',
  );
  // And the same question is a gap when it was never answered or declined.
  const unasked = buildReflection(answers());
  assert.ok(unasked.gaps.some((g) => g.label === 'What you have been feeling'));
});

test('a cycle gap is only raised when a cycle is relevant to her', () => {
  const menopause = buildReflection(answers({ lifeStage: 'menopause' }));
  assert.ok(
    !menopause.gaps.some((g) => g.label === 'Your cycle timing'),
    'asked a woman in menopause for a cycle length',
  );
});

// ── Which questions she is actually asked ──────────────────────────────

test('the cycle step is skipped where it could not change an interpretation', () => {
  assert.ok(!stepsFor(answers({ lifeStage: 'menopause' })).includes('cycle'));
  assert.ok(!stepsFor(answers({ lifeStage: 'pregnant' })).includes('cycle'));
  assert.ok(stepsFor(answers({ lifeStage: 'perimenopause' })).includes('cycle'));
  assert.ok(stepsFor(answers({ lifeStage: 'cycle_irregular' })).includes('cycle'));
});

test('she is asked about her cycle when that is what she came for, even with no life stage', () => {
  assert.ok(cycleIsRelevant(answers({ intents: ['cycle'] })));
  assert.ok(stepsFor(answers({ intents: ['cycle'] })).includes('cycle'));
});

test('the sequence always opens on the promise and closes on the reflection', () => {
  const s = stepsFor(answers());
  assert.equal(s[0], 'welcome', 'the first session must open with the promise, not a question');
  assert.equal(s[s.length - 1], 'reflect', 'she must be shown what Ciatta made of it');
  assert.ok(s.indexOf('tell') < s.indexOf('intent'), 'her own words must come before the checkboxes');
});

// ── Ending with something useful ───────────────────────────────────────

test('she always leaves with a next step', () => {
  for (const a of [
    answers(),
    answers({ intents: ['appointment'] }),
    answers({ symptoms: ['Fatigue'] }),
    answers({ lifeStage: 'menopause' }),
  ]) {
    const r = buildReflection(a);
    assert.ok(r.nextStep && r.nextStep.trim().length > 0, 'a session ended with nothing to do next');
  }
});

test('preparing for an appointment changes what she is pointed at next', () => {
  const appt = buildReflection(answers({ intents: ['appointment'] })).nextStep ?? '';
  assert.match(appt, /appointment|raise/i);
});

// ── Small guarantees ───────────────────────────────────────────────────

test('an empty session is recognised as empty', () => {
  assert.equal(hasAnything(answers()), false);
  assert.equal(hasAnything(answers({ opening: '   ' })), false, 'whitespace counted as an answer');
  assert.equal(hasAnything(answers({ opening: 'something' })), true);
  assert.equal(hasAnything(answers({ intents: ['cycle'] })), true);
});

test('rather not say is honoured rather than displayed back', () => {
  const r = buildReflection(answers({ ageRange: 'prefer_not' }));
  assert.ok(!r.known.some((k) => k.label === 'Age range'), 'a declined age was echoed back as known');
});

test('option lists have no duplicate ids and carry a label each', () => {
  for (const [name, list] of [
    ['INTENTS', INTENTS],
    ['AGE_RANGES', AGE_RANGES],
    ['LIFE_STAGES', LIFE_STAGES],
  ] as const) {
    const ids = list.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, `${name} has a duplicate id`);
    for (const o of list) assert.ok(o.label.trim().length > 0, `${name} has an option with no label`);
  }
});

test('no option label carries a dash, which the copy rule forbids', () => {
  for (const list of [INTENTS, AGE_RANGES, LIFE_STAGES]) {
    for (const o of list) {
      assert.ok(!/[—–-]/.test(o.label), `"${o.label}" contains a dash`);
    }
  }
});
