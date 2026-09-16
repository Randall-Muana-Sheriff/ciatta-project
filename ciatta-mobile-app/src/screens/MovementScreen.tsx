import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { parseDay, shortDate } from '../data/cycleLog';
import { fmtCount, type MovementSummary } from '../lib/engine';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { C, font, fonts, RADIUS } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { DetailScreen, SecLabel, SourceFooter } from '../ui/kit';

// Daily steps for four weeks against the usual range. Coral days sit below
// it. With no baseline days yet (a new real record, or a source that has
// never reported steps), band is null: nothing is compared against a
// fabricated usual, and every bar draws the same neutral colour.
function StepsChart({ movement }: { movement: MovementSummary }) {
  const W = 336;
  const H = 150;
  const base = 124;
  const { series, band } = movement;
  if (!series.length) return null;
  const max = Math.max(band?.high ?? 0, ...series.map((d) => d.steps)) * 1.1;
  const y = (v: number) => base - (v / max) * (base - 8);
  const gap = W / series.length;
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} accessible accessibilityLabel="Daily steps for the last four weeks against your usual range">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {band ? (
          <>
            <Rect x={0} y={y(band.high)} width={W} height={y(band.low) - y(band.high)} fill={C.white} opacity={0.07} />
            <Line x1={0} y1={y(band.usual)} x2={W} y2={y(band.usual)} stroke={C.secondary} strokeDasharray="3 4" opacity={0.6} />
          </>
        ) : null}
        <Line x1={0} y1={base} x2={W} y2={base} stroke={C.separator} />
        {series.map((d, i) => (
          <Rect
            key={d.date}
            x={i * gap + gap * 0.2}
            y={y(d.steps)}
            width={gap * 0.6}
            height={base - y(d.steps)}
            rx={2}
            fill={band && d.steps < band.low ? C.coral : C.lavender}
          />
        ))}
        <SvgText x={0} y={H - 6} fontSize={11} fill={C.secondary} fontFamily={fonts.regular}>
          {shortDate(parseDay(series[0].date))}
        </SvgText>
        <SvgText x={W} y={H - 6} fontSize={11} fill={C.secondary} fontFamily={fonts.regular} textAnchor="end">
          Today
        </SvgText>
      </Svg>
    </View>
  );
}

export function MovementScreen() {
  const nav = useNav();
  const { setFocus } = useCycle();
  const { movement, ranked } = useInsights();
  const related = ranked.filter((i) => i.triage !== 'Ignore' && i.domains.includes('Movement'));
  const open = (id: string) => {
    setFocus(id);
    nav.push('evidence');
  };

  // sub is left out entirely (rather than "Usual" over a fabricated zero)
  // for a figure with no baseline days to compute one from yet.
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: 'Steps a day', value: fmtCount(movement.steps.recent), sub: movement.steps.usual != null ? `Usual ${fmtCount(movement.steps.usual)}` : undefined },
    {
      label: 'Active minutes',
      value: `${Math.round(movement.active.recent)}`,
      sub: movement.active.usual != null ? `Usual ${Math.round(movement.active.usual)}` : undefined,
    },
    { label: 'Workouts', value: `${movement.workouts.recent}`, sub: `Usually ${Math.round(movement.workouts.usual)} a week` },
  ];

  return (
    <DetailScreen
      title="Movement"
      onBack={nav.back}
      footer={<SourceFooter kind="measured" text="Steps and workouts from your phone and watch. Sample data for now." />}
    >
      <Text style={[font('footnote'), { color: C.secondary, marginBottom: 8 }]}>Last 7 days</Text>
      <View style={m.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={m.tile} accessible accessibilityLabel={`${t.label}, ${t.value}${t.sub ? `, ${t.sub}` : ''}`}>
            <Text style={[font('footnote'), { color: C.secondary }]}>{t.label}</Text>
            <Text style={[font('title2', 'semibold'), { color: C.text }]}>{t.value}</Text>
            {t.sub ? <Text style={[font('caption1'), { color: C.secondary }]}>{t.sub}</Text> : null}
          </View>
        ))}
      </View>

      {movement.series.length ? (
      <View style={m.section}>
        <SecLabel right="Last 28 days">Daily Steps</SecLabel>
        <Panel>
          <StepsChart movement={movement} />
          <Text style={[font('footnote'), { color: C.secondary, marginTop: 8 }]}>
            The shaded band is your usual range. Coral days fell below it.
          </Text>
        </Panel>
      </View>
      ) : null}

      <View style={m.section}>
        <SecLabel>How It Lines Up</SecLabel>
        {related.length ? (
          <ListGroup>
            {related.map((i, n) => (
              <ListRow key={i.id} first={n === 0} title={i.title} sub={i.brief} onPress={() => open(i.id)} />
            ))}
          </ListGroup>
        ) : (
          <Text style={[font('subhead'), { color: C.secondary }]}>Nothing lines up with your movement yet.</Text>
        )}
      </View>
    </DetailScreen>
  );
}

const m = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: RADIUS, padding: 12, gap: 2 },
  section: { marginTop: 28 },
});
