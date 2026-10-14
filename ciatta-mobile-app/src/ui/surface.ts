// The surface, on Graphite.
//
// Source: 05.ciatta-design-system-foundations-tokens, resolved for dark,
// with the grounds taken from Oura's own near black rather than from pure
// black. Oura's ground is a shade off black and its surfaces are barely
// lifted from it, which is what stops a dark app reading as a hole.
//
// Mode is a resolution, not a token, which is the system's own wording: the
// same semantic mark that is Base on light is Dark here. Same hue, same
// meaning, same weight.
//
// The file was called light.ts while the app was on white. A file of dark
// values under that name is the kind of lie that costs somebody an hour, so
// it was renamed with the values.
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
  // The default ground. Near black rather than black: pure black against an
  // OLED makes every edge a hard line, and Oura's ground sits just off it.
  canvas: '#0C0E11',
  // Grouping and secondary panels, one step up and only one. Translucent,
  // so the wash behind the screen comes through the card and tints it.
  // An opaque panel would be a hole in the ground it sits on.
  recessed: 'rgba(255, 255, 255, 0.055)',
  // Dividers, borders, inactive states. Never a text colour.
  rule: 'rgba(255, 255, 255, 0.08)',
  // Full bleed behind one sentence. Sparingly, never a card fill. A
  // further lift rather than a wash of its own.
  statement: 'rgba(255, 255, 255, 0.10)',

  // Selected. One more lift than a resting surface, with an edge a step
  // brighter than a resting edge, so a chosen thing is chosen by being
  // nearer rather than by spending a semantic hue on it. Shared by tiles,
  // rows and tabs, so selection looks the same wherever it happens.
  fillSelected: 'rgba(255, 255, 255, 0.15)',
  edgeOn: 'rgba(255, 255, 255, 0.16)',

  // Headings and anything carrying the sentence. White, because the ground
  // underneath is no longer flat: a wash at a fifth of a semantic hue lifts
  // the floor the type has to clear, and Paper on it reads soft rather than
  // gentle. The old worry was glare, which is a worry about white on pure
  // black and not about white on a washed Graphite.
  ink: '#FFFFFF',
  // Supporting and long form copy. Still a step down from ink, so hierarchy
  // survives, but well clear of the ground: around 13:1 rather than 8:1.
  body: '#D7DADF',
  // Sources, timestamps, labels.
  //
  // Lifted from the brand's Quiet for the same reason the light surface
  // amends it: metadata in Ciatta is a source, a date, a provenance label,
  // which is the evidence first promise in its smallest form and never
  // decoration, so it has to clear 4.5:1. It clears about 9:1 here, because
  // the smallest type is the type that needs the contrast most.
  meta: '#B2B7BE',

  // The primary action: a pill in the ink colour, so it is white on dark
  // and near black on light, and the label is the ground's own colour.
  // A glass card's own fill: the smoked fill under a blur, or nothing at
  // all where Liquid Glass is the material, so a card is the tab bar's glass.
  glass: '#0B0B0C',
  // The text box's field, and the cards drawn like it.
  field: 'rgba(0, 0, 0, 0.32)',
  pill: '#FFFFFF',
  onPill: '#0C0E11',
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

// The semantic eight, one meaning each, at their Base step. These are the
// values the system prints in its colour table: the hue itself, before it
// is re lit for a ground.
//
// Base is what a mark takes on light and what a ground takes on dark, at
// 12 to 20 percent alpha. It is never text on this surface: that is what
// the Dark step below is for.
export const BASE: Record<Meaning, string> = {
  measured: '#486FE9', // Sky
  timeDepth: '#915ADB', // Lavender
  reported: '#CD4290', // Rose
  escalation: '#C52D1E', // Flare, the anchor
  change: '#C7702A', // Ember
  evidence: '#CD9132', // Amber
  uncertainty: '#D2AC3A', // Mustard
  attention: '#D5D244', // Citron
};

// The Dark step for each meaning: the base re lit for this ground, at
// L +12 and chroma x 0.95. All eight clear 5.2:1 on Graphite, which is
// why coloured text on dark uses this step and never the Base.
export const HUE: Record<Meaning, string> = {
  // Sky: anything instrumented.
  measured: '#789AF3',
  // Lavender: long horizons, receded periods.
  timeDepth: '#B188F3',
  // Rose: what she said, felt or wrote.
  reported: '#F46EB4',
  // Flare: gated, never casual.
  escalation: '#EC5D4A',
  // Ember: where something turned, and every relationship.
  change: '#EC9658',
  // Amber: ranges and research, never about her.
  evidence: '#F2B863',
  // Mustard: a gap, always drawn dashed.
  uncertainty: '#E4C058',
  // Citron: worth raising, marks only.
  attention: '#CECB47',
};

// A mark: a line, a point, a stroke.
export function mark(meaning: Meaning): string {
  return HUE[meaning];
}

// A ground in that hue. The system's rule for dark, in its own words:
// "Tints become transparency. A pale fill on dark reads as a hole." So a
// ground here is the Dark step at low alpha rather than the light surface's
// pale tint.
export function ground(meaning: Meaning, alpha = 0.16): string {
  const hex = HUE[meaning];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Text sitting on that hue's ground. The Dark step, which is the only step
// legible on this surface: "Deep steps have no dark equivalent."
export function onTint(meaning: Meaning): string {
  return HUE[meaning];
}

// One corner radius for tiles. Bento only reads as bento when every tile
// shares an edge treatment.
export const TILE_RADIUS = 22;

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
