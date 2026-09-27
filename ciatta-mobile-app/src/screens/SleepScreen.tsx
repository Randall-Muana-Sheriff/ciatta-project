import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useData } from '../state/session';
import { C, font, numeral } from '../theme';
import { MiniWeekChart, SleepBarChart } from '../ui/charts';
import { DetailScreen, EmptyNote, Expandable, Facts, SegmentedControl, SecLabel, SourceFooter } from '../ui/kit';

const PERIODS = ['3M', '6M', '12M', 'All'] as const;

export function SleepScreen() {
  const nav = useNav();
  const { sleep, mode } = useData();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('12M');
  const [open, setOpen] = useState<string | null>(sleep?.lowest[0]?.week ?? null);

  if (!sleep) {
    return (
      <DetailScreen title="Sleep" onBack={nav.back}>
        <EmptyNote text="Nothing here yet. This fills in as you log and connect sources." />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen title="Sleep" onBack={nav.back} footer={<SourceFooter kind="measured" text={sleep.source} />}>
      {/* Her own record reaches back thirteen weeks, so there is no longer
          span to choose; the sample person has the year. */}
      {mode === 'demo' ? <SegmentedControl segments={PERIODS} active={period} onChange={setPeriod} /> : null}

      <Text style={[font('caption1'), { color: C.muted, marginBottom: 4 }]}>{displayCopy(sleep.caption)}</Text>
      <View style={sl.big} accessible accessibilityLabel={`${sleep.average.hours} hours ${sleep.average.minutes} minutes`}>
        <Text style={[numeral(48), sl.num]}>{sleep.average.hours}</Text>
        <Text style={[font('title1', 'semibold'), sl.unit]}>h</Text>
        <Text style={[numeral(48), sl.num]}>{sleep.average.minutes}</Text>
        <Text style={[font('title1', 'semibold'), sl.unit]}>m</Text>
      </View>
      <Text style={[font('subhead', 'semibold'), { color: sleep.below ? C.orangeText : C.secondary, marginBottom: 20 }]}>
        {displayCopy(sleep.vsTypical)}
      </Text>

      <SecLabel right="Weekly average">Duration</SecLabel>
      <View style={{ marginBottom: 8 }}>
        <SleepBarChart bars={sleep.weekly} highlight={sleep.lowWeeks} labels={sleep.weekLabels} />
      </View>

      <View style={sl.tiles}>
        {sleep.tiles.map((t) => (
          <View key={t.label} style={sl.tile}>
            <Text style={[font('title2', 'semibold'), { color: C.text, marginBottom: 4 }]}>{t.value}</Text>
            <Text style={[font('footnote'), { color: C.secondary }]}>{t.label}</Text>
          </View>
        ))}
      </View>

      {sleep.lowest.length ? <SecLabel right={`${sleep.lowest.length} found`}>Lowest weeks</SecLabel> : null}
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
