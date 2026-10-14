// A content card's ground: a motion blurred film photograph, one per tab,
// under the insight card's dark wash. Free under the Unsplash License; see
// assets/images/cards/CREDITS.md. The same in light and dark, as the insight cards are: the
// card is the object, and only the ground around it changes with the mode.

import { Image, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { type GroundHue, useGroundPair } from './Ground';

const CARDS: Record<string, number> = {
  'measured-timeDepth': require('../../assets/images/cards/measured-timeDepth.jpg'),
  'reported-change': require('../../assets/images/cards/reported-change.jpg'),
  'timeDepth-measured': require('../../assets/images/cards/timeDepth-measured.jpg'),
  'timeDepth-reported': require('../../assets/images/cards/timeDepth-reported.jpg'),
};

export const cardImage = (from: GroundHue, to: GroundHue) => CARDS[`${from}-${to}`] ?? CARDS['measured-timeDepth'];

// The wash is the insight card's own, deepening toward the foot, with its
// floor raised: a content card carries type from top to bottom, where an
// insight card carries it only at the foot. Each photo is toned so that at
// 62 percent every text colour clears 4.5:1 on its brightest part.
const WASH = [0.62, 0.68, 0.76];

export function CardFill() {
  const { from, to } = useGroundPair();
  return (
    <>
      <Image source={cardImage(from, to)} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />
      {/* A unit view box stretched to the card, so the wash covers the
          whole card at any size rather than the Svg's default 300 by 150. */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="cf-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C0E11" stopOpacity={WASH[0]} />
            <Stop offset="0.55" stopColor="#0C0E11" stopOpacity={WASH[1]} />
            <Stop offset="1" stopColor="#0C0E11" stopOpacity={WASH[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#cf-wash)" />
      </Svg>
    </>
  );
}
