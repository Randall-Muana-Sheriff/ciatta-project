// Pattern Insights on Today, as Lotus sets them: resting over the lower
// part of the screen with the first pattern showing, and opening into the
// same sheet the rest of the app uses (ui/Sheet, iOS's own page sheet,
// as Gender in Profile opens): rounded top corners, no outline, the screen
// behind stepping back, and a swipe down to close.
//
// The resting part is drawn to match that sheet: the same corners and no
// edge line, so the two read as one object at two heights. Tap it or swipe
// it up to open. Tapping a pattern closes the sheet and opens its page.

import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { openInsight } from '../lib/careHandoff';
import type { InsightMatch } from '../lib/insights';
import { useNav } from '../navigation';
import { useInsightReactions } from '../state/insightReactions';
import { useResearchInsights } from '../state/researchInsights';
import { font, GUTTER } from '../theme';
import { GroundLayer } from './Ground';
import { InsightCard } from './InsightCards';
import { G } from './scheme';
import { Sheet } from './Sheet';
import { BLEED, L, SPACE } from './surface';

// How much of the screen the resting sheet takes.
const REST = 0.44;
// The corner iOS gives a page sheet on these phones.
const SHEET_CORNER = 12;

export function InsightsSheet() {
  const nav = useNav();
  const { height } = useWindowDimensions();
  const { reactions } = useInsightReactions();
  const { matches } = useResearchInsights(reactions);
  const [open, setOpen] = useState(false);
  const opening = useRef(false);

  // A clear swipe up on the resting sheet opens it.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (!opening.current && g.dy < -24) {
            opening.current = true;
            setOpen(true);
          }
        },
        onPanResponderRelease: () => {
          opening.current = false;
        },
        onPanResponderTerminate: () => {
          opening.current = false;
        },
      }),
    [],
  );

  if (!matches.length) return null;

  const openPattern = (id: string) => {
    setOpen(false);
    openInsight(id);
    nav.push('insight');
  };

  return (
    <>
      <View style={[s.rest, { height: Math.round(height * REST) }]} {...pan.panHandlers}>
        <GroundLayer />
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Show all pattern insights" style={s.head}>
          <View style={s.grabber} />
          <View style={s.titleRow}>
            <Text style={[font('title3', 'semibold'), s.title]} accessibilityRole="header">
              Pattern Insights
            </Text>
            <Text style={[font('footnote'), s.count]}>{`${matches.length} for today`}</Text>
          </View>
        </Pressable>
        <View style={s.peek}>
          <Card match={matches[0]} onOpen={openPattern} />
        </View>
      </View>

      <Sheet visible={open} title="Pattern Insights" sub={`${matches.length} for today`} onDone={() => setOpen(false)}>
        <View style={s.list}>
          {matches.map((m) => (
            <Card key={m.insight.id} match={m} onOpen={openPattern} />
          ))}
        </View>
      </Sheet>
    </>
  );
}

function Card({ match, onOpen }: { match: InsightMatch; onOpen: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onOpen(match.insight.id)}
      accessibilityRole="button"
      accessibilityLabel={`${match.insight.title}. Opens this pattern`}
      style={({ pressed }) => [pressed && s.pressed]}
    >
      <InsightCard insight={match.insight} connections={match.connections} style={s.card} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // The resting sheet: full width, the page sheet's corners, no edge line,
  // on the same ground.
  rest: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: SHEET_CORNER,
    borderTopRightRadius: SHEET_CORNER,
    overflow: 'hidden',
    backgroundColor: L.canvas,
  },
  head: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: GUTTER },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: G.rule, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: G.ink, flex: 1 },
  count: { color: G.meta },
  peek: { paddingHorizontal: GUTTER },
  list: { gap: SPACE.grid, paddingTop: SPACE.tight },
  // Edge to edge, as every full width card is.
  card: { height: 320, ...BLEED },
  pressed: { opacity: 0.8 },
});
