// Which capability a message is asking for.
//
// Deterministic on purpose. A model deciding which capability runs would
// put the model back in charge of what happens, and the whole arrangement
// depends on it not being. It also means classification is testable, which
// a prompt is not.
//
// The cost is that this is keyword matching and keyword matching is blunt.
// That cost is paid in the right direction: an unmatched message goes to
// decline, which says what the agent can do, rather than to a capability
// that then answers the wrong question confidently.
//
// Order matters. Escalation is checked first and on its own, because a
// message about severe pain must never be routed to a capability that
// answers it with a step count.

import type { CapabilityId } from './types';

// Words that mean "this may need care now". Deliberately short: a long list
// catches ordinary sentences and turns every conversation into a warning.
// Everything here is either an explicit emergency word or a phrase a woman
// uses when something has changed sharply.
const RED_FLAGS = [
  'emergency',
  'ambulance',
  'fainted',
  'faint',
  'passed out',
  'cannot stand',
  "can't stand",
  'worst pain',
  'unbearable',
  'heavy bleeding',
  'soaking',
  'chest pain',
  'trouble breathing',
  'suicidal',
];

const MATCHERS: { id: CapabilityId; any: string[] }[] = [
  // Before prepare and navigate, which also name specialists.
  { id: 'referral', any: ['referral', 'referred', 'refer me'] },
  {
    id: 'prepare',
    any: ['appointment', 'see my doctor', 'brief', 'summary for', 'gynae', 'gynecologist', 'specialist visit'],
  },
  {
    id: 'ask',
    any: ['what should i ask', 'questions', 'what do i say', 'bring up', 'raise with', 'tests should i'],
  },
  {
    id: 'navigate',
    any: ['book', 'booking', 'find a doctor', 'find a clinician', 'insurance', 'covered', 'coverage', 'who should i see'],
  },
  {
    id: 'pattern',
    any: ['pattern', 'changed', 'changing', 'trend', 'connection', 'related', 'noticed anything', 'what have you found'],
  },
  { id: 'labs', any: ['lab', 'labs', 'blood work', 'bloodwork', 'blood test', 'test result'] },
  { id: 'clinical', any: ['results from', 'my doctor sent', 'my chart', 'provider sent'] },
  {
    id: 'record',
    any: [
      'how did i', 'how many', 'how much', 'how long', 'when was', 'when did', 'last period', 'my sleep',
      'my steps', 'my hrv', 'heart rate', 'show me', 'what did i', 'my cycle', 'my data', 'my record',
      'in my record', 'what is in my', 'my gut', 'bowel', 'stool', 'digestion', 'blood pressure', 'oxygen', 'spo2',
    ],
  },
  // Last, and narrowly. An earlier version matched a bare "what is ",
  // which swallowed "What is in my record today" and answered a question
  // about her own data with general literature. Everything here now names
  // the literature explicitly, and anything about her record is matched
  // above this point.
  {
    id: 'context',
    any: ['the research say', 'research on', 'evidence on', 'studies', 'study on', 'literature', 'generally known', 'in general'],
  },
];

export function classify(message: string): CapabilityId {
  const text = message.toLowerCase().trim();
  if (!text) return 'decline';

  // First and alone. A message that mentions a red flag is routed to
  // escalate whatever else it also mentions, because the cost of missing
  // one is not the same as the cost of a false positive.
  if (RED_FLAGS.some((w) => text.includes(w))) return 'escalate';

  for (const m of MATCHERS) {
    if (m.any.some((w) => text.includes(w))) return m.id;
  }
  return 'decline';
}

// Exposed so the escalate capability can name which phrase it matched,
// rather than telling her something was flagged without saying what.
//
// Only the longest match of an overlapping pair is returned. "fainted"
// contains "faint", and showing her both would say two things were noticed
// in a message where one word was.
export function redFlagsIn(message: string): string[] {
  const text = message.toLowerCase();
  const hits = RED_FLAGS.filter((w) => text.includes(w));
  return hits.filter((w) => !hits.some((other) => other !== w && other.includes(w)));
}

// A lab test she has on record, named in what she wrote, so "is my
// ferritin ok?" reaches her labs without the word lab in it.
export function mentionsLab(message: string, names: readonly string[]): string | null {
  const text = message.toLowerCase();
  for (const n of names) {
    const k = n.trim().toLowerCase();
    if (k && new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) return n;
  }
  return null;
}
