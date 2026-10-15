// A card on a photograph, as Lotus sets its care cards and as Insights sets
// its own: an image from Ciatta's generator under one dark wash that
// deepens toward the foot. Every card in the app draws the same wash
// (CardWash), whether it is a PhotoCard or a content card's CardFill, so
// there is one card style rather than two.

import type { ReactNode } from 'react';
import { ImageBackground, type ImageSourcePropType, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Raised from the foot-only wash an insight card once had, because every
// card now carries type from top to bottom. With each image toned to suit,
// every text colour clears 4.5:1 on the brightest part of any card.
export const WASH = [0.62, 0.68, 0.76] as const;

// A unit view box stretched to the card, so the wash covers the whole card
// at any size rather than the Svg's default 300 by 150.
export function CardWash() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="card-wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0C0E11" stopOpacity={WASH[0]} />
          <Stop offset="0.55" stopColor="#0C0E11" stopOpacity={WASH[1]} />
          <Stop offset="1" stopColor="#0C0E11" stopOpacity={WASH[2]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill="url(#card-wash)" />
    </Svg>
  );
}

export function PhotoCard({
  source,
  children,
  style,
}: {
  source: ImageSourcePropType;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <ImageBackground source={source} style={[s.card, style]} imageStyle={[s.image, style?.borderRadius != null ? { borderRadius: style.borderRadius } : null]} resizeMode="cover" accessibilityIgnoresInvertColors>
      <CardWash />
      <View style={s.body}>{children}</View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden' },
  image: { borderRadius: 22 },
  body: { padding: 18, gap: 10, flexGrow: 1 },
});
