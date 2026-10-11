// What the agent can do for her right now, and what it cannot do yet.
//
// A chat box says "ask me anything", which is a promise no health
// intelligence can keep and this one does not try to. It also hides the
// two things that make this not a chatbot: a fixed set of capabilities,
// and a record that either supports one or does not.
//
// So the capabilities are the interface, and each one reports whether it
// would answer. Readiness is not a second judgement maintained alongside
// the capabilities: a capability is ready exactly when it would not
// abstain, which is found by running it. They are pure and cheap, so the
// screen runs all of them on every render and cannot drift from what
// actually happens when she taps.
//
// Escalation is deliberately not in this list. It is not a feature to
// browse, and a row reading "Urgent care, ready" would be grotesque. It
// runs on what she writes, and the standing text says so.

import { respond, type Record } from './capabilities';
import type { CapabilityId } from './types';

export type CapabilityCard = {
  id: CapabilityId;
  title: string;
  // What it does, in her terms rather than the system's.
  what: string;
  // The message tapping it sends, so the conversation reads the same
  // whether she tapped or typed.
  ask: string;
  ready: boolean;
  // Why not, when not. Specific: "no reviewed sources yet" and "not enough
  // days yet" are different problems with different fixes, and a single
  // "unavailable" would hide which one she has.
  blocked?: string;
};

const CARDS: { id: CapabilityId; title: string; what: string; ask: string }[] = [
  {
    id: 'record',
    title: 'Your record today',
    what: 'What has actually arrived, and what has not',
    ask: 'What is in my record today?',
  },
  {
    id: 'pattern',
    title: 'What has been established',
    what: 'Only what has happened more than once',
    ask: 'Has anything changed?',
  },
  {
    id: 'ask',
    title: 'Questions for your clinician',
    what: 'Built from what you logged, so you can point at it',
    ask: 'What should I ask my doctor?',
  },
  {
    id: 'navigate',
    title: 'Who to see, and what to check',
    what: 'The clinician, the insurance questions, the request',
    ask: 'Who should I see about this?',
  },
  {
    id: 'prepare',
    title: 'Prepare for a visit',
    what: 'Your record as a brief you can hand over',
    ask: 'Help me prepare for my appointment',
  },
  {
    id: 'context',
    title: 'What the research says',
    what: 'General, cited, and never about you',
    ask: 'What does the research say?',
  },
];

// Why a capability is not ready, said as the thing she would change.
const BLOCKED: { no_data: string; no_citations: string; out_of_scope: string } = {
  no_data: 'Not enough in your record yet',
  no_citations: 'No reviewed sources yet',
  out_of_scope: 'Not available',
};

export function capabilityCards(record: Record): CapabilityCard[] {
  return CARDS.map((c) => {
    // Run it. Readiness that is computed separately from the answer is
    // readiness that can lie, and this cannot: it is the same call the
    // tap makes.
    const answer = respond(c.ask, record, c.id);
    return {
      ...c,
      ready: !answer.abstained,
      blocked: answer.abstained ? BLOCKED[answer.abstained] : undefined,
    };
  });
}

// The standing line above the list. It counts rather than reassures: six of
// six reads differently from two of six, and she should see which she has
// before she asks anything.
export function readinessLine(cards: readonly CapabilityCard[]): string {
  const ready = cards.filter((c) => c.ready).length;
  if (ready === 0) return 'None of these can be answered from your record yet.';
  if (ready === cards.length) return `All ${cards.length} can be answered from your record.`;
  return `${ready} of ${cards.length} can be answered from your record right now.`;
}
