// Today's Patterns drawn: two wearable metrics on the day's hours, each on
// its own scale so both fluctuations read, last night shaded at the start
// and a line at now. Chips above choose the pair; two at a time keeps the
// chart a comparison rather than a tangle. See lib/dayPatterns.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { smooth } from '../lib/curve';
import { type DayMetricKey, type DayView, defaultPair, pairInsight, rotatePair } from '../lib/dayPatterns';
import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { L } from './surface';

const COLORS = ['#789AF3', '#F2A4B8'];
const HEIGHT = 120;
const PAD = 10;
const TICKS = ['12a', '6a', '12p', '6p', '12a'];

export function DayPair({ view, usual = {} }: { view: DayView; usual?: Partial<Record<DayMetricKey, number>> }) {
  const [width, setWidth] = useState(0);
  const [pair, setPair] = useState<DayMetricKey[]>(() => defaultPair(view.series));
  // A metric that has gone (a new day, a new sync) leaves the pair.
  useEffect(() => {
    setPair((p) => {
      const kept = p.filter((k) => view.series.some((s) => s.key === k));
      return kept.length ? kept : defaultPair(view.series);
    });
  }, [view.series]);

  const shown = pair.map((k) => view.series.find((s) => s.key === k)!).filter(Boolean);
  // The card's two lines, from the pair she has chosen, rewritten the
  // moment she changes it.
  const [lead, state] = shown.length ? pairInsight(shown[0], shown[1], usual) : ['', ''];
  const x = (h: number) => (h / 24) * width;

  const toggle = (k: DayMetricKey) => setPair((p) => rotatePair(p, k));

  const paths = useMemo(
    () =>
      shown.map((s) => {
        const span = s.high - s.low || 1;
        const y = (v: number) => PAD + (1 - (v - s.low) / span) * (HEIGHT - PAD * 2);
        const pts = s.values.flatMap((v, h) => (v == null ? [] : [{ x: x(h + 0.5), y: y(v) }]));
        return { key: s.key, pts, steps: s.key === 'steps', y, values: s.values };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown.map((s) => s.key).join(), width, view],
  );

  return (
    <View>
      {/* Two lines, no more: how the pair moved, and where each stands. */}
      {lead ? (
        <View style={s.insight} accessibilityLiveRegion="polite">
          <Text style={[font('subhead', 'semibold'), s.lead]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {displayCopy(lead)}
          </Text>
          <Text style={[font('footnote'), s.state]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {displayCopy(state)}
          </Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {view.series.map((m) => {
          const i = pair.indexOf(m.key);
          return (
            <Pressable
              key={m.key}
              onPress={() => toggle(m.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: i >= 0 }}
              style={[s.chip, i >= 0 && { borderColor: COLORS[i], backgroundColor: L.statement }]}
            >
              {i >= 0 ? <View style={[s.swatch, { backgroundColor: COLORS[i] }]} /> : null}
              <Text style={[font('caption1', i >= 0 ? 'semibold' : 'regular'), { color: i >= 0 ? L.ink : L.meta }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={{ height: HEIGHT, marginTop: 10 }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={shown.map((m) => `${m.label} today, ${m.range}`).join('. ')}
      >
        {width ? (
          <Svg width={width} height={HEIGHT}>
            {view.wokeAt != null ? <Rect x={0} y={0} width={x(view.wokeAt)} height={HEIGHT} rx={4} fill={L.rule} /> : null}
            {[6, 12, 18].map((h) => (
              <Line key={h} x1={x(h)} x2={x(h)} y1={0} y2={HEIGHT} stroke={L.rule} strokeWidth={StyleSheet.hairlineWidth} />
            ))}
            {paths.map((p, i) =>
              p.steps ? (
                p.values.map((v, h) =>
                  v == null ? null : (
                    <Rect key={`${p.key}${h}`} x={x(h) + width / 96} y={p.y(v)} width={width / 48} height={Math.max(1, HEIGHT - PAD - p.y(v))} rx={2} fill={COLORS[i]} opacity={0.55} />
                  ),
                )
              ) : (
                <Path key={p.key} d={p.pts.length > 1 ? smooth(p.pts) : ''} stroke={COLORS[i]} strokeWidth={2} fill="none" strokeLinecap="round" />
              ),
            )}
            {paths.map((p, i) =>
              p.steps ? null : p.pts.map((pt, n) => <Circle key={`${p.key}d${n}`} cx={pt.x} cy={pt.y} r={2.2} fill={COLORS[i]} />),
            )}
            <Line x1={x(view.nowHour + 0.5)} x2={x(view.nowHour + 0.5)} y1={0} y2={HEIGHT} stroke={L.meta} strokeWidth={1} strokeDasharray="2 3" />
          </Svg>
        ) : null}
      </View>
      <View style={s.axis}>
        {TICKS.map((t, i) => (
          <Text key={i} style={[font('caption2'), s.tick]}>
            {t}
          </Text>
        ))}
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  insight: { gap: 2, marginBottom: 12 },
  lead: { color: L.ink },
  state: { color: L.body },
  chips: { gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tick: { color: L.meta },
});
