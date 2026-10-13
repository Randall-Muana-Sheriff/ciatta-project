// Her own daily nutrition targets, and the macro gauges that use them.
//
// Every target is optional and hers. Ciatta never proposes one: with none
// set, a gauge shows what she ate and its share of the day, and "Left"
// appears only against a number she chose.

export type NutritionTargets = { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number };

const KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const;
// Beyond these a figure is a typo, not a day.
const MAX: Record<(typeof KEYS)[number], number> = { kcal: 10000, protein_g: 600, carbs_g: 1500, fat_g: 600 };

export function normalizeTargets(value: unknown): NutritionTargets {
  const out: NutritionTargets = {};
  if (!value || typeof value !== 'object') return out;
  for (const k of KEYS) {
    const v = (value as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX[k]) out[k] = v;
  }
  return out;
}

// A box she typed in. Blank, zero or not a number clears the target.
export function targetFromInput(text: string): number | undefined {
  const n = Number(text.trim());
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

export type Gauge = { figure: string; caption: string; fill: number };

// One macro card. `meal` is this meal's grams, `day` today's total with
// this meal in it.
export function macroGauge(name: string, meal: number, target: number | undefined, day: number): Gauge {
  if (target) {
    return {
      figure: `${Math.max(0, Math.round(target - day))} g`,
      caption: `${name} Left`,
      fill: Math.min(1, day / target),
    };
  }
  return { figure: `${Math.round(meal)} g`, caption: `${name}, of today`, fill: day > 0 ? Math.min(1, meal / day) : 0 };
}
