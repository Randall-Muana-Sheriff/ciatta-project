// Hormones across her cycle: the phases as columns sized to her own cycle,
// today's highlighted, the typical shape of estrogen, progesterone, LH and
// FSH drawn across them, what the phase is commonly like, and what it looks
// like in her own record. Tap a column to read another phase.
//
// The curves are a typical pattern, never her levels, and the card says so
// under them. The phase is "Likely" until ovulation is confirmed. The
// numbers below are hers, from her completed cycles. See lib/hormones.ts.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { ClinicalPhase } from '../lib/cycleModel';
import { smooth } from '../lib/curve';
import { displayCopy } from '../lib/displayCopy';
import { HORMONE_LABEL, type HormoneKey, hormoneCurves, type HormoneView, PHASE_NOTE, phaseBounds, type PhaseRow } from '../lib/hormones';
import { font } from '../theme';
import { L, TILE_RADIUS } from './surface';
import { onGround } from './scheme';

const LAVENDER = onGround('#B188F3');
const STYLE: Record<HormoneKey, { color: string; dash?: string; width: number }> = {
  estradiol: { color: LAVENDER, width: 2 },
  progesterone: { color: onGround('#F2A4B8'), dash: '6 4', width: 2 },
  lh: { color: L.body, dash: '2 3', width: 1.5 },
  fsh: { color: onGround('#8C93A3'), dash: '1 3', width: 1.5 },
};
const LETTER: Record<ClinicalPhase, string> = { Menstrual: 'M', Follicular: 'F', Ovulatory: 'O', Luteal: 'L' };
const HEIGHT = 150;
const TOP = 26;

export function HormonesSection({ view, effects }: { view: HormoneView; effects: Record<ClinicalPhase, PhaseRow[]> }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<ClinicalPhase>(view.phase);
  const spans = phaseBounds(view.length, view.ovulationDay);
  const curves = hormoneCurves(view.length, view.ovulationDay);
  const gap = 4;
  const x = (day: number) => ((day - 1) / Math.max(1, view.length - 1)) * width;
  const y = (v: number) => TOP + (1 - v) * (HEIGHT - TOP - 8);
  const isToday = picked === view.phase;
  const label = view.confirmed ? `${picked} phase` : picked === 'Menstrual' ? 'Menstrual' : `Likely ${picked.toLowerCase()}`;
  const rows = effects[picked];

  return (
    <View style={h.card}>
      <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Svg width={width} height={HEIGHT}>
            {spans.map((s) => {
              const x1 = x(s.from) - (s.from === 1 ? 0 : gap / 2);
              const x2 = s.to === view.length ? width : x(s.to + 1) - gap / 2;
              const on = s.phase === picked;
              return (
                <Rect
                  key={s.phase}
                  x={Math.max(0, x1)}
                  y={0}
                  width={Math.max(4, x2 - x1)}
                  height={HEIGHT}
                  rx={10}
                  fill={on ? 'rgba(177, 136, 243, 0.16)' : L.recessed}
                  stroke={on ? LAVENDER : 'transparent'}
                  strokeWidth={on ? 1.5 : 0}
                />
              );
            })}
            {(Object.keys(curves) as HormoneKey[]).map((k) => (
              <Path
                key={k}
                d={smooth(curves[k].map((v, i) => ({ x: x(i + 1), y: y(v) })))}
                stroke={STYLE[k].color}
                strokeWidth={STYLE[k].width}
                strokeDasharray={STYLE[k].dash}
                fill="none"
                opacity={k === 'estradiol' || k === 'progesterone' ? 0.95 : 0.7}
              />
            ))}
            {/* Today. */}
            <Line x1={x(Math.min(view.today, view.length))} x2={x(Math.min(view.today, view.length))} y1={TOP - 4} y2={HEIGHT} stroke={L.ink} strokeWidth={1} opacity={0.6} />
          </Svg>
        ) : null}
        {/* The column letters, and a tap target over each column. */}
        {width
          ? spans.map((s) => {
              const x1 = x(s.from);
              const x2 = s.to === view.length ? width : x(s.to + 1);
              return (
                <Pressable
                  key={s.phase}
                  onPress={() => setPicked(s.phase)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.phase === picked }}
                  accessibilityLabel={`${s.phase}, days ${s.from} to ${s.to}`}
                  style={[h.col, { left: x1, width: x2 - x1 }]}
                >
                  <Text style={[font('caption2', 'semibold'), { color: s.phase === picked ? L.ink : L.meta }]}>{LETTER[s.phase]}</Text>
                </Pressable>
              );
            })
          : null}
      </View>

      <View style={h.legend}>
        {(Object.keys(STYLE) as HormoneKey[]).map((k) => (
          <View key={k} style={h.legendItem}>
            <Svg width={18} height={6}>
              <Line x1={0} x2={18} y1={3} y2={3} stroke={STYLE[k].color} strokeWidth={2} strokeDasharray={STYLE[k].dash} />
            </Svg>
            <Text style={[font('caption2'), h.meta]}>{HORMONE_LABEL[k]}</Text>
          </View>
        ))}
      </View>

      <Text style={[font('headline'), h.ink, { marginTop: 14 }]}>{label}</Text>
      <Text style={[font('caption1'), h.meta]}>
        {displayCopy(
          isToday
            ? `Day ${view.today} of ${view.ownLength ? 'about' : 'a typical'} ${view.length}${view.ownLength ? '' : ' day cycle, until yours is known'}`
            : `Days ${spans.find((s) => s.phase === picked)!.from} to ${spans.find((s) => s.phase === picked)!.to}`,
        )}
      </Text>
      <Text style={[font('subhead'), h.body, { marginTop: 8 }]}>{displayCopy(PHASE_NOTE[picked])}</Text>

      <Text style={[font('footnote', 'semibold'), h.ink, { marginTop: 16 }]}>In your record</Text>
      {rows.length ? (
        <View style={h.rows}>
          {rows.map((r) => (
            <View key={r.key} style={h.tile} accessible accessibilityLabel={`${r.label}, ${r.value}, ${r.compare}`}>
              <Text style={[font('caption2'), h.meta]} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={[font('subhead', 'semibold'), h.ink]}>{displayCopy(r.value)}</Text>
              <Text style={[font('caption2', 'semibold'), { color: r.compare.startsWith('About') ? L.meta : LAVENDER }]} numberOfLines={2}>
                {r.compare}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[font('footnote'), h.meta, { marginTop: 4 }]}>
          After two logged cycles, this shows how your sleep, HRV, resting heart rate and stress change in this phase.
        </Text>
      )}

      <Text style={[font('caption2'), h.meta, { marginTop: 14, lineHeight: 16 }]}>
        {displayCopy(
          `A typical hormone pattern, not your levels: nothing here measures a hormone. Shape from published reference ranges (Stricker et al., 2006), fitted to your cycle.${view.confirmed ? '' : ' The phase is estimated until ovulation is confirmed.'}`,
        )}
      </Text>
    </View>
  );
}

const h = StyleSheet.create({
  card: { backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, padding: 14 },
  col: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', paddingTop: 7 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rows: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: L.recessed, borderRadius: 10, padding: 10, gap: 2 },
  ink: { color: L.ink },
  body: { color: L.body, lineHeight: 21 },
  meta: { color: L.meta },
});
