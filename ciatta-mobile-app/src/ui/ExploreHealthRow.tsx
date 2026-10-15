// Explore health on Today, as Lotus sets it: the heading with View all,
// then a row of topic tiles, an icon over a name, running off the right
// edge. Each opens what Ciatta knows about her for that topic.

import { useBodyOpen } from '../state/todayMode';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BodyView } from './BodyView';

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

// Topics, or her body: a small switch beside View all chooses which.
const VIEWS = ['Topics', 'Body'] as const;

export function ExploreHealthRow() {
  const nav = useNav();
  const [bodyOpen, setBodyOpen] = useBodyOpen();
  const view: (typeof VIEWS)[number] = bodyOpen ? 'Body' : 'Topics';
  const setView = (v: (typeof VIEWS)[number]) => setBodyOpen(v === 'Body');
  return (
    <View>
      <View style={e.head}>
        <Text style={[font('headline'), e.title]} accessibilityRole="header">
          Explore
        </Text>
        <View style={e.right}>
          <View style={e.toggle} accessibilityRole="tablist">
            {VIEWS.map((v) => {
              const on = v === view;
              return (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={v === 'Body' ? 'Show your body, system by system' : 'Show health topics'}
                  hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
                  style={[e.seg, on && e.segOn]}
                >
                  <Text style={[font('caption1', on ? 'semibold' : 'regular'), { color: on ? G.onPill : G.meta }]}>{v}</Text>
                </Pressable>
              );
            })}
          </View>
          {view === 'Topics' ? (
            <Pressable onPress={() => nav.push('exploreAll')} accessibilityRole="button" accessibilityLabel="View all health topics" hitSlop={8} style={e.all}>
              <Text style={[font('subhead'), e.allText]}>View all</Text>
              <Icon name="chevronRight" size={14} color={G.meta} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {view === 'Topics' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.rowWrap} contentContainerStyle={e.row}>
          {EXPLORE_TOPICS.map((t) => (
            <TopicTile key={t.key} topicKey={t.key} label={t.label} />
          ))}
        </ScrollView>
      ) : (
        <BodyView />
      )}
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
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // A very small switch: two words on a pill.
  toggle: { flexDirection: 'row', padding: 2, borderRadius: 999, backgroundColor: G.fill },
  seg: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  segOn: { backgroundColor: G.pill },
  allText: { color: G.meta, fontSize: 13 },
  rowWrap: { marginHorizontal: -GUTTER },
  row: { gap: 10, paddingHorizontal: GUTTER },
  tile: {
    width: 108,
    // A floor, not a fixed height: at larger text sizes the tile grows
    // rather than cutting the name off.
    minHeight: 84,
    padding: 12,
    justifyContent: 'space-between',
    borderRadius: 18,
    // The ground's own lift and edge, so a tile reads in light and dark.
    backgroundColor: G.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G.rule,
  },
  tileWide: { width: '48%' },
  label: { color: G.ink, lineHeight: 17 },
  pressed: { opacity: 0.6 },
});
