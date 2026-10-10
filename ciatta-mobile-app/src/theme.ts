import type { TextStyle } from 'react-native';

// Apple's dark appearance system colors (HIG › Color) with Ciatta coral as
// the app accent. The documented values are mirrored here because the charts
// draw with react-native-svg, which can't resolve PlatformColor.
// The light surface, from 05.ciatta-design-system-foundations-tokens.
//
// Same key names as the dark set they replace, so every screen moved at
// once without a line of layout or content changing. Mode is a resolution,
// not a token: a semantic mark is Base on light where it was Dark on
// Graphite, same hue and same meaning.
//
// The paired background and text tokens below are the system's rule made
// concrete: a tint is a ground at roughly 1.2:1, so the text on it is that
// hue's Deep step and never anything lighter.
export const C = {
  // Four grounds. Depth is a change of ground, never a stack, which is why
  // there is no elevation scale here.
  bg: '#FDFDFC', // White, the default canvas
  card: '#F7F4EE', // Paper, grouping and secondary panels
  cardHi: '#EFEBE3', // Paper pressed
  surface: '#F7F4EE',
  fill: '#EFEBE3',
  fillSelected: '#E8E4DC',
  border: '#E8E4DC', // Mist. Never a text colour.
  borderSub: '#E8E4DC',
  separator: '#E8E4DC',

  // Three inks. 17.3:1, 6.0:1 and 4.5:1 on White.
  //
  // muted is the system's amendment rather than the brand's Quiet, which
  // measures 2.8:1 and fails: a source, a date and a provenance label are
  // the evidence first promise in its smallest form, not decoration.
  text: '#18191B', // Graphite
  secondary: '#5F6265', // Slate
  muted: '#737577',
  tertiary: '#A9ABAD', // Inactive, never type that must be read
  chevron: '#BCBEC0',

  // The accent is ink. On this ground the eight hues carry meaning, so
  // spending one of them on "this is tappable" would make the legend lie.
  tint: '#18191B',
  blueLink: '#1C35AC', // Sky Deep, the only blue step legible as text

  // The eight meanings at their Base step: lines, points, strokes, marks.
  coral: '#CD4290', // Rose, what she said, felt or wrote
  rose: '#CD4290',
  pink: '#CD4290',
  lavender: '#915ADB', // Lavender, long horizons
  indigo: '#915ADB',
  violet: '#915ADB',
  blue: '#486FE9', // Sky, anything instrumented
  mint: '#486FE9',
  sleepLine: '#486FE9',
  orange: '#C7702A', // Ember, where something turned
  orangeText: '#6B3910', // Ember Deep, since this one is read as text
  amber: '#CD9132', // Amber, ranges and research, never about her
  gray: '#737577',

  // Flare is the anchor and is gated, never casual: refusals and
  // destructive actions only.
  red: '#C52D1E',
  pinkSevere: '#C52D1E',
  pinkMild: '#FCDAE8', // Rose Tint, a ground

  // Grounds and the text that sits on them, paired so the pairing cannot
  // be got wrong at a call site.
  amberBg: '#FCE0BB',
  amberBorder: '#F0CF9A',
  amberInk: '#5F4110', // Amber Deep
  lowBg: '#F8E3AC', // Mustard Tint, a gap
  lowText: '#574610', // Mustard Deep
  loggedBg: '#FCDAE8', // Rose Tint, reported
  loggedInk: '#7C1653', // Rose Deep
  measuredBg: '#DBE5FC', // Sky Tint, instrumented
  measuredText: '#1C35AC', // Sky Deep
  labBg: '#FCE0BB', // Amber Tint: a lab result is research, not her
  labText: '#5F4110', // Amber Deep

  // In range is not one of the eight meanings, so it carries no hue. A
  // reading that is where it usually is does not need a colour to say so.
  inBg: '#F7F4EE',
  inText: '#5F6265',
  green: '#5F6265',

  white: '#FFFFFF',
} as const;

// Jost everywhere. Custom fonts on Android ignore fontWeight, so every
// weight is its own family.
export const fonts = {
  regular: 'Jost_400Regular',
  medium: 'Jost_500Medium',
  semibold: 'Jost_600SemiBold',
  bold: 'Jost_700Bold',
  italic: 'Jost_400Regular_Italic',
} as const;

// Apple's text style sizes at the default (Large) Dynamic Type size, set in
// Jost. Text follows the person's Dynamic Type setting.
const STYLES = {
  largeTitle: [34, 41],
  title1: [28, 34],
  title2: [22, 28],
  title3: [20, 25],
  headline: [17, 22],
  body: [17, 22],
  callout: [16, 21],
  subhead: [15, 20],
  footnote: [13, 18],
  caption1: [12, 16],
  caption2: [11, 13],
} as const;

export type TextStyleName = keyof typeof STYLES;
export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export function font(style: TextStyleName, weight?: Weight): TextStyle {
  const [fontSize, lineHeight] = STYLES[style];
  return { fontFamily: fonts[weight ?? (style === 'headline' ? 'semibold' : 'regular')], fontSize, lineHeight };
}

// Hero figures that sit outside the text styles, set in tabular numerals.
export function numeral(size: number, weight: Weight = 'semibold'): TextStyle {
  return { fontFamily: fonts[weight], fontSize: size, lineHeight: Math.round(size * 1.2), fontVariant: ['tabular-nums'] };
}

// The eight meanings from the Ciatta design system, at their Dark step (the
// base re-lit for a dark ground). Colour carries meaning, never decoration.
export const M = {
  measured: '#486FE9', // Sky: anything instrumented
  timeDepth: '#915ADB', // Lavender: long horizons, receded periods
  reported: '#CD4290', // Rose: what she said, felt or wrote
  escalation: '#C52D1E', // Flare: gated, never casual
  change: '#C7702A', // Ember: where something turned, and every relationship
  evidence: '#CD9132', // Amber: ranges and research, never about her
  uncertainty: '#D2AC3A', // Mustard: a gap, always drawn dashed
  attention: '#D5D244', // Citron: worth raising, marks only
  historical: '#A9ABAD',
  unlit: '#E8E4DC',
} as const;

// iPhone layout margin and the corner radius shared by cards and groups.
export const GUTTER = 16;
export const RADIUS = 12;
