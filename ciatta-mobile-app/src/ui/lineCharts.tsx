import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { daysBetween } from '../data/cycleLog';
import { fmtHours } from '../lib/engine';
import { C, font, fonts, M } from '../theme';

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

  const segments: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v == null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  if (current) segments.push(current);
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

export const STAGE_ORDER = ['Awake', 'REM', 'Light', 'Deep'] as const;
export type Stage = (typeof STAGE_ORDER)[number];

// Day.stages allows a stage to be null (a night no wearable measured), but
// these two components only ever draw a night whose four stages are all
// known; the caller (HealthDashboard) decides whether that's the case and
// only renders them once it is, so the maths in here never has to treat an
// absence as zero minutes.
export type CompleteStages = { awake: number; rem: number; light: number; deep: number };

const stageMinutes = (s: CompleteStages, stage: Stage) =>
  stage === 'Awake' ? s.awake : stage === 'REM' ? s.rem : stage === 'Light' ? s.light : s.deep;

// Nested outlines, one per stage, sized by share of the night. The chosen
// stage is drawn heavier; nothing is filled.
export function StageRings({ stages, active }: { stages: CompleteStages; active: Stage }) {
  const total = stages.awake + stages.rem + stages.light + stages.deep || 1;
  const W = 150;
  const H = 110;
  const ordered = [...STAGE_ORDER].sort((a, b) => stageMinutes(stages, b) - stageMinutes(stages, a));
  return (
    <View style={{ width: W, height: H }} importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={H}>
        <Ellipse cx={W / 2} cy={H / 2} rx={70} ry={48} fill="none" stroke={C.separator} strokeWidth={1} />
        {ordered.map((stage) => {
          const share = stageMinutes(stages, stage) / total;
          const rx = 14 + Math.sqrt(share) * 60;
          const on = stage === active;
          return (
            <Ellipse
              key={stage}
              cx={W / 2}
              cy={H / 2 + (48 - rx * 0.62) * 0.35}
              rx={rx}
              ry={rx * 0.62}
              fill="none"
              stroke={on ? C.text : C.secondary}
              strokeWidth={on ? 3 : 1}
              opacity={on ? 1 : 0.55}
            />
          );
        })}
      </Svg>
    </View>
  );
}

export function StageLegend({
  stages,
  active,
  onPick,
}: {
  stages: CompleteStages;
  active: Stage;
  onPick: (stage: Stage) => void;
}) {
  const total = stages.awake + stages.rem + stages.light + stages.deep || 1;
  return (
    <View style={s.legend}>
      {STAGE_ORDER.map((stage) => {
        const on = stage === active;
        const mins = stageMinutes(stages, stage);
        return (
          <Pressable
            key={stage}
            onPress={() => onPick(stage)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${stage}, ${fmtHours(mins / 60)}, ${Math.round((mins / total) * 100)} percent`}
            hitSlop={6}
            style={s.legendRow}
          >
            <View style={[s.legendDot, { backgroundColor: on ? C.text : C.chevron }]} />
            <Text style={[font('subhead', on ? 'semibold' : 'regular'), { color: on ? C.text : C.secondary, flex: 1 }]}>{stage}</Text>
            <Text style={[font('footnote'), { color: on ? C.text : C.secondary }]}>{fmtHours(mins / 60)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A line from 4 to 10 hours: the gray ring is her usual, the white point is
// this value.
export function DotScale({ value, usual }: { value: number; usual: number }) {
  const W = 140;
  const H = 30;
  const x = (h: number) => 10 + (Math.max(4, Math.min(10, h)) - 4) / 6 * (W - 20);
  return (
    <Svg width={W} height={H}>
      <Line x1={10} x2={W - 10} y1={H / 2} y2={H / 2} stroke={C.separator} strokeWidth={1} />
      <Circle cx={10} cy={H / 2} r={3} fill={C.secondary} />
      <Circle cx={x(usual)} cy={H / 2} r={7} fill="none" stroke={C.secondary} strokeWidth={1.5} />
      <Circle cx={x(value)} cy={H / 2} r={9} fill={C.text} />
    </Svg>
  );
}

// Time in bed as the outer half ring; the inner half ring is the share of it
// spent asleep.
export function BedArc({ inBed, asleep }: { inBed: number; asleep: number }) {
  const W = 140;
  const H = 44;
  const R = 34;
  const r = R * Math.sqrt(Math.min(1, asleep / (inBed || 1)));
  const arc = (rad: number) => `M${W / 2 - rad},${H - 4} A${rad},${rad} 0 0 1 ${W / 2 + rad},${H - 4}`;
  return (
    <Svg width={W} height={H}>
      <Path d={arc(R)} fill="none" stroke={C.secondary} strokeWidth={1} opacity={0.6} />
      <Path d={arc(r)} fill="none" stroke={C.text} strokeWidth={2} />
      <Line x1={W / 2 - R - 12} x2={W / 2 + R + 12} y1={H - 4} y2={H - 4} stroke={C.text} strokeWidth={2} />
    </Svg>
  );
}

// A result against its reference range: the band is the range, the point is
// her value. Out of range points take the attention colour.
export function RangeBar({
  value,
  low,
  high,
  rangeColor,
  pointColor,
}: {
  value: number;
  low: number;
  high: number;
  rangeColor: string;
  pointColor: string;
}) {
  const W = 200;
  const H = 18;
  const min = Math.min(low * 0.6, value * 0.8);
  const max = Math.max(high * 1.1, value * 1.2);
  const x = (v: number) => 6 + ((v - min) / (max - min)) * (W - 12);
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={6} x2={W - 6} y1={H / 2} y2={H / 2} stroke={C.separator} strokeWidth={1} />
        <Rect x={x(low)} y={H / 2 - 2.5} width={x(high) - x(low)} height={5} rx={2.5} fill={rangeColor} opacity={0.35} />
        <Circle cx={x(value)} cy={H / 2} r={4.5} fill={pointColor} />
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
