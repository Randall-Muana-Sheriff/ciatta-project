// Explore health: topics she can look into, each read from what Ciatta
// already knows about her (the agent's context): where she is in her
// cycle, her readings against her own usual, the labs that bear on it,
// symptoms she has logged more than once, and conditions on her record.
// Facts only, in plain lines; a topic her record says nothing about says
// that, and never fills the gap.

import type { AgentContext } from './agent/proactive';
import { isOutside, type LabResult, labStatus } from './labs';

export type ExploreTopic = {
  key: string;
  label: string;
  // How the topic is said in a sentence.
  noun: string;
  cycle?: boolean;
  readings?: string[];
  labs?: RegExp;
  symptoms?: string[];
  conditions?: RegExp;
  // The Pattern Insights topics that belong here.
  insightTopics: string[];
};

export const EXPLORE_TOPICS: ExploreTopic[] = [
  { key: 'fertility', label: 'Fertility', noun: 'fertility', cycle: true, labs: /\b(amh|fsh|lh|estradiol|progesterone|prolactin)\b/i, symptoms: ['Breast tenderness', 'Spotting'], conditions: /pcos|endometriosis|infertil/i, insightTopics: ['cycle', 'hormones'] },
  { key: 'cycle', label: 'Cycle', noun: 'cycle', cycle: true, labs: /estradiol|progesterone|ferritin|hemoglobin/i, symptoms: ['Pelvic pain', 'Cramping', 'Breast tenderness', 'Spotting', 'Bloating'], conditions: /endometriosis|adenomyosis|pcos|fibroid|heavy period/i, insightTopics: ['cycle', 'endometriosis'] },
  { key: 'pregnancy', label: 'Pregnancy & postpartum', noun: 'pregnancy and postpartum', labs: /\bhcg\b|prolactin/i, symptoms: ['Nausea'], conditions: /pregnan|postpartum/i, insightTopics: [] },
  { key: 'sleep', label: 'Sleep & fatigue', noun: 'sleep and fatigue', readings: ['sleep_hours'], labs: /ferritin|hemoglobin|\bb12\b|vitamin d|\btsh\b/i, symptoms: ['Fatigue', 'Insomnia', 'Waking at night', 'Daytime sleepiness'], insightTopics: ['sleep', 'energy'] },
  { key: 'hormones', label: 'Hormones', noun: 'hormones', labs: /\btsh\b|\bt4\b|\bt3\b|testosterone|estradiol|cortisol|dhea|prolactin/i, symptoms: ['Hot flashes', 'Night sweats', 'Hair shedding', 'Acne'], conditions: /thyroid|pcos|menopaus/i, insightTopics: ['hormones'] },
  { key: 'gut', label: 'Gut health', noun: 'gut health', labs: /celiac|calprotectin|\bttg\b|lipase/i, symptoms: ['Bloating', 'Constipation', 'Nausea', 'Cramping'], conditions: /\bibs\b|crohn|colitis|celiac/i, insightTopics: ['gut'] },
  { key: 'heart', label: 'Heart & vitals', noun: 'heart and vitals', readings: ['resting_hr', 'hrv'], labs: /cholesterol|\bldl\b|\bhdl\b|triglycer|\ba1c\b|glucose|\bcrp\b/i, symptoms: ['Palpitations', 'Racing heart', 'Dizziness'], conditions: /hypertension|blood pressure|heart/i, insightTopics: ['heart', 'vitals'] },
  { key: 'mood', label: 'Mood & stress', noun: 'mood and stress', labs: /vitamin d|\btsh\b|\bb12\b/i, symptoms: ['Anxiety', 'Low mood', 'Mood swings', 'Irritability', 'Brain fog'], conditions: /depress|anxiety|pmdd/i, insightTopics: [] },
  { key: 'skin', label: 'Skin & hair', noun: 'skin and hair', labs: /testosterone|dhea/i, symptoms: ['Acne', 'Oily skin', 'Dry skin', 'Hair shedding', 'Unwanted hair growth'], conditions: /pcos|eczema|psoriasis|acne/i, insightTopics: [] },
  { key: 'nutrition', label: 'Nutrition', noun: 'nutrition', labs: /vitamin|ferritin|\bb12\b|folate|magnesium|\biron\b/i, symptoms: ['Food cravings', 'Appetite change'], insightTopics: ['energy'] },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const labLine = (l: LabResult) =>
  `${l.name} was ${isOutside(l) ? labStatus(l).label.toLowerCase() : 'within range'}, ${l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? '')} on ${shortDay(l.on)}.`;

type Context = Pick<AgentContext, 'labs' | 'symptoms' | 'cycle'> & {
  readings: { key: string; label: string; latest: string; usual: string | null; side: 'above' | 'below' | 'within' | null; daysOutside: number }[];
};

export function exploreTopic(key: string, c: Context, conditions: readonly string[]) {
  const t = EXPLORE_TOPICS.find((x) => x.key === key) ?? EXPLORE_TOPICS[0];
  const lines: string[] = [];
  if (t.cycle && c.cycle) lines.push(`Today is day ${c.cycle.day} of your cycle${c.cycle.phase ? `, ${c.cycle.phase.toLowerCase()}` : ''}.`);
  for (const k of t.readings ?? []) {
    const r = c.readings.find((x) => x.key === k);
    if (!r || !r.side || r.side === 'within' || !r.usual) continue;
    lines.push(`${r.label} has been ${r.side} your usual of ${r.usual} on ${r.daysOutside === 1 ? '1 day' : `${r.daysOutside} days`}, latest ${r.latest}.`);
  }
  if (t.labs) {
    // The latest of each test, newest first, at most four.
    const latest = new Map<string, LabResult>();
    for (const l of [...c.labs].sort((a, b) => b.on.localeCompare(a.on))) if (t.labs.test(l.name) && !latest.has(l.name)) latest.set(l.name, l);
    lines.push(...[...latest.values()].slice(0, 4).map(labLine));
  }
  for (const s of c.symptoms) if ((t.symptoms ?? []).includes(s.name) && s.days >= 2) lines.push(`You logged ${s.name.toLowerCase()} on ${s.days} days in the last 90.`);
  if (t.conditions) for (const name of conditions) if (t.conditions.test(name)) lines.push(`${name} is on your record.`);
  return {
    topic: t,
    lines,
    empty: `Nothing in your record speaks to ${t.noun} yet. Ask Ciatta, or tell it what is going on.`,
    insightTopics: t.insightTopics,
    ask: `Explore my ${t.noun}: what in my record stands out?`,
  };
}
