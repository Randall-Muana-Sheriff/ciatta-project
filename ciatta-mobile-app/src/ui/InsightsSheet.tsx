// Insights on Today, as Lotus sets them: a sheet resting over the lower
// part of the screen with the first pattern showing, which slides up to
// fill the screen with every pattern for the day. Pull it up, or start
// scrolling, and it rises; pull it down from the top of the list and it
// settles again. Tapping a pattern opens its page.
//
// On the same ground as every screen, so it is never a flat page of its
// own. Built on React Native's Animated and PanResponder, since the app
// carries no gesture library.

import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openInsight } from '../lib/careHandoff';
import { useNav } from '../navigation';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { font, GUTTER } from '../theme';
import { GroundLayer } from './Ground';
import { InsightCard } from './InsightCards';
import { G } from './scheme';
import { L, NAV_CLEARANCE, SPACE } from './surface';

// How much of the screen the resting sheet takes, and how far from the top
// it stops when open.
const REST = 0.44;
const TOP_GAP = 56;

export function InsightsSheet() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reactions } = useInsightReactions();
  const { matches } = useResearchInsights(reactions);

  const full = height - insets.top - TOP_GAP;
  const resting = full - Math.round(height * REST);
  const y = useRef(new Animated.Value(resting)).current;
  const at = useRef(resting);
  const [open, setOpen] = useState(false);
  const scrollTop = useRef(0);

  const settle = (toOpen: boolean) => {
    const to = toOpen ? 0 : resting;
    at.current = to;
    setOpen(toOpen);
    Animated.spring(y, { toValue: to, useNativeDriver: true, bounciness: 2 }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Resting: any clear vertical drag moves the sheet. Open: only a
        // pull down from the top of the list, so the list still scrolls.
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) && (at.current !== 0 || (g.dy > 0 && scrollTop.current <= 0)),
        onPanResponderMove: (_, g) => y.setValue(Math.min(resting, Math.max(0, at.current + g.dy))),
        onPanResponderRelease: (_, g) => {
          const moved = at.current + g.dy;
          if (g.vy < -0.4 || moved < resting / 2) settle(true);
          else settle(false);
        },
        onPanResponderTerminate: () => settle(at.current === 0),
      }),
    [resting],
  );

  if (!matches.length) return null;

  return (
    <Animated.View
      style={[s.sheet, { top: insets.top + TOP_GAP, height: full, transform: [{ translateY: y }] }]}
      {...pan.panHandlers}
    >
      <GroundLayer />
      <Pressable onPress={() => settle(!open)} accessibilityRole="button" accessibilityLabel={open ? 'Lower pattern insights' : 'Show all pattern insights'} style={s.head}>
        <View style={s.grabber} />
        <View style={s.titleRow}>
          <Text style={[font('title3', 'semibold'), s.title]} accessibilityRole="header">
            Pattern Insights
          </Text>
          <Text style={[font('footnote'), s.count]}>{`${matches.length} for today`}</Text>
        </View>
      </Pressable>
      <ScrollView
        scrollEnabled={open}
        onScroll={(e) => {
          scrollTop.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[s.list, { paddingBottom: NAV_CLEARANCE + (height - full) }]}
        showsVerticalScrollIndicator={false}
      >
        {matches.map(({ insight, connections }) => (
          <Pressable
            key={insight.id}
            onPress={() => {
              openInsight(insight.id);
              nav.push('insight');
            }}
            accessibilityRole="button"
            accessibilityLabel={`${insight.title}. Opens this pattern`}
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <InsightCard insight={insight} connections={connections} style={s.card} />
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: L.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: G.rule,
  },
  head: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: GUTTER },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: G.rule, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: G.ink, flex: 1 },
  count: { color: G.meta },
  list: { paddingHorizontal: GUTTER, gap: SPACE.grid },
  card: { width: '100%', height: 320 },
  pressed: { opacity: 0.8 },
});
