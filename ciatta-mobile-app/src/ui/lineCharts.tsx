import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { daysBetween } from '../data/cycleLog';
import { fmtHours } from '../lib/engine';
import { C, font, fonts, M } from '../theme';
import { smoothSegments } from '../lib/curve';

// Minimal charts for the Health dashboard: single weight hairlines, open end
// points, a dashed line for her usual level, and no fills. A gap in the data
// stays a gap; an absence is never drawn as a value.

type Num = number | null;

export function HairlineChart({
  values,
  usual,
  color,
  height = 64,
  first,
  last,
  dots = false,
}: {
  values: Num[];
  usual?: number;
  color: string;
  height?: number;
  first?: string;
  last?: string;
  dots?: boolean;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  const W = 320;
  const pad = 8;
  const labelH = first || last ? 18 : 0;
  const H = height;
  const lo = Math.min(...nums, usual ?? Infinity);
  const hi = Math.max(...nums, usual ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (values.length > 1 ? i / (values.length - 1) : 0.5) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);

  // Each run of real values is curved on its own. A single curve across a
  // missing stretch would draw a confident line through days with no
  // reading, which is the thing the gap exists to say.
  const segments = smoothSegments(values.map((v, i) => (v == null ? null : { x: x(i), y: y(v) })));
  let lastIdx = values.length - 1;
  while (lastIdx >= 0 && values[lastIdx] == null) lastIdx--;

  return (
    <View style={{ width: '100%', aspectRatio: W / (H + labelH) }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H + labelH}`}>
        {usual != null ? (
          <Line x1={pad} x2={W - pad} y1={y(usual)} y2={y(usual)} stroke={C.secondary} strokeWidth={1} strokeDasharray="3 5" opacity={0.55} />
        ) : null}
        {segments.map((d, i) => (
          <Path key={i} d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {dots
          ? values.map((v, i) =>
              v == null || i === lastIdx ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} />,
            )
          : null}
        {lastIdx >= 0 ? (
          <Circle cx={x(lastIdx)} cy={y(values[lastIdx] as number)} r={4} fill={C.card} stroke={color} strokeWidth={1.5} />
        ) : null}
        {first ? (
          <SvgText x={pad} y={H + labelH - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>
            {first}
          </SvgText>
        ) : null}
        {last ? (
          <SvgText x={W - pad} y={H + labelH - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">
            {last}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

// Completed cycle lengths as points on one line. The dashed tick is the
// middle length; the open point is the latest cycle.
export function LengthDots({ lengths }: { lengths: number[] }) {
  if (!lengths.length) return null;
  const W = 320;
  const H = 44;
  const pad = 12;
  const lo = Math.min(21, ...lengths);
  const hi = Math.max(45, ...lengths);
  const x = (n: number) => pad + ((n - lo) / (hi - lo)) * (W - pad * 2);
  const sorted = [...lengths].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const lastIdx = lengths.length - 1;
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={pad} x2={W - pad} y1={16} y2={16} stroke={C.separator} strokeWidth={1} />
        <Line x1={x(median)} x2={x(median)} y1={6} y2={26} stroke={C.secondary} strokeWidth={1} strokeDasharray="3 3" />
        {lengths.map((n, i) => (
          <Circle key={i} cx={x(n)} cy={16} r={i === lastIdx ? 5 : 4} fill={i === lastIdx ? C.card : M.timeDepth} stroke={M.timeDepth} strokeWidth={1.5} />
        ))}
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>{`${lo} days`}</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">{`${hi} days`}</SvgText>
      </Svg>
    </View>
  );
}

// Weeks since birth on one line, with a point for each period that returned.
export function PostpartumTimeline({ weeks, periodWeeks }: { weeks: number; periodWeeks: number[] }) {
  const W = 320;
  const H = 44;
  const pad = 12;
  const span = Math.max(52, weeks);
  const x = (w: number) => pad + (Math.min(w, span) / span) * (W - pad * 2);
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={pad} x2={W - pad} y1={16} y2={16} stroke={C.separator} strokeWidth={1} />
        <Line x1={pad} x2={x(weeks)} y1={16} y2={16} stroke={M.timeDepth} strokeWidth={2} />
        {periodWeeks.map((w, i) => (
          <Circle key={i} cx={x(w)} cy={16} r={4} fill={M.reported} />
        ))}
        <Circle cx={x(weeks)} cy={16} r={5} fill={C.card} stroke={M.timeDepth} strokeWidth={1.5} />
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>Birth</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">{`${span} weeks`}</SvgText>
      </Svg>
    </View>
  );
}

// Twelve steps toward a year without a period; the filled ones have passed.
export function MonthsSince({ months }: { months: number }) {
  const W = 320;
  const H = 44;
  const pad = 12;
  const step = (W - pad * 2) / 11;
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: 12 }, (_, i) => (
          <Circle
            key={i}
            cx={pad + i * step}
            cy={16}
            r={5}
            fill={i < months ? M.timeDepth : 'none'}
            stroke={i < months ? M.timeDepth : C.separator}
            strokeWidth={1.5}
          />
        ))}
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>1</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">12 months</SvgText>
      </Svg>
    </View>
  );
}

// The current cycle as a line of days: period days, the fertile window as an
// outline, the likely ovulation days, and today. An estimate is dashed; a
// confirmed ovulation is filled.
export function FertilityStrip({
  start,
  fertile,
  ovulation,
  confirmed,
  today = new Date(),
}: {
  start: Date;
  fertile: { start: Date; end: Date };
  ovulation: { start: Date; end: Date };
  confirmed: boolean;
  today?: Date;
}) {
  const W = 320;
  const H = 48;
  const pad = 12;
  const y = 18;
  const dayOf = (d: Date) => daysBetween(start, d);
  const total = Math.max(28, dayOf(fertile.end) + 12, dayOf(today) + 3);
  const x = (n: number) => pad + (Math.max(0, Math.min(n, total)) / total) * (W - pad * 2);
  const t = dayOf(today);
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={pad} x2={W - pad} y1={y} y2={y} stroke={C.separator} strokeWidth={1} />
        <Rect x={x(0)} y={y - 3} width={x(5) - x(0)} height={6} rx={3} fill={M.reported} />
        <Rect
          x={x(dayOf(fertile.start))}
          y={y - 8}
          width={x(dayOf(fertile.end) + 1) - x(dayOf(fertile.start))}
          height={16}
          rx={8}
          fill="none"
          stroke={M.timeDepth}
          strokeWidth={1.5}
          strokeDasharray={confirmed ? undefined : '4 3'}
        />
        <Rect
          x={x(dayOf(ovulation.start))}
          y={y - 4}
          width={Math.max(6, x(dayOf(ovulation.end) + 1) - x(dayOf(ovulation.start)))}
          height={8}
          rx={4}
          fill={confirmed ? M.timeDepth : 'none'}
          stroke={M.timeDepth}
          strokeWidth={1.5}
        />
        {t >= 0 && t <= total ? <Line x1={x(t)} x2={x(t)} y1={y - 12} y2={y + 12} stroke={C.text} strokeWidth={1.5} /> : null}
        <SvgText x={pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>Day 1</SvgText>
        <SvgText x={W - pad} y={H - 3} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">{`Day ${total}`}</SvgText>
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
