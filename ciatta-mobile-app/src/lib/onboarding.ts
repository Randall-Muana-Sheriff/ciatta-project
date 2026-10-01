// The first steps after sign in, as a rule the screen follows and a test
// can read: which steps there are, in what order, which of them a platform
// can offer, and whether a profile is owed the run at all. No React, no
// Supabase: the screen renders what this says.

export type OnboardingStep = 'welcome' | 'source' | 'cycle' | 'name' | 'expect';

// In this order, and every one of them can be skipped. The source step
// comes before the questions on purpose: a connected source is the one
// thing that gives her record something to work with from day one, and
// the rest can wait.
export const STEPS: readonly OnboardingStep[] = ['welcome', 'source', 'cycle', 'name', 'expect'];

export type StepPlan = { step: OnboardingStep; available: boolean };

// Every step is shown on every platform, so the run reads the same
// everywhere; only the source step has something to DO on iOS. On Android
// it says, honestly, that device data comes later, and offers no button.
export function stepsFor(platform: string): StepPlan[] {
  return STEPS.map((step) => ({ step, available: step !== 'source' || platform === 'ios' }));
}

// Owed only to her own record, and only while nothing says she has been
// through it. `undefined` is a read that failed, for instance a project
// that does not have the column yet: her record is never held behind a
// column, so that is "nothing to show", not "show it".
export function needsOnboarding(mode: string, onboardedAt: string | null | undefined): boolean {
  return mode === 'real' && onboardedAt === null;
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = STEPS.indexOf(step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

export const isLast = (step: OnboardingStep) => nextStep(step) === null;
