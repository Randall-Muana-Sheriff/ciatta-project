// Insights on Today: the word, then cards on photographs, each a
// research finding that connects to her own
// record, with how many sources stand behind it. Only the ones that
// connect are shown.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { ResearchInsight } from '../lib/insights';

import { displayCopy } from '../lib/displayCopy';
import { useResearchInsights } from '../state/researchInsights';
import { useInsightReactions } from '../state/insightReactions';
import { PublisherLogo } from './PublisherLogo';
import { useState } from 'react';
import { font } from '../theme';
import { Icon } from './icons';
import { PhotoCard } from './PhotoCard';
import { L } from './surface';
import { G } from './scheme';
import { SectionHeading } from './kit';
import { chip } from './chip';
import { InsightView } from '../screens/InsightScreen';
import { Ground } from './Ground';
import { CardFill } from './cardFill';

// The heading photographs: real photographs (Unsplash and Pexels, free to
// use), one per pattern, shown on its card and at the top of its page.
const HEADINGS: Record<string, number> = {
  'iron-fatigue': require('../../assets/images/insight-photos/iron-fatigue.jpg'),
  'cycle-physiology': require('../../assets/images/insight-photos/cycle-physiology.jpg'),
  'sleep-cycle': require('../../assets/images/insight-photos/sleep-cycle.jpg'),
  'bp-categories': require('../../assets/images/insight-photos/bp-categories.jpg'),
  bristol: require('../../assets/images/insight-photos/bristol.jpg'),
  'endo-gut': require('../../assets/images/insight-photos/endo-gut.jpg'),
  thyroid: require('../../assets/images/insight-photos/thyroid.jpg'),
  'headache-red-flags': require('../../assets/images/insight-photos/headache-red-flags.jpg'),
  'hormones-cycle': require('../../assets/images/insight-photos/hormones-cycle.jpg'),
};
// An insight added to the library before its heading exists takes the
// first one, so a card is never blank.
export const headingFor = (image: string) => HEADINGS[image] ?? HEADINGS['cycle-physiology'];

