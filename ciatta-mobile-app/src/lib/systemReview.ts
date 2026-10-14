// One insight card per body system: short highlights from her own record,
// gathered from everywhere it lives (wearables, provider records, labs, her
// logs and the foods she eats), and the prompt Explore sends to Care.
//
// The Body card and the agent's answer are built from this one function,
// so what the card says and what the agent says can never disagree. Every
// highlight is a fact from her record; nothing here diagnoses or advises.

import { REGION_BY_ID, type BodyPoint, type RegionId } from './bodyMap';
import { isOutside, type LabResult, labStatus } from './labs';
import { type AgentContext, bpLine, spo2Line } from './agent/proactive';
import type { Fact } from './agent/types';

export const SYSTEM_TOPICS: Record<string, string[]> = {
  Reproductive: ['Fertility', 'Cycle', 'Pregnancy and postpartum', 'Menopause', 'Endometriosis'],
  Circulatory: ['Heart rate', 'Blood pressure', 'Iron'],
  Respiratory: ['Blood oxygen', 'Breathing'],
  Digestive: ['Bowel', 'Bloating', 'What you eat'],
  Metabolic: ['Thyroid', 'Blood sugar', 'Weight'],
  Urinary: ['Bladder', 'Kidneys'],
  Immune: ['Infections', 'Inflammation'],
  Musculoskeletal: ['Pain', 'Movement'],
  Nervous: ['Sleep', 'Mood', 'Headaches'],
  Skin: ['Skin', 'Hair'],
  'Whole Body': ['Energy', 'Symptoms'],
};

