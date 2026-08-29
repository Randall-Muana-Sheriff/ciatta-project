import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, type } from '../theme/tokens';
import { domainLabel, domains } from '../lib/mockData';
import { coreStatusLabel } from '../lib/intelligenceStatus';
import type { Domain, Strength } from '../lib/types';
import type { DiscoveryRow, RelationshipRow, UnderstandingRow } from '../lib/queries';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import BodySilhouette, {
  CORE_FIGURE_ASPECT,
  CORE_FIGURE_BASE_WIDTH,
} from '../components/BodySilhouette';

const TAP_HINT_BLOCK = 8;
const MODEL_MARGIN = 24;
const MAX_SCALE = 1.8;

type Tab = 'discoveries' | 'unwritten';

export default function CoreScreen({
  onOpenUnderstanding,
  onOpenDiscovery,
  strengths,
  discoveries,
  understandings = [],
  relationships = [],
}: {
  onOpenUnderstanding: (domain: Domain) => void;
  onOpenDiscovery: (id: string) => void;
  strengths: Partial<Record<Domain, Strength>>;
  discoveries: DiscoveryRow[];
  understandings?: UnderstandingRow[];
  relationships?: RelationshipRow[];
}) {
  const [tab, setTab] = useState<Tab>('discoveries');
  const understoodDomains = domains.filter((d) => strengths[d]);
  const unwrittenDomains = domains.filter((d) => !strengths[d]);

  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const SCREEN_TOP_PADDING = 20;
  const NAV_CAPSULE_HEIGHT = 62;
  const NAV_BOTTOM_CLEARANCE = 2;
  const navFootprint = NAV_CAPSULE_HEIGHT + insets.bottom + NAV_BOTTOM_CLEARANCE;
  const NAV_OVERLAP_COVERAGE = 8;
  const introMinHeight = Math.max(
    0,
    windowHeight - insets.top - SCREEN_TOP_PADDING - navFootprint + NAV_OVERLAP_COVERAGE
  );

  const [headerHeight, setHeaderHeight] = useState(0);
  const availableModelHeight = Math.max(
    0,
    introMinHeight - headerHeight - TAP_HINT_BLOCK - MODEL_MARGIN
  );
  const scaleForHeight = availableModelHeight / (CORE_FIGURE_BASE_WIDTH * CORE_FIGURE_ASPECT);
  const silhouetteScale = headerHeight > 0 ? Math.min(scaleForHeight, MAX_SCALE) : 1;

  const statusLabels = Object.fromEntries(
    understandings.map((u) => [u.domain, coreStatusLabel(u)])
  ) as Partial<Record<Domain, string>>;

  return (
    <ScreenContainer>
      <View style={{ minHeight: introMinHeight }}>
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <EditorialHeader title="Core" subtitle="How this has taken shape." />
        </View>

        <View style={styles.model}>
          <BodySilhouette
            variant="core"
            labeled
            strengths={strengths}
            statusLabels={statusLabels}
            links={relationships.map((r) => ({
              from: r.from_domain,
              to: r.to_domain,
              strength: r.strength,
            }))}
            onDomainPress={onOpenUnderstanding}
            scale={silhouetteScale}
          />
          {understoodDomains.length === 0 ? (
            <Text style={styles.tapHint}>Nothing to show here yet.</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['discoveries', 'Noticed'],
            ['unwritten', 'Still taking shape'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <Text
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            {label}
          </Text>
        ))}
      </View>

      {tab === 'discoveries' &&
        (discoveries.length > 0 ? (
          <View style={styles.list}>
            {discoveries.map((disc) => (
              <Pressable
                key={disc.id}
                accessibilityRole="button"
                onPress={() => onOpenDiscovery(disc.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowTitle}>{disc.name ?? 'Something new'}</Text>
                <Text style={styles.rowSub}>{disc.narrative}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Nothing here yet. Patterns appear once they are strong enough to
            become part of your story.
          </Text>
        ))}

      {tab === 'unwritten' && (
        <View style={styles.list}>
          {unwrittenDomains.length > 0 ? (
            unwrittenDomains.map((d) => (
              <View key={d} style={styles.row}>
                <Text style={styles.rowTitle}>{domainLabel[d]}</Text>
                <Text style={styles.rowSub}>Not yet in the picture.</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              Everything with a starting point is here. Nothing left to take
              shape.
            </Text>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  model: {
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: colors.canvas,
  },
  tapHint: {
    ...type.footnote,
    color: colors.ink3,
    marginTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 12,
    paddingBottom: 12,
  },
  tab: {
    ...type.subheadline,
    color: colors.ink3,
  },
  tabActive: {
    ...fonts.sansMedium,
    color: colors.ink,
  },
  list: {
    marginTop: 8,
    gap: 20,
  },
  row: {
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.65,
  },
  rowTitle: {
    ...type.headline,
    color: colors.ink,
  },
  rowSub: {
    ...type.footnote,
    color: colors.ink2,
    marginTop: 4,
  },
  emptyText: {
    ...type.body,
    color: colors.ink2,
    marginTop: 8,
  },
});
