// The lists behind Health Details: what she can pick from in one tap, in
// plain names. Anything not here she types; these are the common ones, not
// a closed set.

import type { IconName } from '../ui/icons';

export const DETAIL_KINDS = ['conditions', 'allergies', 'medications', 'vaccinations', 'genetics', 'lifestyle'] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

const SUPPLEMENTS = [
  'Iron',
  'Vitamin D',
  'Vitamin B12',
  'Folic acid',
  'Magnesium',
  'Omega 3',
  'Zinc',
  'Calcium',
  'Probiotic',
  'Melatonin',
  'Prenatal vitamin',
  'Inositol',
];

export const DETAILS: Record<DetailKind, { title: string; icon: IconName; search: string; options: string[] }> = {
  conditions: {
    title: 'Conditions & Injuries',
    icon: 'bandage',
    search: 'Search or add a condition or injury',
    options: [
      'Endometriosis', 'Adenomyosis', 'PCOS', 'Uterine fibroids', 'Hypothyroidism', 'Hyperthyroidism', "Hashimoto's",
      'Iron deficiency anaemia', 'Migraine', 'IBS', "Crohn's disease", 'Ulcerative colitis', 'Coeliac disease', 'Asthma',
      'Type 1 diabetes', 'Type 2 diabetes', 'Prediabetes', 'High blood pressure', 'High cholesterol', 'Depression', 'Anxiety',
      'ADHD', 'Eczema', 'Psoriasis', 'Lupus', 'Rheumatoid arthritis', 'Fibromyalgia', 'ME or CFS', 'Interstitial cystitis',
      'Vulvodynia', 'Osteoporosis', 'Back injury', 'Knee injury', 'Concussion', 'Fracture',
    ],
  },
  allergies: {
    title: 'Allergies & Intolerances',
    icon: 'flower',
    search: 'Search or add an allergy or intolerance',
    options: [
      'Penicillin', 'Sulfa drugs', 'NSAIDs', 'Aspirin', 'Codeine', 'Latex', 'Peanuts', 'Tree nuts', 'Shellfish', 'Fish',
      'Eggs', 'Milk', 'Soy', 'Wheat', 'Sesame', 'Gluten intolerance', 'Lactose intolerance', 'Pollen', 'Dust mites',
      'Pet dander', 'Mould', 'Bee stings', 'Nickel', 'Iodine contrast',
    ],
  },
  medications: {
    title: 'Medications & Supplements',
    icon: 'pill',
    search: 'Search or add a medication or supplement',
    options: [
      'Levothyroxine', 'Metformin', 'Combined pill', 'Progestin only pill', 'Hormonal IUD', 'Copper IUD', 'Implant',
      'Dienogest', 'Norethindrone', 'Elagolix', 'Relugolix', 'Ibuprofen', 'Naproxen', 'Paracetamol', 'Tranexamic acid',
      'Sertraline', 'Escitalopram', 'Fluoxetine', 'Bupropion', 'Spironolactone', 'Inhaler', ...SUPPLEMENTS,
    ],
  },
  vaccinations: {
    title: 'Vaccinations',
    icon: 'syringe',
    search: 'Search or add a vaccination',
    options: [
      'Influenza', 'COVID 19', 'HPV', 'Hepatitis A', 'Hepatitis B', 'Tetanus, diphtheria, pertussis', 'MMR', 'Varicella',
      'Shingles', 'Pneumococcal', 'Meningococcal', 'RSV', 'Typhoid', 'Yellow fever', 'Rabies',
    ],
  },
  genetics: {
    title: 'Genetics',
    icon: 'hourglass',
    search: 'Search or add a result or family history',
    options: [
      'BRCA1', 'BRCA2', 'Lynch syndrome', 'MTHFR variant', 'Factor V Leiden', 'APOE4', 'Haemochromatosis', 'Cystic fibrosis carrier',
      'Sickle cell trait', 'Thalassaemia trait', 'Family history of breast cancer', 'Family history of ovarian cancer',
      'Family history of heart disease', 'Family history of diabetes', 'Family history of endometriosis', 'Family history of thyroid disease',
    ],
  },
  lifestyle: {
    title: 'Lifestyle & Habits',
    icon: 'leaf',
    search: 'Search or add a habit',
    options: [
      'Never smoked', 'Former smoker', 'Smoker', 'Vapes', 'Rarely drinks', 'Drinks weekly', 'Drinks daily', 'Caffeine daily',
      'Vegetarian', 'Vegan', 'Gluten free', 'Exercises regularly', 'Mostly sedentary', 'Night shifts', 'High stress',
      'Meditates', 'Sleeps under 7 hours',
    ],
  },
};

const SUPPLEMENT_SET = new Set(SUPPLEMENTS.map((s) => s.toLowerCase()));
export const isSupplement = (name: string) => SUPPLEMENT_SET.has(name.trim().toLowerCase());

// What a Health Details row says about its list.
export function detailSummary(items: readonly string[]): string {
  if (!items.length) return 'None added';
  if (items.length <= 2) return items.join(', ');
  return `${items.slice(0, 2).join(', ')} and ${items.length - 2} more`;
}
