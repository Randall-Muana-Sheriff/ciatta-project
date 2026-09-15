import type { TextStyle } from 'react-native';

// Apple's dark appearance system colors (HIG › Color) with Ciatta coral as
// the app accent. The documented values are mirrored here because the charts
// draw with react-native-svg, which can't resolve PlatformColor.
export const C = {
  // Grouped backgrounds: primary for the view, secondary for groups,
  // tertiary for elements inside groups.
  bg: '#000000',
  card: '#1C1C1E',
  cardHi: '#2C2C2E',
  surface: '#1C1C1E',
  fill: '#2C2C2E',
  fillSelected: '#636366',
  border: '#38383A',
  borderSub: '#38383A',
  separator: '#38383A',

  // Labels. Secondary is 5.8:1 on card, muted 5.2:1, both above 4.5:1.
  text: '#FFFFFF',
  secondary: '#98989F',
  muted: '#8E8E93',
  tertiary: '#48484A',
  chevron: '#5A5A5F',

  // Accent and chart series.
  tint: '#F2957A',
  coral: '#F2957A',
  lavender: '#A5A3FF',
  indigo: '#5E5CE6',
  violet: '#BF5AF2',
  mint: '#63E6E2',
  green: '#30D158',
  red: '#FF453A',
  gray: '#8E8E93',

  rose: '#FF6482',
  blue: '#0A84FF',
  blueLink: '#F2957A',
  sleepLine: '#A5A3FF',

  orange: '#FF9F0A',
  orangeText: '#FF9F0A',

  pink: '#FF375F',
  pinkMild: '#8A2A45',
  pinkSevere: '#FF453A',

  amber: '#FFD60A',
  amberBg: '#2A2505',
  amberBorder: '#3D3508',
  amberInk: '#E6D38A',

  inBg: '#0E2C17',
  inText: '#30D158',
  lowBg: '#2E2208',
  lowText: '#FF9F0A',

  loggedBg: '#5A1F3A',
  measuredBg: '#0B2540',
  measuredText: '#64D2FF',
  labBg: '#0E2C17',
  labText: '#30D158',

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

// iPhone layout margin and the corner radius shared by cards and groups.
export const GUTTER = 16;
export const RADIUS = 12;
