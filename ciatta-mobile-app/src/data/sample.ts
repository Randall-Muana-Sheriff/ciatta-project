import type { Screen } from '../navigation';
import type { IconName } from '../ui/icons';
import type { images } from '../ui/images';

// A made up person to build the UI against before the schema exists. Maya is
// invented and every figure matches the Figma Make reference screens. Swap
// these out screen by screen once the data layer lands.

export const person = {
  firstName: 'Maya',
  fullName: 'Maya Chen',
  initial: 'M',
  email: 'maya@example.com',
  age: 28,
  memberSince: 'January 2026',
};

export const insight = {
  headline: 'Your two shortest cycles followed your two lowest sleep weeks.',
  meta: 'Seen twice · across 7 months · updated 21 Jul',
  basedOn: [
    { label: 'Two shortest cycles', sub: '4 Apr · 28 May', value: '26d', screen: 'cycle' },
    { label: 'Two lowest sleep weeks', sub: '25 Mar · 20 May', value: '5h 54m', screen: 'sleep' },
    { label: 'Disrupted sleep', sub: 'from 18 Mar', value: '34d', screen: 'symptoms' },
    { label: '“A stressful stretch at work”', sub: '14 Mar', value: '', screen: 'journal' },
  ] satisfies { label: string; sub: string; value: string; screen: Screen }[],
  evidence: {
    claim: 'Shorter sleep is associated with cycle variability in published cohorts.',
    meta: '2,300 women · published 2019 · not about you',
  },
  stillOpen: 'Whether this repeats across your next two cycles.',
  method: [
    { label: 'Looked at', value: '7 cycles and 30 weeks of sleep' },
    { label: 'Pattern', value: 'A lowest sleep week, then a short cycle within 10 days' },
    { label: 'Times seen', value: 'Both of your two lowest sleep weeks' },
    { label: 'Other weeks', value: 'No short cycle followed' },
  ],
};

export const sleep = {
  average: { hours: 6, minutes: 54 },
  averageLabel: '6h 54m',
  vsTypical: '11m under your typical 7h 05m',
  weekly: [0.84, 0.87, 0.82, 0.8, 0.78, 0.82, 0.84, 0.83, 0.57, 0.8, 0.82, 0.83, 0.8, 0.79, 0.61, 0.82, 0.85, 0.87],
  lowWeeks: [8, 14],
  tiles: [
    { value: '7h 21m', label: 'Time in bed' },
    { value: '±38m', label: 'Bedtime spread' },
  ],
  lowest: [
    {
      week: 'Week of 25 Mar',
      value: '5h 54m',
      nights: [0.55, 0.32, 0.6, 0.38, 0.72, 0.8, 0.76],
      facts: [
        { label: 'Under 5h 30m', value: '3 nights' },
        { label: 'Next cycle', value: 'Started 4 Apr, ran 26 days' },
      ],
    },
    {
      week: 'Week of 20 May',
      value: '6h 04m',
      nights: [0.62, 0.7, 0.44, 0.58, 0.66, 0.74, 0.7],
      facts: [
        { label: 'Under 5h 30m', value: '2 nights' },
        { label: 'Next cycle', value: 'Started 28 May, ran 26 days' },
      ],
    },
  ],
  source: 'Oura · nightly · synced 2 hours ago',
};

export const cycle = {
  day: 12,
  progress: 0.43,
  started: '21 Jul',
  nextExpected: '18 Aug',
  typical: 'Typical 26 to 30 days',
  lengths: [
    { h: 0.88 },
    { h: 0.9 },
    { h: 0.86 },
    { h: 0.65, short: '26d' },
    { h: 0.88 },
    { h: 0.64, short: '26d' },
    { h: 0.9 },
  ],
  history: [
    { dates: '23 Jun to 20 Jul', flow: 'Medium flow', days: '28d', short: false, facts: [
      { label: 'Length', value: '28 days · typical' },
      { label: 'Bleeding', value: '5 days, medium' },
    ] },
    { dates: '28 May to 22 Jun', flow: 'Light flow', days: '26d', short: true, facts: [
      { label: 'Length', value: '26 days · 2 under typical' },
      { label: 'Bleeding', value: '4 days, light' },
      { label: 'Also this cycle', value: 'Low energy, 20 May to 5 Jun' },
    ] },
    { dates: '30 Apr to 27 May', flow: 'Medium flow', days: '28d', short: false, facts: [
      { label: 'Length', value: '28 days · typical' },
      { label: 'Bleeding', value: '5 days, medium' },
    ] },
  ],
  source: 'Oura · nightly · 3 start dates you confirmed',
};

