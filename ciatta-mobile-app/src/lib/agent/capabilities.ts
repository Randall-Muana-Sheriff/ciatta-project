// The seven things the Care agent can do, as ordinary functions.
//
// Each takes her record and returns an Answer: the facts it is built from
// and the sentence those facts support. No model runs in this file, and
// nothing here reaches the network. That is what makes the tab work on a
// plane and what makes every sentence testable.
//
// The rules every capability holds, which are the app's rules and not new
// ones:
//
//   Missing is unknown. A figure that is not in her record is absent, and
//   the sentence says so. It is never a zero and never a "none".
//
//   Measured and reported never blur. An instrument reading and a sentence
//   she typed are different kinds of fact and are labelled as such.
//
//   Nothing is diagnosed, prescribed, or caused. Not by omission but by
//   construction: no capability here has a branch that could produce one.
//
//   An abstention is an answer. "There is not enough yet" is true and
//   useful; an answer improvised to avoid saying it is neither.

import type { Day } from '../../data/daily';
import type { Episode } from '../../data/cycleLog';
import { buildMetrics, recordedCount } from '../allMetrics';
import { fmtHours } from '../engine';
import type { Answer, Fact, Suggestion } from './types';
import { redFlagsIn } from './classify';

// Everything a capability is allowed to read. Assembled by the screen from
// state it already holds, so a capability cannot reach past it.
export type Record = {
  name: string | null;
  today: Day | null;
  days: readonly Day[];
  episodes: readonly Episode[];
  conditions: readonly string[];
  medications: readonly string[];
  // Insights the gate has already earned. The agent never finds a new one:
  // finding is gate.ts's job and it has rules this file must not reinvent.
  insights: readonly { title: string; whatChanged: string; notEstablished: string[] }[];
  // Reviewed rows from research_refs. Empty until the store is populated,
  // and the context capability abstains rather than improvising when it is.
  references: readonly { id: string; title: string; publication: string | null; year: number | null; summary: string }[];
  cycleDay: number | null;
  cyclePhase: string | null;
};

const PREPARE: Suggestion = { label: 'Prepare for an appointment', screen: 'appointment' };
const METRICS: Suggestion = { label: "Today's metrics", screen: 'metrics' };
const LOG: Suggestion = { label: 'Log cycle experience', screen: 'cycleLog' };

// ── Record ───────────────────────────────────────────────────────────

export function answerRecord(r: Record): Answer {
  const facts: Fact[] = [];
  const d = r.today;

  if (d?.sleepHours != null) facts.push({ label: 'Sleep', value: fmtHours(d.sleepHours), from: 'measured', on: d.date });
  if (d?.hrv != null) facts.push({ label: 'Heart rate variability', value: `${Math.round(d.hrv)} ms`, from: 'measured', on: d.date });
  if (d?.steps != null) facts.push({ label: 'Steps', value: Math.round(d.steps).toLocaleString('en-US'), from: 'measured', on: d.date });
  if (r.cycleDay != null) {
    facts.push({ label: 'Cycle day', value: `${r.cycleDay}`, from: 'reported' });
    if (r.cyclePhase) facts.push({ label: 'Phase', value: r.cyclePhase, from: 'reported' });
  }

  const counts = recordedCount(buildMetrics(d));
  facts.push({ label: 'Recorded today', value: `${counts.recorded} of ${counts.total}`, from: 'derived' });

  if (facts.length === 1) {
    return {
      capability: 'record',
      text: 'Nothing has arrived for today yet. As soon as your devices record something, or you log it, it will be here.',
      facts,
      suggestions: [METRICS, LOG],
      abstained: 'no_data',
    };
  }

  const said = facts
    .filter((f) => f.from !== 'derived')
    .map((f) => `${f.label.toLowerCase()} ${f.value}`)
    .join(', ');
  return {
    capability: 'record',
    text: `${name(r)}today your record holds ${said}. That is ${counts.recorded} of ${counts.total} figures recorded.`,
    facts,
    suggestions: [METRICS],
  };
}

// ── Pattern ──────────────────────────────────────────────────────────

