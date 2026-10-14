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
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { G } from './scheme';
import { BASE, type Meaning } from './surface';

// The ground is named by meaning now, because the hue is the semantic
// colour rather than its pale print.
export type GroundHue = Meaning;

// Graphite on dark, warm paper on light, which every wash sits over. Read
// from the resolved scheme, which is set before this module loads.
const TOP = G.top;
const MID = G.mid;
const FOOT = G.foot;

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

// The wash alone, filling whatever holds it: for a sheet or a card that
// sits over the screen and must stand on the same ground as the screen.
export function GroundLayer({ from = 'measured', to = 'timeDepth' }: { from?: GroundHue; to?: GroundHue }) {
  return (
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
            <Stop offset="0" stopColor={BASE[from]} stopOpacity={G.washFrom} />
            <Stop offset="0.55" stopColor={BASE[from]} stopOpacity={G.washFrom * 0.35} />
            <Stop offset="1" stopColor={BASE[from]} stopOpacity={0} />
          </RadialGradient>

          {/* The second, pooled low and to the other side, so the two meet
              across the middle of the screen rather than stacking. */}
          <RadialGradient id="g-to" cx="88%" cy="76%" rx="95%" ry="55%">
            <Stop offset="0" stopColor={BASE[to]} stopOpacity={G.washTo} />
            <Stop offset="0.6" stopColor={BASE[to]} stopOpacity={G.washTo * 0.32} />
            <Stop offset="1" stopColor={BASE[to]} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-base)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-from)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g-to)" />
      </Svg>
  );
}

const s = StyleSheet.create({
  // What shows for the instant before the gradient paints.
  fill: { flex: 1, backgroundColor: MID },
});