export type SymptomGroup = 'Sleep' | 'Energy' | 'Temperature';

export const symptoms = {
  cycleStarts: [0, 1, 3, 4, 5.5],
  timeline: [
    { label: 'Disrupted sleep', start: 2, end: 5.5, color: 'moderate' },
    { label: 'Night sweats', start: 2.2, end: 5.2, color: 'moderate' },
    { label: 'Low energy', start: 3.8, end: 5.5, color: 'mild' },
  ] as { label: string; start: number; end: number; color: 'mild' | 'moderate' | 'severe' }[],
  list: [
    { name: 'Disrupted sleep', days: '34 days', group: 'Sleep', facts: [
      { label: 'First logged', value: '18 Mar' },
      { label: 'Most often', value: 'Moderate, 21 of 34 days' },
      { label: 'Around it', value: 'Lowest sleep week, 25 Mar' },
    ] },
    { name: 'Night sweats', days: '21 days', group: 'Temperature', facts: [
      { label: 'First logged', value: '22 Mar' },
      { label: 'Most often', value: 'Moderate, 14 of 21 days' },
    ] },
    { name: 'Low energy', days: '17 days', group: 'Energy', facts: [
      { label: 'First logged', value: '20 May' },
      { label: 'Most often', value: 'Mild, 12 of 17 days' },
    ] },
    { name: 'Headaches', days: '6 days', sub: 'none since 12 Feb', facts: [
      { label: 'First logged', value: '9 Jan' },
      { label: 'Last logged', value: '12 Feb' },
    ] },
  ] as { name: string; days: string; sub?: string; group?: SymptomGroup; facts: { label: string; value: string }[] }[],
};

export const medications = {
  current: [
    { name: 'Magnesium', dose: '300 mg', timing: 'Evening', since: 'Since 14 Mar', note: null },
    { name: 'Vitamin D', dose: '1,000 IU', timing: 'Morning', since: 'Since 12 Jun', note: 'Added after your 12 Jun results' },
  ],
  stopped: [
    { name: 'Iron', dose: '24 mg', timing: 'Morning', since: '2 Feb to 30 Apr', note: null },
  ],
  timeline: [
    { label: 'Iron, 24 mg', start: 0, end: 2.9, tone: 'past' },
    { label: 'Magnesium, 300 mg', start: 2.4, end: 8, tone: 'current' },
    { label: 'Vitamin D, 1,000 IU', start: 5.4, end: 8, tone: 'current' },
  ] as { label: string; start: number; end: number; tone: 'past' | 'current' }[],
  changes: [
    { label: 'Stopped iron', date: '30 Apr', facts: [
      { label: 'Taken for', value: '87 days, 2 Feb to 30 Apr' },
      { label: 'Ferritin since', value: '34 → 41 ng/mL' },
    ], link: 'See what changed after this' },
    { label: 'Started vitamin D', date: '12 Jun', facts: [
      { label: 'Why', value: 'After your 12 Jun results' },
      { label: 'Dose', value: '1,000 IU, mornings' },
    ] },
    { label: 'Started magnesium', date: '14 Mar', facts: [
      { label: 'Why', value: 'You said, for sleep' },
      { label: 'Dose', value: '300 mg, evenings' },
    ] },
  ] as { label: string; date: string; facts: { label: string; value: string }[]; link?: string }[],
};

export type EntryKind = 'Notes' | 'Symptoms' | 'Context';

export const journal = {
  count: 42,
  since: 'Since January',
  months: [
    { month: 'July 2026', items: [
      { text: 'Better week. Slept through four nights.', date: '3 Jul', tag: 'Sleep', kind: 'Notes', usedInInsight: false },
    ] },
    { month: 'June 2026', items: [
      { text: 'Started vitamin D after the last results.', date: '12 Jun', tag: 'Medication', kind: 'Context', usedInInsight: false },
    ] },
    { month: 'May 2026', items: [
      { text: 'Tired in a way sleep is not fixing.', date: '22 May', tag: 'Energy', kind: 'Symptoms', usedInInsight: false },
    ] },
    { month: 'March 2026', items: [
      { text: 'Stopped sleeping through the night.', date: '18 Mar', tag: 'Used in an insight', kind: 'Symptoms', usedInInsight: true },
      { text: 'Stressful stretch at work.', date: '14 Mar', tag: 'Used in an insight', kind: 'Context', usedInInsight: true },
    ] },
    { month: 'February 2026', items: [
      { text: 'Started iron after the last results.', date: '2 Feb', tag: 'Medication', kind: 'Context', usedInInsight: false },
    ] },
  ] as { month: string; items: { text: string; date: string; tag: string; kind: EntryKind; usedInInsight: boolean }[] }[],
};

