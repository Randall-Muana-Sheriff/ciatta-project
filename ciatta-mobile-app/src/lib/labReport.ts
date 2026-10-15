// One report, as the report screen shows it: which results belong to it,
// the count line, and its panels with what is outside range first.

import { groupByPanel, isOutside, type LabResult, labStatus } from './labs';

export type ReportKey = { documentId: string | null; on: string; lab: string | null };

// A report she added owns exactly the results read from it. A provider
// draw, which has no document, is the provider results of that day at that
// lab.
export function reportResults(labs: readonly LabResult[], key: ReportKey): LabResult[] {
  if (key.documentId) return labs.filter((l) => l.documentId === key.documentId);
  return labs.filter((l) => !l.documentId && l.on === key.on && (l.lab ?? null) === (key.lab ?? null));
}

export function countLine(results: readonly LabResult[]): string {
  let high = 0;
  let low = 0;
  let inRange = 0;
  let none = 0;
  let abnormal = 0;
  for (const r of results) {
    const k = labStatus(r).key;
    if (k === 'high' || k === 'criticalHigh') high++;
    else if (k === 'low' || k === 'criticalLow') low++;
    else if (k === 'inRange') inRange++;
    else if (k === 'abnormal') abnormal++;
    else none++;
  }
  return [
    high ? `${high} high` : null,
    low ? `${low} low` : null,
    abnormal ? `${abnormal} abnormal` : null,
    inRange ? `${inRange} in range` : null,
    none ? `${none} with no range given` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function reportPanels(results: readonly LabResult[]): { title: string; items: LabResult[] }[] {
  return groupByPanel(results.map((r) => ({ ...r, panel: r.panel ?? null }))).map((g) => ({
    title: g.title,
    items: [...g.items.filter(isOutside), ...g.items.filter((r) => !isOutside(r))],
  }));
}
