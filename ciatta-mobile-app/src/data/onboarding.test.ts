import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AGE_RANGES,
  buildReflection,
  consentsFor,
  correctionTarget,
  cycleIsRelevant,
  emptyAnswers,
  hasAnything,
  INTENTS,
  LIFE_STAGES,
  reflectionParagraph,
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
  const skipped = buildReflection(answers({ skipped: ['snapshot'] }));
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

test('the cycle question is hidden where it could not change an interpretation', () => {
  // It is a section inside the snapshot screen now, not a step of its own, so
  // the rule lives in cycleIsRelevant and the screen reads it. A question that
  // vanishes from a scroll costs her nothing; a step that vanishes from a
  // count makes the progress indicator jump.
  assert.equal(cycleIsRelevant(answers({ lifeStage: 'menopause' })), false);
  assert.equal(cycleIsRelevant(answers({ lifeStage: 'pregnant' })), false);
  assert.equal(cycleIsRelevant(answers({ lifeStage: 'perimenopause' })), true);
  assert.equal(cycleIsRelevant(answers({ lifeStage: 'cycle_irregular' })), true);
});

test('she is asked about her cycle when that is what she came for, even with no life stage', () => {
  assert.ok(cycleIsRelevant(answers({ intents: ['cycle'] })));
});

test('the sequence opens on the promise and closes on the reflection', () => {
  const s = stepsFor(answers());
  assert.deepEqual(s, ['welcome', 'name', 'intent', 'tell', 'snapshot', 'connect', 'reflect']);
  assert.equal(s[0], 'welcome', 'the first session must open with the promise, not a question');
  assert.equal(s[s.length - 1], 'reflect', 'she must be shown what Ciatta made of it');
});

test('her name is the first thing asked, before anything about her health', () => {
  // Her email is how she authenticates. The name on it belongs to whoever set
  // the account up, which on a Google sign in is a legal name she may not use
  // and did not choose for this. Asking is the only way to get the name she
  // wants Ciatta to call her.
  const s = stepsFor(answers());
  assert.equal(s[1], 'name', 'Begin must lead straight to the name question');
  assert.ok(s.indexOf('name') < s.indexOf('intent'), 'a health question came before her name');
});

test('the name she gives is read back to her as her own report', () => {
  const r = buildReflection(answers({ name: '  Jenny  ' }));
  const line = r.known.find((k) => k.label === 'Name');
  assert.ok(line, 'the name she typed never appeared in what Ciatta knows');
  assert.equal(line.value, 'Jenny', 'the name was stored with her whitespace');
  assert.equal(line.source, 'reported');
});

test('no name means no name line, rather than a blank one', () => {
  const r = buildReflection(answers({ name: '   ' }));
  assert.equal(r.known.find((k) => k.label === 'Name'), undefined);
});

test('tapping her name on the reflection reopens the name question', () => {
  assert.equal(correctionTarget(answers({ name: 'Jenny' }), 'Name'), 'name');
});

test('a name on its own is enough to have told Ciatta something', () => {
  assert.ok(hasAnything(answers({ name: 'Jenny' })));
  assert.ok(!hasAnything(answers({ name: '  ' })), 'whitespace counted as an answer');
});

test('the tags come before the open box, so she has a frame to write against', () => {
  // This reverses the first build, which opened on the empty box reasoning
  // that a questionnaire first teaches her Ciatta wants data entry. An empty
  // box with no frame is the harder question, not the softer one.
  const s = stepsFor(answers());
  assert.ok(s.indexOf('intent') < s.indexOf('tell'), 'the open box came before anything framed it');
});

