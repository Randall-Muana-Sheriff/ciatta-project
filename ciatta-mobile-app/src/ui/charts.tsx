import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { C, fonts, sans } from '../theme';

// Charts are drawn on the Figma frame's 333pt grid and scaled to the width
// they are given, so they keep the reference proportions on any phone.
function Frame({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', aspectRatio: w / h }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        {children}
      </Svg>
    </View>
  );
}

const axisFont = { fontSize: 11, fill: C.muted, fontFamily: fonts.sans[400] } as const;

// ── Insight: cycle length against sleep ────────────────────────
export function InsightLineChart() {
  const W = 333;
  const H = 138;
  const mx = [18, 64, 110, 156, 202, 248, 294];
  const cycleY = [30, 28, 26, 65, 28, 66, 28];
  const sleepY = [68, 66, 88, 72, 90, 74, 68];
  const path = (ys: number[]) => ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${mx[i]},${y}`).join(' ');
  const windows = [
    [mx[1] + 14, mx[3] + 12],
    [mx[3] + 28, mx[5] + 14],
  ];
  const dots = [
    [mx[2] + 8, 88],
    [mx[3], 65],
    [mx[4] + 4, 90],
    [mx[5], 66],
  ];

  return (
    <Frame w={W} h={H}>
      <Rect width={W} height={H} rx={8} fill={C.card} />
      {windows.map(([x1, x2]) => (
        <Rect key={x1} x={x1} y={8} width={x2 - x1} height={H - 22} rx={4} fill={C.orange} fillOpacity={0.13} />
      ))}
      <Line x1={18} y1={H - 10} x2={W - 18} y2={H - 10} stroke={C.border} strokeWidth={1} />
      <Path d={path(cycleY)} fill="none" stroke={C.blue} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={path(sleepY)} fill="none" stroke={C.sleepLine} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {dots.map(([cx, cy]) => (
        <Circle key={cx} cx={cx} cy={cy} r={5} fill={C.orange} />
      ))}
      <SvgText x={18} y={H - 1} {...axisFont} fontSize={10}>
        A lowest sleep week, then a short cycle inside ten days. Twice.
      </SvgText>
    </Frame>
  );
}

export function Legend({
  items,
  style,
}: {
  items: { label: string; color: string; kind?: 'line' | 'bar' }[];
  style?: object;
}) {
  return (
    <View style={[cs.legend, style]}>
      {items.map((it) => (
        <View key={it.label} style={cs.legendItem}>
          <View
            style={
              it.kind === 'bar'
                ? { width: 20, height: 7, borderRadius: 4, backgroundColor: it.color }
                : { width: 24, height: 2, backgroundColor: it.color }
            }
          />
          <Text style={[sans(12), { color: C.secondary }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Sleep: weekly averages with the low weeks called out ───────
export function SleepBarChart({ bars, highlight }: { bars: number[]; highlight: number[] }) {
  const W = 333;
  const H = 120;
  const barW = 13;
  const gap = 5;
  const offsetX = (W - (bars.length * barW + (bars.length - 1) * gap)) / 2;
  const refY = H * (1 - 0.86);
  const labels = [
    { label: 'Jan', i: 0 },
    { label: 'Mar', i: 8 },
    { label: 'May', i: 14 },
    { label: 'Jul', i: 17 },
  ];

  return (
    <Frame w={W} h={H + 24}>
      <Line x1={offsetX} y1={refY} x2={W - 14} y2={refY} stroke={C.secondary} strokeWidth={1} strokeDasharray="4 4" />
      <SvgText x={W - 12} y={refY + 4} {...axisFont} fontSize={10} fill={C.secondary} textAnchor="end">
        7h
      </SvgText>
      {bars.map((h, i) => {
        const low = highlight.includes(i);
        return (
          <Rect
            key={i}
            x={offsetX + i * (barW + gap)}
            y={H - h * H}
            width={barW}
            height={h * H}
            rx={3}
            fill={low ? C.orange : C.blue}
            opacity={low ? 0.95 : 0.7}
          />
        );
      })}
      <Line x1={offsetX} y1={H} x2={W - offsetX} y2={H} stroke={C.border} strokeWidth={1} />
      {labels.map(({ label, i }) => (
        <SvgText key={label} x={offsetX + i * (barW + gap) + barW / 2} y={H + 16} {...axisFont} textAnchor="middle">
          {label}
        </SvgText>
      ))}
    </Frame>
  );
}

// ── Sleep: one week, night by night ────────────────────────────
export function MiniWeekChart({ bars }: { bars: number[] }) {
  const H = 44;
  const bw = 22;
  const gap = 6;
  const W = bars.length * bw + (bars.length - 1) * gap;
  return (
    <Svg width={W} height={H + 16}>
      {bars.map((h, i) => (
        <Rect key={i} x={i * (bw + gap)} y={H - h * H} width={bw} height={h * H} rx={3} fill={C.blue} opacity={0.6} />
      ))}
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
        <SvgText key={i} x={i * (bw + gap) + bw / 2} y={H + 14} {...axisFont} textAnchor="middle">
          {d}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Cycle: length of each cycle, short ones called out ─────────
export function CycleBarChart({ bars }: { bars: { h: number; short?: string }[] }) {
  const W = 333;
  const H = 110;
  const barW = 36;
  const gap = 10;
  const offsetX = (W - (bars.length * barW + (bars.length - 1) * gap)) / 2;
  const refY = H * 0.12;
  const labels = [
    { label: 'Jan', i: 0 },
    { label: 'Mar', i: 2 },
    { label: 'May', i: 4 },
    { label: 'Jul', i: 6 },
  ];

  return (
    <Frame w={W} h={H + 24}>
      <Line x1={offsetX} y1={refY} x2={W - offsetX} y2={refY} stroke={C.secondary} strokeWidth={1} strokeDasharray="4 4" />
      {bars.map((b, i) => {
        const x = offsetX + i * (barW + gap);
        const y = H - b.h * H;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={b.h * H} rx={4} fill={b.short ? C.orange : C.blue} opacity={b.short ? 0.95 : 0.7} />
            {b.short ? (
              <SvgText x={x + barW / 2} y={y - 4} {...axisFont} fill={C.orange} fontFamily={fonts.sans[600]} textAnchor="middle">
                {b.short}
              </SvgText>
            ) : null}
          </G>
        );
      })}
      <Line x1={offsetX} y1={H} x2={W - offsetX} y2={H} stroke={C.border} strokeWidth={1} />
      {labels.map(({ label, i }) => (
        <SvgText key={label} x={offsetX + i * (barW + gap) + barW / 2} y={H + 16} {...axisFont} textAnchor="middle">
          {label}
        </SvgText>
      ))}
    </Frame>
  );
}

// ── Month axis for the span timelines ──────────────────────────
function MonthAxis({ months }: { months: number }) {
  return (
    <View style={cs.axis}>
      {['Jan', 'Mar', 'May', 'Jul'].map((l, i) => (
        <Text key={l} style={[sans(11), cs.axisLabel, { left: `${((i * 2) / months) * 100}%` }]}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function Span({ start, end, months, color, opacity, height }: {
  start: number;
  end: number;
  months: number;
  color: string;
  opacity: number;
  height: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: `${(start / months) * 100}%`,
        width: `${((end - start) / months) * 100}%`,
        height,
        borderRadius: height / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

// ── Medications: when each was taken ───────────────────────────
export function MedTimeline({ rows }: { rows: { label: string; start: number; end: number; tone: 'past' | 'current' }[] }) {
  const months = 8;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} style={{ marginBottom: 12 }}>
          <Text style={[sans(13), { color: C.secondary, marginBottom: 5 }]}>{r.label}</Text>
          <View style={[cs.track, { height: 12, borderRadius: 6 }]}>
            <Span
              start={r.start}
              end={r.end}
              months={months}
              height={12}
              color={r.tone === 'past' ? C.secondary : C.blue}
              opacity={r.tone === 'past' ? 0.5 : i === rows.length - 1 ? 0.9 : 0.7}
            />
          </View>
        </View>
      ))}
      <MonthAxis months={months} />
    </View>
  );
}

// ── Symptoms: when each was reported, against cycle starts ─────
const SEVERITY = { mild: C.pinkMild, moderate: C.pink, severe: C.pinkSevere } as const;

export function SymptomTimeline({
  cycleStarts,
  rows,
}: {
  cycleStarts: number[];
  rows: { label: string; start: number; end: number; color: keyof typeof SEVERITY }[];
}) {
  const months = 7;
  return (
    <View>
      <View style={{ marginBottom: 16 }}>
        <Text style={[sans(13), { color: C.secondary, marginBottom: 6 }]}>Cycle starts</Text>
        <View style={[cs.track, cs.trackFaint]}>
          {cycleStarts.map((m) => (
            <View key={m} style={[cs.tick, { left: `${(m / months) * 100}%` }]} />
          ))}
        </View>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={{ marginBottom: 16 }}>
          <Text style={[sans(13), { color: C.secondary, marginBottom: 6 }]}>{r.label}</Text>
          <View style={[cs.track, cs.trackFaint]}>
            <Span start={r.start} end={r.end} months={months} height={10} color={SEVERITY[r.color]} opacity={0.85} />
          </View>
        </View>
      ))}
      <MonthAxis months={months} />
      <Legend
        items={[
          { label: 'Mild', color: C.pinkMild, kind: 'bar' },
          { label: 'Moderate', color: C.pink, kind: 'bar' },
          { label: 'Severe', color: C.pinkSevere, kind: 'bar' },
        ]}
      />
    </View>
  );
}

const cs = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 10, borderRadius: 5, backgroundColor: C.surface, overflow: 'hidden', justifyContent: 'center' },
  trackFaint: { backgroundColor: 'rgba(28,27,42,0.4)' },
  tick: { position: 'absolute', width: 3, height: 10, marginLeft: -1.5, borderRadius: 1.5, backgroundColor: C.secondary, opacity: 0.6 },
  axis: { height: 18, marginTop: 4 },
  axisLabel: { position: 'absolute', color: C.muted },
});
