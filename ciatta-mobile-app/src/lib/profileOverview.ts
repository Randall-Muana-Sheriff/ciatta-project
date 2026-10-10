// Her record in a paragraph: what she told Ciatta, and what has arrived
// since.
//
// Profile's overview was a set of tiles and rings that counted things. A
// count tells her how much is there; this tells her what is there, which
// is the question someone opens their own profile to answer.
//
// It grows with the record rather than being written once. The first
// sentence is her onboarding, which never changes, and everything after it
// is however long she has been sharing: the span, the sources, and what
// they have added. A woman six months in should not read the same
// paragraph she read on day one.
//
// Same rule as everywhere else: reported and measured stay apart, and
// nothing here says more than the record does.

export type OverviewInput = {
  name: string | null;
  // The day she finished onboarding, which is where the record starts.
  since: Date | null;
  // What she said about herself, as she said it.
  conditions: string[];
  surgeries: string[];
  medications: string[];
  supplements: string[];
  symptoms: string[];
  // What has arrived since, measured.
  observationCount: number;
  daysWithData: number;
  sources: string[];
  now: Date;
};

function listJoin(items: readonly string[]): string {
  const xs = items.map((x) => x.trim()).filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

// How long she has been sharing, in the largest unit that is still true.
// "Six months" is a fact she recognises; "184 days" is arithmetic.
export function sharingFor(since: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86400000));
  if (days === 0) return 'since today';
  if (days === 1) return 'for a day';
  if (days < 14) return `for ${days} days`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `for ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `for ${months} ${months === 1 ? 'month' : 'months'}`;
  }
  const years = Math.floor(days / 365);
  const rest = Math.floor((days - years * 365) / 30);
  if (rest === 0) return `for ${years} ${years === 1 ? 'year' : 'years'}`;
  return `for ${years} ${years === 1 ? 'year' : 'years'} and ${rest} ${rest === 1 ? 'month' : 'months'}`;
}

export function profileOverview(input: OverviewInput): string {
  const parts: string[] = [];
  const name = (input.name ?? '').trim();

  // What she told Ciatta. This is the part that does not change, and it is
  // first because it is the part she authored.
  const told: string[] = [];
  if (input.conditions.length) told.push(`you are managing ${listJoin(input.conditions)}`);
  if (input.surgeries.length) told.push(`your history includes ${listJoin(input.surgeries)}`);
  if (input.medications.length) told.push(`you take ${listJoin(input.medications)}`);
  if (input.supplements.length) {
    told.push(`${input.medications.length ? 'you also take' : 'you take'} ${listJoin(input.supplements)}`);
  }
  if (input.symptoms.length) {
    told.push(
      input.symptoms.length === 1
        ? `the symptom you named is ${input.symptoms[0]}`
        : `the symptoms you named are ${listJoin(input.symptoms)}`,
    );
  }

  if (told.length) {
    const joined = listJoin(told);
    parts.push(`${name ? `${name}, when` : 'When'} you started, you told me ${joined}.`);
  } else if (input.since) {
    parts.push(`${name ? `${name}, there` : 'There'} is not much about you here yet.`);
  } else {
    // No onboarding and no history: there is no record to describe, and
    // saying so is the whole of the honest answer.
    return `${name ? `${name}, your` : 'Your'} record is empty. Everything you log or connect will gather here.`;
  }

  // What has arrived since. Measured, named as measured, and only when
  // there is some: a sentence about zero readings is a sentence about
  // nothing.
  if (input.since) {
    const span = sharingFor(input.since, input.now);
    if (input.observationCount > 0) {
      const where = input.sources.length ? ` from ${listJoin(input.sources)}` : '';
      const days =
        input.daysWithData > 0
          ? ` across ${input.daysWithData} ${input.daysWithData === 1 ? 'day' : 'days'}`
          : '';
      // "you have" is refused across the app, because it is how "you have
      // endometriosis" gets written. It refuses "you have been sharing"
      // too, so the sentence is built without the phrase.
      parts.push(
        `Your health data has been with Ciatta ${span}, and ${input.observationCount.toLocaleString('en-US')} readings have arrived${where}${days}.`,
      );
    } else {
      parts.push(`You started sharing ${span}, and no readings have arrived yet.`);
    }
  }

  return parts.join(' ');
}
