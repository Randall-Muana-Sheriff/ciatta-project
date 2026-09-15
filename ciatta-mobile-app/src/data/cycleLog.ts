import { readNote } from '../lib/readNote';
import { cycle } from './sample';

// The Cycle experience: what someone logs about bleeding, pain, symptoms and
// the context around them. Everything here is what the person reported.
// Nothing is a diagnosis, and a flare up is only ever their own designation.

// ── Options ────────────────────────────────────────────────────

export const WHAT_HAPPENED = ['Period', 'Spotting', 'Pain', 'Symptoms', 'Other'] as const;
export const FLOW = ['Light', 'Moderate', 'Heavy', 'Very heavy', 'Variable', 'Not sure'] as const;
export const TIMING_STATES = ['Still happening', 'Started during the night', 'Comes and goes'] as const;
export const PAIN_PATTERN = ['Constant', 'Comes and goes', 'Comes in waves', 'Sudden episodes'] as const;

export const LOCATION_GROUPS = [
  { group: 'Pelvis', items: ['Pelvis', 'Lower pelvis', 'Left pelvis', 'Right pelvis'] },
  { group: 'Abdomen', items: ['Lower abdomen', 'Upper abdomen', 'Left abdomen', 'Right abdomen', 'Center abdomen'] },
  { group: 'Back', items: ['Lower back', 'Middle back', 'Upper back'] },
  { group: 'Hips and buttocks', items: ['Left hip', 'Right hip', 'Buttocks'] },
  { group: 'Legs', items: ['Left leg', 'Right leg', 'Both legs'] },
  { group: 'Upper body', items: ['Chest', 'Left shoulder', 'Right shoulder'] },
  { group: 'General', items: ['Whole body', 'Other'] },
] as const;

export const SENSATIONS = [
  'Sharp', 'Stabbing', 'Cramping', 'Burning', 'Shooting', 'Aching', 'Pulling', 'Dull', 'Throbbing',
  'Pressure', 'Tight', 'Heavy', 'Tender', 'Electric', 'Tingling', 'Numb', 'Other',
] as const;

// How much it affected someone, kept apart from the 0 to 10 intensity.
export const AFFECT = [
  'Manageable', 'Uncomfortable', 'Disruptive', 'Very disruptive', 'Could not do normal activities',
  'Could not work', 'Could not sleep', 'Needed help from someone',
] as const;

export const TRAJECTORY = [
  'Sudden pain spike', 'Started suddenly', 'Gradual worsening', 'Ongoing worsening', 'Stayed about the same',
  'Came and went', 'Came in waves', 'Gradually improved', 'Suddenly improved', 'Returned after improving',
] as const;

export const CHANGES = [
  'Pain became stronger', 'Pain became more frequent', 'Pain spread to another area', 'Pain changed location',
  'Pain changed sensation', 'New symptom appeared', 'Bleeding changed', 'Could not move normally',
  'Could not sleep', 'Energy dropped', 'Mood changed', 'Nothing changed', 'Other',
] as const;

export const DAY_IMPACT = [
  'Could not stand', 'Could not walk normally', 'Could not sit comfortably', 'Could not work', 'Missed work',
  'Changed plans', 'Stopped exercising', 'Could not sleep', 'Needed help', 'Needed medication',
  'Needed more medication than usual', 'Vomited', 'Fainted or passed out', 'Contacted a clinician',
  'Went to urgent care', 'Went to the ER', 'Nothing', 'Other',
] as const;

// Selections that bring up the care note on the impact step.
export const ACUTE = ['Fainted or passed out', 'Went to the ER', 'Went to urgent care', 'Needed help', 'Could not stand', 'Vomited'];

export const CONTEXT = [
  'Period', 'Before period', 'After period', 'Ovulation', 'Stress', 'Poor sleep', 'Travel', 'Physical activity',
  'Food', 'Alcohol', 'Sex', 'Illness', 'Medication change', 'Supplement change', 'Treatment', 'Major life event',
  'No obvious trigger', 'Other',
] as const;

export const SYMPTOMS = [
  'Fatigue', 'Bloating', 'Sleep disruption', 'Nausea', 'Headache', 'Mood changes', 'Breast tenderness',
  'Digestive changes', 'Dizziness', 'Other',
] as const;

export const HELPED = [
  'Rest', 'Heat', 'Medication', 'More medication than usual', 'Movement', 'Sleep', 'Food', 'Hydration',
  'Bathroom', 'Stretching', 'Treatment', 'Nothing', 'Other',
] as const;

export const HELPED_AMOUNT = ['Not at all', 'A little', 'Somewhat', 'A lot', 'Completely'] as const;

