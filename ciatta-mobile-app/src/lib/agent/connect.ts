// How several symptoms may connect, asked of the concierge. Read across
// her whole record, the answer is laid out the way a clinician's note
// would be: what stands out in her records, how her symptoms line up with
// each other and with her readings, the testing worth asking about, what
// is easy to miss, when to get care right away, and the one question that
// would narrow it down. Built by code from her record, every figure from
// it, nothing diagnosed and nothing prescribed. Her clinician reviews it.

import { isOutside, type LabResult, labStatus } from '../labs';
import { metricCorrelation, symptomCorrelation, windowDays } from '../symptomCorrelation';
import { labSuggestions } from './labSuggest';
import { type AgentContext, bpBand, bpLine } from './proactive';
import type { Answer, Fact } from './types';

export const CONNECT_SYMPTOMS =
  'I would like to understand how several symptoms I am experiencing may be connected. Please ask thoughtful follow up questions, review my health history, medications and relevant records, identify the most likely explanations, recommend any appropriate testing or evaluation, and help me understand the most appropriate next steps with clinician review.';

export const REFILL =
  'I would like to refill a prescription or ask about a new one. Review my medications and help me prepare the request for my clinician.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const SAFETY: { match: RegExp; lines: string[] }[] = [
  {
    match: /headache|migraine/i,
    lines: [
      'A sudden, severe headache, the worst of your life',
      'Headache with fever and a stiff neck',
      'Confusion, trouble speaking, vision changes or weakness on one side',
    ],
  },
  { match: /pelvic|cramp|^pain$|lower back/i, lines: ['Severe pelvic or belly pain with fever, fainting or vomiting', 'Bleeding that soaks a pad or tampon every hour'] },
  { match: /palpitation|racing heart|shortness of breath|dizz/i, lines: ['Chest pain, fainting, or breathlessness at rest'] },
];

function latestOutside(labs: readonly LabResult[], now: Date): LabResult[] {
  const since = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const by = new Map<string, LabResult>();
  for (const l of labs) {
    if (l.on < since) continue;
    const k = l.name.toLowerCase();
    if (!by.has(k) || by.get(k)!.on < l.on) by.set(k, l);
  }
  return [...by.values()].filter(isOutside).slice(0, 3);
}

