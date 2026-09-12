import type { TextStyle } from 'react-native';

// Palette lifted from the Figma Make reference screens (Ciatta-ui-ux).
export const C = {
  bg: '#141320',
  surface: '#1C1B2A',
  card: '#201F30',
  border: '#28273C',
  borderSub: '#201F2E',

  text: '#EEEEF5',
  secondary: '#7878A0',
  muted: '#4A4A6A',

  rose: '#C05878',
  blue: '#4A80C5',
  blueLink: '#78ACEC',
  sleepLine: '#A0A0C0',

  orange: '#D87030',
  orangeText: '#E09050',

  pink: '#CC5580',
  pinkMild: '#7A3555',
  pinkSevere: '#E06888',

  amber: '#C49030',
  amberBg: '#1A1508',
  amberBorder: '#2E2510',
  amberInk: '#C0A070',

  inBg: '#0C1E14',
  inText: '#38A868',
  lowBg: '#1C1608',
  lowText: '#C09030',

  loggedBg: '#6A2040',
  measuredBg: '#182438',
  measuredText: '#5890C8',
  labBg: '#182518',
  labText: '#4A9858',

  white: '#FFFFFF',
} as const;

// Custom fonts on Android ignore fontWeight, so every weight is its own family.
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: {
    400: 'Urbanist_400Regular',
    500: 'Urbanist_500Medium',
    600: 'Urbanist_600SemiBold',
  },
  sansItalic: 'Urbanist_400Regular_Italic',
} as const;

export type Weight = 400 | 500 | 600;

export function serif(size: number, italic = false): TextStyle {
  return {
    fontFamily: italic ? fonts.serifItalic : fonts.serif,
    fontSize: size,
    lineHeight: Math.round(size * (size >= 26 ? 1.18 : 1.27)),
  };
}

export function sans(size: number, weight: Weight = 400): TextStyle {
  return {
    fontFamily: fonts.sans[weight],
    fontSize: size,
    lineHeight: size <= 12 ? 16 : size <= 14 ? 20 : size <= 18 ? 24 : Math.round(size * 1.15),
  };
}

export const caps: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.9 };

export const GUTTER = 20;
