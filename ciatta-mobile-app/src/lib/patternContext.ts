// The context behind one pattern, for the top of its page: what in her
// record it rests on, her readings against her own usual and for how
// long, and where she is in her cycle. Said from facts only; a reading
// within her usual adds nothing, and nothing is added for a cycle she has
// not logged.
//
// metrics are the readings this pattern is about, which the page's
// Metrics view puts first.

type Reading = { key: string; label: string; latest: string; usual: string | null; side: 'above' | 'below' | 'within' | null; daysOutside: number };

const METRICS: Record<string, string[]> = {
  'iron-fatigue': ['sleep_hours'],
  'cycle-physiology': ['resting_hr', 'hrv'],
  'sleep-cycle': ['sleep_hours'],
  thyroid: ['resting_hr'],
  'headache-red-flags': ['sleep_hours'],
  'hormones-cycle': ['resting_hr', 'hrv', 'sleep_hours'],
};

export function patternContext(
  insightId: string,
  connections: readonly string[],
  c: { readings: readonly Reading[]; cycle: { day: number; phase: string | null } | null },
): { lines: string[]; metrics: string[] } {
  const metrics = METRICS[insightId] ?? [];
  const lines = [...connections];
  for (const key of metrics) {
    const r = c.readings.find((x) => x.key === key);
    if (!r || !r.side || r.side === 'within' || !r.usual) continue;
    if (lines.some((l) => l.startsWith(r.label))) continue;
    const days = r.daysOutside === 1 ? '1 day' : `${r.daysOutside} days`;
    lines.push(`${r.label} has been ${r.side} your usual of ${r.usual} on ${days}, latest ${r.latest}.`);
  }
  if (c.cycle && !lines.some((l) => /day \d+ of your cycle/.test(l))) {
    lines.push(`Today is day ${c.cycle.day} of your cycle${c.cycle.phase ? `, ${c.cycle.phase.toLowerCase()}` : ''}.`);
  }
  return { lines, metrics };
}