export type LabStatus = 'In' | 'Low';

export const records = {
  highlight: { name: 'Ferritin, latest', value: '41', unit: 'ng/mL', status: 'In' as LabStatus, change: 'up from 34 on 2 Feb' },
  draws: [
    { date: '12 Jun 2026', lab: 'Quest Diagnostics', results: [
      { name: 'Ferritin', value: '41 ng/mL', range: '15 to 150', status: 'In' },
      { name: 'Vitamin D', value: '26 ng/mL', range: '30 to 100', status: 'Low' },
      { name: 'TSH', value: '2.3 mIU/L', range: '0.4 to 4.0', status: 'In' },
    ] },
    { date: '2 Feb 2026', lab: 'Quest Diagnostics', results: [
      { name: 'Ferritin', value: '34 ng/mL', range: '15 to 150', status: 'In' },
      { name: 'Vitamin D', value: '28 ng/mL', range: '30 to 100', status: 'Low' },
    ] },
  ] as { date: string; lab: string; results: { name: string; value: string; range: string; status: LabStatus }[] }[],
  lowNote: 'Vitamin D below range on both draws. 28 then 26 ng/mL',
  gap: 'No results between February and June',
  older: { date: '19 Aug 2025', lab: 'Northside Family Health', count: '2 results' },
  documents: [
    { title: 'Lab report', sub: 'Quest Diagnostics · 12 Jun 2026', kind: 'PDF · 3 pages' },
    { title: 'Lab report', sub: 'Quest Diagnostics · 2 Feb 2026', kind: 'PDF · 2 pages' },
    { title: 'Visit summary', sub: 'Northside Family Health · 19 Aug 2025', kind: 'PDF · 1 page' },
  ],
  source: '3 draws on file · imported, never edited',
};

export type SourceKind = 'measured' | 'logged' | 'lab';

export const sources = [
  { name: 'Oura Ring', kind: 'measured', status: 'Connected', facts: [
    { label: 'Supplies', value: 'Sleep, temperature, cycle start dates' },
    { label: 'Since', value: '9 Jan 2026' },
    { label: 'Last updated', value: '2 hours ago' },
  ] },
  { name: 'Apple Health', kind: 'measured', status: 'Connected', facts: [
    { label: 'Supplies', value: 'Steps, heart rate, workouts' },
    { label: 'Since', value: '9 Jan 2026' },
    { label: 'Last updated', value: 'Today, 7:12' },
  ] },
  { name: 'Quest Diagnostics', kind: 'lab', status: '2 imports', facts: [
    { label: 'Supplies', value: 'Ferritin, vitamin D, TSH' },
    { label: 'Draws', value: '2 Feb 2026 and 12 Jun 2026' },
    { label: 'Last updated', value: '14 Jun 2026' },
  ] },
  { name: 'You', kind: 'logged', status: '42 entries', facts: [
    { label: 'Supplies', value: 'Notes, symptoms, medications' },
    { label: 'Since', value: '9 Jan 2026' },
    { label: 'Last entry', value: '3 Jul' },
  ] },
] as { name: string; kind: SourceKind; status: string; facts: { label: string; value: string }[] }[];

export const aboutYou = [
  { label: 'Age', value: '28' },
  { label: 'Life stage', value: 'Not added' },
  { label: 'Cycle', value: 'Usually 26 to 30 days' },
  { label: 'Conditions', value: 'None added' },
];

// ── Reference screens (ciatta-visual-assets) ──────────────────
// Figures below match today-cia, health-cia, journey-cia and profile-cia.

export type Tone = 'coral' | 'mint' | 'lavender' | 'indigo' | 'text';

// Today's cycle and sleep figures are drawn live from the cycle record and
// daily data (see cycleTrend in engine.ts); only the words live here. Both
// claims are what the engine's combined insight says of the sample record:
// the shortest cycle ended in a low sleep stretch, and the same combination
// closed the next shortest cycle.
export const today = {
  headline: 'Your two shortest cycles both ended during weeks of lower sleep.',
  kicker: 'Today’s pattern',
  // Opens Today's Pattern when nothing is ready to surface.
  brief:
    'Your two shortest cycles both ended during weeks when your sleep was lower than usual, a stretch when you also logged more stress. That has happened twice so far, which is enough to keep watching but not enough to say lower sleep caused the change.',
};

