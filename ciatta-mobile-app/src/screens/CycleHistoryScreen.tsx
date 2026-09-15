import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { AFFECT, dayLabel, shortDate } from '../data/cycleLog';
import { PHASES, tally } from '../lib/cyclePatterns';
import { useNav } from '../navigation';
import { useCycleInsights } from '../state/cycleStore';
import { C, font } from '../theme';
import { ListGroup, ListRow, Panel } from '../ui/chrome';
import { BarRow, ObservationCard } from '../ui/cycleInputs';
import { DetailScreen, SecLabel, SourceFooter } from '../ui/kit';

function SeverityStrip({ severities }: { severities: number[] }) {
  const W = 132;
  const H = 30;
  const bar = 6;
  return (
    <Svg width={W} height={H}>
      {severities.slice(0, 16).map((v, i) => (
        <Rect key={i} x={i * (bar + 2)} y={H - Math.max(2, v * 3)} width={bar} height={Math.max(2, v * 3)} rx={2} fill={C.coral} opacity={0.4 + v * 0.06} />
      ))}
    </Svg>
  );
}

export function CycleHistoryScreen() {
  const nav = useNav();
  const { signals, summaries, observations } = useCycleInsights();
  const pain = signals.filter((s) => s.pain);

  const locations = tally(pain.map((s) => s.episode.locations));
  const sensations = tally(pain.map((s) => s.episode.sensations));
  const impact = tally(pain.map((s) => s.episode.affect)).sort((a, b) => AFFECT.indexOf(a.label as never) - AFFECT.indexOf(b.label as never));
  const timing = PHASES.map((phase) => ({ label: phase, count: pain.filter((s) => s.phase === phase).length }));
  const flares = signals.filter((s) => s.episode.flareUpUserReported).reverse();
  const maxOf = (xs: { count: number }[]) => Math.max(1, ...xs.map((x) => x.count));

  return (
    <DetailScreen
      title="Pain & Flare History"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Everything here is what you reported." />}
    >
      <SecLabel right={`${pain.length} episodes`}>Pain Location</SecLabel>
      {locations.map((x) => (
        <BarRow key={x.label} label={x.label} count={x.count} max={maxOf(locations)} color={C.coral} />
      ))}

      <View style={h.section}>
        <SecLabel>Pain Sensation</SecLabel>
        {sensations.map((x) => (
          <BarRow key={x.label} label={x.label} count={x.count} max={maxOf(sensations)} color={C.lavender} />
        ))}
      </View>

      <View style={h.section}>
        <SecLabel right="Each bar is one episode">Pain Severity</SecLabel>
        <Panel>
          {summaries.map((c, n) => (
            <View key={c.window.index} style={[h.cycleRow, n > 0 && h.sep]}>
              <View style={{ flex: 1 }}>
                <Text style={[font('subhead'), { color: C.text }]}>
                  {c.window.end ? `Cycle from ${shortDate(c.window.start)}` : 'This cycle'}
                </Text>
                <Text style={[font('footnote'), { color: C.secondary }]}>
                  {c.maxSeverity != null ? `Up to ${c.maxSeverity} of 10` : 'No pain logged'}
                </Text>
              </View>
              <SeverityStrip severities={c.severities} />
            </View>
          ))}
        </Panel>
      </View>

      <View style={h.section}>
        <SecLabel>Impact</SecLabel>
        {impact.map((x) => (
          <BarRow key={x.label} label={x.label} count={x.count} max={maxOf(impact)} color={C.indigo} />
        ))}
      </View>

      <View style={h.section}>
        <SecLabel>Timing</SecLabel>
        {timing.map((x) => (
          <BarRow key={x.label} label={x.label} count={x.count} max={maxOf(timing)} color={C.mint} />
        ))}
      </View>

      <View style={h.section}>
        <SecLabel right="User reported">Flare ups</SecLabel>
        {flares.length ? (
          <ListGroup footer="These are flare ups you marked yourself. They aren't classified.">
            {flares.map((s, n) => (
              <ListRow
                key={s.episode.id}
                first={n === 0}
                icon="flame"
                tint={C.coral}
                title={dayLabel(s.episode.date)}
                sub={[
                  s.episode.locations.join(', '),
                  s.episode.severity != null ? `${s.episode.severity} of 10` : null,
                  s.episode.context.filter((c) => c !== 'Period').join(', ') || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </ListGroup>
        ) : (
          <Text style={[font('subhead'), { color: C.secondary }]}>You haven't marked any flare ups.</Text>
        )}
      </View>

      {observations.length ? (
        <View style={h.section}>
          <SecLabel>Patterns</SecLabel>
          {observations.map((o) => (
            <ObservationCard key={o.id} observation={o} />
          ))}
        </View>
      ) : null}
    </DetailScreen>
  );
}

const h = StyleSheet.create({
  section: { marginTop: 28 },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
});
