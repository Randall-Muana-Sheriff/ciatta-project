// The Ciatta wordmark. Brand Brief / Constitution v2.0, section 06 Logo,
// and the same component the landing page ships.
//
// "A wordmark and nothing else. There is no symbol, no container, no icon
// and no registered mark: the name, set once, correctly, is the entire
// identity."
//
// So this is type, not an image. The app had been drawing a PNG of it,
// which is the one thing the Constitution rules out: a picture of a
// wordmark cannot be set correctly, it can only be scaled, and it had to
// be tinted at every call site because the artwork was white.
//
// The rules it holds:
//
//   Face      Jost, weight 500. Never lighter, never heavier, never italic.
//   Case      All capitals, always. "Ciatta" in sentence case is body copy.
//   Tracking  Widely tracked, and more so at small sizes. Never tightened.
//   Grounds   Graphite or Paper only. Never a semantic colour, and semantic
//             colour never sits behind it. Ember never enters the lockup.
//   Space     Clear space on all four sides equals the cap height.
//
// The text stays sentence case and the style raises it, because a screen
// reader given literal "CIATTA" may spell it out letter by letter. The mark
// is uppercase to the eye and a word to the ear, which is what we want.

import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '../theme';
import { L } from './surface';

export type WordmarkSize = 'sm' | 'md';

// Sizes and tracking from the landing page's own stylesheet, converted from
// rem at the browser's 16px root. Tracking is in points here rather than em,
// which is what React Native takes, so it is computed from the size.
// sm is a fifth smaller than the landing page's own, because at the top of
// a screen the mark is a signature rather than a headline: it says whose
// record this is and then gets out of the way of the record. Tracking opens
// a touch as it shrinks, which is the rule above, never the reverse. Clear
// space is still the cap height, so the mark's whole block shrinks with it.
const SIZES: Record<WordmarkSize, { fontSize: number; trackEm: number }> = {
  sm: { fontSize: 16.4, trackEm: 0.075 },
  md: { fontSize: 26.2, trackEm: 0.06 },
};

export function Wordmark({
  size = 'sm',
  color = L.ink,
}: {
  size?: WordmarkSize;
  // Graphite or Paper. There is no third option, and a semantic colour is
  // never one of them.
  color?: string;
}) {
  const { fontSize, trackEm } = SIZES[size];
  return (
    // Clear space on all four sides equals the cap height. Nothing enters
    // it, which is why it is padding on the mark rather than margin left to
    // whatever is placed next to it.
    <View style={{ padding: fontSize * 0.72 }}>
      <Text
        accessibilityRole="image"
        accessibilityLabel="Ciatta"
        style={[
          s.mark,
          {
            fontSize,
            letterSpacing: fontSize * trackEm,
            color,
            // The tracking adds a space after the last letter too, so the
            // mark is pulled back by one step to stay optically centred.
            marginRight: -(fontSize * trackEm),
          },
        ]}
      >
        Ciatta
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  mark: {
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    // Jost's own line height leaves the mark sitting high in its box.
    lineHeight: undefined,
    includeFontPadding: false,
  },
});
