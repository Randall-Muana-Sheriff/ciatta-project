// The light surface, taken from the Ciatta design system rather than
// invented here.
//
// Source: 05.ciatta-design-system-foundations-tokens. The first version of
// this file was five values I chose by eye, which is exactly the drift the
// system warns about, so the values below are the system's and the rules
// below are its rules.
//
// Four steps per hue, and each one has a job:
//
//   Base   lines, points, strokes, marks.
//   Tint   L 92, chroma x 0.55. Grounds and fills, roughly 1.2:1.
//          Grounds ONLY. Never a mark and never text.
//   Deep   L 40 at the ceiling. The only step legible as text, and what
//          text on a tint of the same hue must use.
//   Dark   the base re-lit for the Graphite ground. That is theme.ts's M,
//          which is why this file does not repeat it.
//
// Mode is a resolution, not a token: a semantic mark is Base on light and
// Dark on Graphite. Same hue, same meaning, same weight.

// Four grounds and three inks.
export const L = {
  // The default ground. Most of every screen. Not pure white: the system's
  // White is a shade off it and the difference is what stops a full page of
  // it glaring.
  canvas: '#FDFDFC',
  // Grouping and secondary panels. One step, never two: depth here is a
  // change of ground rather than a stack, which is why the system has no
  // elevation scale at all.
  recessed: '#F7F4EE',
  // Dividers, borders, inactive states. Never a text colour.
  rule: '#E8E4DC',
  // Full bleed behind one sentence. Sparingly, and never a card fill.
  statement: '#FFF8EC',

  // Headings and anything carrying the sentence. 17.3:1.
  ink: '#18191B',
  // Supporting and long form copy. 6.0:1.
  body: '#5F6265',
  // Sources, timestamps, labels. 4.5:1.
  //
  // Not the brand's Quiet, which measures 2.8:1 and fails. The system
  // amends text.meta to this value for exactly that reason: metadata in
  // Ciatta is a source, a date, a provenance label, which is the evidence
  // first promise in its smallest form and never decoration.
  meta: '#737577',
} as const;

export type Meaning =
  | 'measured'
  | 'timeDepth'
  | 'reported'
  | 'escalation'
  | 'change'
  | 'evidence'
  | 'uncertainty'
  | 'attention';

type Steps = { base: string; tint: string; deep: string };

// The eight meanings on a light ground. Same meanings as theme.ts's M,
// which holds the Dark step for the record's own ground.
export const HUE: Record<Meaning, Steps> = {
  // Sky: anything instrumented.
  measured: { base: '#486FE9', tint: '#DBE5FC', deep: '#1C35AC' },
  // Lavender: long horizons, receded periods.
  timeDepth: { base: '#915ADB', tint: '#E8DFFC', deep: '#5A1B9B' },
  // Rose: what she said, felt or wrote.
  reported: { base: '#CD4290', tint: '#FCDAE8', deep: '#7C1653' },
  // Flare: gated, never casual.
  escalation: { base: '#C52D1E', tint: '#FCDCD7', deep: '#84190F' },
  // Ember: where something turned, and every relationship.
  change: { base: '#C7702A', tint: '#FCDECB', deep: '#6B3910' },
  // Amber: ranges and research, never about her.
  evidence: { base: '#CD9132', tint: '#FCE0BB', deep: '#5F4110' },
  // Mustard: a gap, always drawn dashed.
  uncertainty: { base: '#D2AC3A', tint: '#F8E3AC', deep: '#574610' },
  // Citron: worth raising, marks only.
  attention: { base: '#D5D244', tint: '#EAEAA6', deep: '#4C4A10' },
};

// A mark: a line, a point, a stroke. The step a semantic colour resolves to
// on this ground.
export function mark(meaning: Meaning): string {
  return HUE[meaning].base;
}

// A ground. The only place a tint may be used.
export function ground(meaning: Meaning): string {
  return HUE[meaning].tint;
}

// Text sitting on that hue's tint. Deep, always: a tint is roughly 1.2:1
// against white, so anything lighter than Deep on top of it is unreadable,
// and this function exists so that pairing cannot be got wrong by hand.
export function onTint(meaning: Meaning): string {
  return HUE[meaning].deep;
}

// One corner radius for tiles. Bento only reads as bento when every tile
// shares an edge treatment.
export const TILE_RADIUS = 18;

// Editorial spacing. Whitespace is the only thing carrying hierarchy once
// the palette is this quiet, so the steps are few and far apart rather than
// a fine scale nobody can tell apart.
export const SPACE = {
  tight: 8,
  // Between tiles in a row and rows in a grid.
  grid: 10,
  // Between a heading and what it heads.
  near: 16,
  // Between one block and the next.
  block: 28,
  // Between sections that are about different things.
  section: 44,
} as const;

// How much a scrolling screen must leave at its foot so the floating nav
// does not sit on top of its last row. The bar is 60 plus its wrapper's
// padding; the rest is breathing room so the last tile is not tucked
// under the edge of it.
export const NAV_CLEARANCE = 104;
