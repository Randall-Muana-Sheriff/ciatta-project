// Whether this build can draw real glass.
//
// Translucency and glass are not the same thing, and the difference decides
// where each belongs. A card is translucent: the ground shows through it
// undisturbed, because nothing moves behind a card. The tab bar is the one
// surface her own content scrolls underneath, and a translucent bar would
// have her sentences sliding through it, legible and upside down against the
// labels. Glass diffuses what is behind it instead of transmitting it, which
// is why it is the right surface for a bar and overkill for a tile.
//
// Liquid glass needs iOS 26, and the native module needs to be in the binary.
// A dev client built before expo-glass-effect was a dependency has the
// JavaScript but not the module, and requireNativeModule throws there rather
// than returning false, so the check is wrapped: an older build reads as no
// glass and takes the painted fallback, which is what it was already doing.
//
// Read once, at module load. The answer cannot change while the app runs.

import { isLiquidGlassAvailable } from 'expo-glass-effect';

export const GLASS: boolean = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();