export function answerPattern(r: Record): Answer {
  if (!r.insights.length) {
    return {
      capability: 'pattern',
      // The honest version of "no patterns". A pattern needs the same thing
      // happening more than once, so the absence of one is a statement
      // about how much time has passed, not about her health.
      text: 'Nothing has been established yet. A pattern needs the same thing happening more than once, so the first comparisons arrive once there are more days to compare.',
      facts: [{ label: 'Established patterns', value: '0', from: 'derived' }],
      suggestions: [LOG],
      abstained: 'no_data',
    };
  }

  const facts: Fact[] = r.insights.map((i) => ({ label: i.title, value: i.whatChanged, from: 'derived' }));
  const first = r.insights[0];
  // What was not established is carried with it, always. An insight quoted
  // without its limits is the insight becoming a claim.
  const limits = first.notEstablished.length ? ` What this does not show: ${first.notEstablished[0]}` : '';
  return {
    capability: 'pattern',
    text: `${name(r)}${r.insights.length === 1 ? 'one thing has' : `${r.insights.length} things have`} been established so far. ${first.whatChanged}${limits}`,
    facts,
    suggestions: [{ label: 'See the evidence', screen: 'evidence' }],
  };
}

// ── Prepare ──────────────────────────────────────────────────────────

export function answerPrepare(r: Record): Answer {
  const withNotes = r.days.filter((d) => d.note).length;
  const facts: Fact[] = [
    { label: 'Days of record', value: `${r.days.length}`, from: 'derived' },
    { label: 'Episodes logged', value: `${r.episodes.length}`, from: 'reported' },
    { label: 'Days with a note', value: `${withNotes}`, from: 'reported' },
  ];
  if (!r.days.length && !r.episodes.length) {
    return {
      capability: 'prepare',
      text: 'There is not enough in your record to build a brief yet. Log what you notice and it will gather here.',
      facts,
      suggestions: [LOG],
      abstained: 'no_data',
    };
  }
  return {
    capability: 'prepare',
    text: `${name(r)}a brief can be built from what is already here: ${r.days.length} days of record and ${r.episodes.length} episodes you logged. Everything in it comes from your own entries, so there is nothing to fill in.`,
    facts,
    suggestions: [PREPARE],
  };
}

// ── Ask ──────────────────────────────────────────────────────────────

// Questions to raise with a clinician, built from her own record.
//
// This is the capability that does the most good and it is also the one
// most able to do harm, so the shape is strict: every question is about
// something she recorded, phrased as a question for her to ask, and never
// as a thing that is true. "Ask whether your cycle length is worth
// investigating" is hers to raise. "Your cycle length is concerning" is a
// clinical claim and nothing here may produce one.
export function answerAsk(r: Record): Answer {
  const questions: string[] = [];
  const facts: Fact[] = [];

  if (r.conditions.length) {
    questions.push(`whether anything in the last months changes how you are managing ${r.conditions.join(' and ')}`);
    facts.push({ label: 'You told Ciatta', value: r.conditions.join(', '), from: 'reported' });
  }
  if (r.medications.length) {
    questions.push(`whether ${r.medications.join(' and ')} is still the right thing to be taking`);
    facts.push({ label: 'Medications', value: r.medications.join(', '), from: 'reported' });
  }

  const severe = r.episodes.filter((e) => (e.severity ?? 0) >= 7).length;
  if (severe > 0) {
    questions.push(`what the ${severe} ${severe === 1 ? 'episode' : 'episodes'} you rated 7 or above might warrant`);
    facts.push({ label: 'Episodes rated 7 or above', value: `${severe}`, from: 'reported' });
  }

  const flares = r.episodes.filter((e) => e.flareUpUserReported).length;
  if (flares > 0) {
    questions.push(`what you can do about the days you marked as a flare up`);
    facts.push({ label: 'Days you called a flare up', value: `${flares}`, from: 'reported' });
  }

  if (!questions.length) {
    return {
      capability: 'ask',
      text: 'There is not enough in your record yet to turn into questions. The more you log, the more specific these get.',
      facts,
      suggestions: [LOG],
      abstained: 'no_data',
    };
  }

  const list = questions.map((q) => `Ask ${q}.`).join(' ');
  return {
    capability: 'ask',
    text: `${name(r)}from what is in your record, these are worth raising. ${list} Each one comes from something you logged, so you can point at it in the room.`,
    facts,
    suggestions: [PREPARE],
  };
}

// ── Navigate ─────────────────────────────────────────────────────────

