// What a meal photo scan returns, made safe to show.
//
// The photo is read by OpenAI's vision model (supabase/functions/food-scan),
// and nothing it says is trusted as is: every item is checked here before
// it reaches the screen. A figure that is not a real, non negative number
// drops the item; a position off the photo leaves the item listed but not
// pinned. Every figure is an estimate until she corrects it, and the item
// says which it is.

export type ScanItem = {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  // Centre and radius as fractions of the photo, for the label and ring.
  at: { x: number; y: number; r: number } | null;
  from: 'estimated' | 'reported';
};

export type Scan = { items: ScanItem[]; notFood: boolean };

const MOST = 12;
// Beyond these, one food on one plate is a misreading.
const CAP = { kcal: 3000, protein_g: 300, carbs_g: 500, fat_g: 300 };

const amount = (v: unknown, cap: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= cap ? v : null);
const fraction = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

export function readScan(raw: unknown): Scan {
  const nothing: Scan = { items: [], notFood: true };
  if (!raw || typeof raw !== 'object') return nothing;
  const r = raw as { items?: unknown; not_food?: unknown };
  if (!Array.isArray(r.items)) return nothing;
  const items: ScanItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const kcal = amount(o.kcal, CAP.kcal);
    const protein = amount(o.protein_g, CAP.protein_g);
    const carbs = amount(o.carbs_g, CAP.carbs_g);
    const fat = amount(o.fat_g, CAP.fat_g);
    if (!name || kcal == null || protein == null || carbs == null || fat == null) continue;
    const x = fraction(o.x);
    const y = fraction(o.y);
    const rr = fraction(o.r);
    items.push({
      name,
      portion: typeof o.portion === 'string' ? o.portion.trim() : '',
      kcal,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      at: x != null && y != null && rr != null ? { x, y, r: rr } : null,
      from: 'estimated',
    });
    if (items.length === MOST) break;
  }
  return { items, notFood: r.not_food === true || items.length === 0 };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function mealTotals(items: readonly ScanItem[]) {
  const sum = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => round1(items.reduce((a, i) => a + i[k], 0));
  return { kcal: Math.round(sum('kcal')), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') };
}

// Her correction. Whatever she changed, the item is now hers.
export function editItem(item: ScanItem, change: Partial<Omit<ScanItem, 'from' | 'at'>>): ScanItem {
  return { ...item, ...change, from: 'reported' };
}

// A food she adds that the scan missed: no figures until she gives them.
export const blankItem = (): ScanItem => ({
  name: '',
  portion: '',
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  at: null,
  from: 'reported',
});

// A meal as saved.
export type Meal = { id: string; eatenAt: string; items: ScanItem[]; photoUri: string | null };

// INFERRED while any figure is still the scan's estimate; REPORTED once
// every item is hers.
export const mealProvenance = (items: readonly ScanItem[]): 'INFERRED' | 'REPORTED' =>
  items.some((i) => i.from === 'estimated') ? 'INFERRED' : 'REPORTED';

// A stored row, checked again on the way back: what is in the database is
// still only shown if it passes the same rules a fresh scan does.
export function mealFromRow(r: { client_id: string; eaten_at: string; items: unknown; photo: unknown }): Meal {
  const stored = Array.isArray(r.items) ? r.items : [];
  // Each stored item on its own, so one that fails cannot shift another's
  // flag of whether it is an estimate or hers.
  const items = stored.flatMap((i) => {
    const [item] = readScan({ items: [{ ...(i as object), ...flatAt(i) }] }).items;
    if (!item) return [];
    return (i as { from?: unknown }).from === 'reported' ? [{ ...item, from: 'reported' as const }] : [item];
  });
  const photo = r.photo as { uri?: unknown } | null;
  return { id: r.client_id, eatenAt: r.eaten_at, items, photoUri: typeof photo?.uri === 'string' ? photo.uri : null };
}

// Stored items keep their position as `at`; the scan reader expects x, y, r.
const flatAt = (i: unknown) => {
  const at = (i as { at?: { x?: unknown; y?: unknown; r?: unknown } | null })?.at;
  return at ? { x: at.x, y: at.y, r: at.r } : {};
};
