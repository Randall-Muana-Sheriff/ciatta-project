// Tapping the body to log pain there. Where a tap lands, as a place on the
// body, and what a pain there is logged as.
//
// The figure is one image turned by quarters: 0 front, 1 and 3 the sides,
// 2 the back (the front mirrored). Only the front has positions for every
// place; the back and sides are read by height on the body.

import { REGION_BY_ID, REGION_LOCATION, REGIONS, type RegionId } from './bodyMap';

// How far from a place a tap may land, in percent of the figure.
const REACH = 12;

export function regionAt(xPct: number, yPct: number, quarter: number): RegionId | null {
  if (quarter === 2 && yPct >= 18 && yPct < 34) return 'upper_back';
  if (quarter === 2 && yPct >= 34 && yPct < 47) return 'lower_back';
  const placed = REGIONS.filter((r) => r.x != null && r.y != null);
  // From the side, height decides, with a light pull toward the middle of
  // the body and toward the side that faces her: the right from one side,
  // the left from the other.
  const side = quarter === 1 || quarter === 3;
  const nearSide = (x: number) => (quarter === 1 ? x < 50 : x > 50);
  let best: RegionId | null = null;
  let bestD = Infinity;
  for (const r of placed) {
    const dx = side ? (r.x! - 50) * 0.1 : xPct - r.x!;
    const dy = yPct - r.y!;
    const d = Math.hypot(dx, dy) + (side && r.x !== 50 && !nearSide(r.x!) ? 0.01 : 0);
    if (d < bestD) {
      bestD = d;
      best = r.id;
    }
  }
  return bestD <= REACH ? best : null;
}

// The words a pain there is logged in, from the record's own list, and how
// the place is said in a sentence.
export function painItemFor(region: RegionId): { items: string[]; place: string } {
  const place = (REGION_LOCATION[region] ?? REGION_BY_ID[region].label).toLowerCase();
  if (region === 'head') return { items: ['Headache'], place };
  if (region === 'pelvis' || region === 'lower_abdomen') return { items: ['Pain', 'Pelvic pain'], place };
  if (region === 'lower_back') return { items: ['Pain', 'Lower back pain'], place };
  if (region.startsWith('knee') || region.startsWith('hip') || region.startsWith('shoulder')) return { items: ['Pain', 'Joint pain'], place };
  return { items: ['Pain'], place };
}
