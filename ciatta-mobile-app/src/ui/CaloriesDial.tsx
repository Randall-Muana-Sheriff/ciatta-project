// The Calories block's dial (design: IMG_4912): a wide arc with tick
// marks, the filled part in the app's sky, and a dot where today stands.
// Drawn only when there is something to fill toward: her target or her
// usual day.

import Svg, { Circle, Line, Path } from 'react-native-svg';

import { L } from './surface';
import { onGround } from './scheme';

const SKY = onGround('#6FB6F5');

export function CaloriesDial({ fill, width }: { fill: number; width: number }) {
  const h = width * 0.42;
  const cx = width / 2;
  const cy = h * 1.55;
  const r = width * 0.46;
  // The arc spans 150 degrees, centred on the top.
  const from = (-165 * Math.PI) / 180;
  const span = (150 * Math.PI) / 180;
  const at = (t: number, radius = r) => {
    const a = from + t * span;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  const arc = (t0: number, t1: number) => {
    const a = at(t0);
    const b = at(t1);
    return `M${a.x},${a.y} A${r},${r} 0 0 1 ${b.x},${b.y}`;
  };
  const f = Math.max(0, Math.min(1, fill));
  const dot = at(f);
  return (
    <Svg width={width} height={h} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 31 }, (_, i) => {
        const t = i / 30;
        const outer = at(t, r + 14);
        const inner = at(t, r + (i % 5 === 0 ? 6 : 10));
        return <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={L.meta} strokeWidth={i % 5 === 0 ? 1.4 : 0.8} opacity={0.6} />;
      })}
      <Path d={arc(0, 1)} stroke={L.rule} strokeWidth={4} fill="none" strokeLinecap="round" />
      {f > 0 ? <Path d={arc(0, f)} stroke={SKY} strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
      <Circle cx={dot.x} cy={dot.y} r={7} fill={SKY} />
    </Svg>
  );
}
