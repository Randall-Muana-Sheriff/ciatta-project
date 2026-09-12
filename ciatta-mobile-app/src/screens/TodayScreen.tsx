import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cycle, insight, journal, person, sleep } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { C, caps, GUTTER, sans, serif } from '../theme';
import { ChevronRight, Tag } from '../ui/kit';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function TodayScreen() {
  const nav = useNav();
  const now = new Date();
  const lastNote = journal.months[0].items[0];

  const tiles = [
    { label: 'Sleep last night', value: sleep.averageLabel, sub: '11m under typical', go: () => nav.push('sleep') },
    { label: 'Cycle day', value: `Day ${cycle.day}`, sub: `Started ${cycle.started}`, go: () => nav.push('cycle') },
  ];

  return (
    <ScrollView style={t.fill} contentContainerStyle={t.body}>
      <Text style={[sans(13), { color: C.muted, marginBottom: 4 }]}>
        {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </Text>
      <Text style={[serif(28), { color: C.text, marginBottom: 24 }]} accessibilityRole="header">
        {greeting(now)}, {person.firstName}.
      </Text>

      <Pressable
        onPress={() => nav.push('insight')}
        accessibilityRole="button"
        style={({ pressed }) => [t.insight, pressed && t.pressed]}
      >
        <View style={t.between}>
          <Tag label="Personalized insight" tone="amber" size={10} upper />
          <ChevronRight />
        </View>
        <Text style={[serif(22), { color: C.text, lineHeight: 26, marginTop: 10, marginBottom: 8 }]}>
          {displayCopy(insight.headline)}
        </Text>
        <Text style={[sans(12), { color: C.muted }]}>{insight.meta}</Text>
      </Pressable>

      <View style={t.tiles}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            onPress={tile.go}
            accessibilityRole="button"
            style={({ pressed }) => [t.tile, pressed && t.pressed]}
          >
            <Text style={[sans(12), { color: C.muted, marginBottom: 4 }]}>{tile.label}</Text>
            <Text style={[sans(20, 600), { color: C.text, marginBottom: 2 }]}>{tile.value}</Text>
            <Text style={[sans(11), { color: C.secondary }]}>{tile.sub}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => nav.push('journal')}
        accessibilityRole="button"
        style={({ pressed }) => [t.note, pressed && t.pressed]}
      >
        <Text style={[sans(11, 600), caps, { color: C.muted, marginBottom: 8 }]}>
          You told Ciatta · {lastNote.date}
        </Text>
        <Text style={t.noteText}>“{displayCopy(lastNote.text)}”</Text>
      </Pressable>
    </ScrollView>
  );
}

const t = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingVertical: 24 },
  pressed: { opacity: 0.7 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  insight: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  note: { backgroundColor: C.card, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  noteText: { fontFamily: 'Urbanist_400Regular_Italic', fontSize: 15, lineHeight: 22, color: C.text },
});
