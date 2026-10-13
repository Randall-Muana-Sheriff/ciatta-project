// What she uses during her period, and when.
//
// How often she changes, and at what absorbency, is her own menstrual
// picture, and it is what a clinician asks when judging whether bleeding
// is heavy: "soaking a super tampon every hour or two" is part of the
// standard screen. So each use is a fact with a start and an end, logged
// by her and never inferred.
//
// One rule holds the record honest: at most one use is in at a time.
// Putting a new one in closes the one that was in, at that same moment,
// because that is what changing is.

export const PRODUCTS = ['Pad', 'Tampon', 'Cup', 'Disc', 'Period underwear'] as const;
export type Product = (typeof PRODUCTS)[number];

// Tampons use the FDA's standardized absorbency terms, which is what the
// box says. The rest follow the way they are sold.
export const SIZES: Record<Product, readonly string[]> = {
  Pad: ['Liner', 'Light', 'Regular', 'Heavy', 'Overnight', 'Extra long'],
  Tampon: ['Light', 'Regular', 'Super', 'Super plus', 'Ultra'],
  Cup: ['Small', 'Large'],
  Disc: ['Small', 'Large'],
  'Period underwear': ['Light', 'Moderate', 'Heavy', 'Overnight'],
};

// How full it was when it came out. Optional: skipped is unknown.
export const FULLNESS = ['Not full', 'Partly full', 'Soaked', 'Leaked'] as const;
export type Fullness = (typeof FULLNESS)[number];

export type ProductUse = {
  id: string;
  product: Product;
  size: string;
  startedAt: string;
  endedAt: string | null;
  fullness: Fullness | null;
};

export const openUse = (uses: readonly ProductUse[]): ProductUse | null => uses.find((u) => u.endedAt == null) ?? null;

export function startUse(
  uses: readonly ProductUse[],
  next: { id: string; product: Product; size: string; at: string },
): ProductUse[] {
  const closed = uses.map((u) => (u.endedAt == null ? { ...u, endedAt: next.at } : u));
  return [...closed, { id: next.id, product: next.product, size: next.size, startedAt: next.at, endedAt: null, fullness: null }];
}

export function endUse(uses: ProductUse[], out: { at: string; fullness: Fullness | null }): ProductUse[] {
  if (!openUse(uses)) return uses;
  return uses.map((u) => (u.endedAt == null ? { ...u, endedAt: out.at, fullness: out.fullness } : u));
}

export function inForLine(use: ProductUse, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(use.startedAt).getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `In for ${h}h ${m}m` : `In for ${m}m`;
}
