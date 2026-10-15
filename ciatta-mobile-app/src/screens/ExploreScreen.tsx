// One Explore health topic, read from what Ciatta knows about her: what
// her record says about it, the Pattern Insights that belong to it, and
// a way to ask Ciatta to go further.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { askCare, openInsight } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { takeExplore } from '../lib/exploreHandoff';
import { exploreTopic } from '../lib/exploreHealth';
import { useNav } from '../navigation';
import { useAgentContext } from '../state/agentContext';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { CardFill } from '../ui/cardFill';
import { InsightCard } from '../ui/InsightCards';
import { Icon } from '../ui/icons';
import { DetailScreen, SectionHeading } from '../ui/kit';
import { G } from '../ui/scheme';
import { BLEED, L, SPACE } from '../ui/surface';
import { useEffect } from 'react';

export function ExploreScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [key] = useState(() => takeExplore() ?? 'cycle');
  const { context } = useAgentContext();
  const [conditions, setConditions] = useState<string[]>([]);
  useEffect(() => {
    repo
      .loadReported()
      .then((r) => setConditions(r.conditions))
      .catch(() => {});
  }, [repo]);
  const view = useMemo(() => exploreTopic(key, context, conditions), [key, context, conditions]);
  const { reactions } = useInsightReactions();
  const { matches } = useResearchInsights(reactions);
  const related = matches.filter((m) => m.insight.topics.some((t) => view.insightTopics.includes(t)));

  return (
    <DetailScreen title={view.topic.label} onBack={nav.back}>
      <SectionHeading title="From your record" />
      <View style={x.card}>
        <CardFill />
        {view.lines.length ? (
          view.lines.map((line) => (
            <View key={line} style={x.line}>
              <View style={x.dot} />
              <Text style={[font('subhead'), x.lineText]}>{displayCopy(line)}</Text>
            </View>
          ))
        ) : (
          <Text style={[font('subhead'), x.lineText]}>{displayCopy(view.empty)}</Text>
        )}
      </View>

      <Pressable
        onPress={() => {
          askCare(view.ask);
          nav.push('ciatta');
        }}
        accessibilityRole="button"
        style={({ pressed }) => [x.ask, pressed && x.pressed]}
      >
        <Icon name="chat" size={16} color={G.onPill} />
        <Text style={[font('subhead', 'semibold'), { color: G.onPill }]}>{`Ask Ciatta about ${view.topic.noun}`}</Text>
      </Pressable>

      {related.length ? (
        <View style={x.section}>
          <SectionHeading title="Pattern Insights" />
          <View style={x.list}>
            {related.map((m) => (
              <Pressable
                key={m.insight.id}
                onPress={() => {
                  openInsight(m.insight.id);
                  nav.push('insight');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${m.insight.title}. Opens this pattern`}
              >
                <InsightCard insight={m.insight} connections={m.connections} style={x.insight} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </DetailScreen>
  );
}

const x = StyleSheet.create({
  card: { backgroundColor: L.glass, padding: 16, gap: 10, overflow: 'hidden', ...BLEED },
  line: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: G.ink, marginTop: 8 },
  lineText: { color: L.ink, lineHeight: 22, flex: 1 },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACE.near,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: G.pill,
  },
  section: { marginTop: SPACE.section },
  list: { gap: SPACE.grid },
  insight: { height: 300, ...BLEED },
  pressed: { opacity: 0.8 },
});
