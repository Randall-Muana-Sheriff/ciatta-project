// A content card's ground, made by the same generator as the insight
// headings: a dark room lit in the screen's two hues, a soft figure out of
// focus, grain. The same in light and dark, as the insight cards are: the
// card is the object, and only the ground around it changes with the mode.

import { Image, StyleSheet } from 'react-native';

import { type GroundHue, useGroundPair } from './Ground';

const CARDS: Record<string, number> = {
  'measured-timeDepth': require('../../assets/images/cards/measured-timeDepth.jpg'),
  'reported-change': require('../../assets/images/cards/reported-change.jpg'),
  'timeDepth-measured': require('../../assets/images/cards/timeDepth-measured.jpg'),
  'timeDepth-reported': require('../../assets/images/cards/timeDepth-reported.jpg'),
};

export const cardImage = (from: GroundHue, to: GroundHue) => CARDS[`${from}-${to}`] ?? CARDS['measured-timeDepth'];

export function CardFill() {
  const { from, to } = useGroundPair();
  return <Image source={cardImage(from, to)} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />;
}
