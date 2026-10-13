// One metric over a range, drawn the way the metric is read.
//
// Sleep and steps are amounts: bars standing on zero. HRV and blood oxygen
// are levels: a dot per day joined where days are next to each other.
// Blood pressure is two numbers: a bar from the bottom number to the top
// one. Skin temperature is a difference from usual: bars up or down from
// a line in the middle. Her usual range is shaded behind, when it is known.
// A day without a reading is left empty.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { fmt, type MetricKey, type Point, scaleFor, shortDay, type Usual } from '../lib/metricDetail';
import { font } from '../theme';
import { L } from './surface';

const HEIGHTS = { mini: 34, card: 112, full: 170 } as const;
export type ChartSize = keyof typeof HEIGHTS;
const PAD_TOP = 6;
const PAD_BOTTOM = 6;

// One chart per metric, the same wherever that metric is drawn: mini on a
// Today card, card size on the Health dashboard, full on its own screen.
export function MetricChart({
  metric,
  points,
  usual,
  color,
  size = 'full',
}: {
  metric: MetricKey;
  points: Point[];
  usual: Usual | null;
  color: string;
  size?: ChartSize;
}) {
  const [width, setWidth] = useState(0);
  const HEIGHT = HEIGHTS[size];
  const labelled = size !== 'mini';
  const { min, max } = scaleFor(metric, points, usual);
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const slot = points.length ? width / points.length : 0;
  const x = (i: number) => slot * i + slot / 2;
  const barW = Math.max(2, Math.min(size === 'mini' ? 6 : 18, slot * 0.6));
  const dots = metric === 'hrv' || metric === 'rhr' || metric === 'spo2';

  // Runs of consecutive days with a reading, so a line never bridges a gap.
  const runs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value == null) return runs.push([]);
    if (!runs.length) runs.push([]);
    runs[runs.length - 1].push({ i, v: p.value });
  });

  const band = usual && metric !== 'temp' ? { top: y(usual.high), bottom: y(usual.low) } : null;
  const recorded = points.filter((p) => p.value != null).length;
  const top = metric === 'temp' ? null : fmt(metric, max);
  const bottom = metric === 'temp' || metric === 'sleep' || metric === 'steps' ? null : fmt(metric, min);

  return (
    <View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`Chart of ${recorded} of ${points.length} ${points[0]?.day.includes('T') ? 'hours' : points[0]?.day.length === 7 ? 'months' : 'days'} with a reading${usual ? ', with your usual range shaded' : ''}`}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {band ? <Rect x={0} y={band.top} width={width} height={Math.max(1, band.bottom - band.top)} fill={color} opacity={0.12} /> : null}
            {metric === 'temp' ? <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={L.rule} strokeWidth={1} /> : null}
            {points.map((p, i) => {
              if (p.value == null) return null;
              if (metric === 'sleep' || metric === 'steps') {
                return <Rect key={p.day} x={x(i) - barW / 2} y={y(p.value)} width={barW} height={Math.max(1, y(0) - y(p.value))} rx={barW / 3} fill={color} />;
              }
              if (metric === 'temp') {
                const a = y(Math.max(0, p.value));
                const b = y(Math.min(0, p.value));
                return <Rect key={p.day} x={x(i) - barW / 2} y={a} width={barW} height={Math.max(1, b - a)} rx={barW / 3} fill={color} opacity={p.value >= 0 ? 1 : 0.55} />;
              }
              if (metric === 'bp') {
                const a = y(p.value);
                const b = p.low != null ? y(p.low) : a + 2;
                return <Rect key={p.day} x={x(i) - barW / 2} y={a} width={barW} height={Math.max(2, b - a)} rx={barW / 2} fill={color} />;
              }
              return null;
            })}
            {dots
              ? runs
                  .filter((r) => r.length > 1)
                  .map((r) => (
                    <Polyline key={`l${r[0].i}`} points={r.map((d) => `${x(d.i)},${y(d.v)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
                  ))
              : null}
            {dots
              ? points.map((p, i) => (p.value == null ? null : <Circle key={p.day} cx={x(i)} cy={y(p.value)} r={size === 'mini' ? 1.8 : Math.min(3.5, Math.max(2, slot / 4))} fill={color} />))
              : null}
          </Svg>
        ) : null}
        {labelled && top ? <Text style={[font('caption2'), c.axis, { top: 0 }]}>{displayCopy(top)}</Text> : null}
        {labelled && bottom ? <Text style={[font('caption2'), c.axis, { bottom: 0 }]}>{displayCopy(bottom)}</Text> : null}
        {labelled && metric === 'temp' ? <Text style={[font('caption2'), c.axis, { top: y(0) - 16 }]}>Usual</Text> : null}
      </View>
      {labelled && points.length ? (
        <View style={c.days}>
          <Text style={[font('caption2'), c.day]}>{shortDay(points[0].day)}</Text>
          <Text style={[font('caption2'), c.day]}>{shortDay(points[points.length - 1].day)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const c = StyleSheet.create({
  axis: { position: 'absolute', right: 0, color: L.meta },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  day: { color: L.meta },
});
