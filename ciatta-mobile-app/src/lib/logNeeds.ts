// What the You can box asks for today: only what Ciatta does not have yet.
// The cycle during a period or when one is due; how she feels, if nothing
// is logged today; food, when meals look missing for the time of day. Each
// with the quick chips most likely to be the answer, her own symptoms first.

import type { CategoryKey } from './logCategories';

export type LogNeed = { key: CategoryKey; label: string; prompt: string; chips: string[] };

export const FLOW_CHIPS = ['Light', 'Moderate', 'Heavy'];
const DEFAULT_SYMPTOMS = ['Fatigue', 'Headache', 'Bloating', 'Pain', 'Low mood'];

export function logNeeds(input: {
  symptomsToday: boolean;
  cycleToday: boolean;
  mealsToday: number;
  cycle: { day: number; usualLength: number | null; bleeding: boolean } | null;
  // The symptoms she logs most, most first.
  frequent: string[];
  now: Date;
}): LogNeed[] {
  const out: LogNeed[] = [];
  const c = input.cycle;
  if (c && !input.cycleToday) {
    if (c.bleeding && c.day <= 7) {
      out.push({ key: 'cycle', label: 'Cycle', prompt: `Day ${c.day} of your period. How is the flow today?`, chips: [...FLOW_CHIPS, 'Spotting'] });
    } else if (c.usualLength && c.day >= c.usualLength - 2) {
      out.push({ key: 'cycle', label: 'Cycle', prompt: 'Your period is due around now. Has it started?', chips: ['Period', 'Spotting'] });
    }
  }
  if (!input.symptomsToday) {
    const chips = [...new Set([...input.frequent, ...DEFAULT_SYMPTOMS])].slice(0, 4);
    out.push({ key: 'symptoms', label: 'Symptoms', prompt: 'How are you feeling today?', chips });
  }
  const h = input.now.getHours();
  const food =
    h >= 19 && input.mealsToday < 3
      ? 'What did you have this evening?'
      : h >= 14 && input.mealsToday < 2
        ? 'Anything since breakfast? Lunch, a snack, a coffee?'
        : h >= 10 && input.mealsToday < 1
          ? 'Nothing logged to eat yet today. What have you had?'
          : null;
  if (food) out.push({ key: 'nutrition', label: 'Food', prompt: food, chips: ['Caffeine', 'Alcohol', 'Skipped a meal', 'Ate late'] });
  return out;
}
