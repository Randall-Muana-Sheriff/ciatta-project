// Frosted glass behind a card: the ground and anything scrolling under the
// card are blurred, then the card's own translucent fill and hairline edge
// sit on top. Placed as a card's first child; the card clips it to its
// corners.

import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import { G } from './scheme';

export function GlassFill({ intensity = 28 }: { intensity?: number }) {
  return (
    <BlurView
      intensity={intensity}
      tint={G.mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
