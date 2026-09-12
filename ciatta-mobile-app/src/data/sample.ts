import type { Screen } from '../navigation';

// A made up person to build the UI against before the schema exists. Maya is
// invented and every figure matches the Figma Make reference screens. Swap
// these out screen by screen once the data layer lands.

export const person = {
  firstName: 'Maya',
  fullName: 'Maya Adeyemi',
  initial: 'M',
  email: 'maya@example.com',
  age: 41,
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
  { label: 'Age', value: '41' },
  { label: 'Life stage', value: 'Perimenopause, in your words' },
  { label: 'Cycle', value: 'Usually 26 to 30 days' },
  { label: 'Conditions', value: 'None added' },
];