export function answerConnect(c: AgentContext | undefined, name: string | null, now: Date = new Date()): Answer {
  const top = (c?.symptoms ?? []).filter((s) => s.days >= 2).slice(0, 4);
  if (!c || !top.length) {
    return {
      capability: 'connect',
      text: 'Tell me which symptoms you have been having, and since when, and I will look at how they line up with your sleep, heart, cycle and labs. Logging them each day builds the picture.',
      facts: [],
      suggestions: [{ label: 'Log symptoms', screen: 'quickLog' }],
      abstained: 'no_data',
    };
  }
  const facts: Fact[] = [];
  const say = (label: string, value: string, from: Fact['from']) => {
    facts.push({ label, value, from });
    return value;
  };

  const stands: string[] = [];
  for (const l of latestOutside(c.labs, now)) {
    const value = l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? '');
    stands.push(say(l.name, `${l.name} was ${labStatus(l).label.toLowerCase()}, ${value} on ${short(l.on)}${l.rangeText ? `, against the lab’s range of ${l.rangeText}` : ''}.`, 'measured'));
  }
  for (const r of c.readings.filter((x) => x.daysOutside >= 3 && (x.side === 'above' || x.side === 'below'))) {
    stands.push(say(r.label, `${r.label} ${r.side} your usual for ${r.daysOutside} days, latest ${r.latest}.`, 'measured'));
  }
  if (c.vitals.bp && bpBand(c.vitals.bp) !== 'usual') stands.push(say('Blood Pressure', `${bpLine(c.vitals.bp)}.`, 'measured'));
  if (c.gut?.blood) stands.push(say('Blood with a bowel movement', `You logged blood with a bowel movement ${c.gut.blood} ${c.gut.blood === 1 ? 'time' : 'times'} in 4 weeks.`, 'reported'));
  for (const s of top.filter((x) => x.versus?.startsWith('More often'))) {
    stands.push(say(s.name, `${s.name} on ${s.days} days in the last 90, more often lately.`, 'reported'));
  }

  // How they line up: symptom with symptom, then symptom with readings,
  // over the last four weeks.
  const window = windowDays('28', now);
  const daysOf = (n: string) => new Set(c.symptomDays[n] ?? []);
  const links: string[] = [];
  for (let i = 0; i < top.length && links.length < 2; i++) {
    for (let j = i + 1; j < top.length && links.length < 2; j++) {
      const p = symptomCorrelation(top[i].name, daysOf(top[i].name), top[j].name, daysOf(top[j].name), window);
      if (p.together) links.push(say(`${top[i].name} and ${top[j].name}`, p.sentence, 'derived'));
    }
  }
  let readingLinks = 0;
  for (const s of top.slice(0, 2)) {
    for (const m of ['sleep', 'hrv', 'rhr'] as const) {
      if (readingLinks >= 2) break;
      const r = metricCorrelation(s.name, daysOf(s.name), m, c.days, window);
      if (r.direction === 'lower' || r.direction === 'higher') {
        links.push(say(`${s.name} and ${m}`, r.sentence, 'derived'));
        readingLinks += 1;
      }
    }
  }

  const picks = labSuggestions({ symptoms: c.symptoms, labs: c.labs, now });
  const tests = picks.map((p) => say(p.test, `${p.test}, since you logged ${p.reasons.slice(0, 2).join(' and ')}`, 'reported'));

  const missed = c.meds.month.find((m) => m.label === 'Missed a dose')?.days ?? 0;
  const easy: string[] = [];
  if (missed >= 2) easy.push(say('Missed medication', `You missed your medication on ${missed} days in the last 30. Worth mentioning with your medication list.`, 'reported'));

  const names = top.map((s) => s.name).join(' ');
  const safety = [...new Set(SAFETY.filter((x) => x.match.test(names) || top.some((s) => x.match.test(s.name))).flatMap((x) => x.lines))];

  const section = (title: string, lines: string[]) => (lines.length ? `${title}\n${lines.map((l) => `• ${l}`).join('\n')}` : '');
  const text = [
    `${name ? `${name}, here` : 'Here'} is what your record shows, and how it may fit together.`,
    section('What stands out in your records', stands),
    section('How they may connect', links),
    section('Worth asking your clinician about', tests),
    section('Easy to miss', easy),
    section('Get care right away if', safety.length ? safety : ['Anything gets suddenly and sharply worse, or feels like an emergency']),
    'To narrow this down: when did these begin, and are they better, worse or about the same since? Your visit prep gathers all of this for your clinician to review.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    capability: 'connect',
    text,
    facts,
    suggestions: [
      { label: 'Open your visit prep', screen: 'visitPrep' },
      ...(picks.length ? [{ label: 'Draft a lab request', screen: 'careRequest', requestDraft: picks.map((p) => p.test).join('|') }] : []),
      { label: 'Log symptoms', screen: 'quickLog' },
    ],
  };
}

// Her medications on file, and the refill drafted for her to send.
export function answerMeds(c: AgentContext | undefined): Answer {
  const meds = c?.meds.medications ?? [];
  const supps = c?.meds.supplements ?? [];
  if (!meds.length) {
    return {
      capability: 'record',
      text: 'No medications are on file yet. Add them to your profile, or tell me which one you want to refill, and I will draft the request for you to send.',
      facts: [],
      suggestions: [{ label: 'Draft a refill request', screen: 'careRequest', requestKind: 'refill' }],
      abstained: 'no_data',
    };
  }
  const facts: Fact[] = [...meds, ...supps].map((m) => ({ label: m.name, value: m.last ? `last logged ${m.last}` : 'on file', from: 'reported' as const }));
  const medLine = meds.map((m) => `${m.name}${m.last ? `, last logged ${m.last}` : ''}`).join('; ');
  return {
    capability: 'record',
    text: `Your medications on file: ${medLine}.${supps.length ? ` Also on file: ${supps.map((s) => s.name).join(', ')}.` : ''} I can draft a refill request for you to send to your clinician.`,
    facts,
    suggestions: [{ label: 'Draft a refill request', screen: 'careRequest', requestKind: 'refill', requestFor: meds[0].name }],
  };
}
