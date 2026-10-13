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

// "Super tampon", "Overnight pad", "Small cup": the size first, as on the box.
export const productName = (u: { product: Product; size: string }) =>
  u.product === 'Period underwear' ? `${u.size} period underwear` : `${u.size} ${u.product.toLowerCase()}`;

// The Cycle card's line. While one is in: what, and for how long. When
// nothing is in: this period's changes and the size she used most. Null
// when she has logged no products this period, so the card adds nothing.
export function productsLine(uses: readonly ProductUse[], periodStart: string, now: Date): string | null {
  const current = openUse(uses);
  if (current) {
    const minutes = Math.max(0, Math.floor((now.getTime() - new Date(current.startedAt).getTime()) / 60000));
    const h = Math.floor(minutes / 60);
    return `${productName(current)} in, for ${h ? `${h}h ${minutes % 60}m` : `${minutes % 60}m`}`;
  }
  const these = uses.filter((u) => u.startedAt >= periodStart);
  if (!these.length) return null;
  const counts = new Map<string, number>();
  for (const u of these) counts.set(productName(u), (counts.get(productName(u)) ?? 0) + 1);
  const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return `This period: ${these.length} ${these.length === 1 ? 'change' : 'changes'}, mostly ${most}`;
}

// The longest each product should be worn, with where that number comes
// from. Shown as given by the source, never stretched or softened.
export const WEAR_LIMIT: Record<Product, { hours: number; source: string }> = {
  Tampon: { hours: 8, source: 'FDA tampon labeling, 21 CFR 801.430: do not wear a tampon for more than 8 hours' },
  Cup: { hours: 12, source: 'Manufacturer labeling of FDA cleared menstrual cups: up to 12 hours' },
  Disc: { hours: 12, source: 'Manufacturer labeling: up to 12 hours' },
  Pad: { hours: 8, source: 'ACOG patient guidance: change a pad every 4 to 8 hours' },
  'Period underwear': { hours: 12, source: 'Manufacturer labeling: up to 12 hours' },
};

export const changeBy = (use: ProductUse): Date =>
  new Date(new Date(use.startedAt).getTime() + WEAR_LIMIT[use.product].hours * 3600000);

export function changeLine(use: ProductUse, now: Date): string {
  const by = changeBy(use);
  if (now >= by) return `Past ${WEAR_LIMIT[use.product].hours} hours. Change it now.`;
  return `Change by ${by.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