export const healthCards: {
  title: string;
  value: string;
  period: string;
  meta: string;
  metaIcon: IconName;
  tone: 'coral' | 'mint' | 'lavender';
  image: keyof typeof images;
  screen: Screen;
}[] = [
  { title: 'Health Records', value: '14 results · 3 documents', period: 'Results and documents', meta: '2 new since last visit', metaIcon: 'ring', tone: 'mint', image: 'records', screen: 'healthrecords' },
  { title: 'Cycle', value: '26 to 29 days', period: 'Last 4 cycles', meta: 'Slightly shorter recently', metaIcon: 'wave', tone: 'coral', image: 'cycle', screen: 'cycle' },
  { title: 'Sleep', value: '6h 12m average', period: 'Last 7 days', meta: '12% lower than your usual', metaIcon: 'bars', tone: 'coral', image: 'sleep', screen: 'sleep' },
  // Value and meta are filled in live from the insight layer.
  { title: 'Movement', value: 'Steps a day', period: 'Last 7 days', meta: 'Against your usual', metaIcon: 'bars', tone: 'coral', image: 'movement', screen: 'movement' },
  { title: 'Symptoms', value: '3 observations', period: 'This month', meta: 'Fatigue, sleep disruption, stress', metaIcon: 'ring', tone: 'coral', image: 'symptoms', screen: 'symptoms' },
  { title: 'Medications & Supplements', value: '4 active', period: '2 changes this year', meta: 'Levothyroxine · Magnesium · Vitamin D', metaIcon: 'pill', tone: 'coral', image: 'medications', screen: 'medications' },
  { title: 'Your Notes', value: '38 entries', period: 'Last 30 days', meta: '“Work has been stressful lately…”', metaIcon: 'chat', tone: 'lavender', image: 'journal', screen: 'journal' },
];

// Month positions are fractional: cycles and draws do not land on month starts.
// Seven months ending one month ahead, so the timeline always reaches today
// and logged episodes land in the current month.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function journeyMonth(i: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + i - 5, 1);
}

export const journey = {
  months: Array.from({ length: 7 }, (_, i) => MONTHS_SHORT[journeyMonth(i).getMonth()]),
  yearOf: (month: number) => String(journeyMonth(month).getFullYear()),
  monthDate: journeyMonth,
  now: 5,
  // The cycle lane is drawn from logged periods (see JourneyScreen).
  sleep: [
    { m: 0, hours: 7.47, label: '7h 28m' },
    { m: 1.1, hours: 7.2, label: '7h 12m' },
    { m: 2.4, hours: 6.8, label: '6h 48m' },
    { m: 3.8, hours: 6.53, label: '6h 32m' },
    { m: 5, hours: 6.2, label: '6h 12m' },
    { m: 6.3, hours: 6.6, expected: true },
  ] as { m: number; hours: number; label?: string; expected?: boolean }[],
  symptoms: [
    { m: 0.2, y: 58 }, { m: 1.1, y: 58 }, { m: 1.7, y: 66 }, { m: 2.3, y: 30 },
    { m: 3.7, y: 56 }, { m: 3.9, y: 70 }, { m: 5, y: 26 }, { m: 5, y: 44 },
    { m: 5.2, y: 58 }, { m: 5.2, y: 72 }, { m: 6.3, y: 58, expected: true },
  ] as { m: number; y: number; expected?: boolean }[],
  medications: [
    { name: 'Magnesium', from: 0.35, to: 5, ongoing: 6.5, y: 32, labelAt: 1, tone: 'mint' },
    { name: 'Levothyroxine', from: 2.4, to: 5.4, y: 76, labelAt: 3.5, tone: 'lavender' },
  ] as { name: string; from: number; to: number; ongoing?: number; y: number; labelAt: number; tone: 'mint' | 'lavender' }[],
  records: [
    { m: 0.35, label: 'Lab results' },
    { m: 2.4, label: 'Annual exam' },
    { m: 5.2, label: 'Blood work' },
  ],
  notes: [
    { m: 1, lines: ['Felt more', 'stressed'] },
    { m: 3, lines: ['Waking up', 'often'] },
    { m: 5, lines: ['Work has been', 'really stressful'] },
  ],
  insight: {
    headline: 'Your two shortest cycles followed your two lowest sleep weeks.',
    sub: 'Tap to explore what happened during this time.',
  },
};

type ProfileTile = { icon: IconName; tone: Tone; label: string; value: string; sub?: string };

