import { useState } from 'react';
import { View } from 'react-native';

import { symptoms } from '../data/sample';
import { useNav } from '../navigation';
import { SymptomTimeline } from '../ui/charts';
import { DetailScreen, Expandable, Facts, FilterPills, SecLabel, SecondaryButton, SourceFooter } from '../ui/kit';

const FILTERS = ['All', 'Sleep', 'Energy', 'Temperature'] as const;

export function SymptomsScreen() {
  const nav = useNav();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [open, setOpen] = useState<string | null>(symptoms.list[0].name);
  const shown = symptoms.list.filter((s) => filter === 'All' || s.group === filter);

  return (
    <DetailScreen
      title="Symptoms"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Entered by you, dated as you entered it" />}
    >
      <FilterPills pills={FILTERS} active={filter} onChange={setFilter} />

      <SecLabel right="Jan to Aug">Timeline</SecLabel>
      <View style={{ marginBottom: 24 }}>
        <SymptomTimeline cycleStarts={symptoms.cycleStarts} rows={symptoms.timeline} />
      </View>

      <SecLabel right="Days logged">Most reported</SecLabel>
      {shown.map((s, n) => (
        <Expandable
          key={s.name}
          first={n === 0}
          title={s.name}
          sub={s.sub}
          value={s.days}
          open={open === s.name}
          onToggle={() => setOpen(open === s.name ? null : s.name)}
        >
          <Facts rows={s.facts} />
        </Expandable>
      ))}

      <View style={{ paddingTop: 20 }}>
        <SecondaryButton label="Log a symptom" />
      </View>
    </DetailScreen>
  );
}
