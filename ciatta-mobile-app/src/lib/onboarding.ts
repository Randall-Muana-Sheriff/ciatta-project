// The first session, as a sequence and a reflection.
//
// No React and no Supabase in this file, the same arrangement as engine.ts and
// cycleModel.ts: the decisions worth testing are which questions she is asked
// and what Ciatta says it knows, and both are pure functions of her answers.
// The screen renders what this returns.
//
// The rule the reflection turns on, and it is the project's rule rather than
// this file's: nothing here may state something she did not say. At the end of
// onboarding there is no measured data at all, so every line the reflection
// produces is either her own report or an honest statement of absence. There
// is no third category yet, and a first session that implied otherwise would
// be the most damaging place in the whole app to do it.

export type Intent =
  | 'noticing_change'
  | 'managing_condition'
  | 'life_stage'
  | 'cycle'
  | 'symptoms'
  | 'appointment';

export const INTENTS: { id: Intent; label: string }[] = [
  { id: 'noticing_change', label: 'Something has changed' },
  { id: 'cycle', label: 'My cycle' },
  { id: 'symptoms', label: 'Symptoms I want to understand' },
  { id: 'life_stage', label: 'A life stage I am in' },
  { id: 'managing_condition', label: 'A condition I am managing' },
  { id: 'appointment', label: 'Preparing for an appointment' },
];

export type AgeRange = 'under_25' | '25_34' | '35_44' | '45_54' | '55_plus' | 'prefer_not';

export const AGE_RANGES: { id: AgeRange; label: string }[] = [
  { id: 'under_25', label: 'Under 25' },
  { id: '25_34', label: '25 to 34' },
  { id: '35_44', label: '35 to 44' },
  { id: '45_54', label: '45 to 54' },
  { id: '55_plus', label: '55 or older' },
  { id: 'prefer_not', label: 'Rather not say' },
];

export type LifeStage =
  | 'cycling'
  | 'cycle_irregular'
  | 'perimenopause'
  | 'menopause'
  | 'postpartum'
  | 'pregnant'
  | 'contraception'
  | 'unsure';

export const LIFE_STAGES: { id: LifeStage; label: string }[] = [
  { id: 'cycling', label: 'Cycling regularly' },
  { id: 'cycle_irregular', label: 'Cycles are irregular' },
  { id: 'perimenopause', label: 'Perimenopause' },
  { id: 'menopause', label: 'Menopause' },
  { id: 'postpartum', label: 'Postpartum' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'contraception', label: 'On contraception' },
  { id: 'unsure', label: 'Not sure' },
];

// Six screens in three phases, down from ten.
//
// The order reverses what the first build did, and the reversal is the point.
// It opened on the empty text box, reasoning that a questionnaire first
// teaches her Ciatta wants data entry. That was the wrong read of the same
// instinct: an empty box with no frame is the harder question, not the softer
// one. Tapping intent first costs one gesture and gives her something to
// write against, so by the time the box appears she knows what it is for.
//
// What was five separate question screens is now one scrolling snapshot.
// Conditions, medications and cycle are the same kind of answer, and making
// her tap Continue between them was pacing, not progress.
export type StepId =
  | 'welcome'
  | 'name'
  | 'intent'
  | 'tell'
  | 'snapshot'
  | 'connect'
  | 'reflect';

export type Answers = {
  // What she wants Ciatta to call her.
  //
  // Asked rather than taken from the account, and the distinction matters.
  // The email is how she proves who she is; the name attached to it was set
  // by whoever created the Google or Apple account, which is often a legal
  // name she does not use and never chose for this. Personalisation runs on
  // this field alone, so an account whose name is wrong is still greeted
  // right.
  name: string;
  // Her own words, kept verbatim. This is the one answer that is never turned
  // into a checkbox: it goes to raw_inputs as she said it.
  opening: string;
  openingMode: 'typed' | 'spoken' | null;
  intents: Intent[];
  ageRange: AgeRange | null;
  lifeStage: LifeStage | null;
  // Only asked when a cycle is relevant to her. See stepsFor.
  cycleLength: number | null;
  cycleRegular: boolean | null;
  lastPeriodOn: string | null;
  conditions: string[];
  surgeries: string[];
  medications: string[];
  supplements: string[];
  symptoms: string[];
  goals: string[];
  // Steps she passed over. Kept apart from steps never shown, because a
  // question she declined is not a gap Ciatta can go and fill, and the
  // reflection must not describe it as one.
  skipped: StepId[];
};

export function emptyAnswers(): Answers {
  return {
    name: '',
    opening: '',
    openingMode: null,
    intents: [],
    ageRange: null,
    lifeStage: null,
    cycleLength: null,
    cycleRegular: null,
    lastPeriodOn: null,
    conditions: [],
    surgeries: [],
    medications: [],
    supplements: [],
    symptoms: [],
    goals: [],
    skipped: [],
  };
}

