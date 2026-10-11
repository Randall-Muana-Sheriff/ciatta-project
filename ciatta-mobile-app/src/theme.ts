import type { TextStyle } from 'react-native';

// Apple's dark appearance system colors (HIG › Color) with Ciatta coral as
// the app accent. The documented values are mirrored here because the charts
// draw with react-native-svg, which can't resolve PlatformColor.
// Graphite, with Oura's grounds.
//
// Same key names as the set they replace, so the whole app moved at once
// without a line of layout, content or logic changing. The grounds are near
// black rather than black and the surfaces are barely lifted from them,
// which is what stops a dark app reading as a hole; the inks are Paper
// rather than white, because white on near black glares at paragraph
// length.
//
// Mode is a resolution, not a token: every semantic mark below is the Dark
// step, the base re lit for this ground. Same hue, same meaning.
//
// Tints become transparency here. A pale fill on dark reads as a hole, so
// the paired grounds are the hue at low alpha and the text on them is the
// Dark step, which is the only step legible on this surface.
export const C = {
  // Four grounds, and three of them are translucent.
  //
  // An opaque card punches a flat hole in the wash behind it, which is the
  // whole of what the ground was for. White at low alpha instead: the card
  // lifts off the page and takes the colour of whatever it is sitting
  // over, so a card on the Sky end of a screen is faintly Sky and the same
  // card lower down is faintly Lavender, with nothing deciding that but
  // where it sits.
  //
  // White rather than a tint, because white at six percent over any of the
  // eight reads as that hue lifted. A tinted card would pick a hue and
  // then fight the one behind it.
  bg: '#0C0E11',
  card: 'rgba(255, 255, 255, 0.055)',
  cardHi: 'rgba(255, 255, 255, 0.09)',
  surface: 'rgba(255, 255, 255, 0.055)',
  fill: 'rgba(255, 255, 255, 0.09)',
  fillSelected: 'rgba(255, 255, 255, 0.15)',
  // Edges carry what translucency gives up. A card with no border and no
  // fill of its own has no shape on a ground that varies underneath it.
  border: 'rgba(255, 255, 255, 0.10)',
  borderSub: 'rgba(255, 255, 255, 0.07)',
  separator: 'rgba(255, 255, 255, 0.08)',

  // Three inks, all raised: the ground is a wash now rather than a flat
  // dark, and type set for a flat dark reads soft on it.
  text: '#FFFFFF',
  secondary: '#D7DADF',
  muted: '#B2B7BE',
  tertiary: '#878C94',
  chevron: '#6E737A',

  // The accent is the ink. On this ground the eight hues carry meaning, so
  // spending one on "this is tappable" would make the legend lie.
  tint: '#FFFFFF',
  blueLink: '#789AF3',

  // The eight meanings at their Dark step.
  coral: '#F46EB4', // Rose, what she said, felt or wrote
  rose: '#F46EB4',
  pink: '#F46EB4',
  lavender: '#B188F3', // Lavender, long horizons
  indigo: '#B188F3',
  violet: '#B188F3',
  blue: '#789AF3', // Sky, anything instrumented
  mint: '#789AF3',
  sleepLine: '#789AF3',
  orange: '#EC9658', // Ember, where something turned
  orangeText: '#EC9658',
  amber: '#F2B863', // Amber, ranges and research, never about her
  gray: '#B2B7BE',

  // Flare is the anchor and is gated, never casual.
  red: '#EC5D4A',
  pinkSevere: '#EC5D4A',
  pinkMild: 'rgba(244, 110, 180, 0.16)',

  // Grounds and the text on them, paired so the pairing cannot be got
  // wrong at a call site.
  amberBg: 'rgba(242, 184, 99, 0.16)',
  amberBorder: 'rgba(242, 184, 99, 0.28)',
  amberInk: '#F2B863',
  lowBg: 'rgba(228, 192, 88, 0.16)',
  lowText: '#E4C058',
  loggedBg: 'rgba(244, 110, 180, 0.16)',
  loggedInk: '#F46EB4',
  measuredBg: 'rgba(120, 154, 243, 0.16)',
  measuredText: '#789AF3',
  labBg: 'rgba(242, 184, 99, 0.16)',
  labText: '#F2B863',

  // In range is not one of the eight meanings, so it carries no hue.
  inBg: '#15171A',
  inText: '#D7DADF',
  green: '#D7DADF',

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
  measured: '#789AF3', // Sky: anything instrumented
  timeDepth: '#B188F3', // Lavender: long horizons, receded periods
  reported: '#F46EB4', // Rose: what she said, felt or wrote
  escalation: '#EC5D4A', // Flare: gated, never casual
  change: '#EC9658', // Ember: where something turned, and every relationship
  evidence: '#F2B863', // Amber: ranges and research, never about her
  uncertainty: '#E4C058', // Mustard: a gap, always drawn dashed
  attention: '#CECB47', // Citron: worth raising, marks only
  historical: '#B2B7BE',
  unlit: '#24272C',
} as const;

// iPhone layout margin and the corner radius shared by cards and groups.
export const GUTTER = 16;
export const RADIUS = 12;
