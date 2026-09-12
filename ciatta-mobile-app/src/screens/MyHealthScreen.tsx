import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cycle, journal, medications, records, sleep, symptoms } from '../data/sample';
import { type Screen, useNav } from '../navigation';
import { C, GUTTER, sans, serif } from '../theme';
import { ChevronRight } from '../ui/kit';

export function MyHealthScreen() {
  const nav = useNav();
  const items: { label: string; sub: string; screen: Screen }[] = [
    { label: 'Your health', sub: '1 new insight', screen: 'insight' },
    { label: 'Sleep', sub: `${sleep.averageLabel} avg · 12M`, screen: 'sleep' },
    { label: 'Cycle', sub: `Day ${cycle.day} · started ${cycle.started}`, screen: 'cycle' },
    { label: 'Symptoms', sub: `${symptoms.timeline.length} tracked`, screen: 'symptoms' },
    { label: 'Medications', sub: `${medications.current.length} current`, screen: 'medications' },
    { label: 'What you told Ciatta', sub: `${journal.count} entries · since January`, screen: 'journal' },
    { label: 'Health records', sub: `${records.draws.length + 1} lab draws`, screen: 'healthrecords' },
  ];

  return (
    <ScrollView style={h.fill}>
      <View style={h.titleWrap}>
        <Text style={[serif(24), { color: C.text }]} accessibilityRole="header">
          My Health
        </Text>
      </View>
      <View style={h.list}>
        {items.map((item) => (
          <Pressable
            key={item.screen}
            onPress={() => nav.push(item.screen)}
            accessibilityRole="button"
            style={({ pressed }) => [h.row, pressed && h.pressed]}
          >
            <View style={h.rowText}>
              <Text style={[sans(16), { color: C.text }]}>{item.label}</Text>
              <Text style={[sans(13), { color: C.muted, marginTop: 2 }]}>{item.sub}</Text>
            </View>
            <ChevronRight />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  fill: { flex: 1 },
  titleWrap: { paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 12 },
  list: { borderTopWidth: 1, borderTopColor: C.border },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
  },
  rowText: { flex: 1, paddingRight: 12 },
  pressed: { backgroundColor: C.surface },
});
