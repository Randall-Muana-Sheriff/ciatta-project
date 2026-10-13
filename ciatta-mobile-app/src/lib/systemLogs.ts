// The body systems and the Log screen's categories, joined both ways.
//
// What she logs shows under the system it is about, item by item rather
// than category by category: under Sexual and urinary, burning when she
// pees is the urinary system and vaginal dryness is reproductive. And each
// system's log button opens the category that logs it.
//
// An item about no one system (fatigue, travel) belongs to the whole
// body. Medicines and supplements are not parts of the body, so they are
// on no system at all.

import type { JournalView } from '../data/rows';
import type { BodyPoint } from './bodyMap';
import type { CategoryKey } from './logCategories';

// Where a whole category goes, unless an item says otherwise below.
const BY_CATEGORY: Partial<Record<CategoryKey, string[]>> = {
  cycle: ['Reproductive'],
  nutrition: ['Digestive', 'Metabolic'],
  gut: ['Digestive'],
  mind: ['Nervous'],
  skin: ['Skin'],
  sexual: ['Reproductive'],
};

const BY_ITEM: Partial<Record<CategoryKey, Record<string, string[]>>> = {
  body: {
    Pain: ['Musculoskeletal'],
    'Joint pain': ['Musculoskeletal'],
    // Hot flashes, night sweats and breast tenderness follow her hormones.
    'Breast tenderness': ['Reproductive'],
    'Hot flashes': ['Reproductive'],
    'Night sweats': ['Reproductive'],
    Chills: ['Immune'],
    Swelling: ['Circulatory'],
    Fatigue: [],
  },
  sexual: {
    'Urinary urgency': ['Urinary'],
    Leaking: ['Urinary'],
    'Burning when peeing': ['Urinary'],
  },
  context: {
    'Slept badly': ['Nervous'],
    'Slept well': ['Nervous'],
    'Stressful event': ['Nervous'],
    Exercised: ['Musculoskeletal', 'Circulatory'],
    Sex: ['Reproductive'],
    Illness: ['Immune'],
    // Damp and mould are breathed in.
    'Damp or mould at home': ['Respiratory'],
    Travel: [],
  },
};

const NOT_THE_BODY: CategoryKey[] = ['meds', 'supplements', 'note'];

// The systems an item belongs to. An empty list is the whole body; null
// is nothing on the body at all.
export function systemsFor(category: CategoryKey, item: string): string[] | null {
  if (NOT_THE_BODY.includes(category)) return null;
  return BY_ITEM[category]?.[item] ?? BY_CATEGORY[category] ?? [];
}

// The category each system's log button opens.
export const SYSTEM_CATEGORY: Record<string, CategoryKey> = {
  Circulatory: 'body',
  Respiratory: 'body',
  Digestive: 'gut',
  Metabolic: 'nutrition',
  Reproductive: 'cycle',
  Urinary: 'sexual',
  Immune: 'body',
  Musculoskeletal: 'body',
  Nervous: 'mind',
  Skin: 'skin',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WINDOW_DAYS = 30;

// What she logged in the last 30 days, one point per item per system,
// with how often and when last. Her words, counted, and nothing inferred.
export function loggedPoints(view: JournalView, now: Date): BodyPoint[] {
  const since = now.getTime() - WINDOW_DAYS * 86400000;
  const seen = new Map<string, { item: string; system: string | null; count: number; last: Date }>();
  for (const entry of view.months.flatMap((m) => m.items)) {
    if (!entry.at || !entry.items) continue;
    const at = new Date(entry.at);
    if (Number.isNaN(at.getTime()) || at.getTime() < since || at > now) continue;
    for (const [cat, list] of Object.entries(entry.items) as [CategoryKey, string[]][]) {
      for (const item of list ?? []) {
        const systems = systemsFor(cat, item);
        if (systems == null) continue;
        for (const system of systems.length ? systems : [null]) {
          const key = `${system ?? ''}|${item}`;
          const was = seen.get(key);
          seen.set(key, { item, system, count: (was?.count ?? 0) + 1, last: was && was.last > at ? was.last : at });
        }
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .map(({ item, system, count, last }) => {
      const on = `${last.getDate()} ${MONTHS[last.getMonth()]}`;
      return {
        region: 'systemic',
        meaning: 'reported',
        state: 'lit',
        halo: false,
        title: item,
        detail:
          count === 1
            ? `You logged this once in the last 30 days, on ${on}.`
            : `You logged this ${count} times in the last 30 days, most recently on ${on}.`,
        source: 'You reported',
        ...(system ? { system } : {}),
      };
    });
}
