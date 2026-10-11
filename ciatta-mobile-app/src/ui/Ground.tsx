// The ground every screen stands on.
//
// A single flat dark fill reads as a void: there is nothing for the eye to
// place a surface against, so a card at 15171A on a page at 0B0C0E looks
// like a mistake rather than a layer. Oura's ground is not flat. It lifts
// slightly at the top, settles through the middle, and deepens at the
// foot, and that shift is most of why its cards read as sitting on
// something.
//
// Three rules keep this from becoming decoration:
//
//   It is monochrome. The shift is in lightness only, on the same neutral
//   the grounds are cut from. A tinted gradient would put a colour behind
//   content on a surface where colour means something.
//
//   It stays under the content. The first version was fourteen points of
//   lightness across a whole screen, which turned out to be invisible on a
//   phone: an effect nobody can see is an effect that is not there. It is
//   about twice that now, plus a soft lift at the top, which is enough to
//   read as depth and still not enough to compete with a chart.
//
//   It is behind everything and touches nothing. No card, no text and no
//   mark reads it, so it cannot change what anything means.

import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { L } from './surface';

// The three tones, lightest to deepest. The top is where the eye enters a
// screen and the foot is where the floating nav sits, so the bar has
// something fractionally darker to lift off.
const TOP = '#1C2129';
const MID = '#0C0E11';
const FOOT = '#070809';

export function Ground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={s.fill}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={TOP} />
            {/* Settled by a third of the way down, so most of a long
                scrolling screen is one steady tone and only its ends
                differ. A gradient running the whole height would make the
                same card look like two different cards at two scroll
                positions. */}
            <Stop offset="0.34" stopColor={MID} />
            <Stop offset="0.86" stopColor={MID} />
            <Stop offset="1" stopColor={FOOT} />
          </LinearGradient>
          {/*
            A soft lift behind the top of the screen, which is what gives
            the ramp a shape rather than a direction. White at four
            percent: monochrome, because a tinted glow would put colour
            behind content on a surface where colour carries meaning.
          */}
          <RadialGradient id="lift" cx="50%" cy="0%" rx="90%" ry="42%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.055} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ground)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lift)" />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // The flat colour underneath is what shows for the instant before the
  // gradient paints, and on any surface the Svg cannot cover.
  fill: { flex: 1, backgroundColor: MID },
});
