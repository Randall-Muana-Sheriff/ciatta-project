// Everything she bookmarked, in one place. Today shows the insights that
// connect to her record this week; here are the ones she chose to keep,
// whether they connect today or not.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'react-native';

import { openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { savedInsights } from '../lib/insights';
import { useNav } from '../navigation';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { font } from '../theme';
import { headingFor } from '../ui/InsightCards';
import { Icon } from '../ui/icons';
import { DetailScreen, EmptyNote, Lead } from '../ui/kit';
import { PublisherLogo } from '../ui/PublisherLogo';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { GlassFill } from '../ui/frosted';

export function BookmarksScreen() {
  const nav = useNav();
  const { reactions, react } = useInsightReactions();
  const { library } = useResearchInsights(reactions);
  const saved = savedInsights(library, reactions);

  return (
    <DetailScreen title="Bookmarks" onBack={nav.back}>
      <Lead style={s.lede} text="What you kept. Open one to read it again, or discuss it with Ciatta." />
      {saved.length ? (
        <View style={s.list}>
          {saved.map((insight) => {
            const publishers = [...new Set(insight.sources.map((x) => x.publisher))];
            const logos = [...new Set(insight.sources.map((x) => x.logo))];
            return (
              <Pressable
                key={insight.id}
                onPress={() => {
                  openInsight(insight.id);
                  nav.push('insight');
                }}
                accessibilityRole="button"
                accessibilityLabel={insight.title}
                style={({ pressed }) => [s.row, pressed && s.pressed]}
              >
                <GlassFill />
                <Image source={headingFor(insight.image)} style={s.thumb} resizeMode="cover" accessible={false} />
                <View style={s.text}>
                  <Text style={[font('subhead', 'semibold'), s.ink]} numberOfLines={3}>
                    {displayCopy(insight.title)}
                  </Text>
                  <View style={s.sources}>
                    {logos.slice(0, 3).map((l, n) => (
                      <View key={l} style={{ marginLeft: n ? -5 : 0 }}>
                        <PublisherLogo logo={l} size={16} />
                      </View>
                    ))}
                    <Text style={[font('caption1'), s.meta]} numberOfLines={1}>
                      {displayCopy(publishers.slice(0, 2).join(', '))}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => react(insight.id, { saved: false })}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from bookmarks"
                  hitSlop={12}
                  style={s.mark}
                >
                  <Icon name="bookmark" size={20} color={L.ink} filled />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ marginTop: SPACE.near }}>
          <EmptyNote text="Nothing saved yet. Tap the bookmark on any insight and it will be kept here." />
        </View>
      )}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  lede: { color: L.body, lineHeight: 21 },
  list: { marginTop: SPACE.near, gap: SPACE.grid },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: TILE_RADIUS,
    backgroundColor: L.glass,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  thumb: { width: 72, height: 88, borderRadius: 12 },
  text: { flex: 1, gap: 8 },
  ink: { color: L.ink },
  meta: { color: L.meta, flexShrink: 1, marginLeft: 6 },
  sources: { flexDirection: 'row', alignItems: 'center' },
  mark: { alignSelf: 'flex-start', padding: 4 },
});
