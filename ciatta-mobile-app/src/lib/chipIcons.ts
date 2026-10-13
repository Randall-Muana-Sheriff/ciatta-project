// A picture for each quick chip on the Log screen, so a row of chips reads
// at a glance before a word is read. Drawn from the app's own line icons.
// A chip it does not know, like her own medicine by name, takes its
// category's picture.

import type { IconName } from '../ui/icons';
import type { CategoryKey } from './logCategories';

const CHIP: Record<string, IconName> = {
  // Cycle
  Period: 'drop',
  Spotting: 'drop',
  // Nutrition
  Caffeine: 'cup',
  Alcohol: 'glass',
  'Skipped a meal': 'utensils',
  'Ate late': 'clock',
  // Gut
  Bloating: 'bubbles',
  Cramping: 'wave',
  Nausea: 'wave',
  Reflux: 'flame',
  Gas: 'bubbles',
  Constipation: 'gut',
  Loose: 'drop',
  'Bowel movement': 'toilet',
  // Body
  Pain: 'bandage',
  'Breast tenderness': 'body',
  'Hot flashes': 'sun',
  'Night sweats': 'moon',
  Fatigue: 'sleep',
  Chills: 'thermometer',
  Swelling: 'drop',
  'Joint pain': 'bone',
  // Mind
  'Brain fog': 'cloud',
  'Memory lapses': 'brain',
  'Hard to focus': 'target',
  Headache: 'brain',
  Migraine: 'triangle',
  Dizziness: 'wave',
  'Tingling or numbness': 'sparkle',
  'Low mood': 'cloud',
  Anxiety: 'zigzag',
  Irritability: 'flame',
  'Mood swings': 'wave',
  // Skin and hair
  Acne: 'sparkle',
  'Oily skin': 'drop',
  'Dry skin': 'leaf',
  'Hair shedding': 'leaf',
  'Unwanted hair growth': 'leaf',
  'Dark patches': 'sun',
  Itching: 'sparkle',
  // Sexual and urinary
  'Pain with sex': 'uterus',
  'Low libido': 'heart',
  'Vaginal dryness': 'uterus',
  'Discharge change': 'uterus',
  'Urinary urgency': 'kidney',
  Leaking: 'kidney',
  'Burning when peeing': 'kidney',
  'Bleeding after sex': 'drop',
  // Medications and supplements
  'Took medication': 'pill',
  'Missed a dose': 'pill',
  'Started a new medication': 'pill',
  'Stopped a medication': 'pill',
  'Side effect': 'triangle',
  'Took supplement': 'molecule',
  'Skipped a supplement': 'molecule',
  'Started a new supplement': 'molecule',
  'Stopped a supplement': 'molecule',
  // Context
  'Slept badly': 'sleep',
  'Slept well': 'sleep',
  Exercised: 'dumbbell',
  'Stressful event': 'zigzag',
  Travel: 'plane',
  Sex: 'heart',
  Illness: 'virus',
  'Damp or mould at home': 'home',
};

const CATEGORY: Record<CategoryKey, IconName> = {
  cycle: 'drop',
  nutrition: 'utensils',
  gut: 'gut',
  body: 'body',
  mind: 'brain',
  skin: 'sparkle',
  sexual: 'uterus',
  meds: 'pill',
  supplements: 'molecule',
  context: 'calendar',
  note: 'notebook',
};

export function chipIcon(chip: string, category: CategoryKey, strict = false): IconName | null {
  return CHIP[chip] ?? (strict ? null : CATEGORY[category]);
}
