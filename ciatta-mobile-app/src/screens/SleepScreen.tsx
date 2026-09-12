import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sleep } from '../data/sample';
import { useNav } from '../navigation';
import { C, sans } from '../theme';
import { MiniWeekChart, SleepBarChart } from '../ui/charts';
import { DetailScreen, Expandable, Facts, FilterPills, SecLabel, SourceFooter } from '../ui/kit';

const PERIODS = ['3M', '6M', '12M', 'All'] as const;

export function SleepScreen() {
  const nav = useNav();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('12M');
  const [open, setOpen] = useState<string | null>(sleep.lowest[0].week);

  return (
    <DetailScreen title="Sleep" onBack={nav.back} footer={<SourceFooter kind="measured" text={sleep.source} />}>
      <FilterPills pills={PERIODS} active={period} onChange={setPeriod} />

      <Text style={[sans(12), { color: C.muted, marginBottom: 4 }]}>Average, last 4 weeks</Text>
      <View style={sl.big} accessible accessibilityLabel={`${sleep.average.hours} hours ${sleep.average.minutes} minutes`}>
        <Text style={[sans(48, 600), sl.num]}>{sleep.average.hours}</Text>
        <Text style={[sans(24, 600), sl.unit]}>h</Text>
        <Text style={[sans(48, 600), sl.num]}>{sleep.average.minutes}</Text>
        <Text style={[sans(24, 600), sl.unit]}>m</Text>
      </View>
      <Text style={[sans(14, 500), { color: C.orangeText, marginBottom: 20 }]}>{sleep.vsTypical}</Text>

      <SecLabel right="Weekly average">Duration</SecLabel>
      <View style={{ marginBottom: 8 }}>
        <SleepBarChart bars={sleep.weekly} highlight={sleep.lowWeeks} />
      </View>

      <View style={sl.tiles}>
        {sleep.tiles.map((t) => (
          <View key={t.label} style={sl.tile}>
            <Text style={[sans(22, 600), { color: C.text, marginBottom: 4 }]}>{t.value}</Text>
            <Text style={[sans(13), { color: C.secondary }]}>{t.label}</Text>
          </View>
        ))}
      </View>

      <SecLabel right={`${sleep.lowest.length} found`}>Lowest weeks</SecLabel>
      {sleep.lowest.map((w, n) => (
        <Expandable
          key={w.week}
          first={n === 0}
          title={w.week}
          value={w.value}
          open={open === w.week}
          onToggle={() => setOpen(open === w.week ? null : w.week)}
        >
          <MiniWeekChart bars={w.nights} />
          <View style={{ marginTop: 10 }}>
            <Facts rows={w.facts} />
          </View>
        </Expandable>
      ))}
    </DetailScreen>
  );
}

const sl = StyleSheet.create({
  big: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  num: { color: C.text, letterSpacing: -2, fontVariant: ['tabular-nums'], lineHeight: 56 },
  unit: { color: C.text, marginRight: 4, marginLeft: 2 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
});
