// The photo at the top of the Nutrition card: her own most recent meal.
//
// Only a photo she added under Nutrition counts, so nothing else she
// photographed (a rash, a lab report) is ever shown as food. No meal photo
// means no header rather than a stock picture standing in for her plate.

import type { Attachment } from './attachments';
import type { CategoryKey } from './logCategories';

export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

// Named by the hour she logged it. The edges are plain guesses at a day's
// shape, and a snack is anything outside the three meals.
export function mealOf(when: Date): Meal {
  const h = when.getHours();
  if (h >= 5 && h < 11) return 'Breakfast';
  if (h >= 11 && h < 15) return 'Lunch';
  if (h >= 17 && h < 22) return 'Dinner';
  return 'Snack';
}

export function latestMeal(
  entries: readonly { at?: string; category?: CategoryKey; text: string; attachments?: Attachment[] }[],
): { uri: string; title: string; meal: Meal } | null {
  const withPhoto = entries
    .filter((e) => e.at && e.category === 'nutrition' && e.attachments?.some((a) => a.kind === 'photo'))
    .sort((a, b) => b.at!.localeCompare(a.at!));
  const e = withPhoto[0];
  if (!e) return null;
  const meal = mealOf(new Date(e.at!));
  return { uri: e.attachments!.find((a) => a.kind === 'photo')!.uri, title: e.text.trim() || meal, meal };
}
