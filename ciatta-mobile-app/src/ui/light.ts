// The light surface, shared.
//
// These started as four local constants in OnboardingScreen and are here
// because the app is being brought onto them screen by screen. A second
// copy would drift within a week, and the thing that makes the onboarding
// feel considered is that every surface uses the same five values rather
// than five near misses.
//
// Why light at all, when the record has always been dark: onboarding is a
// conversation she is having, and the rest is becoming a document she
// reads. Black on white is the most contrast available for reading, and it
// is what the editorial layout below is built for.

export const L = {
  // Near black rather than black. Pure black on pure white vibrates at text
  // sizes, and this reads as ink.
  ink: '#111113',
  // Secondary text. Clears 4.6:1 on white, so it stays readable rather than
  // becoming decoration.
  muted: '#6B6B70',
  // Hairlines and borders.
  line: '#E4E4E7',
  // The tile and field fill. A grey with a trace of warmth, so a page of
  // tiles does not read as cold grey on cold white.
  field: '#F5F5F7',
  bg: '#FFFFFF',
} as const;

// Accents, used once each and never decoratively. The record's own meaning
// colours are built for a dark ground and do not survive on white, so these
// are their light counterparts, chosen at the same meanings.
export const LA = {
  // Anything instrumented: a reading that came from a device.
  measured: '#2F5BD8',
  // Anything she reported herself.
  reported: '#8A4FD8',
  // Something that completed or is in a good state.
  good: '#0B7A4B',
  // Attention, never alarm. Nothing in Ciatta is urgent on her behalf.
  attention: '#B4531A',
} as const;

// One corner radius for tiles, matching the onboarding cards. Bento only
// reads as bento when every tile shares an edge treatment.
export const TILE_RADIUS = 18;
