// Her chart, arranged for reading.
//
// clinical_records is a flat list of everything every connected hospital
// sent. This turns it into what a person actually looks for: results
// grouped by the day they were drawn, and the standing lists of what she
// is managing, taking and allergic to.
//
// The rule that matters most here is about absence, and it is the one a
// lab screen gets wrong by default.
//
//   A result with no flag is a result the lab did not flag. It is not a
//   normal result. The lab may not have had a reference range, the range
//   may not apply to her, or the flag may simply not have been sent. So
//   nothing here renders "in range", and there is no code path that could:
//   a flag is shown when there is one and nothing is shown when there is
//   not.
//
//   A retracted result is not shown at all. entered-in-error means the
//   provider withdrew it, and showing it beside live results, even greyed,
//   would be showing her a value her hospital says never stood.
//
// Pure, and the whole file is about arrangement. Nothing is computed from
// a value and nothing is compared to anything.

import type { ClinicalRecord } from './fhirMap';
import { isRetracted } from './fhirMap';

export type ResultDay = {
  // ISO day, or null for the results that arrived with no date at all.
  on: string | null;
  results: ClinicalRecord[];
};

export type ChartView = {
  // Labs and vitals, newest day first.
  days: ResultDay[];
  conditions: ClinicalRecord[];
  medications: ClinicalRecord[];
  allergies: ClinicalRecord[];
  immunizations: ClinicalRecord[];
  procedures: ClinicalRecord[];
  // How many the provider withdrew. Counted rather than hidden entirely,
  // so a chart that looks shorter than she expects has an explanation.
  retracted: number;
};

const RESULT_KINDS: ClinicalRecord['kind'][] = ['lab', 'vital'];

export function chartView(records: readonly ClinicalRecord[]): ChartView {
  const live: ClinicalRecord[] = [];
  let retracted = 0;
  for (const r of records) {
    if (isRetracted(r)) retracted += 1;
    else live.push(r);
  }

  const of = (kind: ClinicalRecord['kind']) =>
    live.filter((r) => r.kind === kind).sort((a, b) => (b.effectiveOn ?? '').localeCompare(a.effectiveOn ?? ''));

  const byDay = new Map<string, ClinicalRecord[]>();
  for (const r of live) {
    if (!RESULT_KINDS.includes(r.kind)) continue;
    // Undated results are a real group, not a bucket to drop them into
    // silently. The screen gives them a heading that says so.
    const key = r.effectiveOn ?? '';
    const list = byDay.get(key);
    if (list) list.push(r);
    else byDay.set(key, [r]);
  }

  const days: ResultDay[] = [...byDay.entries()]
    .map(([on, results]) => ({
      on: on || null,
      results: [...results].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    // Newest first, and the undated group last: it has no place on a
    // timeline and putting it at the top would imply it is the most
    // recent thing that happened to her.
    .sort((a, b) => {
      if (a.on == null) return 1;
      if (b.on == null) return -1;
      return b.on.localeCompare(a.on);
    });

  return {
    days,
    conditions: of('condition'),
    medications: of('medication'),
    allergies: of('allergy'),
    immunizations: of('immunization'),
    procedures: of('procedure'),
    retracted,
  };
}

// What a flag is called on screen. Null stays null all the way down: there
// is deliberately no branch here that turns an absent flag into a word.
export function flagLabel(record: ClinicalRecord): string | null {
  switch (record.flag) {
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    case 'abnormal':
      return 'Flagged';
    default:
      return null;
  }
}

// A status worth showing beside a result. final is the expected case and
// saying so on every row would be noise; anything else is a reason to
// look twice and is named.
export function statusNote(record: ClinicalRecord): string | null {
  switch (record.status) {
    case 'preliminary':
      return 'Preliminary';
    case 'amended':
      return 'Amended';
    case 'corrected':
      return 'Corrected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return null;
  }
}

// The day's heading.
export function dayLabel(on: string | null): string {
  if (!on) return 'No date given';
  const [y, m, d] = on.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d) return on;
  return `${d} ${months[m - 1]} ${y}`;
}

export function isEmpty(view: ChartView): boolean {
  return (
    view.days.length === 0 &&
    view.conditions.length === 0 &&
    view.medications.length === 0 &&
    view.allergies.length === 0 &&
    view.immunizations.length === 0 &&
    view.procedures.length === 0
  );
}

// What the chart says about itself. Counted, never characterised: "412
// results" is a fact, and "your results look good" would be a reading of
// a chart Ciatta has not read.
export function chartLine(view: ChartView): string {
  const results = view.days.reduce((n, d) => n + d.results.length, 0);
  if (results === 0) return 'No results have arrived yet.';
  const days = view.days.length;
  return `${results} ${results === 1 ? 'result' : 'results'} across ${days} ${days === 1 ? 'day' : 'days'}.`;
}
