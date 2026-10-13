// The Symptoms screen, from her own logs: what she logged in the last 90
// days, by how many days she logged it, with its group, the last day, the
// worst rating she gave, and how often against the 30 days before. Read from
// her episodes (cycle questionnaire and Log), her category logs, and the gut
// flags on her daily log. Medicines, supplements and context are not
// symptoms. Nothing logged is an empty list, never a row of zeros.

import { CATEGORIES, type CategoryKey } from './logCategories';

const WINDOW = 90;
const DAY = 86400000;
const SYMPTOM_CATEGORIES: CategoryKey[] = ['gut', 'body', 'mind', 'skin', 'sexual'];
const GROUP_LABEL: Partial<Record<CategoryKey, string>> = {
  gut: 'Gut',
  body: 'Body',
  mind: 'Mind',
  skin: 'Skin',
  sexual: 'Sexual and urinary',
};

type Signal = { date: Date; episode: { kinds: string[]; symptoms?: string[]; severity: number | null } };
type Log = { at?: string; category?: string; items?: Partial<Record<string, string[]>> };
type DayRow = { date: string; digestion?: string[] };

export type SymptomRow = { name: string; group: string; days: number; last: string; worst: number | null; versus: string | null };
export type SymptomsView = { list: SymptomRow[]; groups: string[]; weeks: string[]; grid: { name: string; counts: number[] }[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

// Which group a symptom belongs to, by the Log chip it is.
function groupOf(name: string): string {
  if (name === 'Pain') return 'Body';
  for (const key of SYMPTOM_CATEGORIES) {
    if (CATEGORIES.find((c) => c.key === key)?.quick.includes(name)) return GROUP_LABEL[key]!;
  }
  if (/sleep|headache|mood|dizz/i.test(name)) return 'Mind';
  if (/bowel|digest|abdominal|nausea/i.test(name)) return 'Gut';
  return 'Body';
}

// Each symptom she logged in the last 90 days, by day, with the worst
// rating she gave that day. Shared with Today's symptom card.
export function symptomDays(input: { signals: readonly Signal[]; logs: readonly Log[]; days: readonly DayRow[]; now: Date }): Map<string, Map<string, number | null>> {
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const since = today - (WINDOW - 1) * DAY;
  // name -> day key -> worst rating that day (null when none given)
  const seen = new Map<string, Map<string, number | null>>();
  const note = (name: string, at: Date, severity: number | null) => {
    const t = at.getTime();
    if (t < since || t > today + DAY) return;
    const days = seen.get(name) ?? new Map<string, number | null>();
    const k = dayKey(at);
    const was = days.get(k);
    days.set(k, severity == null ? (was ?? null) : Math.max(was ?? 0, severity));
    seen.set(name, days);
  };
  for (const s of input.signals) {
    if (s.episode.kinds.includes('Pain')) note('Pain', s.date, s.episode.severity);
    for (const name of s.episode.symptoms ?? []) note(name, s.date, s.episode.severity);
  }
  for (const l of input.logs) {
    if (!l.at || !l.items) continue;
    const at = new Date(l.at);
    for (const [cat, items] of Object.entries(l.items)) {
      if (!SYMPTOM_CATEGORIES.includes(cat as CategoryKey)) continue;
      for (const name of items ?? []) note(name, at, null);
    }
  }
  for (const d of input.days) for (const name of d.digestion ?? []) note(name, parseDay(d.date), null);
  return seen;
}

export function symptomsView(input: { signals: readonly Signal[]; logs: readonly Log[]; days: readonly DayRow[]; now: Date }): SymptomsView {
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const seen = symptomDays(input);

  const split = today - 29 * DAY;
  const list: SymptomRow[] = [...seen.entries()]
    .map(([name, days]) => {
      const keys = [...days.keys()].sort();
      const ratings = [...days.values()].filter((v): v is number => v != null);
      const recent = keys.filter((k) => parseDay(k).getTime() >= split).length;
      const before = keys.filter((k) => {
        const t = parseDay(k).getTime();
        return t < split && t >= split - 30 * DAY;
      }).length;
      const last = parseDay(keys[keys.length - 1]);
      return {
        name,
        group: groupOf(name),
        days: keys.length,
        last: `${last.getDate()} ${MONTHS[last.getMonth()]}`,
        worst: ratings.length ? Math.max(...ratings) : null,
        versus:
          recent + before < 2
            ? null
            : recent > before
              ? 'More often than the 30 days before'
              : recent < before
                ? 'Less often than the 30 days before'
                : 'About as often as the 30 days before',
      };
    })
    // Most days first; ties keep the order they were first logged in.
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.days - a.r.days || a.i - b.i)
    .map(({ r }) => r);

  const groups = ['All', ...new Set(list.map((r) => r.group))];

  // Twelve weeks, Monday first, ending this week.
  const now = new Date(today);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  const weekStarts = Array.from({ length: 12 }, (_, n) => monday - (11 - n) * 7 * DAY);
  const grid = list.slice(0, 5).map((r) => {
    const days = [...seen.get(r.name)!.keys()].map((k) => parseDay(k).getTime());
    return { name: r.name, counts: weekStarts.map((w) => days.filter((t) => t >= w && t < w + 7 * DAY).length) };
  });
  return { list, groups, weeks: weekStarts.map((w) => dayKey(new Date(w))), grid };
}