// Which lab belongs to which system, by the test's name.
const LAB_SYSTEM: [RegExp, string][] = [
  [/ferritin|iron|h(a)?emoglobin|hematocrit|cholesterol|ldl|hdl|triglycer|b12|folate|platelet/i, 'Circulatory'],
  [/tsh|\bt3\b|\bt4\b|thyro|glucose|a1c|insulin|vitamin d|cortisol/i, 'Metabolic'],
  [/creatinine|egfr|urea|\bbun\b|urine|albumin/i, 'Urinary'],
  [/wbc|white blood|crp|esr|lymph|neutro/i, 'Immune'],
  [/estradiol|progesterone|\blh\b|fsh|amh|testosterone|prolactin|hcg|shbg/i, 'Reproductive'],
  [/\balt\b|\bast\b|bilirubin|lipase|amylase|calprotectin/i, 'Digestive'],
];
const SYMPTOM_GROUP: Record<string, string> = { Digestive: 'Gut', Nervous: 'Mind', Skin: 'Skin', Urinary: 'Sexual and urinary', 'Whole Body': 'Body' };
const READINGS: Record<string, string[]> = { Circulatory: ['resting_hr', 'hrv'], Nervous: ['sleep_hours'], Musculoskeletal: ['steps'] };
const SITUATIONS = ['Pregnant', 'Postpartum', 'Perimenopause', 'Menopause', 'Trying to conceive', 'PCOS / PMOS'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function latestLabs(labs: readonly LabResult[], system: string): LabResult[] {
  const by = new Map<string, LabResult>();
  for (const l of labs) {
    if (LAB_SYSTEM.find(([re]) => re.test(l.name))?.[1] !== system) continue;
    const k = l.name.toLowerCase();
    if (!by.has(k) || by.get(k)!.on < l.on) by.set(k, l);
  }
  return [...by.values()].sort((a, b) => Number(isOutside(b)) - Number(isOutside(a)) || b.on.localeCompare(a.on));
}

export type SourceKind = 'Measured' | 'You logged' | 'Lab' | 'Provider';
export type SystemReview = { highlights: string[]; facts: Fact[]; sources: { kind: SourceKind; label: string }[] };

export function systemReview(
  system: string,
  input: {
    context: AgentContext;
    points: readonly Pick<BodyPoint, 'title' | 'source' | 'region'>[];
    conditions: readonly string[];
    situations: readonly string[];
    // The system's own counted sentence, from systemInsight.
    insight: string | null;
    now: Date;
  },
): SystemReview {
  const c = input.context;
  const out: string[] = [];
  const kinds = new Map<string, SourceKind>();
  const add = (h: string, kind: SourceKind) => {
    out.push(h);
    if (!kinds.has(h)) kinds.set(h, kind);
  };
  if (input.insight) add(input.insight.replace(/\.$/, ''), 'You logged');

  if (system === 'Reproductive') {
    if (c.cycle) add(`Cycle day ${c.cycle.day}${c.cycle.phase ? `, ${lower(c.cycle.phase)}` : ''}`, 'You logged');
    for (const cond of input.conditions) if (/endometriosis|pcos|adenomyosis|fibroid/i.test(cond)) add(`${cond} on your record`, 'You logged');
    for (const sit of input.situations) if (SITUATIONS.includes(sit)) add(`${sit} noted in your profile`, 'You logged');
  }
  if (system === 'Circulatory' && c.vitals.bp) add(bpLine(c.vitals.bp), 'Measured');
  if (system === 'Respiratory') {
    if (c.vitals.spo2) add(spo2Line(c.vitals.spo2), 'Measured');
    const rr = c.today.find((t) => /respiratory/i.test(t.label));
    if (rr) add(`Respiratory rate today, ${rr.range}`, 'Measured');
  }
  if (system === 'Digestive' && c.gut?.count) {
    if (c.gut.blood) add(`Blood with a movement, ${c.gut.blood} ${c.gut.blood === 1 ? 'time' : 'times'} in 4 weeks`, 'You logged');
    const rated = c.gut.mix.hard + c.gut.mix.typical + c.gut.mix.loose;
    add(`${c.gut.count} bowel movements in 4 weeks${rated ? `, ${c.gut.mix.typical} of ${rated} typical` : ''}`, 'You logged');
  }
  for (const key of READINGS[system] ?? []) {
    const r = c.readings.find((x) => x.key === key);
    if (r) add(`${r.label} ${r.latest}${r.side ? `, ${r.side === 'within' ? 'within' : r.side} your usual` : ''}`, 'Measured');
  }
  const group = SYMPTOM_GROUP[system];
  if (group) for (const sym of c.symptoms.filter((x) => x.group === group).slice(0, 2)) add(`${sym.name} on ${sym.days} ${sym.days === 1 ? 'day' : 'days'} in 90`, 'You logged');
  if ((system === 'Digestive' || system === 'Metabolic') && c.foods.length) {
    add(`Foods you log most: ${c.foods.slice(0, 3).map((f) => f.name).join(', ')}`, 'You logged');
  }
  for (const l of latestLabs(c.labs, system).slice(0, 2)) {
    add(isOutside(l) ? `${l.name} ${labStatus(l).label.toLowerCase()} on ${short(l.on)}` : `${l.name} within range on ${short(l.on)}`, l.source === 'report' ? 'Lab' : 'Provider');
  }
  for (const p of input.points) {
    if (p.source === 'Lab' || p.source === 'Synced' || p.source === 'Pattern') continue;
    const where = p.region === 'systemic' ? '' : `, ${REGION_BY_ID[p.region as RegionId]?.label.toLowerCase() ?? ''}`;
    add(`${p.title}${where}`, 'You logged');
  }

  const highlights = [...new Set(out)].slice(0, 5);
  return {
    highlights,
    facts: highlights.map((h) => ({ label: system, value: h, from: kinds.get(h) === 'You logged' ? ('reported' as const) : ('measured' as const) })),
    sources: highlights.map((h) => ({ kind: kinds.get(h)!, label: h })),
  };
}

// What Explore sends to Care: the system, a topic when she chose one, and
// what to bring together.
export function explorePrompt(system: string, topic?: string): string {
  return `Review my ${system.toLowerCase()} health${topic ? `, with a focus on ${topic.toLowerCase()}` : ''}: what my wearables, provider records, labs and food logs show, what stands out, and what to plan or raise at my next visit.`;
}
