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

import { NAME } from '../metricNames';
import { systemReview, SYSTEM_TOPICS } from '../systemReview';
import type { Day } from '../../data/daily';
import type { Episode } from '../../data/cycleLog';
import { buildMetrics, recordedCount } from '../allMetrics';
import { fmtHours } from '../engine';
import type { Answer, Fact, Suggestion } from './types';
import { isOutside, labDay, labDraws, labHistory, labStatus } from '../labs';
import { currentStep, nextAction, referralFromMessage } from '../referrals';
import { mentionsLab } from './classify';
import type { AgentContext } from './proactive';
import { labBrief, visitPrep } from './tasks';
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
  references: readonly {
    id: string;
    title: string;
    publication: string | null;
    year: number | null;
    summary: string;
    domains?: readonly string[];
  }[];
  cycleDay: number | null;
  cyclePhase: string | null;
  // What her hospitals sent. Measured by somebody else and recorded in
  // her chart, which is a third kind of fact alongside what a device
  // measured and what she reported, and is labelled as such.
  clinical: readonly {
    kind: string;
    name: string;
    value: string | null;
    flag: string | null;
    effectiveOn: string | null;
  }[];
  // Everything else she has given Ciatta, gathered fresh for each
  // question: readings against her usual, labs, symptoms, what she takes,
  // insurance and referrals. Absent until it has been read.
  context?: AgentContext;
};

const PREPARE: Suggestion = { label: 'Prepare for an appointment', screen: 'appointment' };
const METRICS: Suggestion = { label: "Today's metrics", screen: 'metrics' };
const LOG: Suggestion = { label: 'Log cycle experience', screen: 'cycleLog' };

// ── Record ───────────────────────────────────────────────────────────

// What her provider sent, said without reading it.
//
// The agent may count these and name them. It may not say what a value
// means, whether it is good, or what to do about it, and the shape of
// this function is what prevents that: it reports the lab's own flag
// where there is one and is silent where there is not.
export function answerClinical(r: Record): Answer {
  if (!r.clinical.length) {
    return {
      capability: 'clinical',
      text: 'Nothing has arrived from a provider yet. Connecting your hospital or clinic brings your results here.',
      facts: [],
      suggestions: [{ label: 'Connect a Provider', screen: 'providerConnect' }],
      abstained: 'no_data',
    };
  }

  const results = r.clinical.filter((c) => c.kind === 'lab' || c.kind === 'vital');
  const flagged = results.filter((c) => c.flag);
  const facts: Fact[] = [
    { label: 'Records from your providers', value: `${r.clinical.length}`, from: 'derived' },
    ...results.slice(0, 4).map((c) => ({
      label: c.name,
      value: c.value ?? 'no value given',
      // Measured, and by an instrument in a lab rather than by her
      // phone, but measured all the same. Not reported: she did not say
      // this, her hospital did.
      from: 'measured' as const,
      on: c.effectiveOn ?? undefined,
    })),
  ];

  // The flagged count is the lab's own count. Nothing here decides what
  // is worth flagging, and the sentence says whose judgement it was.
  const flagLine = flagged.length
    ? ` Your lab marked ${flagged.length} of them, which is their flag and not Ciatta's reading.`
    : '';

  return {
    capability: 'clinical',
    text: `${name(r)}your providers have sent ${r.clinical.length} records, including ${results.length} results.${flagLine} They are in your record exactly as your provider wrote them.`,
    facts,
    suggestions: [{ label: 'From your providers', screen: 'chart' }, PREPARE],
  };
}

