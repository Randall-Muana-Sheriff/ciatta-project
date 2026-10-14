// Last night as a hypnogram: one lane per stage, Awake at the top and Deep
// at the bottom, each stretch of a stage a rounded band on its lane, joined
// by a hairline where she moved between stages. Above it, each stage's share
// of the night and its time. The same chart wherever a night is shown.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { fmtHours } from '../lib/engine';
import { type Night, type Stage, STAGE_ORDER } from '../lib/hypnogram';
import { font } from '../theme';
import { L } from './surface';
import { onGround } from './scheme';

// Rose for awake, then the sleep blue, lighter to deeper.
export const STAGE_COLOR: Record<Stage, string> = {
  awake: onGround('#F27D9B'),
  rem: onGround('#A9B4FF'),
  light: onGround('#7088F0'),
  deep: onGround('#3E50C8'),
  asleep: onGround('#7088F0'),
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', ' ');
const span = (minutes: number) => (minutes < 60 ? `${minutes}m` : fmtHours(minutes / 60));

export function Hypnogram({ night, size = 'card' }: { night: Night; size?: 'card' | 'full' }) {
  const [width, setWidth] = useState(0);
  const lanes: Stage[] = night.staged ? STAGE_ORDER : ['awake', 'asleep'];
  const height = size === 'full' ? 172 : 128;
  const labelW = 46;
  const plotW = Math.max(0, width - labelW);
  const laneH = height / lanes.length;
  const band = Math.min(14, laneH * 0.5);
  const t0 = Date.parse(night.start);
  const t1 = Date.parse(night.end);
  const x = (iso: string) => labelW + ((Date.parse(iso) - t0) / (t1 - t0)) * plotW;
  const y = (stage: Stage) => lanes.indexOf(stage) * laneH + laneH / 2;

  return (
    <View>
      {/* Each stage's share of the night, and its time. */}
      <View style={h.legend}>
        {night.totals.map((t) => (
          <View key={t.stage} style={h.legendItem} accessible accessibilityLabel={`${t.label}, ${t.percent} percent, ${span(t.minutes)}`}>
            <View style={h.legendHead}>
              <View style={[h.swatch, { backgroundColor: STAGE_COLOR[t.stage] }]} />
              <Text style={[font('caption1', 'semibold'), h.ink]}>{t.label}</Text>
            </View>
            <Text style={[font('caption1'), h.meta]}>{`${t.percent}%`}</Text>
            <Text style={[font('caption1'), h.meta]}>{span(t.minutes)}</Text>
          </View>
        ))}
      </View>

      <View
        style={{ height, marginTop: 12 }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Sleep stages from ${time(night.start)} to ${time(night.end)}`}
      >
        {width ? (
          <Svg width={width} height={height}>
            {lanes.map((stage) => (
              <Line key={stage} x1={labelW} x2={width} y1={y(stage)} y2={y(stage)} stroke={L.rule} strokeWidth={StyleSheet.hairlineWidth} />
            ))}
            {night.segments.map((seg, i) => {
              const next = night.segments[i + 1];
              const x1 = x(seg.from);
              const x2 = x(seg.to);
              return (
                <Line
                  key={`j${i}`}
                  x1={x2}
                  x2={x2}
                  y1={y(seg.stage)}
                  y2={next && next.from === seg.to ? y(next.stage) : y(seg.stage)}
                  stroke={L.meta}
                  strokeWidth={1}
                  opacity={next && next.from === seg.to && x2 - x1 >= 0 ? 0.45 : 0}
                />
              );
            })}
            {night.segments.map((seg, i) => {
              const x1 = x(seg.from);
              const w = Math.max(1.5, x(seg.to) - x1);
              return <Rect key={i} x={x1} y={y(seg.stage) - band / 2} width={w} height={band} rx={Math.min(band / 2, w / 2)} fill={STAGE_COLOR[seg.stage]} />;
            })}
          </Svg>
        ) : null}
        {lanes.map((stage) => (
          <Text key={stage} style={[font('caption2'), h.lane, { top: y(stage) - 8 }]}>
            {stage === 'asleep' ? 'Asleep' : stage === 'rem' ? 'REM' : stage.charAt(0).toUpperCase() + stage.slice(1)}
          </Text>
        ))}
      </View>
      <View style={[h.ends, { marginLeft: labelW }]}>
        <Text style={[font('caption2'), h.meta]}>{time(night.start)}</Text>
        <Text style={[font('caption2'), h.meta]}>{time(night.end)}</Text>
      </View>
      {!night.staged ? <Text style={[font('caption1'), h.meta, { marginTop: 6 }]}>Your device recorded sleep without stages.</Text> : null}
    </View>
  );
}

const h = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  legendItem: { flex: 1 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  ink: { color: L.ink },
  meta: { color: L.meta },
  lane: { position: 'absolute', left: 0, color: L.meta, width: 44 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
