// Referral tracking: the steps from being referred to being seen, what to
// do at each, and when a referral has stalled. Ciatta prepares each step
// (what to ask the insurer, what to say when she calls); it never contacts
// anyone. Stored in public.referrals (20261014130000_referrals.sql).

export type StepKey = 'referred' | 'insurance' | 'requested' | 'scheduled' | 'seen';

export const REFERRAL_STEPS: { key: StepKey; label: string }[] = [
  { key: 'referred', label: 'Referred' },
  { key: 'insurance', label: 'Insurance checked' },
  { key: 'requested', label: 'Appointment requested' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'seen', label: 'Seen' },
];

export type Referral = {
  id: string;
  specialty: string;
  clinician: string | null;
  reason: string | null;
  referredBy: string | null;
  referredOn: string | null;
  // The day each step was marked, by step.
  steps: Partial<Record<StepKey, string>>;
  scheduledFor: string | null;
  notes: string | null;
};

export const currentStep = (r: Referral) => REFERRAL_STEPS.find((s) => !r.steps[s.key]) ?? null;

// What she can do next, written for her to do. Nothing here is sent.
export function nextAction(r: Referral, hasInsurance: boolean): { step: StepKey; text: string } | null {
  const step = currentStep(r);
  if (!step) return null;
  const who = r.specialty;
  const why = r.reason ? ` for ${r.reason}` : '';
  switch (step.key) {
    case 'referred':
      return { step: step.key, text: `Mark the day you were referred to ${who}, so Ciatta can keep track of how long each step takes.` };
    case 'insurance':
      return hasInsurance
        ? {
            step: step.key,
            text: `Call the number on your insurance card and ask: is a visit to ${who}${why} covered, do I need prior authorization or a referral on file, and which in network ${who} clinicians are near me?`,
          }
        : { step: step.key, text: `Add your insurance on your Profile, then check whether a visit to ${who} is covered and needs prior authorization.` };
    case 'requested':
      return {
        step: step.key,
        text: `When you call ${r.clinician ?? `a ${who} clinic`}, say you have a referral${r.referredBy ? ` from ${r.referredBy}` : ''}${why}, and ask for the first appointment they have.`,
      };
    case 'scheduled':
      return { step: step.key, text: 'When they give you a date, mark it here. Ciatta will help you prepare for the visit.' };
    case 'seen':
      return { step: step.key, text: `After the visit, mark it seen and note what ${who} said, so it is in your record.` };
  }
}

const DAY = 86400000;
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

// Days since the last step was marked, when that is 14 or more and the
// referral is not finished; null otherwise. A booked visit she is waiting
// for is not stalled.
export function stalled(r: Referral, now: Date): number | null {
  const step = currentStep(r);
  if (!step) return null;
  if (step.key === 'seen' && r.scheduledFor && parse(r.scheduledFor) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) return null;
  const marked = Object.values(r.steps).filter((v): v is string => !!v).map(parse);
  if (!marked.length) return null;
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - Math.max(...marked)) / DAY);
  return days >= 14 ? days : null;
}

const SPECIALTIES: [RegExp, string][] = [
  [/\bpelvic floor\b/i, 'Pelvic floor physiotherapy'],
  [/\bgyn(a)?ecolog\w*|\bob\s*\/?\s*gyn\b|\bgyno\b/i, 'Gynecology'],
  [/\bendocrinolog\w*/i, 'Endocrinology'],
  [/\bcardiolog\w*/i, 'Cardiology'],
  [/\bdermatolog\w*/i, 'Dermatology'],
  [/\bgastroenterolog\w*|\bgi\b specialist/i, 'Gastroenterology'],
  [/\brheumatolog\w*/i, 'Rheumatology'],
  [/\burolog\w*|\burogyn\w*/i, 'Urology'],
  [/\bneurolog\w*/i, 'Neurology'],
  [/\bfertility\b|\breproductive endocrinolog\w*/i, 'Fertility'],
  [/\bpsychiatr\w*|\bpsycholog\w*|\btherapist\b/i, 'Mental health'],
  [/\bphysio\w*|\bphysical therap\w*/i, 'Physiotherapy'],
  [/\bhematolog\w*|\bhaematolog\w*/i, 'Hematology'],
  [/\bsleep (clinic|specialist|study)\b/i, 'Sleep medicine'],
];

// A referral named in what she wrote, as a draft for her to confirm.
export function referralFromMessage(text: string): { specialty: string } | null {
  if (!/\brefer(red|ral)\b/i.test(text)) return null;
  for (const [cue, specialty] of SPECIALTIES) if (cue.test(text)) return { specialty };
  return null;
}
