// One lab test over time: the latest result against the lab's range, every
// result she has for it drawn with the range shaded behind, and each one
// listed with where it came from. The ranges are the labs' own; nothing
// here interprets a result.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { chosenLab } from '../lib/labHandoff';
import { type LabResult, labDay, labHistory, labStatus } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font, numeral } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, EmptyNote } from '../ui/kit';
import { LabRangeBar, LabStatusTag, STATUS_COLOR } from '../ui/labs';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

const CHART_H = 150;

function History({ results }: { results: LabResult[] }) {
  const [width, setWidth] = useState(0);
  const pts = results.filter((r) => r.value != null);
  if (pts.length < 2) return null;
  const latest = pts[pts.length - 1];
  const values = [...pts.map((r) => r.value!), ...(latest.low != null ? [latest.low] : []), ...(latest.high != null ? [latest.high] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.05, 0.1);
  const y = (v: number) => 10 + (1 - (v - (lo - pad)) / (hi - lo + pad * 2)) * (CHART_H - 20);
  const t0 = Date.parse(pts[0].on);
  const t1 = Date.parse(latest.on);
  const x = (on: string) => 12 + (t1 === t0 ? 0.5 : (Date.parse(on) - t0) / (t1 - t0)) * (width - 24);
  return (
    <View style={s.card}>
      <View style={{ height: CHART_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Svg width={width} height={CHART_H}>
            {latest.low != null || latest.high != null ? (
              <Rect
                x={0}
                width={width}
                y={y(latest.high ?? hi + pad)}
                height={Math.max(2, y(latest.low ?? lo - pad) - y(latest.high ?? hi + pad))}
                fill="rgba(94, 211, 196, 0.16)"
              />
            ) : null}
            <Polyline points={pts.map((r) => `${x(r.on)},${y(r.value!)}`).join(' ')} fill="none" stroke={L.meta} strokeWidth={1.5} />
            {pts.map((r) => (
              <Circle key={r.id} cx={x(r.on)} cy={y(r.value!)} r={5} fill={STATUS_COLOR[labStatus(r).key]} />
            ))}
            <Line x1={0} x2={width} y1={CHART_H - 1} y2={CHART_H - 1} stroke={L.rule} />
          </Svg>
        ) : null}
      </View>
      <View style={s.ends}>
        <Text style={[font('caption2'), s.meta]}>{labDay(pts[0].on)}</Text>
        <Text style={[font('caption2'), s.meta]}>{labDay(latest.on)}</Text>
      </View>
      <Text style={[font('caption1'), s.meta, { marginTop: 8 }]}>Shaded: the range on your latest result.</Text>
    </View>
  );
}

export function LabDetailScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [name] = useState(() => chosenLab());
  const [labs, setLabs] = useState<LabResult[] | null>(null);
  useEffect(() => {
    repo.loadLabs().then(setLabs).catch(() => setLabs([]));
  }, [repo]);
  const history = useMemo(() => labHistory(labs ?? [], name), [labs, name]);
  const latest = history[history.length - 1];

  if (!latest) {
    return (
      <DetailScreen title={name || 'Lab'} onBack={nav.back}>
        {labs ? <EmptyNote text="No results for this test yet." /> : null}
      </DetailScreen>
    );
  }
  const st = labStatus(latest);
  return (
    <DetailScreen title={latest.name} onBack={nav.back}>
      <Text style={[font('caption1'), s.meta]}>{displayCopy(`Latest, ${labDay(latest.on)}`)}</Text>
      <View style={s.big}>
        <Text style={[numeral(44), s.value]}>{latest.value != null ? String(latest.value) : (latest.valueText ?? '')}</Text>
        {latest.value != null && latest.unit ? <Text style={[font('title3'), s.unit]}>{latest.unit}</Text> : null}
      </View>
      <LabStatusTag result={latest} />
      {st.basis ? <Text style={[font('caption1'), s.meta, { marginTop: 6 }]}>{displayCopy(st.basis)}</Text> : null}
      <View style={{ marginTop: SPACE.near }}>
        <LabRangeBar result={latest} height={8} labels />
      </View>
      <Text style={[font('footnote'), s.body, { marginTop: 6 }]}>
        {displayCopy(latest.rangeText ? `The lab's range: ${latest.rangeText}${latest.unit && !latest.rangeText.includes(latest.unit) ? ` ${latest.unit}` : ''}` : 'The lab printed no range for this test.')}
      </Text>

      {history.length > 1 ? (
        <View style={{ marginTop: SPACE.block }}>
          <Eyebrow>Over time</Eyebrow>
          <History results={history} />
        </View>
      ) : null}

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Every result</Eyebrow>
      </View>
      <View style={s.card}>
        {[...history].reverse().map((r, n) => (
          <View key={r.id} style={[s.row, n > 0 && s.divided]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('subhead'), s.ink]}>{labDay(r.on)}</Text>
              <Text style={[font('caption1'), s.meta]}>
                {displayCopy(
                  `${r.source === 'report' ? 'Read from a report' : 'From your provider'}${r.lab ? `, ${r.lab}` : ''}${r.status && r.status !== 'final' ? ` · ${r.status}` : ''}`,
                )}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[font('subhead', 'semibold'), s.ink]}>
                {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : (r.valueText ?? '')}
              </Text>
              <LabStatusTag result={r} small />
            </View>
          </View>
        ))}
      </View>
      <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near, lineHeight: 18 }]}>
        Ranges are each lab's own. What a result means for you is a question for your clinician.
      </Text>
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  meta: { color: L.meta },
  body: { color: L.body },
  ink: { color: L.ink },
  big: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 6 },
  value: { color: L.ink, letterSpacing: -1.5 },
  unit: { color: L.body, marginLeft: 6 },
  card: { marginTop: SPACE.tight, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, padding: 14 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
});