// Care navigation, which prepares and does not act.
//
// There is no booking integration and no insurance API, and a screen that
// implied otherwise would be fabricating a capability, which is the same
// failure as fabricating a reading. So this assembles what she needs and
// hands it to her. Nothing leaves the app here.
export function answerNavigate(r: Record): Answer {
  const facts: Fact[] = [];
  if (r.conditions.length) facts.push({ label: 'You are managing', value: r.conditions.join(', '), from: 'reported' });
  facts.push({ label: 'Episodes logged', value: `${r.episodes.length}`, from: 'reported' });

  // Who to see, from what she told Ciatta rather than from a guess about
  // what she has. A woman managing endometriosis asking who to see is
  // asking a question with a known answer; one who has told Ciatta nothing
  // gets the general answer and no invented specificity.
  const who = r.conditions.length
    ? `a gynaecologist, and one who works with ${r.conditions.join(' and ')} if you can find one`
    : 'your GP first, who can refer you on';

  return {
    capability: 'navigate',
    text:
      `${name(r)}for this, ${who}. Before you book, it is worth checking three things with your insurer: whether a referral is needed, ` +
      `whether that clinician is in network, and what the visit will cost you. Ciatta can put your record into a message you send yourself. ` +
      `It does not contact anyone on your behalf.`,
    facts,
    suggestions: [PREPARE],
  };
}

// ── Escalate ─────────────────────────────────────────────────────────

// Her own words against explicit red flags.
//
// What this is not: an assessment. It does not weigh her data, decide how
// serious anything is, or estimate risk. It notices that she used a word
// that means "this might need care now" and says what to do about that,
// which is a thing software can do honestly and a diagnosis is not.
export function answerEscalate(message: string, r: Record): Answer {
  const flags = redFlagsIn(message);
  return {
    capability: 'escalate',
    text:
      `What you are describing is worth getting looked at now rather than logged. ` +
      `If you feel unsafe, or this is sudden or the worst it has been, call your local emergency number or go to urgent care. ` +
      `Ciatta is not able to assess this and will not try.`,
    facts: flags.map((f) => ({ label: 'What you said', value: f, from: 'reported' })),
    suggestions: [],
  };
}

// ── Context ──────────────────────────────────────────────────────────

// General medical context, cited, and strictly not about her.
//
// research_refs carries reviewed_by and reviewed_at, which says what this
// store was always for: citations a person checked. So the agent may only
// quote rows that exist, and abstains when there are none. An agent that
// filled this gap from the model would be fabricating research, which is
// the one failure that would be hardest for her to catch and worst for her
// to act on.
export function answerContext(r: Record): Answer {
  if (!r.references.length) {
    return {
      capability: 'context',
      text:
        'Ciatta does not have reviewed sources on this yet, so there is nothing it can tell you here. ' +
        'It will not summarise research it cannot cite.',
      facts: [],
      suggestions: [],
      abstained: 'no_citations',
    };
  }
  const ref = r.references[0];
  const where = [ref.publication, ref.year ? `${ref.year}` : null].filter(Boolean).join(', ');
  return {
    capability: 'context',
    text: `${ref.summary} That is from ${ref.title}${where ? `, ${where}` : ''}. It is general, and it is not a statement about you.`,
    facts: [{ label: ref.title, value: ref.summary, from: 'reference', refId: ref.id }],
    suggestions: [],
  };
}

// ── Decline ──────────────────────────────────────────────────────────

export function answerDecline(): Answer {
  return {
    capability: 'decline',
    text:
      'That is outside what Ciatta can answer. It can tell you what is in your record, what has been established from it, ' +
      'what is worth asking a clinician, who to see, and how to prepare for a visit. ' +
      'It does not practise medicine, and it will not tell you what is wrong with you.',
    facts: [],
    suggestions: [METRICS, PREPARE],
    abstained: 'out_of_scope',
  };
}

// ── Routing ──────────────────────────────────────────────────────────

export function respond(message: string, r: Record, capability: import('./types').CapabilityId): Answer {
  switch (capability) {
    case 'record':
      return answerRecord(r);
    case 'pattern':
      return answerPattern(r);
    case 'prepare':
      return answerPrepare(r);
    case 'ask':
      return answerAsk(r);
    case 'navigate':
      return answerNavigate(r);
    case 'escalate':
      return answerEscalate(message, r);
    case 'context':
      return answerContext(r);
    default:
      return answerDecline();
  }
}

// Her name, when there is one, as a sentence opener. Lowercase after it,
// because every caller continues the sentence.
function name(r: Record): string {
  const n = (r.name ?? '').trim();
  return n ? `${n}, ` : '';
}
