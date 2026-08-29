import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';
import { displayCopy } from '../lib/displayCopy';
import { composeWhyLayer } from '../lib/whyLayer';
import {
  listInsightCandidates,
  selectInsightVisualization,
  toUnderstandingSignals,
} from '../lib/insightViz';
import { fetchInsightSeries } from '../lib/observationSeries';
import type { TodayPriority } from '../lib/priority';
import type {
  CrossDomainUnderstandingRow,
  RelationshipRow,
  UnderstandingHistoryRow,
  UnderstandingRow,
} from '../lib/queries';
import BottomSheet from '../components/BottomSheet';
import InsightVisualization from '../components/InsightVisualization';

export default function WhySheet({
  visible,
  featured,
  todayNarrative,
  todayPriority,
  understandings,
  relationships,
  crossDomain,
  history,
  goals = [],
  userId,
  onClose,
  onOpenCore,
}: {
  visible: boolean;
  featured: UnderstandingRow | null;
  todayNarrative: string;
  todayPriority: TodayPriority | null;
  understandings: UnderstandingRow[];
  relationships: RelationshipRow[];
  crossDomain: CrossDomainUnderstandingRow[];
  history: UnderstandingHistoryRow[];
  goals?: string[];
  userId?: string | null;
  onClose: () => void;
  onOpenCore: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [candidates, setCandidates] = useState<ReturnType<typeof listInsightCandidates>>([]);

  useEffect(() => {
    if (!visible) {
      setExpandedId(null);
      setHistoryOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !userId || !featured) return;
    let alive = true;
    fetchInsightSeries(userId)
      .then((series) => {
        if (!alive) return;
        const signals = toUnderstandingSignals(understandings);
        const links = relationships.map((r) => ({
          from: r.from_domain,
          to: r.to_domain,
          strength: r.strength,
        }));
        const listed = listInsightCandidates({
          understandings: signals,
          relationships: links,
          goals,
          series,
          featuredDomain: featured.domain,
          focusDomain: featured.domain,
          excludeIds: ['still_learning'],
        });
        const primary = selectInsightVisualization({
          understandings: signals,
          relationships: links,
          goals,
          series,
          featuredDomain: featured.domain,
          focusDomain: featured.domain,
          excludeIds: ['still_learning'],
          allowStillLearning: false,
        });
        const rest = listed.filter((c) => c.id !== primary?.id && c.kind !== 'still-learning');
        setCandidates(primary && primary.kind !== 'still-learning' ? [primary, ...rest] : rest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, userId, featured, understandings, relationships, goals]);

  const layer = useMemo(() => {
    if (!featured) return null;
    return composeWhyLayer({
      featured,
      todayNarrative,
      todayPriority,
      understandings,
      relationships,
      crossDomain,
      history,
      candidates,
    });
  }, [
    featured,
    todayNarrative,
    todayPriority,
    understandings,
    relationships,
    crossDomain,
    history,
    candidates,
  ]);

  const historyItems = (layer?.history ?? []).filter((label) => label !== layer?.mattering);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={0.88}>
      {featured && layer ? (
        <>
          {layer.mattering ? <Text style={styles.mattering}>{layer.mattering}</Text> : null}
          {layer.evidence ? <Text style={styles.evidence}>{layer.evidence}</Text> : null}

          {layer.primaryViz ? (
            <View style={styles.viz}>
              <InsightVisualization view={layer.primaryViz} framed={false} />
            </View>
          ) : null}

          {layer.supporting.map((signal) => {
            const open = expandedId === signal.id;
            return (
              <View key={signal.id} style={styles.support}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={displayCopy(signal.title)}
                  onPress={() => setExpandedId(open ? null : signal.id)}
                  style={({ pressed }) => [styles.supportHit, pressed && { opacity: 0.65 }]}
                >
                  <Text style={styles.supportTitle}>{displayCopy(signal.title)}</Text>
                </Pressable>
                {open ? (
                  <View style={styles.supportViz}>
                    <InsightVisualization view={signal} compact framed={false} />
                  </View>
                ) : null}
              </View>
            );
          })}

          {layer.related.length > 0 ? (
            <View style={styles.relatedBlock}>
              {layer.related.map((item) => (
                <Text key={item.domain} style={styles.relatedText}>
                  {item.text}
                </Text>
              ))}
            </View>
          ) : null}

          {historyItems.length > 0 ? (
            <View style={styles.historyBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How this changed"
                onPress={() => setHistoryOpen((v) => !v)}
                style={({ pressed }) => [styles.historyHit, pressed && { opacity: 0.65 }]}
              >
                <Text style={styles.historyLabel}>How this changed</Text>
              </Pressable>
              {historyOpen
                ? historyItems.map((label) => (
                    <Text key={label} style={styles.history}>
                      {label}
                    </Text>
                  ))
                : null}
            </View>
          ) : null}

          {layer.watching ? <Text style={styles.watching}>{layer.watching}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Core"
            onPress={onOpenCore}
            style={({ pressed }) => [styles.coreHit, pressed && { opacity: 0.65 }]}
          >
            <Text style={styles.coreLink}>The longer picture lives in Core.</Text>
          </Pressable>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  mattering: {
    ...type.title2,
    color: colors.ink,
    marginBottom: 16,
  },
  evidence: {
    ...type.body,
    color: colors.ink2,
  },
  viz: {
    marginTop: 28,
  },
  support: {
    marginTop: 8,
  },
  supportHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  supportTitle: {
    ...type.subheadline,
    color: colors.ink2,
  },
  supportViz: {
    marginTop: 8,
  },
  relatedBlock: {
    marginTop: 28,
    gap: 12,
  },
  relatedText: {
    ...type.body,
    color: colors.ink2,
  },
  historyBlock: {
    marginTop: 20,
  },
  historyHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  historyLabel: {
    ...type.headline,
    color: colors.ink,
  },
  history: {
    ...type.body,
    color: colors.ink2,
    marginTop: 12,
  },
  watching: {
    ...type.body,
    color: colors.ink,
    marginTop: 28,
  },
  coreHit: {
    marginTop: 36,
    minHeight: 44,
    justifyContent: 'center',
  },
  coreLink: {
    ...type.subheadline,
    color: colors.ink2,
  },
});
