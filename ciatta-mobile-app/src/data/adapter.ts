import { type Day, loadDays } from './daily';
import * as sample from './sample';

// What each screen reads, per mode. Demo is the sample person; real is only
// what her record holds, and a piece her record can't supply yet is null.
export type TodayCopy = typeof sample.today;

export type Data = {
  mode: 'demo' | 'real';
  days: Day[];
  person: { firstName: string } | null;
  today: TodayCopy;
  records: typeof sample.records | null;
  sleep: typeof sample.sleep | null;
  symptoms: typeof sample.symptoms | null;
  medications: typeof sample.medications | null;
  journey: typeof sample.journey | null;
  insight: typeof sample.insight | null;
  profile: typeof sample.profile | null;
};

// Structure, not claims about anyone: the Journey month axis and the list of
// body systems. Both modes draw on them, so they sit outside Data.
export const journeyAxis = {
  months: sample.journey.months,
  yearOf: sample.journey.yearOf,
  monthDate: sample.journey.monthDate,
  now: sample.journey.now,
};
export const bodySystems = sample.profile.bodySystems;

// Every field of sample.today is a claim about the sample person, so all of
// them are replaced.
const REAL_TODAY_TEXT = {
  headline: 'Nothing to compare yet.',
  kicker: 'Your record starts with what you log',
  brief: 'As your cycles, notes and sources build up, what changes will show here with the evidence behind it.',
};

export function dataFor(mode: 'demo' | 'real', firstName: string | null): Data {
  if (mode === 'demo') {
    return {
      mode,
      days: loadDays(),
      person: { firstName: sample.person.firstName },
      today: sample.today,
      records: sample.records,
      sleep: sample.sleep,
      symptoms: sample.symptoms,
      medications: sample.medications,
      journey: sample.journey,
      insight: sample.insight,
      profile: sample.profile,
    };
  }
  return {
    mode,
    days: [],
    person: firstName ? { firstName } : null,
    today: { ...sample.today, ...REAL_TODAY_TEXT },
    records: null,
    sleep: null,
    symptoms: null,
    medications: null,
    journey: null,
    insight: null,
    profile: null,
  };
}
