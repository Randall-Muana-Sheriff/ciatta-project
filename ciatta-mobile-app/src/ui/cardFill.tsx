// A content card's ground: a motion blurred film photograph under the
// insight card's dark wash. Every card on a screen takes a different one
// from the pool, in the order it mounts. Free under the Unsplash License;
// see assets/images/cards/CREDITS.md.

import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useGroundPair } from './Ground';

export const CARD_POOL: number[] = [
  require('../../assets/images/cards/00.jpg'),
  require('../../assets/images/cards/01.jpg'),
  require('../../assets/images/cards/02.jpg'),
  require('../../assets/images/cards/03.jpg'),
  require('../../assets/images/cards/04.jpg'),
  require('../../assets/images/cards/05.jpg'),
  require('../../assets/images/cards/06.jpg'),
  require('../../assets/images/cards/07.jpg'),
  require('../../assets/images/cards/08.jpg'),
  require('../../assets/images/cards/09.jpg'),
  require('../../assets/images/cards/10.jpg'),
  require('../../assets/images/cards/11.jpg'),
  require('../../assets/images/cards/12.jpg'),
  require('../../assets/images/cards/13.jpg'),
  require('../../assets/images/cards/14.jpg'),
  require('../../assets/images/cards/15.jpg'),
  require('../../assets/images/cards/16.jpg'),
];

// The Metrics container: a dark blur the glass tiles sit over.
export const METRICS_GROUND = require('../../assets/images/cards/metrics.jpg');

// Which photo the nth card on a screen takes.
export const poolIndex = (n: number) => n % CARD_POOL.length;

// The wash is the insight card's own, deepening toward the foot, with its
// floor raised: a content card carries type from top to bottom. Each photo
// is toned so that at 62 percent every text colour clears 4.5:1 on its
// brightest part.
const WASH = [0.62, 0.68, 0.76];

export function CardFill({ source, wash = WASH }: { source?: number; wash?: number[] }) {
  const { next } = useGroundPair();
  const [n] = useState(next);
  return (
    <>
      <Image source={source ?? CARD_POOL[poolIndex(n)]} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />
      {/* A unit view box stretched to the card, so the wash covers the
          whole card at any size rather than the Svg's default 300 by 150. */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="cf-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C0E11" stopOpacity={wash[0]} />
            <Stop offset="0.55" stopColor="#0C0E11" stopOpacity={wash[1]} />
            <Stop offset="1" stopColor="#0C0E11" stopOpacity={wash[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#cf-wash)" />
      </Svg>
    </>
  );
}
