// One research insight, set as Lotus sets its articles: the photograph
// across the top with the title on it and the Sources pill, then the
// Highlights, the body, and how it connects to her own record. Discuss
// takes it to the concierge. Sources open in a sheet, each named.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { askCare, discussPrompt, takeInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useResearchInsights } from '../state/researchInsights';
import { useInsightReactions } from '../state/insightReactions';
import { PublisherLogo } from '../ui/PublisherLogo';
import { font, GUTTER } from '../theme';
import { Icon } from '../ui/icons';
import { headingFor } from '../ui/InsightCards';
import { PhotoCard } from '../ui/PhotoCard';
import { Sheet } from '../ui/Sheet';
import { HUE, L, NAV_CLEARANCE, SPACE } from '../ui/surface';

export function InsightScreen() {
  const nav = useNav();
  const [id] = useState(() => takeInsight());
  const { reactions, react, of } = useInsightReactions();
  const { matches, library } = useResearchInsights(reactions);
  const insight = useMemo(() => library.find((i) => i.id === id) ?? null, [library, id]);
  const connections = matches.find((m) => m.insight.id === id)?.connections ?? [];
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!insight) return null;

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: NAV_CLEARANCE + 60 }}>
        <PhotoCard source={headingFor(insight.image)} style={s.hero} shade={0.75}>
          <View style={s.bar}>
            <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={s.circle}>
              <Icon name="chevronLeft" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => void Share.share({ message: `${insight.title}\n\n${insight.highlights.map((h) => `• ${h}`).join('\n')}` })}
              accessibilityRole="button"
              accessibilityLabel="Share"
              hitSlop={8}
              style={s.circle}
            >
              <Icon name="send" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[font('title1', 'semibold'), s.title]} accessibilityRole="header">
            {displayCopy(insight.title)}
          </Text>
          <Pressable onPress={() => setSourcesOpen(true)} accessibilityRole="button" style={s.sourcesPill}>
            <View style={s.logos}>
              {[...new Set(insight.sources.map((x) => x.logo))].map((l, n) => (
                <View key={l} style={{ marginLeft: n ? -6 : 0 }}>
                  <PublisherLogo logo={l} size={22} />
                </View>
              ))}
            </View>
            <Text style={[font('subhead', 'semibold'), s.white]}>{`${insight.sources.length} ${insight.sources.length === 1 ? 'Source' : 'Sources'}`}</Text>
            <Icon name="chevronRight" size={13} color="#FFFFFF" />
          </Pressable>
        </PhotoCard>

        <View style={s.body}>
          {/* Her say on it, so Ciatta shows more of what she finds useful. */}
          <View style={s.reactions}>
            <Pressable
              onPress={() => react(insight.id, { reaction: of(insight.id).reaction === 'up' ? null : 'up' })}
              accessibilityRole="button"
              accessibilityLabel="Helpful"
              accessibilityState={{ selected: of(insight.id).reaction === 'up' }}
              hitSlop={8}
              style={[s.reaction, of(insight.id).reaction === 'up' && s.reactionOn]}
            >
              <Icon name="thumbUp" size={18} color={of(insight.id).reaction === 'up' ? L.canvas : L.body} />
            </Pressable>
            <Pressable
              onPress={() => react(insight.id, { reaction: of(insight.id).reaction === 'down' ? null : 'down' })}
              accessibilityRole="button"
              accessibilityLabel="Not for me"
              accessibilityState={{ selected: of(insight.id).reaction === 'down' }}
              hitSlop={8}
              style={[s.reaction, of(insight.id).reaction === 'down' && s.reactionOn]}
            >
              <Icon name="thumbDown" size={18} color={of(insight.id).reaction === 'down' ? L.canvas : L.body} />
            </Pressable>
            <Pressable
              onPress={() => react(insight.id, { saved: !of(insight.id).saved })}
              accessibilityRole="button"
              accessibilityLabel={of(insight.id).saved ? 'Remove from saved' : 'Save'}
              accessibilityState={{ selected: of(insight.id).saved }}
              hitSlop={8}
              style={[s.reaction, of(insight.id).saved && s.reactionOn]}
            >
              <Icon name="bookmark" size={18} color={of(insight.id).saved ? L.canvas : L.body} filled={of(insight.id).saved} />
            </Pressable>
            {of(insight.id).reaction === 'down' ? (
              <Text style={[font('footnote'), s.meta, { flex: 1 }]}>Got it. Ciatta will show fewer like this.</Text>
            ) : of(insight.id).reaction === 'up' || of(insight.id).saved ? (
              <Text style={[font('footnote'), s.meta, { flex: 1 }]}>Ciatta will show more like this.</Text>
            ) : null}
          </View>
          <Text style={[font('title2', 'semibold'), s.ink]}>Highlights</Text>
          {insight.highlights.map((h) => (
            <View key={h} style={s.bullet}>
              <View style={s.dot} />
              <Text style={[font('body'), s.bulletText]}>{displayCopy(h)}</Text>
            </View>
          ))}
          <Text style={[font('body'), s.paragraph]}>{displayCopy(insight.body)}</Text>

          {connections.length ? (
            <View style={s.record}>
              <Text style={[font('headline'), s.ink]}>In your record</Text>
              {connections.map((c) => (
                <Text key={c} style={[font('subhead'), s.recordLine]}>
                  {displayCopy(c)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Discuss, as Lotus floats it: the concierge, asked about this. */}
      <Pressable
        onPress={() => {
          askCare(discussPrompt(insight.title));
          nav.goTab('care');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [s.discuss, pressed && { opacity: 0.8 }]}
      >
        <Icon name="chat" size={16} color="#0C0E11" />
        <Text style={[font('subhead', 'semibold'), { color: '#0C0E11' }]}>Discuss</Text>
      </Pressable>

      <Sheet visible={sourcesOpen} title="Sources" onDone={() => setSourcesOpen(false)}>
        {insight.sources.map((src, n) => (
          <View key={src.title} style={[s.source, n > 0 && s.rule]}>
            <PublisherLogo logo={src.logo} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[font('subhead', 'semibold'), s.ink]}>{displayCopy(src.title)}</Text>
              <Text style={[font('footnote'), s.meta]}>{displayCopy(`${src.publisher}, ${src.year}`)}</Text>
            </View>
          </View>
        ))}
        <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near, lineHeight: 18 }]}>
          Research describes people in general. How it applies to you is a question for your clinician.
        </Text>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  hero: { height: 430, borderRadius: 0, borderWidth: 0 },
  bar: { flexDirection: 'row', justifyContent: 'space-between' },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  title: { color: '#FFFFFF', lineHeight: 36 },
  white: { color: '#FFFFFF' },
  sourcesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
  },
  body: { paddingHorizontal: GUTTER, paddingTop: SPACE.block, gap: 14 },
  ink: { color: L.ink },
  meta: { color: L.meta },
  bullet: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: HUE.reported, marginTop: 9 },
  bulletText: { color: L.ink, flex: 1, lineHeight: 26 },
  paragraph: { color: L.ink, lineHeight: 27, marginTop: 6 },
  record: { marginTop: 8, padding: 16, gap: 6, borderRadius: 18, backgroundColor: L.recessed, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  recordLine: { color: L.body, lineHeight: 21 },
  discuss: {
    position: 'absolute',
    right: GUTTER,
    bottom: NAV_CLEARANCE - 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  source: { paddingVertical: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logos: { flexDirection: 'row' },
  reactions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reaction: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: L.recessed, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  reactionOn: { backgroundColor: L.ink, borderColor: L.ink },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
});
