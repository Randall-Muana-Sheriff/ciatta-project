// A content card's ground, drawn exactly as an insight card is: an image
// from the same generator under the same wash (CardWash). Every card on a
// screen takes a different image from the pool, in the order it mounts.

import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { useGroundPair } from './Ground';
import { CardWash } from './PhotoCard';

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
  return (
    <>
      <Image source={CARD_POOL[poolIndex(n)]} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} accessible={false} />
      <CardWash />
    </>
  );
}
