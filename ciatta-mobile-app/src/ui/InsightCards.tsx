// Insights on Today, as Lotus sets them: a sparkle and the word, then
// cards on photographs, each a research finding that connects to her own
// record, with how many sources stand behind it. Only the ones that
// connect are shown.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import type { InsightImage } from '../lib/insights';
import { useNav } from '../navigation';
import { useResearchInsights } from '../state/researchInsights';
import { font } from '../theme';
import { Icon } from './icons';
import { images } from './images';
import { PhotoCard } from './PhotoCard';
import { L } from './surface';

export const INSIGHT_IMAGE: Record<InsightImage, number> = {
  symptoms: images.symptoms,
  cycle: images.cycle,
  sleep: images.sleep,
  horizon: images.horizon,
  journal: images.journal,
  records: images.records,
  movement: images.movement,
};

export function InsightCards() {
  const nav = useNav();
  const { matches } = useResearchInsights();
  if (!matches.length) return null;
  return (
    <View>
      <View style={s.head}>
        <Icon name="sparkle" size={20} color={L.ink} />
        <Text style={[font('title2', 'semibold'), s.ink]} accessibilityRole="header">
          Insights
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {matches.map(({ insight, connections }) => (
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
            <PhotoCard source={INSIGHT_IMAGE[insight.image]} style={s.card} shade={0.7}>
              <Icon name="sparkle" size={18} color="#FFFFFF" />
              <View style={{ flex: 1 }} />
              <Text style={[font('title3', 'semibold'), s.title]} numberOfLines={4}>
                {displayCopy(insight.title)}
              </Text>
              <Text style={[font('footnote'), s.connection]} numberOfLines={2}>
                {displayCopy(connections[0])}
              </Text>
              <View style={s.sources}>
                <Text style={[font('footnote', 'semibold'), s.white]}>{`${insight.sources.length} ${insight.sources.length === 1 ? 'Source' : 'Sources'}`}</Text>
                <Icon name="chevronRight" size={12} color="#FFFFFF" />
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
});
