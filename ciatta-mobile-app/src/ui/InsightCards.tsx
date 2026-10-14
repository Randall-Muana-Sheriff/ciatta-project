// Insights on Today: the word, then cards on photographs, each a
// research finding that connects to her own
// record, with how many sources stand behind it. Only the ones that
// connect are shown.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useResearchInsights } from '../state/researchInsights';
import { useInsightReactions } from '../state/insightReactions';
import { PublisherLogo } from './PublisherLogo';
import { useState } from 'react';
import { font } from '../theme';
import { Icon } from './icons';
import { PhotoCard } from './PhotoCard';
import { L } from './surface';

// The heading images, generated for Ciatta in one style: a dark room,
// light in two of the design system's hues, a soft figure out of focus.
const HEADINGS: Record<string, number> = {
  'iron-fatigue': require('../../assets/images/insights/iron-fatigue.jpg'),
  'cycle-physiology': require('../../assets/images/insights/cycle-physiology.jpg'),
  'sleep-cycle': require('../../assets/images/insights/sleep-cycle.jpg'),
  'bp-categories': require('../../assets/images/insights/bp-categories.jpg'),
  bristol: require('../../assets/images/insights/bristol.jpg'),
  'endo-gut': require('../../assets/images/insights/endo-gut.jpg'),
  thyroid: require('../../assets/images/insights/thyroid.jpg'),
  'headache-red-flags': require('../../assets/images/insights/headache-red-flags.jpg'),
  'hormones-cycle': require('../../assets/images/insights/hormones-cycle.jpg'),
};
// An insight added to the library before its heading exists takes the
// first one, so a card is never blank.
export const headingFor = (image: string) => HEADINGS[image] ?? HEADINGS['cycle-physiology'];

export function InsightCards() {
  const nav = useNav();
  const { reactions, react, of } = useInsightReactions();
  const { matches, library } = useResearchInsights(reactions);
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = library.filter((i) => of(i.id).saved);
  // Saved shows what she kept, connected or not; otherwise what connects.
  const shown = savedOnly ? saved.map((insight) => ({ insight, connections: matches.find((m) => m.insight.id === insight.id)?.connections ?? [] })) : matches;
  if (!matches.length && !saved.length) return null;
  return (
    <View>
      <View style={s.head}>
        <Text style={[font('title2', 'semibold'), s.ink, { flex: 1 }]} accessibilityRole="header">
          Insights
        </Text>
        {saved.length ? (
          <Pressable
            onPress={() => setSavedOnly((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: savedOnly }}
            style={[s.savedChip, savedOnly && s.savedChipOn]}
          >
            <Icon name="bookmark" size={13} color={savedOnly ? L.canvas : L.body} filled={savedOnly} />
            <Text style={[font('footnote', 'semibold'), { color: savedOnly ? L.canvas : L.body }]}>{`Saved ${saved.length}`}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {shown.map(({ insight, connections }) => (
          <Pressable
            key={insight.id}
            onPress={() => {
              openInsight(insight.id);
              nav.push('insight');
            }}
            accessibilityRole="button"
            accessibilityLabel={`${insight.title}. ${insight.sources.length} sources`}
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <PhotoCard source={headingFor(insight.image)} style={s.card} shade={0.7}>
              <View style={s.cardTop}>
                <Pressable
                  onPress={() => react(insight.id, { saved: !of(insight.id).saved })}
                  accessibilityRole="button"
                  accessibilityLabel={of(insight.id).saved ? 'Remove from saved' : 'Save'}
                  hitSlop={10}
                >
                  <Icon name="bookmark" size={20} color="#FFFFFF" filled={of(insight.id).saved} />
                </Pressable>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={[font('title3', 'semibold'), s.title]} numberOfLines={4}>
                {displayCopy(insight.title)}
              </Text>
              {connections[0] ? (
                <Text style={[font('footnote'), s.connection]} numberOfLines={2}>
                  {displayCopy(connections[0])}
                </Text>
              ) : null}
              <View style={s.foot}>
              <View style={s.sources}>
                <View style={s.logos}>
                  {[...new Set(insight.sources.map((x) => x.logo))].map((l, n) => (
                    <View key={l} style={{ marginLeft: n ? -6 : 0 }}>
                      <PublisherLogo logo={l} size={18} />
                    </View>
                  ))}
                </View>
                <Text style={[font('footnote', 'semibold'), s.white]}>{`${insight.sources.length} ${insight.sources.length === 1 ? 'Source' : 'Sources'}`}</Text>
                <Icon name="chevronRight" size={12} color="#FFFFFF" />
              </View>
              {/* What she thinks of it, which is what Ciatta learns from:
                  up shows more like it, down stops showing it. */}
              <View style={s.thumbs}>
                {(['up', 'down'] as const).map((r) => {
                  const on = of(insight.id).reaction === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => react(insight.id, { reaction: on ? null : r })}
                      accessibilityRole="button"
                      accessibilityLabel={r === 'up' ? 'Show more like this' : 'Show less like this'}
                      accessibilityState={{ selected: on }}
                      hitSlop={8}
                      style={[s.thumb, on && s.thumbOn]}
                    >
                      <Icon name={r === 'up' ? 'thumbUp' : 'thumbDown'} size={17} color={on ? '#0C0E11' : '#FFFFFF'} />
                    </Pressable>
                  );
                })}
              </View>
              </View>
            </PhotoCard>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ink: { color: L.ink },
  row: { gap: 12, paddingTop: 12 },
  card: { width: 272, height: 340 },
  title: { color: '#FFFFFF', lineHeight: 28 },
  connection: { color: 'rgba(255,255,255,0.78)', lineHeight: 18 },
  white: { color: '#FFFFFF' },
  sources: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  thumbOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  logos: { flexDirection: 'row', marginRight: 2 },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, backgroundColor: L.recessed },
  savedChipOn: { backgroundColor: L.ink, borderColor: L.ink },
});
