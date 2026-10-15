// Ciatta's check in: one short question, asked only when today gives a
// reason. Shared by the app (the question on Today) and the intelligence
// run (the push that says there is one). No imports, so both can load it.
//
// It says what changed against her own usual and asks how she is. It never
// forecasts: there is no "a flare is coming" here, by decision.

export type CheckInSignal = 'resting_hr' | 'hrv' | 'sleep_hours' | 'temp_deviation';
export type CheckInToday = { resting_hr: number | null; hrv: number | null; sleep_hours: number | null; temp_deviation: number | null };
export type CheckInBaseline = { metric: string; low: number | null; high: number | null; sufficient: boolean };
export type CheckIn = {
  key: string;
  signal: CheckInSignal;
  line: string;
  question: string;
  answers: [string, string, string];
  // The log word a positive answer files, and how it is said in the note.
  item: string;
  topic: string;
};

const PELVIC = /endometriosis|adenomyosis|pelvic pain|heavy period/i;
const TEMP_UP = 0.5;

function usual(rows: readonly CheckInBaseline[], metric: string) {
  const r = rows.find((b) => b.metric === metric && b.sufficient);
  return r && r.low != null && r.high != null ? r : null;
}

function firstSignal(today: CheckInToday, rows: readonly CheckInBaseline[]): [CheckInSignal, string] | null {
  const rhr = usual(rows, 'resting_hr');
  if (rhr && today.resting_hr != null && today.resting_hr > rhr.high!) return ['resting_hr', 'Your resting heart rate is higher than usual today.'];
  const hrv = usual(rows, 'hrv');
  if (hrv && today.hrv != null && today.hrv < hrv.low!) return ['hrv', 'Your HRV is lower than usual today.'];
  const sleep = usual(rows, 'sleep_hours');
  if (sleep && today.sleep_hours != null && today.sleep_hours < sleep.low!) return ['sleep_hours', 'You slept less than usual last night.'];
  if (today.temp_deviation != null && today.temp_deviation >= TEMP_UP) return ['temp_deviation', 'Your skin temperature is up from your usual.'];
  return null;
}

export function checkIn(input: {
  today: CheckInToday;
  baselines: readonly CheckInBaseline[];
  conditions: readonly string[];
  answered: readonly string[];
  day: string;
}): CheckIn | null {
  const found = firstSignal(input.today, input.baselines);
  if (!found) return null;
  const [signal, line] = found;
  const key = `${signal}:${input.day}`;
  if (input.answered.includes(key)) return null;
  const pelvic = input.conditions.some((c) => PELVIC.test(c));
  return pelvic
    ? { key, signal, line, question: 'How is your pelvic pain?', answers: ['None', 'Mild', 'Strong'], item: 'Pelvic pain', topic: 'pelvic pain' }
    : { key, signal, line, question: 'How is your energy?', answers: ['Fine', 'Tired', 'Exhausted'], item: 'Fatigue', topic: 'energy' };
}

// What an answer files: the symptom word and a short note, or a note alone
// when the answer was that it is fine. A note of none is still kept: she
// said so, which is not the same as not saying.
export function answerSave(c: CheckIn, answer: string): { text: string; tapped: string[] } {
  const none = answer === c.answers[0];
  if (c.topic === 'energy') return { text: `Check in: energy, ${answer.toLowerCase()}.`, tapped: none ? [] : [c.item] };
  return none ? { text: `Check in: no ${c.topic}.`, tapped: [] } : { text: `Check in: ${c.topic}, ${answer.toLowerCase()}.`, tapped: [c.item] };
}

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

// The lock screen says only that there is a question. Never the reading,
// never the symptom: anyone holding her phone can read it.
export function checkInPush(tokens: readonly string[], opts: { allowed: boolean; lastSent: string | null; today: string }) {
  if (!opts.allowed || opts.lastSent === opts.today) return [];
  return tokens
    .filter((t) => EXPO_TOKEN.test(t))
    .map((to) => ({ to, title: 'Ciatta', body: 'Ciatta has a quick question for you.', data: { screen: 'today' }, sound: 'default' as const }));
}

// A message worth offering to add to her timeline: something said, not a
// question asked. Escalation is checked by the app's classifier as well.
export function isLoggable(message: string): boolean {
  const m = message.trim();
  return m.length > 0 && !m.endsWith('?');
}
