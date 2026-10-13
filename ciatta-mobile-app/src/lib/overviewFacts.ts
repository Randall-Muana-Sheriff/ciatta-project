// The six facts at the top of her Profile overview: age, height, weight,
// blood type, insurance and her last period. Each is what Ciatta has, or
// absent; a fact it does not have is shown as not added, never filled in.
// Weight is her latest reading; the last period is from her own logs.

import type { IconName } from '../ui/icons';

export type OverviewFact = { key: string; label: string; value: string | null; sub?: string; icon: IconName };

type Stat = { label: string; value: string; sub?: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function overviewFacts(input: {
  stats: readonly Stat[];
  weight: { value: string | null; note?: string } | null;
  lastPeriod: Date | null;
  now: Date;
}): OverviewFact[] {
  const stat = (key: string, label: string, icon: IconName): OverviewFact => {
    const s = input.stats.find((x) => x.label === label);
    return { key, label, value: s?.value ?? null, ...(s?.sub ? { sub: s.sub } : {}), icon };
  };
  const weight: OverviewFact = {
    key: 'weight',
    label: 'Weight',
    value: input.weight?.value ?? null,
    ...(input.weight?.value && input.weight.note ? { sub: input.weight.note } : {}),
    icon: 'body',
  };
  const p = input.lastPeriod;
  const day = p
    ? Math.floor((new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime() - new Date(p.getFullYear(), p.getMonth(), p.getDate()).getTime()) / 86400000) + 1
    : null;
  const period: OverviewFact = {
    key: 'period',
    label: 'Last period',
    value: p ? `${p.getDate()} ${MONTHS[p.getMonth()]}` : null,
    ...(day != null && day > 0 ? { sub: `Cycle day ${day}` } : {}),
    icon: 'calendar',
  };
  return [
    stat('age', 'Age', 'person'),
    stat('height', 'Height', 'ruler'),
    weight,
    stat('blood', 'Blood Type', 'drop'),
    stat('insurance', 'Insurance', 'shield'),
    period,
  ];
}
