import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cycle } from '../data/sample';
import { useNav } from '../navigation';
import { C, sans } from '../theme';
import { CycleBarChart } from '../ui/charts';
import { Card, DetailScreen, Expandable, Facts, FilterPills, LinkButton, SecLabel, SourceFooter } from '../ui/kit';

const PERIODS = ['3M', '6M', '12M', 'All'] as const;

export function CycleScreen() {
  const nav = useNav();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('12M');
  const [open, setOpen] = useState<string | null>(cycle.history[1].dates);

  return (
    <DetailScreen title="Cycle" onBack={nav.back} footer={<SourceFooter kind="measured" text={cycle.source} />}>
      <FilterPills pills={PERIODS} active={period} onChange={setPeriod} />

      <Card style={{ marginBottom: 20 }}>
        <View style={cy.between}>
          <Text style={[sans(13), { color: C.secondary }]}>Current cycle</Text>
          <Text style={[sans(22, 600), { color: C.text }]}>Day {cycle.day}</Text>
        </View>
        <View style={cy.track} accessibilityRole="progressbar" accessibilityValue={{ now: cycle.day }}>
          <View style={[cy.fill, { width: `${cycle.progress * 100}%` }]} />
        </View>
        <View style={cy.between}>
          <Text style={[sans(12), { color: C.muted }]}>Started {cycle.started}</Text>
          <Text style={[sans(12), { color: C.muted }]}>Next expected {cycle.nextExpected}</Text>
        </View>
      </Card>

      <SecLabel right={cycle.typical}>Cycle length</SecLabel>
      <CycleBarChart bars={cycle.lengths} />

      <View style={{ marginTop: 4 }}>
        <SecLabel right={`${cycle.lengths.length} cycles`}>History</SecLabel>
        {cycle.history.map((row, n) => (
          <Expandable
            key={row.dates}
            first={n === 0}
            title={row.dates}
            sub={row.flow}
            value={row.days}
            valueColor={row.short ? C.orange : undefined}
            open={open === row.dates}
            onToggle={() => setOpen(open === row.dates ? null : row.dates)}
          >
            <Facts rows={row.facts} />
            {row.short ? <LinkButton label="Open the insight for this cycle" onPress={() => nav.push('insight')} /> : null}
          </Expandable>
        ))}
      </View>
    </DetailScreen>
  );
}

const cy = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 5, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden', marginTop: 10, marginBottom: 8 },
  fill: { height: '100%', backgroundColor: C.blue, borderRadius: 3 },
});
