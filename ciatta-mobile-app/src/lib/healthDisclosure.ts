// What Ciatta reads from Apple Health, as the kinds of thing rather than the
// list of them.
//
// The screen used to name all twelve types with a line each. It was accurate
// and it was a wall: Apple's own sheet lists every type with a real toggle
// beside it one tap later, so naming them twice asked her to read the same
// list in a form she could not act on. Categories say the same true thing in
// a sentence she can take in, and the sheet remains the place the detail
// lives, because that is the place the detail can be changed.
//
// Derived from the specs the permission request is built from rather than
// typed out. A hand written disclosure drifts: the day someone adds a metric
// in a new domain, the request asks for something the sentence does not
// cover and nothing fails. Here it fails a test.
//
// No pure data file imports the native module, so this derives from
// healthMetrics, which READ_TYPES in healthKit.ts is also built from. A test
// asserts the two stay the same set.

import { QUANTITY_SPECS, SLEEP_SPEC, WORKOUT_SPEC } from './healthMetrics';

// What she would call each domain. Keyed by the domain the specs carry, so a
// metric filed under something new has no name here and fails the guard
// rather than printing an internal word on her screen.
const CATEGORY_NAMES: Record<string, string> = {
  activity: 'movement',
  vitals: 'heart and breathing',
  sleep: 'sleep',
  body: 'body',
  nutrition: 'food and drink',
  environment: 'surroundings',
  behaviour: 'habits',
  other: 'anything else Health holds',
};

// The order they are said in. Movement first: it is the easiest to recognise
// as your own.
const CATEGORY_ORDER = ['activity', 'vitals', 'sleep', 'body', 'nutrition', 'environment', 'behaviour', 'other'];

// Every identifier Ciatta requests, with the domain it belongs to. Sleep and
// workouts are separate specs rather than entries in QUANTITY_SPECS, so they
// are appended in the order READ_TYPES appends them.
export function requestedTypes(): { identifier: string; domain: string }[] {
  return [
    ...QUANTITY_SPECS.map((spec) => ({ identifier: spec.identifier, domain: spec.domain })),
    { identifier: SLEEP_SPEC.identifier, domain: SLEEP_SPEC.domain },
    { identifier: WORKOUT_SPEC.identifier, domain: WORKOUT_SPEC.domain },
  ];
}

// Domains Ciatta requests that nobody has named. Empty is the only acceptable
// value, and a test says so: a metric added under a new domain must be
// described before it can be asked for.
export function unnamedCategories(): string[] {
  const named = new Set(Object.keys(CATEGORY_NAMES));
  return [...new Set(requestedTypes().map((t) => t.domain))].filter((d) => !named.has(d));
}

// A name for something Ciatta never asks for. Also must be empty: a sentence
// claiming more than the request covers is the same failure in the other
// direction, and the kind a reader cannot check.
export function overstatedCategories(): string[] {
  const asked = new Set(requestedTypes().map((t) => t.domain));
  return Object.keys(CATEGORY_NAMES).filter((d) => !asked.has(d));
}

// The categories actually requested, in reading order.
export function healthCategories(): string[] {
  const asked = new Set(requestedTypes().map((t) => t.domain));
  return CATEGORY_ORDER.filter((d) => asked.has(d)).map((d) => CATEGORY_NAMES[d]);
}

// The categories as one clause: "movement, heart and breathing, and sleep".
export function healthCategoryClause(): string {
  const xs = healthCategories();
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

// The whole disclosure, in three lines.
//
// One sentence could not carry eight categories without becoming a wall, so
// the shape does the work the punctuation was failing at: what Ciatta reads,
// the list, and what it is for. The list stays complete rather than being
// trimmed to fit, because a disclosure that drops a category to read better
// is a disclosure that is wrong.
export function healthDisclosureLines(): string[] {
  const clause = healthCategoryClause();
  return [
    'Ciatta reads what Apple Health already holds for you.',
    `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`,
    'It compares your week to your own usual, never to anybody else.',
  ];
}
