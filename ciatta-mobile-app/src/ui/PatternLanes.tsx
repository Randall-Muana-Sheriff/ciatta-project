// Today's Patterns drawn: lanes stacked on one run of fourteen days, a
// column per day, today's column lifted so the eye starts there. Sleep as
// bars against her usual, her heart as dots against her usual band, mood as
// dots, each symptom a row of cells shaded by severity, and period days on
// the cycle lane with her cycle day under them. See lib/patternLanes.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import type { Lane, PatternView } from '../lib/patternLanes';
import { font } from '../theme';
import { HUE, L } from './surface';

const LABEL_W = 64;
const HEIGHT: Record<Lane['kind'], number> = { bars: 40, dots: 34, heat: 0, cycle: 26 };
const ROW = 14;
const GAP = 10;
const COLOR = { sleep: '#7088F0', heart: HUE.measured, mood: HUE.change, symptoms: HUE.reported, cycle: HUE.reported };
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const laneHeight = (l: Lane) => (l.kind === 'heat' ? l.rows.length * ROW + (l.rows.length - 1) * 3 : HEIGHT[l.kind]);

export function PatternLanes({ view }: { view: PatternView }) {
  const [width, setWidth] = useState(0);
  const plotW = Math.max(0, width - LABEL_W);
  const n = view.days.length;
  const slot = plotW / n;
  const cx = (i: number) => LABEL_W + slot * i + slot / 2;
  const total = view.lanes.reduce((h, l) => h + laneHeight(l) + GAP, 0) - GAP;

  // Each lane's top, stacked.
  let y = 0;
  const tops = view.lanes.map((l) => {
    const t = y;
    y += laneHeight(l) + GAP;
    return t;
  });

  return (
    <View>
      {view.pattern ? <Text style={[font('subhead'), s.pattern]}>{displayCopy(view.pattern)}</Text> : null}
      <View
        style={{ height: total }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Your last ${n} days: ${view.lanes.map((l) => (l.kind === 'heat' ? l.rows.map((r) => r.name).join(', ') : l.label)).join(', ')}, on one timeline.`}
      >
        {width ? (
          <Svg width={width} height={total}>
            {/* Today's column, lifted across every lane. */}
            <Rect x={LABEL_W + slot * (n - 1) + 1} y={0} width={slot - 2} height={total} rx={4} fill={L.statement} />
            {view.lanes.map((lane, li) => {
              const top = tops[li];
              const h = laneHeight(lane);
              const color = COLOR[lane.key];
              if (lane.kind === 'bars') {
                const max = Math.max(lane.usual ?? 0, ...lane.values.map((v) => v ?? 0), 1);
                const yv = (v: number) => top + h - (v / max) * h;
                const bw = Math.max(3, Math.min(10, slot * 0.5));
                return (
                  <G key={lane.key}>
                    {lane.values.map((v, i) =>
                      v == null ? null : <Rect key={`b${i}`} x={cx(i) - bw / 2} y={yv(v)} width={bw} height={Math.max(1, top + h - yv(v))} rx={bw / 3} fill={color} />,
                    )}
                    {lane.usual ? <Line x1={LABEL_W} x2={width} y1={yv(lane.usual)} y2={yv(lane.usual)} stroke={L.meta} strokeDasharray="2 3" strokeWidth={1} /> : null}
                  </G>
                );
              }
              if (lane.kind === 'dots') {
                const span = lane.max - lane.min || 1;
                const yv = (v: number) => top + 4 + (1 - (v - lane.min) / span) * (h - 8);
                const runs: string[][] = [[]];
                lane.values.forEach((v, i) => (v == null ? runs.push([]) : runs[runs.length - 1].push(`${cx(i)},${yv(v)}`)));
                return (
                  <G key={lane.key}>
                    {lane.band ? (
                      <Rect x={LABEL_W} y={yv(lane.band.high)} width={plotW} height={Math.max(2, yv(lane.band.low) - yv(lane.band.high))} rx={3} fill={color} opacity={0.12} />
                    ) : null}
                    {runs.filter((r) => r.length > 1).map((r, i) => <Polyline key={`l${i}`} points={r.join(' ')} fill="none" stroke={color} strokeWidth={1.2} opacity={0.5} />)}
                    {lane.values.map((v, i) => (v == null ? null : <Circle key={`d${i}`} cx={cx(i)} cy={yv(v)} r={3} fill={color} />))}
                  </G>
                );
              }
              if (lane.kind === 'heat') {
                return (
                  <G key={lane.key}>
                    {lane.rows.map((row, ri) =>
                  row.cells.map((c, i) => (
                    <Rect
                      key={`h${ri}-${i}`}
                      x={LABEL_W + slot * i + 2}
                      y={top + ri * (ROW + 3)}
                      width={slot - 4}
                      height={ROW}
                      rx={3}
                      fill={c == null ? L.rule : color}
                      opacity={c == null ? 0.5 : 0.25 + c * 0.75}
                    />
                  )),
                    )}
                  </G>
                );
              }
              return (
                <G key={lane.key}>
                  {lane.period.map((p, i) => (
                    <Rect key={`c${i}`} x={LABEL_W + slot * i + 2} y={top} width={slot - 4} height={10} rx={5} fill={p ? color : L.rule} opacity={p ? 1 : 0.5} />
                  ))}
                </G>
              );
            })}
          </Svg>
        ) : null}

        {/* Lane names, and each symptom's row named. */}
        {view.lanes.map((lane, li) =>
          lane.kind === 'heat' ? (
            lane.rows.map((r, ri) => (
              <Text key={`${lane.key}${ri}`} numberOfLines={1} style={[font('caption2'), s.label, { top: tops[li] + ri * (ROW + 3) }]}>
                {displayCopy(r.name)}
              </Text>
            ))
          ) : (
            <Text key={lane.key} numberOfLines={1} style={[font('caption2'), s.label, { top: tops[li] + (lane.kind === 'cycle' ? -2 : laneHeight(lane) / 2 - 8) }]}>
              {lane.label}
            </Text>
          ),
        )}
        {/* Cycle days under the period cells, every few days so they fit. */}
        {view.lanes.map((lane, li) =>
          lane.kind === 'cycle'
            ? lane.cycleDay.map((d, i) =>
                d != null && (i === n - 1 || d % 4 === 1) ? (
                  <Text key={`cd${i}`} style={[font('caption2'), s.cycleDay, { top: tops[li] + 12, left: cx(i) - 12 }]}>
                    {d}
                  </Text>
                ) : null,
              )
            : null,
        )}
      </View>

      {/* The days, by weekday, with today named. */}
      <View style={[s.axis, { marginLeft: LABEL_W }]}>
        {view.days.map((d, i) => {
          const [yy, mm, dd] = d.split('-').map(Number);
          const wd = WEEKDAY[new Date(yy, mm - 1, dd).getDay()];
          return (
            <Text key={d} style={[font('caption2'), i === n - 1 ? s.today : s.tick, { width: slot }]}>
              {wd}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pattern: { color: L.ink, lineHeight: 21, marginBottom: 12 },
  label: { position: 'absolute', left: 0, width: LABEL_W - 6, color: L.meta },
  cycleDay: { position: 'absolute', width: 24, textAlign: 'center', color: L.meta },
  axis: { flexDirection: 'row', marginTop: 6 },
  tick: { color: L.meta, textAlign: 'center' },
  today: { color: L.ink, textAlign: 'center', fontWeight: '600' },
});
