// A card on a photograph, as Lotus sets its care cards: the app's own
// photography under a dark wash that deepens toward the type, so white
// text reads on any frame. Used by Your Care and by Insights.

import type { ReactNode } from 'react';
import { ImageBackground, type ImageSourcePropType, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function PhotoCard({
  source,
  children,
  style,
  shade = 0.62,
}: {
  source: ImageSourcePropType;
  children: ReactNode;
  style?: ViewStyle;
  // How dark the wash is at its deepest.
  shade?: number;
}) {
  return (
    <ImageBackground source={source} style={[s.card, style]} imageStyle={s.image} resizeMode="cover" accessibilityIgnoresInvertColors>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="pc-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0C0E11" stopOpacity={shade * 0.55} />
            <Stop offset="0.55" stopColor="#0C0E11" stopOpacity={shade * 0.8} />
            <Stop offset="1" stopColor="#0C0E11" stopOpacity={shade} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pc-wash)" />
      </Svg>
      <View style={s.body}>{children}</View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  image: { borderRadius: 22 },
  body: { padding: 18, gap: 10, flexGrow: 1 },
});