// What the gut and vitals questions read, by the words she used.
const GUT_WORDS = ['gut', 'bowel', 'stool', 'poo', 'digest', 'constipat', 'diarrh'];
const VITAL_WORDS = ['blood pressure', 'oxygen', 'spo2', ' bp'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

// Her gut over four weeks, from what she logged: how many movements, how
// often, and how many of those with a type sat in the typical range.
export function answerGut(r: Record): Answer {
  const g = r.context?.gut;
  if (!g || !g.count) {
    return {
      capability: 'record',
      text: 'No bowel movements are logged in the last 4 weeks. Log one with its type under Gut, and your pattern builds from there.',
      facts: [{ label: 'Weeks', value: '4', from: 'derived' }],
      suggestions: [{ label: 'Your gut', screen: 'gut' }],
      abstained: 'no_data',
    };
  }
  const rated = g.mix.hard + g.mix.typical + g.mix.loose;
  const facts: Fact[] = [
    { label: 'Bowel movements logged, 4 weeks', value: `${g.count}`, from: 'reported' },
    { label: 'How often', value: g.perDay ?? '', from: 'derived' },
    { label: 'Typical form', value: `${g.mix.typical} of ${rated}`, from: 'derived' },
    { label: 'Typical range', value: 'Bristol types 3 and 4', from: 'reference' },
    ...(g.blood ? [{ label: 'Blood with a movement', value: `${g.blood}`, from: 'reported' as const }] : []),
  ];
  const typed = rated ? ` ${g.mix.typical} of the ${rated} with a type were in the typical range, Bristol types 3 and 4.` : '';
  const blood = g.blood ? ` You logged blood with ${g.blood} of them, which is worth raising with a clinician soon.` : '';
  return {
    capability: 'record',
    text: `In the last 4 weeks you logged ${g.count} bowel ${g.count === 1 ? 'movement' : 'movements'}, about ${g.perDay}.${typed}${blood}`,
    facts,
    suggestions: [{ label: 'Your gut', screen: 'gut' }, ...(g.blood ? [VISIT_PREP] : [])],
  };
}

// Her latest blood pressure and blood oxygen, each with its day.
export function answerVitals(r: Record): Answer {
  const v = r.context?.vitals;
  const parts: string[] = [];
  const facts: Fact[] = [];
  if (v?.bp) {
    parts.push(`blood pressure was ${v.bp.systolic}/${v.bp.diastolic} on ${shortDay(v.bp.on)}`);
    facts.push({ label: NAME.bp, value: `${v.bp.systolic}/${v.bp.diastolic}`, from: 'measured', on: v.bp.on });
  }
  if (v?.spo2) {
    parts.push(`blood oxygen ${v.spo2.value}% on ${shortDay(v.spo2.on)}`);
    facts.push({ label: NAME.spo2, value: `${v.spo2.value}%`, from: 'measured', on: v.spo2.on });
  }
  if (!parts.length) {
    return {
      capability: 'record',
      text: 'No blood pressure or blood oxygen readings have arrived yet. A cuff or a watch that writes to Apple Health brings them here.',
      facts: [],
      suggestions: [METRICS],
      abstained: 'no_data',
    };
  }
  return {
    capability: 'record',
    text: `Your latest ${parts.join(', and ')}.`,
    facts,
    suggestions: [METRICS],
  };
}

export function answerRecord(r: Record, message = ''): Answer {
  const asked = ` ${message.toLowerCase()}`;
  if (GUT_WORDS.some((w) => asked.includes(w))) return answerGut(r);
  if (VITAL_WORDS.some((w) => asked.includes(w))) return answerVitals(r);
  const facts: Fact[] = [];
  const d = r.today;

  if (d?.sleepHours != null) facts.push({ label: 'Sleep', value: fmtHours(d.sleepHours), from: 'measured', on: d.date });
  if (d?.hrv != null) facts.push({ label: NAME.hrv, value: `${Math.round(d.hrv)} ms`, from: 'measured', on: d.date });
  if (d?.steps != null) facts.push({ label: 'Steps', value: Math.round(d.steps).toLocaleString('en-US'), from: 'measured', on: d.date });
  // Today's wearable readings through the day, as ranges.
  for (const t of r.context?.today ?? []) facts.push({ label: t.label, value: t.range, from: 'measured' });
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
  if (r.context) return answerPrepareFull(r.context);
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
// Which reference answers her. Domains are matched against what she said
// she is managing, so a woman with endometriosis is not handed a sentence
// about PCOS because it happened to sort first. With nothing matching, the
// capability abstains rather than quoting something about a different
// condition entirely, which would read as being about her.
function pickReference(r: Record) {
  if (!r.references.length) return null;
  const hers = r.conditions.map((c) => c.toLowerCase());
  if (!hers.length) return null;
  return (
    r.references.find((ref) =>
      (ref.domains ?? []).some((d) => hers.some((c) => c.includes(d.toLowerCase()) || d.toLowerCase().includes(c))),
    ) ?? null
  );
}

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
  const ref = pickReference(r);
  if (!ref) {
    return {
      capability: 'context',
      // Having sources and having a source about her are different, and
      // the difference matters: quoting a paper on another condition would
      // read as being about her.
      text:
        'Ciatta has reviewed sources, but none of them are about what you told it you are managing. ' +
        'It will not quote research on something else as though it were about you.',
      facts: [],
      suggestions: [],
      abstained: 'no_citations',
    };
  }
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
      return answerRecord(r, message);
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
    case 'clinical':
      return answerClinical(r);
    case 'labs':
      return answerLabs(r, message);
    case 'referral':
      return answerReferral(r, message);
    case 'system':
      return answerSystem(r, message);
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

// ── Visit prep, labs and referrals, from the context ─────────────────

const VISIT_PREP: Suggestion = { label: 'Open your visit prep', screen: 'visitPrep' };
const ADD_LABS: Suggestion = { label: 'Add a lab report', screen: 'addLabs' };
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// The summary she takes to a visit, counted here and laid out on its own
// screen, where she can read, change and share it.
function answerPrepareFull(c: AgentContext): Answer {
  const prep = visitPrep(c, new Date());
  const lines = (t: string) => prep.sections.find((x) => x.title === t)?.lines.length ?? 0;
  const changed = lines('What changed');
  const labs = lines('Labs outside range');
  const referrals = lines('Referrals');
  const parts = [
    ...(changed ? [count(changed, 'thing that changed', 'things that changed')] : []),
    ...(labs ? [count(labs, 'lab outside its range', 'labs outside their range')] : []),
    ...(referrals ? [count(referrals, 'referral in progress', 'referrals in progress')] : []),
    ...(prep.questions.length ? [count(prep.questions.length, 'question to ask', 'questions to ask')] : []),
  ];
  return {
    capability: 'prepare',
    text: parts.length
      ? `Here is what I would bring: ${listed(parts)}. Open it to read, change and share.`
      : 'Nothing in your record stands out for a visit yet. You can still open it and add your own questions.',
    facts: [
      { label: 'Things that changed', value: `${changed}`, from: 'derived' },
      { label: 'Labs outside range', value: `${labs}`, from: 'measured' },
      { label: 'Referrals in progress', value: `${referrals}`, from: 'reported' },
      { label: 'Questions', value: `${prep.questions.length}`, from: 'derived' },
    ],
    suggestions: [VISIT_PREP],
  };
}

// Her labs: a test she named, against the range its lab printed, with its
// trend; or her latest visit. Never what a result means.
export function answerLabs(r: Record, message: string): Answer {
  const labs = r.context?.labs ?? [];
  if (!labs.length) {
    return {
      capability: 'labs',
      text: 'There are no labs in your record yet. Add a lab report, or connect a provider, and I can go through them with you.',
      facts: [],
      suggestions: [ADD_LABS],
      abstained: 'no_data',
    };
  }
  const named = mentionsLab(message, [...new Set(labs.map((l) => l.name))]);
  if (named) {
    const history = labHistory(labs, named);
    const l = history[history.length - 1];
    const st = labStatus(l);
    const value = l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? '');
    const against =
      st.key === 'noRange'
        ? 'and the lab printed no range for it'
        : st.key === 'inRange'
          ? `within the lab's range${l.rangeText ? ` of ${l.rangeText}` : ''}`
          : l.rangeText
            ? `${st.label.toLowerCase()} against the lab's range of ${l.rangeText}`
            : `flagged ${st.label.toLowerCase()} by the lab`;
    const brief = labBrief(labs, named);
    const prev = [...history].reverse().find((x) => x !== l && x.value != null);
    const facts: Fact[] = [
      { label: l.name, value, from: 'measured', on: l.on },
      { label: 'Collected', value: labDay(l.on), from: 'measured' },
      ...(l.rangeText ? [{ label: 'Lab range', value: l.rangeText, from: 'measured' as const }] : []),
      ...(prev
        ? [
            { label: 'Previous', value: `${prev.value}${prev.unit ? ` ${prev.unit}` : ''}`, from: 'measured' as const, on: prev.on },
            { label: 'Previous collected', value: labDay(prev.on), from: 'measured' as const },
          ]
        : []),
    ];
    return {
      capability: 'labs',
      text: `Your ${l.name.toLowerCase()} was ${value} on ${labDay(l.on)}, ${against}.${brief?.trend ? ` ${brief.trend}` : ''}`,
      facts,
      suggestions: [{ label: 'Decode this lab', screen: 'labBrief', lab: l.name }],
    };
  }
  const latest = labDraws(labs)[0];
  const outside = latest.results.filter(isOutside);
  return {
    capability: 'labs',
    text:
      `Your latest labs are from ${labDay(latest.on)}: ${outside.length} of ${latest.results.length} outside the lab's range.` +
      (outside.length ? ` ${outside.map((x) => `${x.name} ${labStatus(x).label.toLowerCase()}`).join(', ')}.` : ' All within range.'),
    facts: [
      { label: 'Collected', value: labDay(latest.on), from: 'measured' },
      { label: 'Outside range', value: `${outside.length}`, from: 'measured' },
      { label: 'Results', value: `${latest.results.length}`, from: 'measured' },
    ],
    suggestions: outside.length ? [{ label: 'Decode this lab', screen: 'labBrief', lab: outside[0].name }] : [{ label: 'Open your labs', screen: 'healthrecords' }],
  };
}

// Referrals: one she mentions, offered for tracking; the ones she tracks,
// with what is next. Ciatta prepares each step; she makes the call.
export function answerReferral(r: Record, message: string): Answer {
  const tracked = r.context?.referrals ?? [];
  const draft = referralFromMessage(message);
  if (draft && !tracked.some((x) => x.specialty.toLowerCase() === draft.specialty.toLowerCase())) {
    return {
      capability: 'referral',
      text: `Shall I keep track of your referral to ${draft.specialty}? I will lay out each step, from checking your insurance to the visit, and prepare what to say at each one.`,
      facts: [{ label: 'Referral', value: draft.specialty, from: 'reported' }],
      suggestions: [{ label: 'Track this referral', screen: 'referral', referralDraft: draft.specialty }],
    };
  }
  const open = tracked.filter((x) => currentStep(x));
  if (!open.length) {
    return {
      capability: 'referral',
      text: 'You are not tracking any referrals. If you have been referred to a specialist, tell me who, and I will lay out the steps.',
      facts: [],
      suggestions: [{ label: 'Track a referral', screen: 'referral' }],
    };
  }
  const next = nextAction(open[0], !!r.context?.insurance);
  return {
    capability: 'referral',
    text: `${open
      .slice(0, 3)
      .map((x) => `${x.specialty}: ${currentStep(x)!.label.toLowerCase()} is next.`)
      .join(' ')}${next ? ` ${next.text}` : ''}`,
    facts: open.slice(0, 3).map((x) => ({ label: 'Referral', value: x.specialty, from: 'reported' as const })),
    suggestions: [{ label: 'Open your referrals', screen: 'referrals' }],
  };
}

// ── A body system, from Explore ──────────────────────────────────────

const SYSTEM_SCREEN: Partial<globalThis.Record<string, Suggestion>> = {
  Reproductive: { label: 'Your cycle', screen: 'cycle' },
  Digestive: { label: 'Your gut', screen: 'gut' },
  Nervous: { label: 'Your sleep', screen: 'sleep' },
  Circulatory: { label: 'Your metrics', screen: 'metrics' },
  Respiratory: { label: 'Your metrics', screen: 'metrics' },
  Metabolic: { label: 'Your labs', screen: 'healthrecords' },
  Urinary: { label: 'Your labs', screen: 'healthrecords' },
  Immune: { label: 'Your labs', screen: 'healthrecords' },
  Musculoskeletal: { label: 'Your movement', screen: 'movement' },
  Skin: { label: 'Your symptoms', screen: 'symptoms' },
  'Whole Body': { label: 'Your symptoms', screen: 'symptoms' },
};

// One system, brought together from her record: the same highlights the
// Body card shows, then where to plan what to raise.
export function answerSystem(r: Record, message: string): Answer {
  const text = message.toLowerCase();
  const system = Object.keys(SYSTEM_TOPICS).find((s) => text.startsWith(`review my ${s.toLowerCase()} health`)) ?? 'Whole Body';
  const review = r.context
    ? systemReview(system, { context: r.context, points: [], conditions: r.conditions, situations: [], insight: null, now: new Date() })
    : { highlights: [], facts: [], sources: [] };
  const screen = SYSTEM_SCREEN[system];
  if (!review.highlights.length) {
    return {
      capability: 'system',
      text: `Nothing about your ${system.toLowerCase()} health is in your record yet. Logging it, or connecting a device or provider, starts it.`,
      facts: [],
      suggestions: [{ label: 'Log', screen: 'quickLog' }, ...(screen ? [screen] : [])],
      abstained: 'no_data',
    };
  }
  return {
    capability: 'system',
    text: `Your ${system.toLowerCase()} health, from your record: ${review.highlights.map((h) => h.charAt(0).toLowerCase() + h.slice(1)).join('; ')}. Your visit prep gathers what to raise, with your questions.`,
    facts: review.facts,
    suggestions: [VISIT_PREP, ...(screen ? [screen] : [])],
  };
}
