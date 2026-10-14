// What she can log, by what it is about.
//
// Logging was split by screen: a Cycle questionnaire, a Daily Log, a
// journal, each with its own copy of some of the same things. These are
// the subjects instead, each with the chips worth one tap and the
// example sentence that teaches the rest. Where each one is stored is
// decided in lib/quickLog.ts, not here: this file only names things.

import type { EntryKind } from '../data/sample';
import type { Screen } from '../navigation';
import { DIGESTION_FLAGS } from './dailyLog';

export type CategoryKey = 'cycle' | 'symptoms' | 'nutrition' | 'gut' | 'body' | 'mind' | 'skin' | 'sexual' | 'meds' | 'supplements' | 'context' | 'note';

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
  // Every symptom, in one place on the Log screen, grouped below in
  // SYMPTOM_GROUPS. Each is filed under the category the rest of the app
  // reads it from (Body, Mind, Gut, Skin, Sexual and urinary), so the
  // Symptoms screen, the body systems and the agent all keep working.
  {
    key: 'symptoms',
    label: 'Symptoms',
    example: 'Headache since lunch, bloated, and more tired than usual',
    quick: [],
    detail: null,
    detailLabel: null,
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
    quick: [...DIGESTION_FLAGS, 'Appetite change', 'Food cravings', BOWEL],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'body',
    label: 'Body',
    example: 'Sore lower back and hot flashes all evening',
    quick: [
      'Pain', 'Pelvic pain', 'Lower back pain', 'Joint pain', 'Muscle aches', 'Breast tenderness', 'Swelling',
      'Fatigue', 'Insomnia', 'Waking at night', 'Daytime sleepiness', 'Hot flashes', 'Night sweats', 'Chills',
      'Palpitations', 'Racing heart', 'Shortness of breath', 'Dizziness',
    ],
    detail: null,
    detailLabel: null,
    journalKind: 'Symptoms',
  },
  {
    key: 'mind',
    label: 'Mind',
    example: 'Foggy all afternoon, could not focus, a bit anxious',
    quick: [
      'Brain fog', 'Memory lapses', 'Hard to focus', 'Headache', 'Migraine',
      'Tingling or numbness', 'Low mood', 'Anxiety', 'Irritability', 'Mood swings', 'Tearful',
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
  // Medicines and supplements are kept apart: what a clinician prescribed
  // and what she chose to take are different facts. Her own, from her
  // profile, are offered as chips beside these on the Log screen.
  {
    key: 'meds',
    label: 'Medications',
    example: 'Took my levothyroxine late, and a headache from the new pill',
    quick: ['Took medication', 'Missed a dose', 'Started a new medication', 'Stopped a medication', 'Side effect'],
    detail: null,
    detailLabel: null,
    journalKind: 'Context',
  },
  {
    key: 'supplements',
    label: 'Supplements',
    example: 'Took magnesium at night, forgot my vitamin D',
    quick: ['Took supplement', 'Skipped a supplement', 'Started a new supplement', 'Stopped a supplement'],
    detail: null,
    detailLabel: null,
    journalKind: 'Context',
  },
  {
    key: 'context',
    label: 'Context',
    example: 'Slept badly, long flight, took ibuprofen at noon',
    quick: ['Slept badly', 'Slept well', 'Exercised', 'Stressful event', 'Travel', 'Sex', 'Illness', 'Damp or mould at home'],
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

// The tabs along the top of the Log screen. Body, Mind, Skin and hair, and
// Sexual and urinary are under Symptoms now; they remain categories, because
// that is where each symptom is filed and read from.
export const LOG_TABS: CategoryKey[] = ['cycle', 'symptoms', 'gut', 'nutrition', 'meds', 'supplements', 'context', 'note'];

// The symptoms worth logging, grouped as she would look for them, each
// group saying what Ciatta reads it against: her wearables, her labs, her
// cycle and her medications. That is what makes a logged symptom worth more
// than a note: it can be set beside something measured.
export type SymptomGroup = { label: string; category: CategoryKey; items: string[]; feeds: string[] };
export const SYMPTOM_GROUPS: SymptomGroup[] = [
  {
    label: 'Pain',
    category: 'body',
    items: ['Pain', 'Pelvic pain', 'Lower back pain', 'Joint pain', 'Muscle aches', 'Breast tenderness', 'Swelling'],
    feeds: ['Cycle phase', 'Sleep', 'HRV', 'Medications'],
  },
  {
    label: 'Energy and sleep',
    category: 'body',
    items: ['Fatigue', 'Insomnia', 'Waking at night', 'Daytime sleepiness'],
    feeds: ['Sleep', 'HRV', 'Resting heart rate', 'Iron and thyroid labs'],
  },
  {
    label: 'Temperature',
    category: 'body',
    items: ['Hot flashes', 'Night sweats', 'Chills'],
    feeds: ['Skin temperature', 'Sleep', 'Cycle phase', 'Hormone labs'],
  },
  {
    label: 'Heart and breathing',
    category: 'body',
    items: ['Palpitations', 'Racing heart', 'Shortness of breath', 'Dizziness'],
    feeds: ['Heart rate', 'HRV', 'Blood pressure', 'Blood oxygen', 'Iron labs'],
  },
  {
    label: 'Gut',
    category: 'gut',
    items: [...DIGESTION_FLAGS, 'Appetite change', 'Food cravings'],
    feeds: ['Bowel type', 'Meals and foods', 'Cycle phase', 'Medications'],
  },
  {
    label: 'Head and mind',
    category: 'mind',
    items: ['Headache', 'Migraine', 'Brain fog', 'Hard to focus', 'Memory lapses', 'Tingling or numbness'],
    feeds: ['Sleep', 'HRV', 'Blood pressure', 'Cycle phase', 'Medications'],
  },
  {
    label: 'Mood',
    category: 'mind',
    items: ['Low mood', 'Anxiety', 'Irritability', 'Mood swings', 'Tearful'],
    feeds: ['Sleep', 'HRV', 'Cycle phase', 'The stress you log'],
  },
  {
    label: 'Skin and hair',
    category: 'skin',
    items: ['Acne', 'Oily skin', 'Dry skin', 'Hair shedding', 'Unwanted hair growth', 'Dark patches', 'Itching'],
    feeds: ['Thyroid, iron and hormone labs', 'Cycle phase'],
  },
  {
    label: 'Urinary and sexual',
    category: 'sexual',
    items: [
      'Pain with sex', 'Low libido', 'Vaginal dryness', 'Discharge change', 'Urinary urgency', 'Leaking',
      'Burning when peeing', 'Bleeding after sex',
    ],
    feeds: ['Cycle phase', 'Kidney and urine labs'],
  },
];

// Where a symptom is filed: the category its group belongs to.
export function symptomCategory(item: string): CategoryKey {
  return SYMPTOM_GROUPS.find((g) => g.items.includes(item))?.category ?? 'body';
}

export const category = (key: CategoryKey): LogCategory => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

// Where a bowel movement is described in full: the cycle questionnaire's
// bowel step (stool type, pain, blood and the rest), opened on a draft that
// already says what this is. The chip alone records that it happened; the
// scale is what a clinician reads, so it is one tap further, never lost.
export function bowelDetail(items: readonly string[]): { label: string; draft: { form: { kinds: string[] } } } | null {
  if (!items.includes(BOWEL)) return null;
  return { label: 'Describe the bowel movement', draft: { form: { kinds: [BOWEL] } } };
}
