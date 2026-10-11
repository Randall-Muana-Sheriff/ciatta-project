// The ground every screen stands on.
//
// Flat dark reads as a void: there is nothing for the eye to place a
// surface against, so a card looks like a mistake rather than a layer.
// Oura's ground is not flat and not neutral either, which is the part the
// first two attempts here missed. Its cycle screen washes from blue into
// violet behind the content, and that wash is most of why the screen reads
// as a place rather than as a background.
//
// The hues are the design system's own tints, the eight it marks grounds
// only. On light they are used as printed, pale fills at roughly 1.2:1.
// This is not light, and the system says what happens then: "Tints become
// transparency. A pale fill on dark reads as a hole." So the same hue
// arrives here as a wash over Graphite rather than as a pale block, which
// is the system's own resolution rather than a liberty taken with it.
//
// Two rules hold it:
//
//   The wash is a ground and nothing else. No card, no text and no mark
//   reads it, so a screen washed in Sky is not claiming anything about
//   what was measured on it.
//
//   Two hues at a time, never eight. A ground that cycles the whole
//   palette is a ground competing with the marks drawn on it.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

// The pale tints, grounds only. Straight out of
// 05.ciatta-design-system-foundations-tokens, at L 92 and chroma x 0.55.
export const TINT = {
  sky: '#DBE5FC',
  lavender: '#E8DFFC',
  rose: '#FCDAE8',
  flare: '#FCDCD7',
  ember: '#FCDECB',
  amber: '#FCE0BB',
  mustard: '#F8E3AC',
  citron: '#EAEAA6',
} as const;

export type TintName = keyof typeof TINT;

// Graphite, which every wash sits over.
const TOP = '#14171C';
const MID = '#0C0E11';
const FOOT = '#07080A';

export function Ground({
  children,
  // The pair the screen washes between. Sky into Lavender by default,
  // which is the pairing Oura's own cycle ground uses.
  from = 'sky',
  to = 'lavender',
}: {
  children?: ReactNode;
  from?: TintName;
  to?: TintName;
}) {
  return (
    <View style={s.fill}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          {/* Graphite underneath, so the washes have something to be over
              rather than something to replace. */}
          <LinearGradient id="g-base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={TOP} />
            <Stop offset="0.45" stopColor={MID} />
            <Stop offset="0.88" stopColor={MID} />
            <Stop offset="1" stopColor={FOOT} />
          </LinearGradient>

          {/* The first hue, pooled behind the top of the screen where the
              eye enters it. */}
          <RadialGradient id="g-from" cx="18%" cy="2%" rx="105%" ry="58%">
            <Stop offset="0" stopColor={TINT[from]} stopOpacity={0.2} />
            <Stop offset="0.55" stopColor={TINT[from]} stopOpacity={0.07} />
            <Stop offset="1" stopColor={TINT[from]} stopOpacity={0} />
          </RadialGradient>

          {/* The second, pooled low and to the other side, so the two meet
              across the middle of the screen rather than stacking. */}
          <RadialGradient id="g-to" cx="88%" cy="76%" rx="95%" ry="55%">
            <Stop offset="0" stopColor={TINT[to]} stopOpacity={0.16} />
            <Stop offset="0.6" stopColor={TINT[to]} stopOpacity={0.05} />
            <Stop offset="1" stopColor={TINT[to]} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-base)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-from)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-to)" />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // What shows for the instant before the gradient paints.
  fill: { flex: 1, backgroundColor: MID },
});
