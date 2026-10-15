// Logging by saying it to Ciatta. What she writes is read for the record's
// own log words (by log-read on the server, with lib/quickLog's reader on
// the phone as the fallback), and Ciatta offers to add them. Nothing is
// saved until she taps Add.
//
// An urgent message is never turned into a log offer: it is escalated, and
// that answer stands alone.

import { CATEGORIES, type CategoryKey, SYMPTOM_GROUPS, symptomCategory } from '../logCategories';
import type { CapabilityId } from './types';

export const LOG_VOCABULARY: string[] = [
  ...new Set([...CATEGORIES.flatMap((c) => c.quick), ...SYMPTOM_GROUPS.flatMap((g) => g.items)]),
];

// Where the record keeps a word: the category that offers it, or for a
// symptom, the category its group files under.
function categoryOf(item: string): CategoryKey {
  const owner = CATEGORIES.find((c) => c.key !== 'symptoms' && c.quick.includes(item));
  return owner ? owner.key : symptomCategory(item);
}

export function groupItems(items: readonly string[]): Partial<Record<CategoryKey, string[]>> {
  const out: Partial<Record<CategoryKey, string[]>> = {};
  for (const item of items) {
    const key = categoryOf(item);
    out[key] = [...(out[key] ?? []), item];
  }
  return out;
}

export function mergeItems(read: readonly string[] | null, local: readonly string[]): string[] {
  return [...new Set([...(read ?? []), ...local])];
}

export function offerLine(items: readonly string[]): string {
  const list = items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return `I can add this to your timeline: ${list}.`;
}

export function turnPlan(capability: CapabilityId, items: readonly string[]): { answer: boolean; offer: boolean } {
  if (capability === 'escalate') return { answer: true, offer: false };
  const offer = items.length > 0;
  return { answer: !(offer && capability === 'decline'), offer };
}
