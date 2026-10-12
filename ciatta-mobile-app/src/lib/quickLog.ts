// Logging in one sentence.
//
// There were two logging experiences and they disagreed. The plus opened a
// menu of three screens; one of them was a fifteen step questionnaire that
// led with "What happened?" and a wall of chips, and the box she actually
// writes in sat at the bottom of every step. So the fastest way to record
// a period was: plus, pick a screen, pick chips, next, next, next, review,
// save. For a thing she wants to log in four seconds, standing up.
//
// This inverts it. The box leads. A tab says which part of her record the
// sentence belongs to, the placeholder shows what a sentence looks like,
// and send saves it. The questionnaire is still there, behind one link,
// for the episode worth describing properly.
//
// What this module does is read that sentence for the vocabulary the rest
// of the app already uses, so a quick log is a real entry rather than a
// loose string. Two rules hold it honest:
//
//   Only words that are present. Every cue below matches something she
//   actually wrote. Nothing is inferred from absence, from the date, or
//   from anything a device reported.
//
//   Everything found is shown back to her before she sends. The screen
//   prints what was recognised, so nothing is stored that she did not see
//   stored. That is why these are reported, never measured.

import { readNote } from './readNote';

export type QuickTab = 'cycle' | 'day' | 'note';

// Which part of her record a sentence lands in, the example that shows her
// what to write, and the full screen for the entry worth more than a line.
export const QUICK_TABS: {
  key: QuickTab;
  label: string;
  // The placeholder. A real sentence, because "describe your symptoms"
  // teaches nothing and an example teaches the whole grammar at once.
  example: string;
  detail: string;
  detailLabel: string;
}[] = [
  {
    key: 'cycle',
    label: 'Cycle',
    example: 'Period started yesterday, heavy, cramping since the morning',
    detail: 'cycleLog',
    detailLabel: 'Describe it step by step',
  },
  {
    key: 'day',
    label: 'Day',
    example: 'Porridge and two coffees, bloated after lunch',
    detail: 'dailyLog',
    detailLabel: 'Log food, gut, and how it felt',
  },
  {
    key: 'note',
    label: 'Note',
    example: 'Foggy all afternoon, slept badly again',
    detail: 'journal',
    detailLabel: 'Open your notes',
  },
];

export const quickTab = (key: QuickTab) => QUICK_TABS.find((t) => t.key === key) ?? QUICK_TABS[0];

// Cues for the kinds in WHAT_HAPPENED. Every one of these is a word she
// wrote, mapped to the label the record already uses for it, so a sentence
// becomes the same kind of entry the chips would have made.
//
// 'Other' is deliberately absent: it is a label for a thing she names
// herself, and guessing it from text would mean guessing.
const KIND_CUES: [RegExp, string][] = [
  [/\b(period|menstruat\w*|bleeding|bled)\b/i, 'Period'],
  [/\bspott?ing\b/i, 'Spotting'],
  [/\b(pain|painful|cramp\w*|ache|aching|aches|sore|hurts?|hurting)\b/i, 'Pain'],
  [/\b(nausea|nauseous|headache|migraine|bloat\w*|dizzy|dizziness|fatigue|exhausted|tender|discharge|spotty|moody|irritable|foggy)\b/i, 'Symptoms'],
  [/\b(stool|poop|pooped|bowel|diarrh\w*|constipat\w*)\b/i, 'Bowel movement'],
];

// The kinds her words name, in the order the record lists them.
export function readKinds(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const [cue, label] of KIND_CUES) {
    if (cue.test(text) && !found.includes(label)) found.push(label);
  }
  return found;
}

// Flow, but only when she said it in those words. A period with no adjective
// has no flow, and 'Moderate' is not a safe default: it would be Ciatta
// filling in a value and calling it hers.
const FLOW_CUES: [RegExp, string][] = [
  [/\bvery heavy\b/i, 'Very heavy'],
  [/\b(heavy|heavier|flooding)\b/i, 'Heavy'],
  [/\b(light|lighter|barely)\b/i, 'Light'],
  [/\bmoderate\b/i, 'Moderate'],
  [/\b(variable|on and off)\b/i, 'Variable'],
];

export function readFlow(text: string): string | null {
  if (!text.trim()) return null;
  for (const [cue, label] of FLOW_CUES) {
    if (cue.test(text)) return label;
  }
  return null;
}

// Yesterday, or a count of days, when she said so. Anything vaguer than
// this stays today, because the sentence is what it is: a log written now.
export function readDaysAgo(text: string): number {
  if (/\byesterday\b/i.test(text)) return 1;
  const named = /\b(\d{1,2}) days? ago\b/i.exec(text);
  if (named) {
    const n = Number(named[1]);
    if (Number.isFinite(n) && n > 0 && n <= 60) return n;
  }
  if (/\blast week\b/i.test(text)) return 7;
  return 0;
}

export type QuickReading = {
  kinds: string[];
  context: string[];
  flow: string | null;
  daysAgo: number;
};

export function readQuick(text: string): QuickReading {
  return { kinds: readKinds(text), context: readNote(text), flow: readFlow(text), daysAgo: readDaysAgo(text) };
}

// What was recognised, for the line printed under the box. Null when there
// is nothing to show, so no empty label is drawn, and the sentence still
// saves: words Ciatta did not recognise are kept verbatim, not dropped.
export function readingLine(r: QuickReading): string | null {
  const parts = [...r.kinds, ...r.context.filter((c) => !r.kinds.includes(c))];
  if (r.flow) parts.push(`${r.flow} flow`);
  if (r.daysAgo === 1) parts.push('yesterday');
  else if (r.daysAgo > 1) parts.push(`${r.daysAgo} days ago`);
  return parts.length ? parts.join(', ') : null;
}
