// A card's ground.
//
// CardFill is the glow: coloured light at the top of the card fading into a
// dark foot, soft rather than flat, with a fine grain over it (see glow.ts).
// Each card on a screen takes a different pair of hues.
//
// CardPhoto is the photograph under the insight wash, kept for the screens
// set that way on purpose: Care and the Visit prep it opens.

import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FOOT as DARK_FOOT, glowFor, LIGHT_END, LIGHT_FOOT, LIGHT_TOP, MID, mix, POOL, topFor } from './glow';
import { G } from './scheme';
import { useGroundPair } from './Ground';
import { CardWash } from './PhotoCard';

const GRAIN = require('../../assets/images/grain.png');
let ids = 0;

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
];

// Which image the nth card on a screen takes.
export const poolIndex = (n: number) => n % CARD_POOL.length;

export function CardFill() {
  const { next } = useGroundPair();
  const [n] = useState(next);
  const [id] = useState(() => `glow${ids++}`);
  const pair = glowFor(n);
  // On light, the same glow in a lighter shade: the hue softly over the
  // card's near white, and no grain, which reads as dust on paper.
  const light = G.mode === 'light';
  const FOOT = light ? LIGHT_FOOT : DARK_FOOT;
  const top = light ? LIGHT_TOP : topFor(pair);
  return (
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          {/* The light falling from the top edge into the dark. */}
          <LinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mix(pair[0], FOOT, top)} />
            <Stop offset={LIGHT_END} stopColor={mix(pair[0], FOOT, MID)} />
            <Stop offset={LIGHT_END + 0.25} stopColor={FOOT} />
            <Stop offset="1" stopColor={FOOT} />
          </LinearGradient>
          {/* The second hue, pooled at the top to one side, so the light
              has a shape and blurs into the first. */}
          <RadialGradient id={`${id}r`} cx="0.82" cy="0" rx="0.7" ry="0.32" fx="0.82" fy="0">
            <Stop offset="0" stopColor={pair[1]} stopOpacity={POOL * top} />
            <Stop offset="1" stopColor={pair[1]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}l)`} />
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}r)`} />
      </Svg>
      {/* One grain image across the whole card. A repeating tile drew only
          a single square in the corner. */}
      {light ? null : <Image source={GRAIN} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} />}
    </>
  );
}

// The photograph under the insight wash.
export function CardPhoto() {
  const { next } = useGroundPair();
  const [n] = useState(next);
  return (
    <>
      <Image source={CARD_POOL[poolIndex(n)]} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />
      <CardWash />
    </>
  );
}