export function InsightCards() {
  const { reactions, react, of } = useInsightReactions();
  const { matches, library } = useResearchInsights(reactions);
  const [savedOnly, setSavedOnly] = useState(false);
  // The insight she tapped, open in a sheet that slides up over Today.
  const [open, setOpen] = useState<string | null>(null);
  const saved = library.filter((i) => of(i.id).saved);
  // Saved shows what she kept, connected or not; otherwise what connects.
  const shown = savedOnly ? saved.map((insight) => ({ insight, connections: matches.find((m) => m.insight.id === insight.id)?.connections ?? [] })) : matches;
  if (!matches.length && !saved.length) return null;
  return (
    <View>
      <SectionHeading
        title="Pattern Insights"
        right={
          saved.length ? (
          <Pressable
            onPress={() => setSavedOnly((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: savedOnly }}
            style={[s.savedChip, savedOnly && s.savedChipOn]}
          >
            <Icon name="bookmark" size={13} color={savedOnly ? G.onPill : G.body} filled={savedOnly} />
            <Text style={[font('footnote', 'semibold'), { color: savedOnly ? G.onPill : G.body }]}>{`Saved ${saved.length}`}</Text>
          </Pressable>
          ) : undefined
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {shown.map(({ insight, connections }) => (
          <Pressable
            key={insight.id}
            onPress={() => setOpen(insight.id)}
            accessibilityRole="button"
            accessibilityLabel={`${insight.title}. ${insight.sources.length} sources`}
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <InsightCard insight={insight} connections={connections} style={s.card} />
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={open !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
        <Ground>
          <InsightView id={open} onClose={() => setOpen(null)} sheet />
        </Ground>
      </Modal>
    </View>
  );
}


// One insight on its photograph: the finding, the line from her record it
// connects to, its sources, and her say on it. Shared by the row on a
// screen and the Insights sheet on Today.
export function InsightCard({
  insight,
  connections,
  style,
}: {
  insight: ResearchInsight;
  connections: readonly string[];
  style?: ViewStyle;
}) {
  // On its photograph, with white type, and her say on it in the corner.
  return (
    <PhotoCard source={headingFor(insight.image)} style={style}>
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
      <View style={[chip.pill, s.sources]}>
        <View style={s.logos}>
          {[...new Set(insight.sources.map((x) => x.logo))].map((l, n) => (
            <View key={l} style={{ marginLeft: n ? -6 : 0 }}>
              <PublisherLogo logo={l} size={18} />
            </View>
          ))}
        </View>
        <Text style={[font('footnote'), s.white]}>{`${insight.sources.length} ${insight.sources.length === 1 ? 'Source' : 'Sources'}`}</Text>
        <Icon name="chevronRight" size={12} color="#FFFFFF" />
      </View>
      <Reactions id={insight.id} />
      </View>
    </PhotoCard>
  );
}

// A pattern opened as a sheet that slides up over the screen, as Profile's
// details do, on the same ground, with its photograph at the top.
export function InsightSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Modal visible={id !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Ground>
        <InsightView id={id} onClose={onClose} sheet />
      </Ground>
    </Modal>
  );
}

// Thumbs up, thumbs down and save, as small rings in a card's corner. What
// she says here is what Ciatta learns from: up shows more like it, down
// fewer, and save keeps it.
export function Reactions({ id }: { id: string }) {
  const { react, of } = useInsightReactions();
  const mine = of(id);
  const ring = (on: boolean) => [s.ring, on && s.ringOn];
  return (
    <View style={s.reactions}>
      <Pressable
        onPress={() => react(id, { reaction: mine.reaction === 'up' ? null : 'up' })}
        accessibilityRole="button"
        accessibilityLabel="Show more like this"
        accessibilityState={{ selected: mine.reaction === 'up' }}
        hitSlop={6}
        style={ring(mine.reaction === 'up')}
      >
        <Icon name="thumbUp" size={16} color={mine.reaction === 'up' ? '#0C0E11' : '#FFFFFF'} />
      </Pressable>
      <Pressable
        onPress={() => react(id, { reaction: mine.reaction === 'down' ? null : 'down' })}
        accessibilityRole="button"
        accessibilityLabel="Show fewer like this"
        accessibilityState={{ selected: mine.reaction === 'down' }}
        hitSlop={6}
        style={ring(mine.reaction === 'down')}
      >
        <Icon name="thumbDown" size={16} color={mine.reaction === 'down' ? '#0C0E11' : '#FFFFFF'} />
      </Pressable>
      <Pressable
        onPress={() => react(id, { saved: !mine.saved })}
        accessibilityRole="button"
        accessibilityLabel={mine.saved ? 'Remove from saved' : 'Save'}
        accessibilityState={{ selected: mine.saved }}
        hitSlop={6}
        style={ring(mine.saved)}
      >
        <Icon name="bookmark" size={16} color={mine.saved ? '#0C0E11' : '#FFFFFF'} filled={mine.saved} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  ink: { color: G.ink },
  row: { gap: 12 },
  card: { width: 272, height: 340 },
  title: { color: '#FFFFFF', lineHeight: 28 },
  reactions: { flexDirection: 'row', gap: 8 },
  ring: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.7)', backgroundColor: 'rgba(0, 0, 0, 0.18)' },
  ringOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  glowCard: { borderRadius: 22, overflow: 'hidden', padding: 18, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  connection: { color: 'rgba(255, 255, 255, 0.85)', lineHeight: 18 },
  white: { color: '#FFFFFF' },
  sources: { alignSelf: 'flex-start', borderColor: 'rgba(255, 255, 255, 0.6)' },
  pressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  thumbs: { flexDirection: 'row', gap: 8 },
  logos: { flexDirection: 'row', marginRight: 2 },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, backgroundColor: L.recessed },
  savedChipOn: { backgroundColor: G.ink, borderColor: G.ink },
});
