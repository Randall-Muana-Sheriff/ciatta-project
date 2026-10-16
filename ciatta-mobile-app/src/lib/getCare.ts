// Get care, on the Care page: five ways in, each a list of real choices,
// endometriosis first and then the whole body, and every choice a message
// to Ciatta. A symptom is said ("I am having pelvic pain."), so the chat
// offers to add it to her timeline; the rest are asked, and answered by
// the same capabilities the chat always uses.

import type { IconName } from '../ui/icons';
import { CONNECT_SYMPTOMS, REFILL } from './agent/connect';
import { SUGGEST_LABS } from './agent/labSuggest';

export type CareChoice = { label: string; ask: string };
export type CareGroup = { title: 'Endometriosis' | 'Whole body'; items: CareChoice[] };
export type GetCareItem = { key: string; label: string; icon: IconName; ask: string | null; opener: string | null; groups: CareGroup[] };

const symptom = (label: string, said: string): CareChoice => ({ label, ask: `I am having ${said}.` });
const lab = (label: string, test: string): CareChoice => ({ label, ask: `Should I ask my clinician for ${test}? What would it tell me, given my record?` });
const see = (label: string, who: string): CareChoice => ({ label, ask: `Help me get ready to see ${who}: what in my record is worth raising, and what should I ask?` });
const rx = (label: string, what: string): CareChoice => ({ label, ask: `I would like to ask my clinician about ${what}. Review my medications and history and help me prepare the request.` });
const dx = (label: string, what: string): CareChoice => ({ label, ask: `What in my record points toward or away from ${what}, and what would it take to rule it in or out?` });

export const GET_CARE: GetCareItem[] = [
  {
    key: 'symptom',
    label: 'Report symptom',
    icon: 'wave',
    ask: null,
    opener: 'Tell me what you are feeling, where, and since when. Say it however it comes, and I will add it to your timeline.',
    groups: [
      {
        title: 'Endometriosis',
        items: [
          symptom('Pelvic pain', 'pelvic pain'),
          symptom('Painful period', 'a painful period with cramping'),
          symptom('Heavy bleeding', 'heavy bleeding'),
          symptom('Pain with sex', 'pain with sex'),
          symptom('Painful bowel movements', 'painful bowel movements'),
          symptom('Pain when peeing', 'pain when peeing'),
          symptom('Bloating', 'bloating'),
          symptom('Lower back pain', 'lower back pain'),
          symptom('Spotting between periods', 'spotting between periods'),
          symptom('Leg or hip pain', 'pain down my leg and hip'),
        ],
      },
      {
        title: 'Whole body',
        items: [
          symptom('Fatigue', 'fatigue'),
          symptom('Headache', 'a headache'),
          symptom('Nausea', 'nausea'),
          symptom('Brain fog', 'brain fog'),
          symptom('Trouble sleeping', 'insomnia'),
          symptom('Low mood', 'low mood'),
          symptom('Anxiety', 'anxiety'),
          symptom('Dizziness', 'dizziness'),
          symptom('Joint pain', 'joint pain'),
          symptom('Hot flashes', 'hot flashes'),
        ],
      },
    ],
  },
  {
    key: 'labs',
    label: 'Get lab tests',
    icon: 'flask',
    ask: SUGGEST_LABS,
    opener: null,
    groups: [
      {
        title: 'Endometriosis',
        items: [
          lab('CA 125', 'a CA 125 test'),
          lab('Iron and ferritin', 'an iron and ferritin test'),
          lab('Full blood count', 'a full blood count'),
          lab('Vitamin D', 'a vitamin D test'),
          lab('Estradiol and progesterone', 'estradiol and progesterone'),
          lab('Thyroid (TSH)', 'a thyroid test'),
        ],
      },
      {
        title: 'Whole body',
        items: [
          lab('Cholesterol', 'a cholesterol test'),
          lab('Blood sugar (A1c)', 'an A1c test'),
          lab('Kidney and liver panel', 'a kidney and liver panel'),
          lab('Vitamin B12', 'a vitamin B12 test'),
          lab('Inflammation (CRP)', 'a CRP test'),
          lab('Magnesium', 'a magnesium test'),
        ],
      },
    ],
  },
  {
    key: 'consult',
    label: 'Consult doctor',
    icon: 'chat',
    ask: 'Help me get ready to see a doctor: what in my record is worth raising, and what should I ask?',
    opener: null,
    groups: [
      {
        title: 'Endometriosis',
        items: [
          see('Gynecologist', 'my gynecologist'),
          see('Endometriosis specialist', 'an endometriosis specialist'),
          see('Pelvic floor physiotherapist', 'a pelvic floor physiotherapist'),
          see('Fertility specialist', 'a fertility specialist'),
          see('Pain specialist', 'a pain specialist'),
        ],
      },
      {
        title: 'Whole body',
        items: [
          see('Primary care doctor', 'my primary care doctor'),
          see('Gastroenterologist', 'a gastroenterologist'),
          see('Urologist', 'a urologist'),
          see('Dietitian', 'a dietitian'),
          see('Mental health professional', 'a mental health professional'),
        ],
      },
    ],
  },
  {
    key: 'prescription',
    label: 'Request prescription',
    icon: 'pill',
    ask: REFILL,
    opener: null,
    groups: [
      {
        title: 'Endometriosis',
        items: [
          { label: 'Refill a current prescription', ask: REFILL },
          rx('Hormonal treatment', 'hormonal treatment for endometriosis'),
          rx('Pain relief', 'pain relief for period and pelvic pain'),
          rx('Heavy bleeding treatment', 'treatment for heavy bleeding'),
          rx('Iron', 'an iron supplement'),
        ],
      },
      {
        title: 'Whole body',
        items: [
          rx('Sleep support', 'help with sleep'),
          rx('Migraine treatment', 'migraine treatment'),
          rx('Nausea relief', 'nausea relief'),
          rx('Vitamin D', 'vitamin D'),
          rx('Allergy relief', 'allergy relief'),
        ],
      },
    ],
  },
  {
    key: 'diagnosed',
    label: 'Get diagnosed',
    icon: 'stethoscope',
    ask: CONNECT_SYMPTOMS,
    opener: null,
    groups: [
      {
        title: 'Endometriosis',
        items: [
          dx('Endometriosis', 'endometriosis'),
          dx('Adenomyosis', 'adenomyosis'),
          dx('PCOS', 'PCOS'),
          dx('Fibroids', 'fibroids'),
          dx('Ovarian cysts', 'ovarian cysts'),
        ],
      },
      {
        title: 'Whole body',
        items: [
          dx('Iron deficiency', 'iron deficiency anemia'),
          dx('Thyroid conditions', 'a thyroid condition'),
          dx('IBS', 'IBS'),
          dx('Celiac disease', 'celiac disease'),
          dx('Bladder pain syndrome', 'bladder pain syndrome'),
        ],
      },
    ],
  },
];