// Which questions she is actually asked.
//
// The cycle step is the only conditional one, and the condition is about
// whether the answer could change an interpretation rather than about whether
// the question is polite. A woman in menopause has no cycle to describe, so
// asking her for a cycle length collects a null and spends a screen; a woman
// who came to understand her cycle gets asked even if she has not named a life
// stage yet.
// The sequence is now fixed. The cycle question did not disappear: it moved
// inside the snapshot screen, where cycleIsRelevant still decides whether the
// section renders. A question that vanishes from a scroll costs her nothing,
// where a step that vanishes from a count makes the progress indicator jump.
export function stepsFor(_a: Answers): StepId[] {
  return ['welcome', 'name', 'intent', 'tell', 'snapshot', 'connect', 'reflect'];
}

export function cycleIsRelevant(a: Answers): boolean {
  if (a.lifeStage === 'menopause' || a.lifeStage === 'pregnant') return false;
  // Everything else has a cycle worth asking about, including an unstated
  // life stage: not knowing is a reason to ask, not a reason to skip.
  return true;
}

// One line of what Ciatta can say, each tied to where it came from.
export type Known = { label: string; value: string; source: 'reported' };

// One thing Ciatta cannot say yet, and why that matters. `why` is required:
// a gap listed without a reason reads as a chore she has been set, and the
// point of naming it is to show what it would change.
export type Gap = { label: string; why: string; fillable: boolean };

export type Reflection = {
  known: Known[];
  gaps: Gap[];
  // What Ciatta is able to interpret right now. At the end of a first session
  // this is almost always empty, and saying so plainly is the honest answer.
  // It exists as a field rather than a sentence so the screen cannot render a
  // finding that was never produced.
  findings: string[];
  // The single next step, when there is one worth naming.
  nextStep: string | null;
};

const INTENT_SUMMARY: Record<Intent, string> = {
  noticing_change: 'something that has changed',
  managing_condition: 'a condition you are managing',
  life_stage: 'the life stage you are in',
  cycle: 'your cycle',
  symptoms: 'symptoms you want to understand',
  appointment: 'an appointment you are preparing for',
};

// What Ciatta knows, what it does not, and nothing in between.
//
// Every entry in `known` is something she typed or chose. There is no entry
// that combines two of her answers into a third claim, because a combination
// is an inference, and at this point there is nothing to check an inference
// against.
export function buildReflection(a: Answers): Reflection {
  const known: Known[] = [];
  const gaps: Gap[] = [];

  if (a.name.trim()) {
    known.push({ label: 'Name', value: a.name.trim(), source: 'reported' });
  }
  if (a.opening.trim()) {
    known.push({ label: 'In your words', value: a.opening.trim(), source: 'reported' });
  }
  if (a.intents.length) {
    known.push({
      label: 'What brought you here',
      value: a.intents.map((i) => INTENT_SUMMARY[i]).join(', '),
      source: 'reported',
    });
  }
  if (a.ageRange && a.ageRange !== 'prefer_not') {
    const label = AGE_RANGES.find((r) => r.id === a.ageRange)?.label ?? '';
    if (label) known.push({ label: 'Age range', value: label, source: 'reported' });
  }
  if (a.lifeStage) {
    const label = LIFE_STAGES.find((s) => s.id === a.lifeStage)?.label ?? '';
    if (label) known.push({ label: 'Life stage', value: label, source: 'reported' });
  }
  if (a.cycleLength != null) {
    known.push({ label: 'Typical cycle', value: `${a.cycleLength} days`, source: 'reported' });
  }
  if (a.conditions.length) {
    known.push({ label: 'Conditions', value: a.conditions.join(', '), source: 'reported' });
  }
  if (a.surgeries.length) {
    known.push({ label: 'Surgeries', value: a.surgeries.join(', '), source: 'reported' });
  }
  if (a.medications.length) {
    known.push({ label: 'Medications', value: a.medications.join(', '), source: 'reported' });
  }
  if (a.supplements.length) {
    known.push({ label: 'Supplements', value: a.supplements.join(', '), source: 'reported' });
  }
  if (a.symptoms.length) {
    known.push({ label: 'Symptoms', value: a.symptoms.join(', '), source: 'reported' });
  }
  if (a.goals.length) {
    known.push({ label: 'What you want', value: a.goals.join(', '), source: 'reported' });
  }

  // The gaps. Each one names what it would let Ciatta do, and `fillable` says
  // whether Ciatta can close it by asking again or whether only time can.
  if (!a.symptoms.length && !a.skipped.includes('snapshot')) {
    gaps.push({
      label: 'What you have been feeling',
      why: 'A symptom logged with a date is the thing a change in sleep or cycle can be lined up against.',
      fillable: true,
    });
  }
  if (cycleIsRelevant(a) && a.cycleLength == null) {
    gaps.push({
      label: 'Your cycle timing',
      why: 'Without a typical length there is nothing to call a short cycle short.',
      fillable: true,
    });
  }

  // The one gap that is never fillable by asking. Said plainly because it is
  // the truthful answer to "why can you not tell me anything yet".
  gaps.push({
    label: 'Time',
    why: 'Everything above is what you told Ciatta today. A pattern needs the same thing happening more than once, so the first comparisons arrive after a few weeks of logging.',
    fillable: false,
  });

  return {
    known,
    gaps,
    // Empty, and not by accident. Nothing has been measured, nothing has been
    // compared, and there is no observation in her record to interpret. A
    // finding here would be invented.
    findings: [],
    nextStep: nextStepFor(a),
  };
}