test('connecting a source is asked last, after she has told her story', () => {
  const s = stepsFor(answers());
  assert.ok(s.indexOf('connect') > s.indexOf('tell'));
  assert.ok(s.indexOf('connect') > s.indexOf('snapshot'), 'asked for permissions before she had invested anything');
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

// ── Consent: recorded per kind, so marketing can be withdrawn alone ────

test('consent is recorded per kind, so marketing can be withdrawn on its own', () => {
  const c = consentsFor(true);
  assert.equal(c.length, 3, 'terms, privacy and marketing are three records');
  assert.deepEqual(c.map((x) => x.kind).sort(), ['marketing_email', 'privacy', 'terms']);
  for (const x of c) {
    assert.ok(x.policyVersion.trim().length > 0, `${x.kind} recorded with no policy version`);
  }
});

test('declining marketing is recorded as declined, not omitted', () => {
  const c = consentsFor(false);
  const marketing = c.find((x) => x.kind === 'marketing_email');
  assert.ok(marketing, 'declining marketing dropped the record entirely');
  assert.equal(marketing.granted, false, 'a decline must be stored as a decline');
  // Being asked and saying no is not the same as never being asked, and only
  // a stored false can tell those apart later.
});

test('signing up always grants terms and privacy, which are not optional', () => {
  for (const m of [true, false]) {
    const c = consentsFor(m);
    assert.equal(c.find((x) => x.kind === 'terms')?.granted, true);
    assert.equal(c.find((x) => x.kind === 'privacy')?.granted, true);
  }
});

// ── Corrections change one answer, not all of them ────────────────────

test('a correction opens the step that holds that answer', () => {
  const a = answers({ conditions: ['Endometriosis'], medications: ['Levothyroxine'] });
  assert.equal(correctionTarget(a, 'In your words'), 'tell');
  assert.equal(correctionTarget(a, 'What brought you here'), 'intent');
  // The rest share the snapshot screen, which is the whole point of merging
  // them: one scroll holds every answer of that kind.
  for (const label of ['Conditions', 'Medications', 'Symptoms', 'Age range', 'Life stage', 'Typical cycle']) {
    assert.equal(correctionTarget(a, label), 'snapshot', `${label} did not open the snapshot`);
  }
});

test('a correction always lands on a question she can answer', () => {
  // The earlier version of this asserted only that the target was in her
  // sequence, which 'connect' satisfies, so it could not fail. 'connect' is
  // the Apple Health offer: it is a step, it holds no answer, and sending a
  // correction there opens a permission prompt. Name the questions.
  const QUESTIONS = ['intent', 'tell', 'snapshot'];
  const a = answers({ opening: 'something' });
  const target = correctionTarget(a, 'Not A Real Label');
  assert.ok(
    QUESTIONS.includes(target),
    `an unknown label sent her to "${target}", which is not a question`,
  );
});

test('a stale correction label does not reopen a question her answers removed', () => {
  // The reachable path, not a hypothetical: she answers a cycle length,
  // reaches reflect, changes her life stage to menopause, and the cycle line
  // is still rendered because cycleLength was never cleared. Tapping it must
  // not reintroduce the cycle question, and must not land on Apple Health.
  const QUESTIONS = ['intent', 'tell', 'snapshot'];
  const a = answers({ lifeStage: 'menopause', cycleLength: 28 });
  const target = correctionTarget(a, 'Typical cycle');
  assert.ok(stepsFor(a).includes(target), 'correction opened a step not in her sequence');
  assert.notEqual(target, 'connect', 'a correction opened the Apple Health offer');
  assert.ok(QUESTIONS.includes(target), `landed on "${target}", which is not a question`);
});

test('every correction label maps to a step that actually exists', () => {
  // A label in the table that buildReflection never emits, or a step id that
  // is not a step, is dead weight that reads as working.
  const a = answers({
    opening: 'x',
    intents: ['cycle'],
    ageRange: '35_44',
    lifeStage: 'cycling',
    cycleLength: 28,
    conditions: ['Endometriosis'],
    surgeries: ['Laparoscopy'],
    medications: ['Levothyroxine'],
    supplements: ['Magnesium'],
    symptoms: ['Fatigue'],
  });
  const steps = stepsFor(a);
  for (const k of buildReflection(a).known) {
    const target = correctionTarget(a, k.label);
    assert.ok(steps.includes(target), `"${k.label}" maps to ${target}, not in her sequence`);
    assert.notEqual(target, 'connect', `"${k.label}" maps to the Apple Health offer`);
  }
});

// ── The reflection, as one paragraph ──────────────────────────────────

const FULL: Partial<Answers> = {
  name: 'Jenny',
  opening: 'My cycles got shorter and I am tired all the time.',
  intents: ['cycle', 'symptoms'],
  ageRange: '35_44',
  lifeStage: 'cycle_irregular',
  cycleLength: 26,
  conditions: ['Endometriosis'],
  surgeries: ['Laparoscopy'],
  medications: ['Levothyroxine'],
  supplements: ['Magnesium'],
  symptoms: ['Fatigue', 'Bloating'],
  goals: ['Understand the tiredness'],
};

test('the paragraph carries every answer she gave', () => {
  const p = reflectionParagraph(answers(FULL));
  for (const fragment of [
    'Jenny',
    'My cycles got shorter and I am tired all the time.',
    '35 to 44',
    'Endometriosis',
    'Laparoscopy',
    'Levothyroxine',
    'Magnesium',
    'Fatigue',
    'Bloating',
    'Understand the tiredness',
    '26 days',
  ]) {
    assert.ok(p.includes(fragment), `the paragraph dropped ${fragment}`);
  }
});

test('the paragraph states no finding, however much she told it', () => {
  // The same rule the card layout was held to. There is nothing measured and
  // nothing compared at the end of a first session, so any sentence that reads
  // as a conclusion about her would be invented.
  const p = reflectionParagraph(answers(FULL)).toLowerCase();
  for (const claim of [
    'because of',
    'caused by',
    'due to',
    'suggests',
    'indicates',
    'likely',
    'consistent with',
    'linked to',
    'related to',
    'you have ',
    'diagnos',
  ]) {
    assert.ok(!p.includes(claim), `the paragraph reads as a finding: ${claim}`);
  }
});

test('the paragraph says what is from her and that nothing is measured', () => {
  const p = reflectionParagraph(answers(FULL));
  assert.ok(/reported/i.test(p), 'the paragraph never says her answers are her own report');
  assert.ok(/measured/i.test(p), 'the paragraph never says nothing has been measured');
});

test('an answer she did not give never becomes an answer of none', () => {
  // The backend rule, on screen. A woman who was never asked about
  // medications has unknown medications, not no medications, and a paragraph
  // that says otherwise puts a clinical claim in her record that she did not
  // make.
  const p = reflectionParagraph(answers({ name: 'Jenny', intents: ['cycle'] })).toLowerCase();
  for (const absence of ['no medications', 'no conditions', 'no symptoms', 'no supplements', 'none', 'nothing else']) {
    assert.ok(!p.includes(absence), `missing data was stated as an absence: ${absence}`);
  }
});

test('the paragraph names what Ciatta cannot do yet, and that time is one of them', () => {
  const p = reflectionParagraph(answers(FULL));
  assert.ok(/more than once|a few weeks|over time/i.test(p), 'the paragraph never says a pattern needs repetition');
});

test('a woman who skipped everything is told so plainly', () => {
  const p = reflectionParagraph(answers());
  assert.ok(/nothing yet/i.test(p), 'an empty first session did not say Ciatta knows nothing yet');
  assert.ok(!/undefined|null/.test(p), 'an empty answer leaked into the prose');
});

test('the paragraph holds no dash of any kind', () => {
  // The copy rule, which matters more here than anywhere else in onboarding:
  // this is the longest templated string in the app.
  const p = reflectionParagraph(answers(FULL));
  for (const dash of ['\u2014', '\u2013', '-']) {
    assert.ok(!p.includes(dash), `the paragraph contains a dash: ${dash}`);
  }
});

test('the paragraph is one paragraph', () => {
  const p = reflectionParagraph(answers(FULL));
  assert.ok(!p.includes('\n'), 'the prose was broken into lines');
  assert.ok(!/\s\s/.test(p), 'a missing clause left a double space');
  assert.ok(p.trim() === p, 'the prose is padded');
});
