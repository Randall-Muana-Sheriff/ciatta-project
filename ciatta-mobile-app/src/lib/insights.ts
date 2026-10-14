// Research insights: what published research says about the things her
// record holds, each shown only when it connects to her own labs, readings
// or logs, and saying how. The research is general and named by its
// sources; the connection is hers and computed from her record. Nothing
// here diagnoses or advises; each insight ends with her clinician.
//
// The library is served from the research_insights table; this copy is
// what the app reads offline and in the example, and seeds that table.

import { isOutside, type LabResult, labStatus } from './labs';
import { type AgentContext, bpBand, bpLine } from './agent/proactive';

export type InsightSource = { title: string; publisher: string; year: number };
export type ResearchInsight = {
  id: string;
  title: string;
  // Its heading image, generated for Ciatta in one style; named by the
  // insight it heads (assets/images/insights).
  image: string;
  highlights: string[];
  body: string;
  sources: InsightSource[];
};

export const INSIGHTS: ResearchInsight[] = [
  {
    id: 'iron-fatigue',
    title: 'Low iron stores can drain your energy, even when your blood count looks normal.',
    image: 'iron-fatigue',
    highlights: [
      'Ferritin shows how much iron your body has stored',
      'Stores can run low before anemia shows on a blood count',
      'Heavy periods are a common reason iron runs low',
      'In a trial, iron eased fatigue in women with low ferritin and no anemia',
    ],
    body:
      'Ferritin measures the iron your body keeps in reserve. It can be low while hemoglobin is still in range, which is why a normal blood count does not always explain tiredness. In a randomized trial of menstruating women with fatigue, low ferritin and no anemia, iron eased fatigue compared with placebo. Whether iron is right for you is a question for your clinician, ideally with a recent ferritin result in hand.',
    sources: [
      { title: 'Effect of iron supplementation on fatigue in nonanemic menstruating women with low ferritin: a randomized controlled trial', publisher: 'CMAJ (Vaucher et al.)', year: 2012 },
      { title: 'Iron: Fact Sheet for Health Professionals', publisher: 'NIH Office of Dietary Supplements', year: 2024 },
    ],
  },
  {
    id: 'cycle-physiology',
    title: 'Your resting heart rate and skin temperature shift with your cycle.',
    image: 'cycle-physiology',
    highlights: [
      'Resting heart rate tends to rise after ovulation',
      'Skin temperature runs higher in the luteal phase',
      'Heart rate variability tends to be lower after ovulation',
      'Reading them against your own cycle tells a real change from a normal shift',
    ],
    body:
      'Wearable studies that followed women through their cycles found that wrist temperature, resting heart rate and heart rate variability move in step with the phases: higher temperature and heart rate, and lower variability, after ovulation. A reading that looks off your usual may simply be your cycle. Ciatta reads your readings against your own cycle for that reason.',
    sources: [
      { title: 'Wearable sensors reveal menses driven changes in physiology and enable prediction of the fertile window', publisher: 'Journal of Medical Internet Research (Goodale et al.)', year: 2019 },
    ],
  },
  {
    id: 'sleep-cycle',
    title: 'Sleep often gets lighter and more broken in the days before a period.',
    image: 'sleep-cycle',
    highlights: [
      'Many women report poorer sleep before and during their period',
      'Body temperature runs higher after ovulation',
      'Period pain and mood changes can break up the night',
      'Tracking sleep against your cycle shows whether this is your pattern',
    ],
    body:
      'Research on sleep across the menstrual cycle finds that sleep quality is often reported as worse in the late luteal phase and during menstruation, alongside the higher body temperature that follows ovulation and symptoms like cramps or low mood. Seeing your own nights against your cycle is the clearest way to know whether it applies to you.',
    sources: [{ title: 'Circadian rhythms, sleep, and the menstrual cycle', publisher: 'Sleep Medicine (Baker and Driver)', year: 2007 }],
  },
  {
    id: 'bp-categories',
    title: 'Blood pressure falls into four categories, and several readings tell more than one.',
    image: 'bp-categories',
    highlights: [
      'Normal is under 120 over 80',
      'Stage 1 starts at 130 over 80',
      'Stage 2 starts at 140 over 90',
      'Readings taken at rest, at the same time of day, give the truest picture',
    ],
    body:
      'The 2017 American College of Cardiology and American Heart Association guideline sorts blood pressure into normal, elevated, stage 1 and stage 2, by the top or the bottom number, whichever is higher. One reading can be raised by stress, caffeine or a rushed cuff, so the guideline relies on several. Bring your readings to your clinician rather than acting on one.',
    sources: [
      {
        title: 'Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults',
        publisher: 'Hypertension (Whelton et al., ACC/AHA)',
        year: 2018,
      },
    ],
  },
  {
    id: 'bristol',
    title: 'The form of your stool is a window into how fast your gut moves.',
    image: 'bristol',
    highlights: [
      'Types 1 and 2 are hard, and go with slow transit',
      'Types 3 and 4 are the typical range',
      'Types 5 to 7 are loose, and go with fast transit',
      'Your pattern over weeks says more than any one day',
    ],
    body:
      'The Bristol Stool Form Scale was shown to track intestinal transit time: harder forms with slower transit, looser forms with faster. It is the scale clinicians use, which makes your logs easy to share. Blood with a bowel movement is always worth raising with a clinician.',
    sources: [{ title: 'Stool form scale as a useful guide to intestinal transit time', publisher: 'Scandinavian Journal of Gastroenterology (Lewis and Heaton)', year: 1997 }],
  },
  {
    id: 'endo-gut',
    title: 'Endometriosis can show up in your bowel and bladder, not only as pelvic pain.',
    image: 'endo-gut',
    highlights: [
      'Pain with bowel movements is a recognised symptom',
      'So is pain when passing urine',
      'Symptoms often follow the cycle',
      'Recording timing helps your clinician see the pattern',
    ],
    body:
      'National guidance on endometriosis lists cyclical bowel and urinary symptoms, including pain with bowel movements or passing urine, alongside pelvic pain and painful periods. Symptoms that come and go with your cycle are worth logging with their timing, so your clinician can see the pattern rather than a single day.',
    sources: [{ title: 'Endometriosis: diagnosis and management (NG73)', publisher: 'National Institute for Health and Care Excellence', year: 2017 }],
  },
  {
    id: 'thyroid',
    title: 'Fatigue, hair shedding and dry skin can trace back to the thyroid.',
    image: 'thyroid',
    highlights: [
      'An underactive thyroid can bring tiredness, dry skin and hair loss',
      'These symptoms are common and overlap with many other things',
      'TSH is the usual first test',
      'A result inside the range is worth reading alongside your symptoms',
    ],
    body:
      'Hypothyroidism, an underactive thyroid, can cause fatigue, dry skin, hair thinning, constipation and feeling cold. Because these symptoms are common, a blood test, usually TSH first, is how it is checked. If you have logged several of them, asking your clinician whether a thyroid test fits is reasonable.',
    sources: [{ title: 'Hypothyroidism (underactive)', publisher: 'American Thyroid Association', year: 2023 }],
  },
  {
    id: 'headache-red-flags',
    title: 'Most headaches are not dangerous, but a few signs need care right away.',
    image: 'headache-red-flags',
    highlights: [
      'A sudden, severe headache, the worst of your life',
      'Headache with fever and a stiff neck',
      'Confusion, weakness on one side, or trouble speaking',
      'Headaches that change pattern or keep getting worse',
    ],
    body:
      'Guidance for clinicians on headaches lists the warning signs that call for urgent assessment, including a sudden severe headache, headache with fever and neck stiffness, and new neurological symptoms. Most headaches are not these. Logging when yours happen, how strong they are and what came with them helps your clinician most.',
    sources: [{ title: 'Headaches in over 12s: diagnosis and management (CG150)', publisher: 'National Institute for Health and Care Excellence', year: 2012 }],
  },
  {
    id: 'hormones-cycle',
    title: 'Estrogen and progesterone shape how each phase of your cycle can feel.',
    image: 'hormones-cycle',
    highlights: [
      'Estrogen rises toward ovulation',
      'Progesterone rises after ovulation and peaks mid luteal',
      'Both fall before your period begins',
      'Your own phases are what Ciatta reads your days against',
    ],
    body:
      'Reference ranges measured across the menstrual cycle show estrogen climbing to a peak before ovulation, progesterone rising after it, and both falling before the next period. Those shifts are part of why energy, sleep and symptoms can change through a cycle. Your Cycle screen draws the typical shape fitted to your own cycle.',
    sources: [
      {
        title: 'Establishment of detailed reference values for luteinizing hormone, follicle stimulating hormone, estradiol, and progesterone during different phases of the menstrual cycle',
        publisher: 'Clinical Chemistry and Laboratory Medicine (Stricker et al.)',
        year: 2006,
      },
    ],
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export type InsightMatch = { insight: ResearchInsight; connections: string[] };

// What in her record each insight connects to: a lab, a reading, a
// symptom she logged, a condition on her record. No connection, no card.
export function matchInsights(library: readonly ResearchInsight[], c: AgentContext, conditions: readonly string[], now: Date): InsightMatch[] {
  const since = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const latestLab = (re: RegExp): LabResult | null =>
    c.labs.filter((l) => re.test(l.name) && l.on >= since).sort((a, b) => b.on.localeCompare(a.on))[0] ?? null;
  const labLine = (l: LabResult) =>
    `${l.name} was ${isOutside(l) ? labStatus(l).label.toLowerCase() : 'within range'}, ${l.value != null ? `${l.value}${l.unit ? ` ${l.unit}` : ''}` : (l.valueText ?? '')} on ${short(l.on)}.`;
  const logged = (names: string[]) =>
    c.symptoms.filter((s) => names.includes(s.name) && s.days >= 2).map((s) => `You logged ${s.name.toLowerCase()} on ${s.days} days in the last 90.`);
  const reading = (key: string) => {
    const r = c.readings.find((x) => x.key === key);
    return r && r.side && r.side !== 'within' ? [`${r.label} ${r.side} your usual, latest ${r.latest}.`] : [];
  };
  const cycleLine = c.cycle ? [`Today is day ${c.cycle.day} of your cycle${c.cycle.phase ? `, ${c.cycle.phase.toLowerCase()}` : ''}.`] : [];

  const rules: Record<string, () => string[]> = {
    'iron-fatigue': () => {
      const f = latestLab(/ferritin/i);
      return [...(f ? [labLine(f)] : []), ...logged(['Fatigue', 'Hair shedding', 'Dizziness', 'Daytime sleepiness'])];
    },
    'cycle-physiology': () => (c.cycle && c.readings.some((r) => r.key === 'resting_hr' || r.key === 'hrv') ? [...cycleLine, ...reading('resting_hr'), ...reading('hrv')] : []),
    'sleep-cycle': () => (c.cycle && c.readings.some((r) => r.key === 'sleep_hours') ? [...cycleLine, ...reading('sleep_hours'), ...logged(['Insomnia', 'Waking at night'])] : []),
    'bp-categories': () => (c.vitals.bp && bpBand(c.vitals.bp) !== 'usual' ? [`${bpLine(c.vitals.bp)}.`] : []),
    bristol: () => (c.gut?.count ? [`You logged ${c.gut.count} bowel movements in the last 4 weeks.`] : []),
    'endo-gut': () => [
      ...(conditions.some((x) => /endometriosis/i.test(x)) ? ['Endometriosis is on your record.'] : []),
      ...logged(['Pelvic pain', 'Burning when peeing']),
    ],
    thyroid: () => {
      const t = latestLab(/\btsh\b|thyro/i);
      return [...(t ? [labLine(t)] : []), ...logged(['Hair shedding', 'Dry skin', 'Constipation'])];
    },
    'headache-red-flags': () => logged(['Headache', 'Migraine']),
    'hormones-cycle': () => (c.cycle && c.symptoms.length ? cycleLine : []),
  };

  return library
    .map((insight) => ({ insight, connections: rules[insight.id]?.() ?? [] }))
    .filter((m) => m.connections.length > 0)
    .sort((a, b) => b.connections.length - a.connections.length);
}