// ── Records ────────────────────────────────────────────────────

// What the logging flow edits. Days are counted back from today; times are
// hours from midnight, and null means the person wasn't sure.
export type EpisodeForm = {
  kinds: string[];
  periodStart: number;
  periodEnd: number | null;
  flow: string | null;
  day: number;
  allDay: boolean;
  start: number | null;
  end: number | null;
  states: string[];
  pattern: string | null;
  locations: string[];
  sensations: string[];
  severity: number | null;
  affect: string[];
  trajectory: string[];
  changes: string[];
  dayImpact: string[];
  symptoms: string[];
  context: string[];
  triggers: string[];
  flare: boolean | null;
  helped: string[];
  helpedAmount: string | null;
  note: string;
};

// A saved episode. `flareUpUserReported` is the person's own designation and
// is never turned into a condition. `triggers` holds only the context items
// the person said they think triggered it; the rest of `context` is things
// that happened around the same time.
export type Episode = Omit<EpisodeForm, 'day' | 'periodStart' | 'periodEnd' | 'flare'> & {
  id: string;
  loggedAt: string;
  date: string;
  periodStart: string | null;
  periodEnd: string | null;
  flareUpUserReported: boolean | null;
  noteContext: string[];
  similar: boolean;
};

export function emptyForm(): EpisodeForm {
  return {
    kinds: [], periodStart: 0, periodEnd: null, flow: null, day: 0, allDay: false, start: null, end: null,
    states: [], pattern: null, locations: [], sensations: [], severity: null, affect: [], trajectory: [],
    changes: [], dayImpact: [], symptoms: [], context: [], triggers: [], flare: null, helped: [],
    helpedAmount: null, note: '',
  };
}

// ── Dates ──────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function dayLabel(iso: string, now = new Date()): string {
  const ago = daysBetween(parseDay(iso), now);
  return ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : shortDate(parseDay(iso));
}

