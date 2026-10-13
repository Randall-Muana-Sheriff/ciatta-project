// The agent, as a mark.
//
// Care is something she talks to, and a title in the corner said "page".
// This says "someone" with as little as it can: a circle and two eyes,
// drawn in white line on the near black ground, the same way the rest of
// the interface draws with type and hairlines rather than fills. No
// gradient, no face, no colour: the eyes are what make it an agent and
// not a button, and nothing else is needed to say so.

import Svg, { Circle, Line } from 'react-native-svg';

const INK = '#FFFFFF';

export function AgentAvatar({ size = 64 }: { size?: number }) {
  // One stroke weight for the whole mark, scaled with it, so it stays a
  // line drawing at any size rather than thickening into a badge.
  const stroke = 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={32} cy={32} r={26} fill="none" stroke={INK} strokeWidth={stroke} />
      <Line x1={26.5} y1={27} x2={26.5} y2={34} stroke={INK} strokeWidth={stroke} strokeLinecap="round" />
      <Line x1={37.5} y1={27} x2={37.5} y2={34} stroke={INK} strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}
