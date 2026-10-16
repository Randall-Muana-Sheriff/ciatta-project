// Get care, on the Care page: five ways in, each one a conversation with
// Ciatta. Report symptom opens with Ciatta asking; the others ask her
// question for her, through the same capabilities the chat answers with.

import type { IconName } from '../ui/icons';
import { CONNECT_SYMPTOMS, REFILL } from './agent/connect';
import { SUGGEST_LABS } from './agent/labSuggest';

export type GetCareItem = { key: string; label: string; icon: IconName; ask: string | null; opener: string | null };

export const GET_CARE: GetCareItem[] = [
  { key: 'symptom', label: 'Report symptom', icon: 'wave', ask: null, opener: 'Tell me what you are feeling, where, and since when. Say it however it comes, and I will add it to your timeline.' },
  { key: 'labs', label: 'Get lab tests', icon: 'flask', ask: SUGGEST_LABS, opener: null },
  { key: 'consult', label: 'Consult doctor', icon: 'chat', ask: 'Help me get ready to see a doctor: what in my record is worth raising, and what should I ask?', opener: null },
  { key: 'prescription', label: 'Request prescription', icon: 'pill', ask: REFILL, opener: null },
  { key: 'diagnosed', label: 'Get diagnosed', icon: 'stethoscope', ask: CONNECT_SYMPTOMS, opener: null },
];
