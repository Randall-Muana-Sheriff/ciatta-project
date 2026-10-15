// Explore health on Today, as Lotus sets it: the heading with View all,
// then a row of topic tiles, an icon over a name, running off the right
// edge. Each opens what Ciatta knows about her for that topic.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chooseExplore } from '../lib/exploreHandoff';
import { EXPLORE_TOPICS } from '../lib/exploreHealth';
import { useNav } from '../navigation';
import { font, GUTTER } from '../theme';
import { Icon, type IconName } from './icons';
import { G } from './scheme';
import { SPACE } from './surface';

export const TOPIC_ICON: Record<string, IconName> = {
  fertility: 'flower',
  cycle: 'drop',
  pregnancy: 'uterus',
  sleep: 'sleep',
  hormones: 'thyroid',
  gut: 'gut',
  heart: 'heartPulse',
  mood: 'brain',
  skin: 'sun',
  nutrition: 'leaf',
};

export function ExploreHealthRow() {
  const nav = useNav();
  return (
    <View>
      <View style={e.head}>
        <Text style={[font('headline'), e.title]} accessibilityRole="header">
          Explore health
        </Text>
        <Pressable onPress={() => nav.push('exploreAll')} accessibilityRole="button" accessibilityLabel="View all health topics" hitSlop={8} style={e.all}>
          <Text style={[font('subhead'), e.allText]}>View all</Text>
          <Icon name="chevronRight" size={14} color={G.meta} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.rowWrap} contentContainerStyle={e.row}>
        {EXPLORE_TOPICS.map((t) => (
          <TopicTile key={t.key} topicKey={t.key} label={t.label} />
        ))}
      </ScrollView>
    </View>
  );
}

export function TopicTile({ topicKey, label, wide = false }: { topicKey: string; label: string; wide?: boolean }) {
  const nav = useNav();
  return (
    <Pressable
      onPress={() => {
        chooseExplore(topicKey);
        nav.push('explore');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${label}`}
      style={({ pressed }) => [e.tile, wide && e.tileWide, pressed && e.pressed]}
    >
      <Icon name={TOPIC_ICON[topicKey] ?? 'sparkle'} size={18} color={G.ink} />
      <Text style={[font('footnote', 'semibold'), e.label]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.tight + 4 },
  title: { color: G.ink },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allText: { color: G.meta, fontSize: 13 },
  rowWrap: { marginHorizontal: -GUTTER },
  row: { gap: 10, paddingHorizontal: GUTTER },
  tile: {
    width: 108,
    height: 84,
    padding: 12,
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  tileWide: { width: '48%' },
  label: { color: G.ink, lineHeight: 17 },
  pressed: { opacity: 0.6 },
});
