// The brief she takes to an appointment.
//
// Pure: her record in, sections out. No React, no network, so the rule this
// file exists to keep can be tested rather than reviewed.
//
// The rule is the project's: nothing here may say more than the record
// does. A brief is read by a clinician in about ninety seconds, which makes
// it the most dangerous surface in the app for a sentence that overstates.
// So every line is either a count, a value with its date, or her own words,
// and a section with nothing behind it says it is empty rather than being
// quietly dropped: a doctor reading "no symptoms recorded" learns something,
// where a missing section teaches them nothing and hides the gap.
//
// The order is the order Ciatta works in, which is the order the landing
// page's brief uses: what changed, what was around it, what she tried, what
// is still worth asking.

export type BriefLine = { text: string; detail?: string };

export type BriefSection = {
  id: string;
  title: string;
  // What this part of the brief is, for the row before it is opened.
  what: string;
  lines: BriefLine[];
  // True when there is nothing in her record for this section. The screen
  // still shows it, saying so.
  empty: boolean;
};

export type BriefInput = {
  from: Date;
  to: Date;
  // Reported, from her own logging.
  symptoms: { name: string; count: number }[];
  conditions: string[];
  medications: string[];
  // Measured, each with the day it is from.
  readings: { label: string; value: string; on: string }[];
  // Cycle lengths over the window, newest last.
  cycleLengths: number[];
  // Things she tried and what was reported after.
  tried: { what: string; outcome: string | null }[];
  // Her own words, verbatim, newest first.
  notes: { on: string; text: string }[];
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// Day then month, written out rather than taken from a locale: en-US puts
// the month first, and a brief read by a clinician should not change the
// order of its dates with the phone's region.
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function briefRange(from: Date, to: Date): string {
  const f = (d: Date) => `${d.getDate()} ${MONTH[d.getMonth()]}`;
  return `${f(from)} to ${f(to)}`;
}

export function buildBrief(input: BriefInput): BriefSection[] {
  const changed: BriefLine[] = [];
  for (const s of input.symptoms) {
    changed.push({ text: s.name, detail: `logged ${s.count} ${plural(s.count, 'time', 'times')}` });
  }
  if (input.cycleLengths.length >= 2) {
    const first = input.cycleLengths[0];
    const last = input.cycleLengths[input.cycleLengths.length - 1];
    changed.push({
      text: 'Cycle length',
      detail: `${first} days to ${last} days over ${input.cycleLengths.length} cycles`,
    });
  }
  for (const r of input.readings) {
    changed.push({ text: r.label, detail: `${r.value}, measured ${r.on}` });
  }

  const around: BriefLine[] = [
    ...input.conditions.map((c) => ({ text: c, detail: 'reported by her' })),
    ...input.medications.map((m) => ({ text: m, detail: 'taking' })),
  ];

  const tried: BriefLine[] = input.tried.map((t) => ({
    text: t.what,
    // An outcome nobody reported is unknown, never "no effect". A brief
    // that turns silence into a finding is the worst version of this
    // document.
    detail: t.outcome ?? 'no outcome reported',
  }));

  const asking: BriefLine[] = input.notes.slice(0, 3).map((n) => ({ text: n.text, detail: n.on }));

  const sections: BriefSection[] = [
    { id: 'changed', title: 'What changed', what: 'Symptoms, sleep and your cycle', lines: changed, empty: changed.length === 0 },
    {
      id: 'around',
      title: 'What was happening around it',
      what: 'Your conditions and medication',
      lines: around,
      empty: around.length === 0,
    },
    { id: 'tried', title: 'What you tried', what: 'And whether it held', lines: tried, empty: tried.length === 0 },
    {
      id: 'asking',
      title: 'In your words',
      what: 'Drawn from your own notes',
      lines: asking,
      empty: asking.length === 0,
    },
  ];

  return sections;
}

// What an empty section says. Written once so every one of them says it the
// same way, and so none of them can say "none" about a question she was
// never asked.
export function emptyLine(id: string): string {
  switch (id) {
    case 'changed':
      return 'Nothing logged or measured in this period.';
    case 'around':
      return 'No conditions or medication recorded.';
    case 'tried':
      return 'Nothing tried in this period.';
    default:
      return 'No notes written in this period.';
  }
}

// Whether the brief is worth taking anywhere yet.
export function briefHasAnything(sections: readonly BriefSection[]): boolean {
  return sections.some((s) => !s.empty);
}