export const dayAgoLabel = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`);

export function fmtHour(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

// ── Cycles ─────────────────────────────────────────────────────

export const TYPICAL_LENGTH = 27;
// Completed cycle lengths, oldest first, from the sample record.
const PAST_LENGTHS = [29, 28, 27, 26];

// Start of each cycle, oldest first. The last one is the current cycle.
export function cycleStartDates(now = new Date()): Date[] {
  const starts = [addDays(startOfDay(now), -(cycle.day - 1))];
  for (const len of [...PAST_LENGTHS].reverse()) starts.unshift(addDays(starts[0], -len));
  return starts;
}

// ── Saving and summarising ─────────────────────────────────────

export function formToEpisode(form: EpisodeForm, similar: boolean, now = new Date()): Episode {
  const { day, periodStart, periodEnd, flare, ...rest } = form;
  const today = startOfDay(now);
  const bleeding = form.kinds.includes('Period') || form.kinds.includes('Spotting');
  const startAgo = form.kinds.includes('Pain') || !bleeding ? day : periodStart;
  return {
    ...rest,
    triggers: form.triggers.filter((t) => form.context.includes(t)),
    id: `ep-${now.getTime()}`,
    loggedAt: now.toISOString(),
    date: isoDay(addDays(today, -startAgo)),
    periodStart: bleeding ? isoDay(addDays(today, -periodStart)) : null,
    periodEnd: bleeding && periodEnd != null ? isoDay(addDays(today, -periodEnd)) : null,
    flareUpUserReported: flare,
    noteContext: readNote(form.note),
    similar,
  };
}

export type SummarySection = { label: string; lines: string[] };

export function episodeTitle(ep: Pick<Episode, 'kinds'>): string {
  if (ep.kinds.includes('Pain')) return 'Pain Episode';
  if (ep.kinds.includes('Period')) return 'Period';
  if (ep.kinds.includes('Spotting')) return 'Spotting';
  if (ep.kinds.includes('Symptoms')) return 'Symptoms';
  return 'Cycle Experience';
}

function timeLine(ep: Episode): string | null {
  if (ep.allDay) return 'All day';
  if (ep.start != null && ep.end != null) return `${fmtHour(ep.start)} to ${fmtHour(ep.end)}`;
  if (ep.start != null) return `From ${fmtHour(ep.start)}`;
  if (ep.end != null) return `Until ${fmtHour(ep.end)}`;
  return null;
}

// The review shown before saving, and the same record read back later.
export function summarize(ep: Episode, now = new Date()): SummarySection[] {
  const pain = ep.kinds.includes('Pain');
  const time = timeLine(ep);
  const sections: SummarySection[] = [
    {
      label: 'When',
      lines: pain || !ep.periodStart
        ? [dayLabel(ep.date, now), ...(time ? [time] : []), ...ep.states, ...(ep.pattern ? [`Pattern: ${ep.pattern}`] : [])]
        : [],
    },
    {
      label: ep.kinds.includes('Period') ? 'Period' : 'Spotting',
      lines: ep.periodStart
        ? [
            ep.periodEnd ? `${dayLabel(ep.periodStart, now)} to ${dayLabel(ep.periodEnd, now)}` : `Since ${dayLabel(ep.periodStart, now)}, still going`,
            ...(ep.flow ? [`Flow: ${ep.flow}`] : []),
          ]
        : [],
    },
    { label: 'Where', lines: ep.locations },
    { label: 'Felt like', lines: ep.sensations },
    { label: 'Severity', lines: ep.severity != null ? [`${ep.severity} of 10`] : [] },
    { label: 'Impact', lines: [...ep.affect, ...ep.dayImpact] },
    { label: 'Pain changed', lines: ep.trajectory.length ? [ep.trajectory.join(' → ')] : [] },
    { label: 'What changed', lines: ep.changes },
    { label: 'Symptoms', lines: ep.symptoms },
    {
      label: 'Around the time',
      lines: [
        ...ep.context,
        ...(ep.triggers.length ? [`You think this may have triggered it: ${ep.triggers.join(', ')}`] : []),
      ],
    },
    {
      label: 'Flare up',
      lines: ep.flareUpUserReported == null ? [] : [ep.flareUpUserReported ? 'Yes, user reported' : 'No'],
    },
    {
      label: 'What helped',
      lines: ep.helped.length ? [...ep.helped, ...(ep.helpedAmount ? [`Helped: ${ep.helpedAmount.toLowerCase()}`] : [])] : [],
    },
    {
      label: 'In your words',
      lines: ep.note.trim()
        ? [`“${ep.note.trim()}”`, ...(ep.noteContext.length ? [`Noted: ${ep.noteContext.join(', ')}`] : [])]
        : [],
    },
  ];
  return sections.filter((s) => s.lines.length > 0);
}

// ── Sample record ──────────────────────────────────────────────

// Pain episodes across the last five cycles, built relative to today so the
// timeline always reaches the present. Durations lengthen and flare ups
// cluster with disrupted sleep, matching the Today insight.
type Seed = [
  cycle: number,
  day: number,
  start: number,
  end: number,
  severity: number,
  locations: string[],
  sensations: string[],
  affect: string[],
  context: string[],
  flare: boolean,
  helped: string[],
  helpedAmount: string | null,
  dayImpact?: string[],
  trajectory?: string[],
  symptoms?: string[],
];

const SEEDS: Seed[] = [
  [0, 0, 9, 11, 4, ['Pelvis', 'Lower abdomen'], ['Cramping'], ['Uncomfortable'], ['Period'], false, ['Heat'], 'Somewhat', ['Needed medication'], ['Came and went'], ['Fatigue']],
  [0, 1, 10, 13, 3, ['Lower abdomen'], ['Cramping', 'Aching'], ['Manageable'], ['Period'], false, ['Rest'], 'A little', [], ['Stayed about the same']],
  [1, -2, 14, 17, 4, ['Pelvis'], ['Cramping'], ['Uncomfortable'], ['Before period'], false, ['Heat'], 'Somewhat', [], ['Gradual worsening'], ['Bloating']],

  [1, 0, 8, 11, 5, ['Pelvis', 'Lower back'], ['Cramping', 'Aching'], ['Disruptive'], ['Period'], false, ['Medication'], 'A lot', ['Needed medication'], ['Came in waves']],
  [1, 1, 9, 12, 4, ['Pelvis'], ['Cramping'], ['Uncomfortable'], ['Period'], false, ['Heat'], 'Somewhat'],
  [2, -2, 15, 19, 5, ['Pelvis', 'Lower back'], ['Cramping', 'Sharp'], ['Disruptive'], ['Before period', 'Stress'], false, ['Medication'], 'Somewhat', ['Changed plans'], ['Gradual worsening'], ['Bloating']],
  [2, -1, 13, 16, 4, ['Pelvis'], ['Aching'], ['Uncomfortable'], ['Before period'], false, ['Rest'], 'A little'],

  [2, 0, 7, 12, 6, ['Pelvis', 'Lower back'], ['Cramping', 'Sharp'], ['Very disruptive'], ['Period', 'Poor sleep', 'Stress'], true, ['Medication', 'Heat'], 'Somewhat', ['Needed medication', 'Could not work'], ['Sudden pain spike', 'Ongoing worsening'], ['Fatigue', 'Sleep disruption']],
  [2, 1, 9, 13, 5, ['Pelvis'], ['Cramping'], ['Disruptive'], ['Period'], false, ['Heat'], 'Somewhat'],
  [3, -2, 12, 17, 6, ['Pelvis', 'Lower back'], ['Sharp', 'Shooting'], ['Disruptive'], ['Before period'], false, ['Medication'], 'A little', ['Stopped exercising'], ['Gradual worsening']],
  [3, -1, 14, 19, 5, ['Pelvis'], ['Cramping'], ['Disruptive'], ['Before period'], false, ['Rest'], 'A little'],

  [3, 0, 6, 13, 7, ['Pelvis', 'Lower back', 'Right hip'], ['Sharp', 'Cramping', 'Shooting'], ['Very disruptive'], ['Period', 'Poor sleep', 'Stress'], true, ['Medication', 'Heat'], 'Somewhat', ['Needed more medication than usual', 'Could not sit comfortably', 'Missed work'], ['Sudden pain spike', 'Ongoing worsening'], ['Fatigue', 'Sleep disruption', 'Bloating']],
  [3, 1, 8, 15, 7, ['Pelvis', 'Lower back'], ['Cramping'], ['Very disruptive', 'Could not sleep'], ['Period', 'Poor sleep'], false, ['Medication'], 'A little', ['Could not sleep']],
  [3, 2, 10, 16, 6, ['Pelvis'], ['Aching'], ['Disruptive'], ['After period'], false, ['Rest'], 'Somewhat'],
  [3, 3, 11, 17, 5, ['Lower back'], ['Dull'], ['Uncomfortable'], ['After period'], false, ['Stretching'], 'Somewhat'],
  [4, -3, 13, 19, 6, ['Pelvis', 'Right hip'], ['Sharp'], ['Disruptive'], ['Before period', 'Travel'], false, ['Rest'], 'A little'],
  [4, -2, 9, 17, 7, ['Pelvis', 'Lower back', 'Right hip'], ['Sharp', 'Cramping'], ['Could not do normal activities'], ['Before period', 'Poor sleep', 'Stress'], true, ['Medication', 'Heat'], 'A little', ['Could not stand', 'Needed medication'], ['Started suddenly', 'Came in waves'], ['Sleep disruption']],
  [4, -1, 10, 17, 6, ['Pelvis'], ['Cramping'], ['Very disruptive'], ['Before period'], false, ['Heat'], 'Somewhat'],

  [4, 0, 7, 14, 7, ['Pelvis', 'Lower back', 'Right hip'], ['Sharp', 'Cramping', 'Shooting'], ['Very disruptive'], ['Period', 'Poor sleep', 'Stress'], true, ['Heat', 'Medication'], 'Somewhat', ['Could not stand', 'Needed medication'], ['Sudden pain spike', 'Ongoing worsening'], ['Fatigue', 'Bloating', 'Sleep disruption']],
  [4, 1, 8, 15, 6, ['Pelvis', 'Lower abdomen'], ['Cramping'], ['Disruptive'], ['Period'], false, ['Heat'], 'Somewhat'],
  [4, 2, 10, 16, 5, ['Pelvis'], ['Aching'], ['Uncomfortable'], ['Period'], false, ['Rest'], 'Somewhat'],
  [4, 9, 13, 19, 6, ['Lower back', 'Right hip'], ['Aching', 'Pulling'], ['Disruptive'], ['Stress', 'Travel'], true, ['Stretching', 'Rest'], 'A little', ['Changed plans'], ['Gradual worsening'], ['Fatigue']],
];

export function sampleEpisodes(now = new Date()): Episode[] {
  const starts = cycleStartDates(now);
  return SEEDS.map(
    ([c, d, start, end, severity, locations, sensations, affect, context, flare, helped, helpedAmount, dayImpact = [], trajectory = [], symptoms = []], i) => {
      const date = addDays(starts[c], d);
      return {
        id: `sample-${i}`,
        loggedAt: date.toISOString(),
        date: isoDay(date),
        kinds: symptoms.length ? ['Pain', 'Symptoms'] : ['Pain'],
        periodStart: null,
        periodEnd: null,
        flow: null,
        allDay: false,
        start,
        end,
        states: [],
        pattern: null,
        locations,
        sensations,
        severity,
        affect,
        trajectory,
        changes: [],
        dayImpact,
        symptoms,
        context,
        triggers: [],
        flareUpUserReported: flare,
        helped,
        helpedAmount,
        note: '',
        noteContext: [],
        similar: false,
      };
    },
  );
}
