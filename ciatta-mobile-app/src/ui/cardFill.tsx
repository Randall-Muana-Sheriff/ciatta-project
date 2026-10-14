// A content card's ground: the insight headings' room, lit in the screen's
// two hues from opposite corners, black on dark and daylight white on
// light. Placed as a card's first child; the card clips it to its corners.

import { Image, StyleSheet } from 'react-native';

import { type GroundHue, useGroundPair } from './Ground';
import { G } from './scheme';

const CARDS: Record<string, { dark: number; light: number }> = {
  'measured-timeDepth': {
    dark: require('../../assets/images/cards/measured-timeDepth-dark.jpg'),
    light: require('../../assets/images/cards/measured-timeDepth-light.jpg'),
  },
  'reported-change': {
    dark: require('../../assets/images/cards/reported-change-dark.jpg'),
    light: require('../../assets/images/cards/reported-change-light.jpg'),
  },
  'timeDepth-measured': {
    dark: require('../../assets/images/cards/timeDepth-measured-dark.jpg'),
    light: require('../../assets/images/cards/timeDepth-measured-light.jpg'),
  },
  'timeDepth-reported': {
    dark: require('../../assets/images/cards/timeDepth-reported-dark.jpg'),
    light: require('../../assets/images/cards/timeDepth-reported-light.jpg'),
  },
};

export const cardImage = (from: GroundHue, to: GroundHue) => (CARDS[`${from}-${to}`] ?? CARDS['measured-timeDepth'])[G.mode];

export function CardFill() {
  const { from, to } = useGroundPair();
  return <Image source={cardImage(from, to)} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />;
}
