// What the Care agent is, in types.
//
// The shape here is the safety argument, so it is worth stating before any
// of it is implemented. summary.ts already made the argument for a single
// paragraph: "the record decides what is true, and the model only decides
// how it is said." A conversation breaks that the moment "the facts" stop
// being a fixed set, because then there is nothing to check an answer
// against.
//
// So the agent is not a model with a system prompt. It is a fixed set of
// capabilities, each of which is ordinary code that gathers a Facts object
// from her rows and writes a sentence from it. The model never decides what
// is true and never decides what to do; given a Facts object it may only
// rewrite the sentence, and its rewrite is checked against that same object
// before anyone sees it. A rewrite that fails is thrown away and the
// sentence the code wrote is used.
//
// Three consequences worth being explicit about:
//
//   The agent works with no backend. The deterministic sentence is produced
//   first, every time, and the model only ever competes with it.
//
//   The agent will decline. A question outside the capability set gets an
//   honest answer about what it cannot do, which is better than an answer
//   it cannot support.
//
//   Nothing here acts on the world. Care navigation prepares; she sends.

export type CapabilityId =
  // What is actually in her record.
  | 'record'
  // Patterns the gate has already earned. Never a new one found here.
  | 'pattern'
  // The visit brief.
  | 'prepare'
  // What to raise with a clinician.
  | 'ask'
  // Which clinician, what to verify with insurance, and a drafted request.
  | 'navigate'
  // Her own reported severity against explicit red flags.
  | 'escalate'
  // General medical context, cited, from reviewed rows only.
  | 'context'
  // None of the above.
  | 'decline';

// One thing the answer is built from, and the reason the answer can be
// checked at all. Every number the agent is allowed to say comes from the
// value of one of these.
export type Fact = {
  label: string;
  value: string;
  // Where it came from, which the interface shows and never blurs.
  //   measured  an instrument recorded it
  //   reported  she said it
  //   derived   computed from her rows, and said as a computation
  //   reference a reviewed row in research_refs, never about her
  from: 'measured' | 'reported' | 'derived' | 'reference';
  // The day it belongs to, where it has one.
  on?: string;
  // research_refs.id, required on a reference fact and meaningless on any
  // other. A cited claim whose id does not resolve is refused.
  refId?: string;
};

// What the user may do next, offered by the capability that answered. These
// are app actions, never outward ones: every one of them opens a screen.
export type Suggestion = { label: string; screen?: string; tab?: string };

export type Answer = {
  capability: CapabilityId;
  // The sentence the code wrote. Always present, never empty, and used
  // whenever the model's rewrite is missing or refused.
  text: string;
  // Exactly what the answer is built from. The model sees only this, and
  // its rewrite is checked against only this.
  facts: Fact[];
  suggestions: Suggestion[];
  // Set when the capability deliberately did not answer: no data yet, a
  // citation store with nothing reviewed in it, a question out of scope.
  // The interface says so rather than dressing it as an answer.
  abstained?: 'no_data' | 'out_of_scope' | 'no_citations';
};

export type Turn = {
  id: string;
  role: 'her' | 'ciatta';
  text: string;
  at: string;
  // Present on an answer turn. Absent on hers.
  answer?: Answer;
  // True when the model's rewrite passed the check and was used, so the
  // interface can be honest about which sentence she is reading.
  worded?: boolean;
};
