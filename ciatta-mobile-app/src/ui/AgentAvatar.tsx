// The agent, as a character.
//
// Care is something she talks to, and a title in the corner said "page".
// A small soft figure says "someone": a hooded shape in Ciatta's own rose
// and lavender, a lighter face, two eyes and a small smile. Drawn rather
// than imported, so it stays sharp at any size and takes the palette with
// it if the palette changes.

import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { C } from '../theme';

export function AgentAvatar({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        {/* Lit from the upper left, so the hood reads as soft and round. */}
        <RadialGradient id="hood" cx="38%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#FCE4F1" />
          <Stop offset="0.55" stopColor={C.coral} stopOpacity={0.75} />
          <Stop offset="1" stopColor={C.lavender} />
        </RadialGradient>
        <RadialGradient id="face" cx="50%" cy="40%" r="65%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#FBEFF6" />
        </RadialGradient>
      </Defs>

      {/* The hood: a dome that widens into shoulders. */}
      <Path
        d="M32 4C18 4 10 15 10 29c0 9 2 16 1 25 0 4 3 6 7 6h28c4 0 7-2 7-6-1-9 1-16 1-25C54 15 46 4 32 4z"
        fill="url(#hood)"
      />
      {/* The face, set into the hood. */}
      <Ellipse cx={32} cy={30} rx={14} ry={12.5} fill="url(#face)" />

      {/* Eyes, cheeks, and a small smile. */}
      <Circle cx={26.5} cy={29} r={2} fill="#3A2A3A" />
      <Circle cx={37.5} cy={29} r={2} fill="#3A2A3A" />
      <Circle cx={27.2} cy={28.3} r={0.6} fill="#FFFFFF" />
      <Circle cx={38.2} cy={28.3} r={0.6} fill="#FFFFFF" />
      <Ellipse cx={23} cy={34} rx={2.6} ry={1.6} fill={C.coral} opacity={0.35} />
      <Ellipse cx={41} cy={34} rx={2.6} ry={1.6} fill={C.coral} opacity={0.35} />
      <Path d="M29.5 34.5c1.4 1.4 3.6 1.4 5 0" stroke="#3A2A3A" strokeWidth={1.3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
