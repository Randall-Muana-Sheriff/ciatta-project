// Pattern Insights on Today, set as the reference's "What are we building
// today?": a large line of type, then a row of small cards, one per pattern
// for the day, running off the right edge. Tapping one opens its page.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { font, GUTTER } from '../theme';
import { CardFill } from './cardFill';
import { Icon } from './icons';
import { G } from './scheme';
import { SPACE } from './surface';

export function PatternInsightsRow() {
  const nav = useNav();
  const { reactions } = useInsightReactions();
  const { matches } = useResearchInsights(reactions);
  return (
    <View>
      <Text style={[font('largeTitle', 'medium'), r.headline]} accessibilityRole="header">
        Pattern Insights
      </Text>
      {matches.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={r.rowWrap} contentContainerStyle={r.row}>
          {matches.map(({ insight }) => (
            <Pressable
              key={insight.id}
              onPress={() => {
                openInsight(insight.id);
                nav.push('insight');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${insight.title}. Opens this pattern`}
              style={({ pressed }) => [r.card, pressed && r.pressed]}
            >
              <CardFill />
              <Icon name="sparkle" size={16} color={G.ink} />
              <View style={{ flex: 1 }} />
              <Text style={[font('footnote', 'medium'), r.title]} numberOfLines={3}>
                {displayCopy(insight.title)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={[font('subhead'), r.none]}>Patterns appear here as Ciatta comes to know your days.</Text>
      )}
    </View>
  );
}

const r = StyleSheet.create({
  headline: { color: G.ink, letterSpacing: -0.6, marginBottom: SPACE.near },
  rowWrap: { marginHorizontal: -GUTTER },
  row: { gap: 10, paddingHorizontal: GUTTER },
  card: {
    width: 136,
    height: 112,
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  title: { color: G.ink, lineHeight: 17 },
  none: { color: G.body, lineHeight: 21 },
  pressed: { opacity: 0.7 },
});
