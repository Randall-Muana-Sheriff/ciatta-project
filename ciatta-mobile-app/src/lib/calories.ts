// The Calories block on the Nutrition card (design: IMG_4912).
//
// Today's calories in one large figure, protein and fat beside it, and a
// dial. The dial fills toward her own target when she set one, otherwise
// toward her usual day once seven logged days make "usual" mean something,
// and is absent when neither exists. Every figure from a scan stays marked
// as an estimate. The one line beneath speaks only from her record.

import type { Meal } from './foodScan';
import type { NutritionTargets } from './nutritionTargets';

const USUAL_DAYS = 7;
const WINDOW = 30;

export type CaloriesBlock = {
  title: 'Calories' | 'Calories Progress';
  // Null when she has logged nothing today: not a zero day, an unlogged one.
  kcal: string | null;
  protein: string;
  fat: string;
  estimated: boolean;
  dial: { fill: number; label: string } | null;
  note: string | null;
};

const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thousands = (n: number) => Math.round(n).toLocaleString('en-US');
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function caloriesBlock(meals: readonly Meal[], targets: NutritionTargets, now: Date): CaloriesBlock | null {
  if (!meals.length) return null;
  const today = dayOf(now.toISOString());
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WINDOW - 1));

  // Each logged day's totals.
  const days = new Map<string, { kcal: number; protein: number; fat: number; estimated: boolean }>();
  for (const m of meals) {
    if (new Date(m.eatenAt) < since) continue;
    const key = dayOf(m.eatenAt);
    const d = days.get(key) ?? { kcal: 0, protein: 0, fat: 0, estimated: false };
    for (const i of m.items) {
      d.kcal += i.kcal;
      d.protein += i.protein_g;
      d.fat += i.fat_g;
      if (i.from === 'estimated') d.estimated = true;
    }
    days.set(key, d);
  }
  const t = days.get(today);

  let dial: CaloriesBlock['dial'] = null;
  if (t && targets.kcal) {
    dial = { fill: Math.min(1, t.kcal / targets.kcal), label: `Your target ${thousands(targets.kcal)}` };
  } else if (t) {
    const before = [...days.entries()].filter(([k]) => k !== today).map(([, d]) => d.kcal);
    if (before.length >= USUAL_DAYS) {
      const usual = median(before);
      dial = { fill: Math.min(1, t.kcal / usual), label: `Your usual ${thousands(usual)}` };
    }
  }

  // Protein against her own target, over her last seven logged days.
  let note: string | null = null;
  if (targets.protein_g) {
    const recent = [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
    const under = recent.filter(([, d]) => d.protein < targets.protein_g!).length;
    if (recent.length >= 3 && under > recent.length / 2) {
      note = `Protein was under your target on ${under} of your last ${recent.length} logged days.`;
    }
  }

  return {
    title: targets.kcal ? 'Calories Progress' : 'Calories',
    kcal: t ? thousands(t.kcal) : null,
    protein: `${Math.round(t?.protein ?? 0)}g`,
    fat: `${Math.round(t?.fat ?? 0)}g`,
    estimated: !!t?.estimated,
    dial,
    note,
  };
}
