// What she can log, by what it is about.
//
// Logging was split by screen: a Cycle questionnaire, a Daily Log, a
// journal, each with its own copy of some of the same things. These are
// the eight subjects instead, each with the chips worth one tap and the
// example sentence that teaches the rest. Where each one is stored is
// decided in lib/quickLog.ts, not here: this file only names things.

import type { EntryKind } from '../data/sample';
import type { Screen } from '../navigation';
import { DIGESTION_FLAGS } from './dailyLog';

export type CategoryKey = 'cycle' | 'nutrition' | 'gut' | 'body' | 'mind' | 'skin' | 'sexual' | 'context' | 'note';

export type LogCategory = {
  key: CategoryKey;
  label: string;
  // The placeholder: a real sentence, because an example teaches the
  // grammar at once and "describe your symptoms" teaches nothing.
  example: string;
  // One tap each. Multi select.
  quick: readonly string[];
  // The full form, for the entry worth more than a line, where one exists.
  detail: Screen | null;
  detailLabel: string | null;
  // The journal_entries.kind this category files under when it becomes a
  // journal entry. The table only allows these three.
  journalKind: EntryKind;
};

// The episode kind the body map, cycle patterns and cycle lens already
// read. Logged under Gut, stored as an episode.
export const BOWEL = 'Bowel movement';

export const CATEGORIES: readonly LogCategory[] = [
  {
    key: 'cycle',
    label: 'Cycle',
    example: 'Period started yesterday, heavy, cramping since the morning',
    quick: ['Period', 'Spotting'],
    detail: 'cycleLog',
    detailLabel: 'Describe it step by step',
    journalKind: 'Symptoms',
  },
  // Nutrition and Gut were one category and are two different things:
  // what she ate and drank, against any goals she set, and how her gut was.
  {
    key: 'nutrition',
    label: 'Nutrition',
    example: 'Porridge and two coffees, skipped lunch',
    quick: ['Caffeine', 'Alcohol', 'Skipped a meal', 'Ate late'],
    detail: 'dailyLog',
    detailLabel: 'Log food and drinks',
    journalKind: 'Context',
  },
  {
    key: 'gut',
    label: 'Gut',
    example: 'Bloated after lunch, and a loose stool this morning',
    quick: [...DIGESTION_FLAGS, BOWEL],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'body',
    label: 'Body',
    example: 'Sore lower back and hot flashes all evening',
    quick: ['Pain', 'Breast tenderness', 'Hot flashes', 'Night sweats', 'Fatigue', 'Chills', 'Swelling', 'Joint pain'],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'mind',
    label: 'Mind',
    example: 'Foggy all afternoon, could not focus, a bit anxious',
    quick: [
      'Brain fog', 'Memory lapses', 'Hard to focus', 'Headache', 'Migraine', 'Dizziness',
      'Tingling or numbness', 'Low mood', 'Anxiety', 'Irritability', 'Mood swings',
    ],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'skin',
    label: 'Skin and hair',
    example: 'Breakout on my chin, more hair in the brush than usual',
    quick: ['Acne', 'Oily skin', 'Dry skin', 'Hair shedding', 'Unwanted hair growth', 'Dark patches', 'Itching'],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'sexual',
    label: 'Sexual and urinary',
    example: 'Some pain with sex, and needing to pee more often',
    quick: [
      'Pain with sex', 'Low libido', 'Vaginal dryness', 'Discharge change', 'Urinary urgency', 'Leaking',
      'Burning when peeing', 'Bleeding after sex',
    ],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'context',
    label: 'Context',
    example: 'Slept badly, long flight, took ibuprofen at noon',
    quick: ['Slept badly', 'Slept well', 'Exercised', 'Stressful event', 'Travel', 'Took medication', 'Took supplement', 'Sex', 'Illness'],
    detail: null,
    detailLabel: null,
    journalKind: 'Context',
  },
  {
    key: 'note',
    label: 'Note',
    example: 'Anything at all, in your own words',
    quick: [],
    detail: 'journal',
    detailLabel: 'Open your notes',
    journalKind: 'Notes',
  },
];

export const category = (key: CategoryKey): LogCategory => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

// Where a bowel movement is described in full: the cycle questionnaire's
// bowel step (stool type, pain, blood and the rest), opened on a draft that
// already says what this is. The chip alone records that it happened; the
// scale is what a clinician reads, so it is one tap further, never lost.
export function bowelDetail(items: readonly string[]): { label: string; draft: { form: { kinds: string[] } } } | null {
  if (!items.includes(BOWEL)) return null;
  return { label: 'Describe the bowel movement', draft: { form: { kinds: [BOWEL] } } };
}
