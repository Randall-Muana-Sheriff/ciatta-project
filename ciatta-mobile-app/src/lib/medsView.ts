// The Medications screen, from her own record: the medications and
// supplements she named (kept apart, as everywhere), when she last logged
// each, what she logged in the last 30 days, and the changes she logged
// (started, stopped, side effects) in her own words. No reminders and no
// adherence score: counts of what she said, nothing more.

import type { Reported } from '../data/repo';

type Log = { at?: string; category?: string; items?: Partial<Record<string, string[]>>; text: string };

export type NamedItem = { name: string; last: string | null; days: number };
export type MedsView = {
  medications: NamedItem[];
  supplements: NamedItem[];
  month: { label: string; days: number }[];
  changes: { label: string; on: string; words: string }[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const ACTIONS = ['Took medication', 'Missed a dose', 'Started a new medication', 'Stopped a medication', 'Side effect', 'Took supplement', 'Skipped a supplement', 'Started a new supplement', 'Stopped a supplement'];
const CHANGES = ['Started a new medication', 'Stopped a medication', 'Side effect', 'Started a new supplement', 'Stopped a supplement'];

export function medsView(input: { reported: Reported | null; logs: readonly Log[]; now: Date }): MedsView {
  const entries = input.logs
    .filter((l) => l.at && (l.category === 'meds' || l.category === 'supplements'))
    .map((l) => ({ at: new Date(l.at!), items: [...(l.items?.meds ?? []), ...(l.items?.supplements ?? [])], words: l.text.trim() }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const named = (names: readonly string[]): NamedItem[] =>
    [...new Set(names.map((n) => n.trim()).filter(Boolean))].map((name) => {
      const mine = entries.filter((e) => e.items.some((i) => i.toLowerCase() === name.toLowerCase()));
      return { name, last: mine[0] ? short(mine[0].at) : null, days: new Set(mine.map((e) => dayKey(e.at))).size };
    });

  const since = input.now.getTime() - 30 * 86400000;
  const month = ACTIONS.map((label) => ({
    label,
    days: new Set(entries.filter((e) => e.at.getTime() >= since && e.items.includes(label)).map((e) => dayKey(e.at))).size,
  })).filter((m) => m.days > 0);

  const changes = entries.flatMap((e) => e.items.filter((i) => CHANGES.includes(i)).map((label) => ({ label, on: short(e.at), words: e.words })));

  return {
    medications: named(input.reported?.medications ?? []),
    supplements: named(input.reported?.supplements ?? []),
    month,
    changes,
  };
}
