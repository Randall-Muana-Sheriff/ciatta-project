// Frosted glass behind a card: the ground and anything scrolling under the
// card are blurred, then the card's own translucent fill and hairline edge
// sit on top. Placed as a card's first child; the card clips it to its
// corners.

import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { StyleSheet } from 'react-native';

import { GLASS } from './glass';
import { G } from './scheme';

// The same material as the tab bar: Liquid Glass, regular, in the app's
// own mode, where the phone has it, and a frosted blur where it does not.
export function GlassFill({ intensity = 28 }: { intensity?: number }) {
  if (GLASS) {
    return <GlassView glassEffectStyle="regular" colorScheme={G.mode} tintColor={G.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : undefined} style={StyleSheet.absoluteFill} pointerEvents="none" />;
  }
  return (
    <BlurView
      intensity={intensity}
      tint={G.mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
