// A small line through a handful of readings, with no axes: shape only.
// It was the Profile biomarker tile's; Today's metric cards carry it now.

import Svg, { Path } from 'react-native-svg';

import { smooth } from '../lib/curve';

export function Sparkline({ points, color, width = 56, height = 20 }: { points: number[]; color: string; width?: number; height?: number }) {
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const d = smooth(
    points.map((v, i) => ({
      x: (i / (points.length - 1)) * width,
      y: height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4),
    })),
  );
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