export const profile = {
  name: 'Maya Chen',
  age: '28 years',
  born: 'Born Apr 14, 1996',
  stats: [
    { icon: 'person', tone: 'coral', label: 'Age', value: '28 years', sub: 'Born Apr 14, 1996' },
    { icon: 'ruler', tone: 'coral', label: 'Height', value: '5′ 8″', sub: '173 cm' },
    { icon: 'drop', tone: 'coral', label: 'Blood Type', value: 'A+' },
    { icon: 'shield', tone: 'lavender', label: 'Insurance', value: 'Anthem', sub: 'PPO' },
  ] as ProfileTile[],
  care: [
    { icon: 'stethoscope', tone: 'lavender', label: 'Primary Care Provider', value: 'Dr. Sarah Kim', sub: 'Internal Medicine' },
    { icon: 'people', tone: 'coral', label: 'Care Team', value: '3 providers', sub: 'PCP · OB/GYN · Dermatologist' },
  ] as ProfileTile[],
  score: 78,
  overview: [
    { label: 'Prevention', done: 3, total: 4, tone: 'indigo' },
    { label: 'Monitoring', done: 5, total: 7, tone: 'mint' },
    { label: 'Action', done: 3, total: 6, tone: 'coral' },
  ] as { label: string; done: number; total: number; tone: Tone }[],
  records: [
    { icon: 'bandage', tone: 'coral', title: 'Conditions & Injuries', lines: ['2 conditions', '1 past injury'], screen: 'symptoms' },
    { icon: 'flower', tone: 'lavender', title: 'Allergies & Intolerances', lines: ['3 allergies', '1 intolerance'] },
    { icon: 'pill', tone: 'mint', title: 'Medications & Supplements', lines: ['4 active', '2 supplements'], screen: 'medications' },
    { icon: 'syringe', tone: 'indigo', title: 'Vaccinations', lines: ['Up to date', 'Last: Oct 2023'] },
    { icon: 'hourglass', tone: 'coral', title: 'Genetics', lines: ['1 report', 'View insights'] },
    { icon: 'leaf', tone: 'mint', title: 'Lifestyle & Habits', lines: ['Sleep, nutrition, activity, stress, and more'], screen: 'sleep' },
  ] as { icon: IconName; tone: Tone; title: string; lines: string[]; screen?: Screen }[],
  biomarkers: [
    { value: '72', label: 'Resting HR', unit: 'bpm', change: '↓ 6%', tone: 'text', trend: [76, 75, 77, 74, 73, 74, 72] },
    { value: '54', label: 'HRV', unit: 'ms', change: '↑ 12%', tone: 'text', trend: [46, 48, 47, 50, 52, 51, 54] },
    { value: '36.6', label: 'Body Temp', unit: '°C', change: '→ 0%', tone: 'lavender', trend: [36.5, 36.6, 36.5, 36.7, 36.6, 36.6, 36.6] },
    { value: '98', label: 'SpO₂', unit: '%', change: '→ 0%', tone: 'text', trend: [97, 98, 97, 98, 98, 99, 98] },
  ] as { value: string; label: string; unit: string; change: string; tone: Tone; trend: number[] }[],
  bodySystems: [
    { label: 'Heart Health', icon: 'heart', tone: 'coral' },
    { label: 'Kidney Function', icon: 'kidney', tone: 'coral' },
    { label: 'Liver & Pancreas', icon: 'liver', tone: 'coral' },
    { label: 'Digestive & Gut Health', icon: 'gut', tone: 'mint' },
    { label: 'Metabolic Health', icon: 'molecule', tone: 'lavender' },
    { label: 'Reproductive Health', icon: 'uterus', tone: 'coral' },
    { label: 'Bones & Muscles', icon: 'bone', tone: 'text' },
    { label: 'Immune Regulation', icon: 'shield', tone: 'lavender' },
    { label: 'Blood Function', icon: 'drop', tone: 'coral' },
    { label: 'Nutrients', icon: 'leaf', tone: 'mint' },
    { label: 'Thyroid Function', icon: 'thyroid', tone: 'indigo' },
    { label: 'Autoimmune Health', icon: 'sun', tone: 'lavender' },
    { label: 'Infectious Diseases', icon: 'virus', tone: 'coral' },
    { label: 'Substance Levels', icon: 'flask', tone: 'coral' },
    { label: 'Other Panels', icon: 'panels', tone: 'text' },
  ] as { label: string; icon: IconName; tone: Tone }[],
};
