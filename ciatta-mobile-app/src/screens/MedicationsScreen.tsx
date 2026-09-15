import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Data } from '../data/adapter';
import { useNav } from '../navigation';
import { useData } from '../state/session';
import { C, font } from '../theme';
import { MedTimeline } from '../ui/charts';
import { DetailScreen, EmptyNote, Expandable, Facts, SegmentedControl, LinkButton, SecLabel, SourceFooter } from '../ui/kit';

const TABS = ['Current', 'All'] as const;

type Med = NonNullable<Data['medications']>['current'][number];

function MedCard({ med, past = false }: { med: Med; past?: boolean }) {
  return (
    <View style={[m.card, past && { opacity: 0.7 }]}>
      <View style={m.nameRow}>
        <Text style={[font('callout', 'semibold'), { color: C.text }]}>{med.name}</Text>
        <Text style={[font('subhead'), { color: C.secondary }]}>{med.dose}</Text>
      </View>
      <View style={m.between}>
        <Text style={[font('footnote'), { color: C.secondary }]}>{med.timing}</Text>
        <Text style={[font('caption1'), { color: C.muted }]}>{med.since}</Text>
      </View>
      {med.note ? <Text style={[font('footnote', 'semibold'), { color: C.blueLink, marginTop: 6 }]}>{med.note}</Text> : null}
    </View>
  );
}

export function MedicationsScreen() {
  const nav = useNav();
  const { medications } = useData();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Current');
  const [open, setOpen] = useState<string | null>(medications?.changes[0].label ?? null);

  if (!medications) {
    return (
      <DetailScreen title="Medications" onBack={nav.back}>
        <EmptyNote text="Nothing here yet. This fills in as you log and connect sources." />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      title="Medications"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="You logged these. There are no reminders to take anything." />}
    >
      <SegmentedControl segments={TABS} active={tab} onChange={setTab} />

      <SecLabel right={`${medications.current.length} items`}>Taking now</SecLabel>
      {medications.current.map((med) => (
        <MedCard key={med.name} med={med} />
      ))}

      {tab === 'All' ? (
        <View style={{ marginTop: 12 }}>
          <SecLabel right={`${medications.stopped.length} item`}>Stopped</SecLabel>
          {medications.stopped.map((med) => (
            <MedCard key={med.name} med={med} past />
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 8, marginBottom: 8 }}>
        <SecLabel right="Jan to Aug">Timeline</SecLabel>
        <MedTimeline rows={medications.timeline} />
      </View>

      <View style={{ marginTop: 8 }}>
        <SecLabel right="Last 6 months">Recent changes</SecLabel>
        {medications.changes.map((c, n) => (
          <Expandable
            key={c.label}
            first={n === 0}
            title={c.label}
            value={c.date}
            open={open === c.label}
            onToggle={() => setOpen(open === c.label ? null : c.label)}
          >
            <Facts rows={c.facts} />
            {c.link ? <LinkButton label={c.link} onPress={() => nav.push('healthrecords')} /> : null}
          </Expandable>
        ))}
      </View>
    </DetailScreen>
  );
}

const m = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
});