function nextStepFor(a: Answers): string | null {
  if (a.intents.includes('appointment')) return 'Add what you want to raise, so it is ready when you go.';
  if (a.symptoms.length) return 'Log the next time one of these shows up, and Ciatta starts building the picture.';
  if (cycleIsRelevant(a)) return 'Log your next period, and Ciatta can start tracking the timing.';
  return 'Log anything you notice, and Ciatta starts from there.';
}

// True when she has given enough for the reflection to be worth showing. One
// answer is enough: the screen is honest about how little it has, and a woman
// who skipped everything still deserves to see that stated rather than be sent
// to a blank Today with no explanation.
export function hasAnything(a: Answers): boolean {
  return (
    a.name.trim().length > 0 ||
    a.opening.trim().length > 0 ||
    a.intents.length > 0 ||
    a.ageRange !== null ||
    a.lifeStage !== null ||
    a.cycleLength !== null ||
    a.conditions.length > 0 ||
    a.surgeries.length > 0 ||
    a.medications.length > 0 ||
    a.supplements.length > 0 ||
    a.symptoms.length > 0 ||
    a.goals.length > 0
  );
}

export type ConsentKind = 'terms' | 'privacy' | 'marketing_email';

export type Consent = { kind: ConsentKind; granted: boolean; policyVersion: string };

// Bump this when the wording at ciatta.io/terms or ciatta.io/privacy changes.
// A consent to the old text is not a consent to the new one, and the stored
// version is what lets anyone tell which she actually saw.
export const POLICY_VERSION = '2026-10-09';

// Three records from one tap, because they have three different lifetimes.
// Terms and privacy are conditions of having an account at all. Marketing is
// hers to withdraw tomorrow without losing the account, and a record that
// cannot express that cannot honour it.
//
// Takes the marketing answer rather than Answers, because consent is given on
// the sign up screen and no onboarding Answers exist yet at that point. That
// ordering is the whole reason this is recorded at sign up: a woman who signs
// up and closes the app mid onboarding would otherwise hold an account with
// no consent on file, which is the one state this table exists to prevent.
export function consentsFor(marketingEmail: boolean): Consent[] {
  return [
    { kind: 'terms', granted: true, policyVersion: POLICY_VERSION },
    { kind: 'privacy', granted: true, policyVersion: POLICY_VERSION },
    // Stored either way. A decline is something she did, and the record must
    // tell "asked and said no" apart from "never asked".
    { kind: 'marketing_email', granted: marketingEmail, policyVersion: POLICY_VERSION },
  ];
}

// Which step a correction should open.
//
// The labels are the ones buildReflection puts on each known line, so tapping
// a line on the reflect screen opens the question that produced it. A
// correction is supposed to change one answer; returning her to question one
// after she answered nine is the restart the promise rules out.
const CORRECTION_STEPS: Record<string, StepId> = {
  Name: 'name',
  'In your words': 'tell',
  'What brought you here': 'intent',
  // Everything below lives on the one snapshot screen now.
  'Age range': 'snapshot',
  'Life stage': 'snapshot',
  'Typical cycle': 'snapshot',
  Conditions: 'snapshot',
  Surgeries: 'snapshot',
  Medications: 'snapshot',
  Supplements: 'snapshot',
  Symptoms: 'snapshot',
  'What you want': 'snapshot',
};

export function correctionTarget(a: Answers, label: string): StepId {
  const steps = stepsFor(a);
  const wanted = CORRECTION_STEPS[label];
  // A step she was never shown is not somewhere to send her: choosing
  // menopause removes the cycle question, and a stale label must not put it
  // back. Falling through to the last question she did see keeps her near
  // where she was rather than at the beginning.
  if (wanted && steps.includes(wanted)) return wanted;
  // Falls back to the first question, not the last step.
  //
  // "The last step she saw" was wrong and review caught it by running it: the
  // last step is 'connect', which is the Apple Health offer, holds no answer
  // and is not a question. The reachable case is real rather than theoretical.
  // She answers a cycle length, reaches reflect, changes her life stage to
  // menopause, and the cycle line is still on screen because cycleLength was
  // never cleared. Tapping it then opened a permission prompt.
  return 'tell';
}
