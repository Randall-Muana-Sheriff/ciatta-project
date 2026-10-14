// The ground every screen stands on.
//
// Flat dark reads as a void: there is nothing for the eye to place a
// surface against, so a card looks like a mistake rather than a layer.
// Oura's ground is not flat and not neutral either, which is the part the
// first two attempts here missed. Its cycle screen washes from blue into
// violet behind the content, and that wash is most of why the screen reads
// as a place rather than as a background.
//
// The hues are the semantic eight, one meaning each, at their Base step.
// The system says exactly how a ground in one of them resolves here: "A
// band resolves to its tint on light, and to its base at 12 to 20 percent
// alpha on dark. A pale fill on dark reads as a hole." So these are Base
// at sixteen and twenty percent, which is that band, and not the pale
// tints, which are the same eight hues printed for a white page.
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
import { Image, StyleSheet, View } from 'react-native';

import { G } from './scheme';
import type { Meaning } from './surface';

// The ground is named by meaning now, because the hue is the semantic
// colour rather than its pale print.
export type GroundHue = Meaning;

// What shows for the instant before the image paints: the ground's own
// middle tone, read from the resolved scheme.
const MID = G.mid;

export function Ground({
  children,
  // The pair the screen washes between. Sky into Lavender by default,
  // which is the pairing Oura's own cycle ground uses.
  from = 'measured',
  to = 'timeDepth',
}: {
  children?: ReactNode;
  from?: GroundHue;
  to?: GroundHue;
}) {
  return (
    <View style={s.fill}>
      <GroundLayer from={from} to={to} />
      {children}
    </View>
  );
}

// The rendered grounds: the insight headings' room, lit in the screen's two
// hues, black for dark and daylight paper for light. Generated for Ciatta,
// one per pair a screen uses; any other pair takes Sky into Lavender.
const IMAGES: Record<string, { dark: number; light: number }> = {
  'measured-timeDepth': {
    dark: require('../../assets/images/grounds/measured-timeDepth-dark.jpg'),
    light: require('../../assets/images/grounds/measured-timeDepth-light.jpg'),
  },
  'reported-change': {
    dark: require('../../assets/images/grounds/reported-change-dark.jpg'),
    light: require('../../assets/images/grounds/reported-change-light.jpg'),
  },
  'timeDepth-measured': {
    dark: require('../../assets/images/grounds/timeDepth-measured-dark.jpg'),
    light: require('../../assets/images/grounds/timeDepth-measured-light.jpg'),
  },
  'timeDepth-reported': {
    dark: require('../../assets/images/grounds/timeDepth-reported-dark.jpg'),
    light: require('../../assets/images/grounds/timeDepth-reported-light.jpg'),
  },
};

export const groundImage = (from: GroundHue, to: GroundHue, mode: 'dark' | 'light') =>
  (IMAGES[`${from}-${to}`] ?? IMAGES['measured-timeDepth'])[mode];

// The ground alone, filling whatever holds it: for a sheet or a card that
// sits over the screen and must stand on the same ground as the screen.
export function GroundLayer({ from = 'measured', to = 'timeDepth' }: { from?: GroundHue; to?: GroundHue }) {
  return (
    <Image
      source={groundImage(from, to, G.mode)}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      fadeDuration={0}
      accessible={false}
    />
  );
}

const s = StyleSheet.create({
  // What shows for the instant before the gradient paints.
  fill: { flex: 1, backgroundColor: MID },
});
