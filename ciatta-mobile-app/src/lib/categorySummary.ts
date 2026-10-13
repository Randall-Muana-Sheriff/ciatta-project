// What she logged in one category recently, for its card on the Health
// dashboard.
//
// Counted in days, not entries: three notes about brain fog on one
// afternoon are one day of brain fog. Only the last 30 days, and only
// what she logged. A category with nothing in it returns nothing, so the
// card says so in words rather than drawing a row of zeros.

import type { Day } from '../data/daily';
import { BOWEL, category, type CategoryKey } from './logCategories';
import type { Found } from './quickLog';

const WINDOW_DAYS = 30;
const MOST = 4;

export type SummaryInput = {
  journal: { at?: string; items?: Found }[];
  days: Day[];
  episodes: { date: string; kinds: string[] }[];
  now: Date;
};

export type CategorySummary = { rows: { item: string; days: number }[]; extra?: string };

const dayOf = (iso: string) => iso.slice(0, 10);

export function categorySummary(key: CategoryKey, input: SummaryInput): CategorySummary {
  const start = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() - (WINDOW_DAYS - 1));
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const recent = (iso: string) => dayOf(iso) >= from;

  const seen = new Map<string, Set<string>>();
  const note = (item: string, iso: string) => {
    if (!recent(iso)) return;
    if (!seen.has(item)) seen.set(item, new Set());
    seen.get(item)!.add(dayOf(iso));
  };

  for (const entry of input.journal) {
    if (!entry.at) continue;
    for (const item of entry.items?.[key] ?? []) note(item, entry.at);
  }
  if (key === 'gut') {
    for (const d of input.days) for (const flag of d.digestion ?? []) note(flag, d.date);
  }
  if (key === 'body') {
    for (const e of input.episodes) if (e.kinds.includes('Pain')) note('Pain', e.date);
  }

  const order = category(key).quick;
  const rows = [...seen.entries()]
    .map(([item, days]) => ({ item, days: days.size }))
    .sort((a, b) => b.days - a.days || order.indexOf(a.item) - order.indexOf(b.item) || a.item.localeCompare(b.item))
    .slice(0, MOST);

  const summary: CategorySummary = { rows };
  if (key === 'gut') {
    const bowel = input.episodes.filter((e) => e.kinds.includes(BOWEL) && recent(e.date)).length;
    if (bowel) summary.extra = `${bowel} bowel ${bowel === 1 ? 'movement' : 'movements'} logged`;
  }
  return summary;
}

export function summaryLines(s: CategorySummary): string[] {
  return s.rows.map((r) => `${r.item}, ${r.days} ${r.days === 1 ? 'day' : 'days'}`);
}
