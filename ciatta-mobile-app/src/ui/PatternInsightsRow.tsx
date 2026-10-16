// Pattern Insights on Today, set as the reference's "What are we building
// today?": a large line of type, then a row of small cards, one per pattern
// for the day, running off the right edge. Tapping one opens its page.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { headingFor, InsightSheet, Reactions } from './InsightCards';
import { PhotoCard } from './PhotoCard';

import { openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { font, GUTTER } from '../theme';
import { CardFill } from './cardFill';
import { G } from './scheme';
import { L, SPACE } from './surface';

export function PatternInsightsRow() {
  const nav = useNav();
  const { reactions } = useInsightReactions();
  const { matches } = useResearchInsights(reactions);
  // One card whole, and the next showing at the right edge, so the row
  // says there is more to swipe to. Swipes stop on a card.
  const { width } = useWindowDimensions();
  const cardWidth = width - GUTTER - PEEK - GAP;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View>
      <Text style={[font('headline'), r.headline]} accessibilityRole="header">
        Pattern Insights
      </Text>
      {matches.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={r.rowWrap}
          contentContainerStyle={r.row}
          snapToInterval={cardWidth + GAP}
          decelerationRate="fast"
        >
          {matches.map(({ insight }) => (
            <Pressable
              key={insight.id}
              onPress={() => setOpen(insight.id)}
              accessibilityRole="button"
              accessibilityLabel={`${insight.title}. Opens this pattern`}
              style={({ pressed }) => [{ width: cardWidth }, pressed && r.pressed]}
            >
              {/* Its photograph, white type, and her say in the corner. The
                  same photograph tops its page when it opens. */}
              <PhotoCard source={headingFor(insight.image)} style={r.card}>
                <View style={{ flex: 1 }} />
                <Text style={[font('headline'), r.title]} numberOfLines={4}>
                  {displayCopy(insight.title)}
                </Text>
                <View style={r.corner}>
                  <Reactions id={insight.id} />
                </View>
              </PhotoCard>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={[font('subhead'), r.none]}>Patterns appear here as Ciatta comes to know your days.</Text>
      )}
      <InsightSheet id={open} onClose={() => setOpen(null)} />
    </View>
  );
}

// How much of the next card shows, and the gap between cards.
const PEEK = 44;
const GAP = 12;

const r = StyleSheet.create({
  headline: { color: G.ink, marginBottom: SPACE.tight + 4 },
  rowWrap: { marginHorizontal: -GUTTER },
  row: { gap: GAP, paddingHorizontal: GUTTER },
  card: {
    // Grows with larger text sizes rather than clipping the title.
    minHeight: 200,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  // On a glow card, dark in every appearance.
  title: { color: '#FFFFFF', lineHeight: 22 },
  corner: { alignItems: 'flex-end', marginTop: 10 },
  none: { color: G.body, lineHeight: 21 },
  pressed: { opacity: 0.7 },
});
