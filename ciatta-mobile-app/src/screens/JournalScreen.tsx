import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { journal } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { C, caps, sans } from '../theme';
import { DetailScreen, FilterPills, SecondaryButton, SourceFooter, Tag } from '../ui/kit';

const FILTERS = ['All', 'Notes', 'Symptoms', 'Context'] as const;

export function JournalScreen() {
  const nav = useNav();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const months = journal.months
    .map((g) => ({ ...g, items: g.items.filter((it) => filter === 'All' || it.kind === filter) }))
    .filter((g) => g.items.length > 0);
  const shown = months.reduce((n, g) => n + g.items.length, 0);

  return (
    <DetailScreen
      title="What you told Ciatta"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Yours, dated, never overwritten by a device or a clinic" />}
    >
      <FilterPills pills={FILTERS} active={filter} onChange={setFilter} />

      <View style={j.between}>
        <Text style={[sans(11, 600), caps, { color: C.muted }]}>
          {filter === 'All' ? `${journal.count} entries` : `${shown} shown`}
        </Text>
        <Text style={[sans(12), { color: C.muted }]}>{journal.since}</Text>
      </View>

      {months.map((group) => (
        <View key={group.month} style={{ marginBottom: 4 }}>
          <Text style={[sans(11, 600), caps, { color: C.rose, marginBottom: 8 }]}>{group.month}</Text>
          {group.items.map((item) => (
            <Pressable
              key={item.date + item.text}
              disabled={!item.usedInInsight}
              onPress={() => nav.push('insight')}
              accessibilityRole={item.usedInInsight ? 'button' : undefined}
              style={({ pressed }) => [j.card, pressed && { opacity: 0.7 }]}
            >
              <Text style={[sans(15), { color: C.text, lineHeight: 22, marginBottom: 8 }]}>{displayCopy(item.text)}</Text>
              <View style={j.cardFoot}>
                <Text style={[sans(12), { color: C.muted }]}>{item.date}</Text>
                <Tag label={item.tag} tone={item.usedInInsight ? 'amber' : 'neutral'} />
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={{ paddingTop: 12 }}>
        <SecondaryButton label="Add an entry" />
      </View>
    </DetailScreen>
  );
}

const j = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
