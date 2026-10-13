// Period product safety: sourced rules, the reminders they set, and the
// flags they raise (spec: 2026-10-12 logging categories, section 3).
//
// Static and checked. Each rule carries its numbers, its words and its
// source, and the wording keeps to what the source says: nothing softened,
// nothing extended. The agent may quote a rule; it never writes its own
// safety advice. Reminder text names the product and nothing about her
// body, because it shows on a lock screen.

import { type Product, type ProductUse, productName, WEAR_LIMIT } from './periodProducts';

export type Rule = { id: string; text: string; source: string };

export const RULES: Rule[] = [
  {
    id: 'tampon-hours',
    text: 'Change a tampon every 4 to 8 hours, and do not wear one for more than 8 hours.',
    source: WEAR_LIMIT.Tampon.source,
  },
  {
    id: 'lowest-absorbency',
    text: 'Use the lowest absorbency tampon you need for your flow.',
    source: 'FDA tampon labeling, 21 CFR 801.430',
  },
  {
    id: 'overnight',
    text: 'If you might sleep longer than 8 hours, a pad or cup is the safer choice overnight.',
    source: 'FDA consumer guidance, The Facts on Tampons and How to Use Them Safely',
  },
  {
    id: 'cup-disc-hours',
    text: 'Empty a cup or disc at least every 12 hours.',
    source: WEAR_LIMIT.Cup.source,
  },
  {
    id: 'pad-hours',
    text: 'Change a pad every 4 to 8 hours.',
    source: WEAR_LIMIT.Pad.source,
  },
  {
    id: 'tss',
    text: 'Toxic shock syndrome is rare and serious. If you have a sudden high fever, vomiting, diarrhea, a rash like a sunburn, dizziness or fainting, or muscle aches while using a tampon, cup or disc, remove it and get medical care now.',
    source: 'FDA tampon labeling, 21 CFR 801.430',
  },
  {
    id: 'heavy-bleeding',
    text: 'Soaking through a pad or tampon every hour for several hours in a row is heavy bleeding, and worth telling your clinician. If you feel faint or dizzy, get care now.',
    source: 'CDC and ACOG, heavy menstrual bleeding',
  },
  {
    id: 'cup-iud',
    text: 'With an IUD, break the cup or disc seal fully before removing it: suction on removal has been reported to move an IUD.',
    source: 'van Eijk et al., Lancet Public Health, 2019',
  },
];

const rule = (id: string) => RULES.find((r) => r.id === id)!.text;

// Nudge and firm reminder hours, by product, from the wear limits.
const REMIND: Record<Product, number[]> = {
  Tampon: [6, 8],
  Cup: [10, 12],
  Disc: [10, 12],
  Pad: [6],
  'Period underwear': [10],
};

export type Reminder = { id: string; at: string; title: string; body: string };

export function remindersFor(use: ProductUse, now: Date = new Date(use.startedAt)): Reminder[] {
  const start = new Date(use.startedAt).getTime();
  const noun = use.product === 'Period underwear' ? 'period underwear' : use.product.toLowerCase();
  return REMIND[use.product]
    .map((h, n, all) => ({
      id: `product-${use.id}-${h}`,
      at: new Date(start + h * 3600000).toISOString(),
      title: n === all.length - 1 && all.length > 1 ? `Change your ${noun} now` : `Time to change your ${noun}`,
      body: `Time to change your ${noun}. It has been ${h} hours.`,
    }))
    .filter((r) => new Date(r.at) > now);
}

// A tampon taken out not full after six hours or more.
export function absorbencyHint(uses: readonly ProductUse[]): string | null {
  const last = [...uses].filter((u) => u.endedAt).sort((a, b) => a.endedAt!.localeCompare(b.endedAt!)).at(-1);
  if (!last || last.product !== 'Tampon' || last.fullness !== 'Not full') return null;
  const hours = (new Date(last.endedAt!).getTime() - new Date(last.startedAt).getTime()) / 3600000;
  return hours >= 6 ? `That ${productName(last).toLowerCase()} was not full after ${Math.floor(hours)} hours. A lower absorbency may be enough next time. ${rule('lowest-absorbency')}` : null;
}

export function overnightNote(use: ProductUse | null): string | null {
  if (!use || use.product !== 'Tampon') return null;
  const h = new Date(use.startedAt).getHours();
  return h >= 21 || h < 4 ? rule('overnight') : null;
}

// The FDA's toxic shock warning signs, as words she might write.
export const TSS_SIGNS: { sign: string; cue: RegExp }[] = [
  { sign: 'Sudden high fever', cue: /\b(fever|feverish|high temperature)\b/i },
  { sign: 'Vomiting', cue: /\b(vomit\w*|throwing up|threw up)\b/i },
  { sign: 'Diarrhea', cue: /\b(diarrh\w*)\b/i },
  { sign: 'A rash like a sunburn', cue: /\b(rash|sunburn)\b/i },
  { sign: 'Dizziness or fainting', cue: /\b(dizz\w*|faint\w*|light ?headed)\b/i },
  { sign: 'Muscle aches', cue: /\b(muscle ache\w*|aching muscles|achy all over)\b/i },
];

const INTERNAL: Product[] = ['Tampon', 'Cup', 'Disc'];

export function tssWarning(text: string, current: ProductUse | null): string | null {
  if (!current || !INTERNAL.includes(current.product)) return null;
  const signs = TSS_SIGNS.filter((s) => s.cue.test(text)).map((s) => s.sign.toLowerCase());
  if (!signs.length) return null;
  return `You mentioned ${signs.join(' and ')} with a ${productName(current).toLowerCase()} in. Remove it and get medical care now. These can be signs of toxic shock syndrome.`;
}

// Two or more consecutive uses ended soaked or leaked within an hour, in
// the last 24 hours. Counted from her logs only.
export function heavyBleedingFlag(uses: readonly ProductUse[], now: Date): string | null {
  const ended = [...uses]
    .filter((u) => u.endedAt && now.getTime() - new Date(u.endedAt).getTime() <= 24 * 3600000)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let run = 0;
  for (const u of ended) {
    const minutes = (new Date(u.endedAt!).getTime() - new Date(u.startedAt).getTime()) / 60000;
    const fast = (u.fullness === 'Soaked' || u.fullness === 'Leaked') && minutes <= 60;
    run = fast ? run + 1 : 0;
    if (run >= 2) return 'Soaking through this fast is worth telling your clinician. If you feel faint or dizzy, get care now.';
  }
  return null;
}

export function cupIudNote(product: Product, contraception: string | undefined): string | null {
  return (product === 'Cup' || product === 'Disc') && contraception === 'Hormonal IUD' ? rule('cup-iud') : null;
}
