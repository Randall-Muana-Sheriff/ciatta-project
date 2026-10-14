import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { bodySystems } from '../data/adapter';
import {
  type BodyReading,
  readSystems,
  stateWords,
  SYSTEM_DOTS,
  WHOLE_BODY,
} from '../lib/bodyMap';
import { displayCopy } from '../lib/displayCopy';
import { C, font, GUTTER, M, RADIUS } from '../theme';
import { Icon } from './icons';
import { images } from './images';
import { systemInsight } from '../lib/systemInsight';
import { systemReview } from '../lib/systemReview';
import type { AgentContext } from '../lib/agent/proactive';
import { SystemCard } from './SystemCard';

// The body view: the body systems from Profile on the left, a neutral
// silhouette on the right, and what is recorded for the chosen system in
// the card beneath.
//
// The figure used to carry a dot per place and a line drawn from one place
// to sleep, with a "Related" card under it. The line asserted a connection
// the reading could not stand behind as drawn, and the dots made the
// figure look like a map of findings when most of them were empty rings.
// Both are gone: the figure is the body, which she can turn, and what is known about it is
// said in words, in the card.

const IMAGE_RATIO = 850 / 1850;
const MAX_HEIGHT = 470;
const COLUMN = 148;
const GAP = 8;
const EASE_BODY = Easing.bezier(0.4, 0, 0.2, 1);

// The four views a turn settles on, by quarter.
const VIEWS = ['Front', 'Side', 'Back', 'Side'] as const;


function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function BodySystemView({
  reading,
  signals,
  context,
  conditions,
  situations,
  onExplore,
}: {
  reading: BodyReading;
  signals: Parameters<typeof systemInsight>[0]['signals'];
  context: AgentContext;
  conditions: readonly string[];
  situations: readonly string[];
  onExplore: (system: string, topic?: string) => void;
}) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const HEIGHT = Math.min(MAX_HEIGHT, (width - GUTTER * 2 - COLUMN - GAP) / IMAGE_RATIO);
  const WIDTH = HEIGHT * IMAGE_RATIO;

  // The list of systems is structure; what lights each one comes only from
  // the reading, so a system with nothing logged shows as nothing recorded.
  const icons = new Map(bodySystems.map((s) => [s.label, s.icon]));
  const systems = useMemo(() => readSystems(reading, bodySystems.map((s) => s.label)), [reading]);
  const [selected, setSelected] = useState<string>(
    () =>
      systems.find((s) => reading.lead && s.regions.includes(reading.lead))?.label ??
      systems.find((s) => s.lead?.state === 'lit')?.label ??
      systems[0].label,
  );
  const system = systems.find((s) => s.label === selected) ?? systems[0];
  const insight = useMemo(
    () => systemInsight({ regions: system.regions, whole: system.label === WHOLE_BODY, points: system.points, signals, now: new Date() }),
    [system, signals],
  );
  const review = useMemo(
    () => systemReview(system.label, { context, points: system.points, conditions, situations, insight, now: new Date() }),
    [system, context, conditions, situations, insight],
  );

  const breath = useRef(new Animated.Value(0)).current;
  // A breath under the turn: about one percent over five and a half
  // seconds, with a hold at the top. Reduce Motion holds still.
  useEffect(() => {
    if (reduce) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2300, easing: EASE_BODY, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(breath, { toValue: 0, duration: 2300, easing: EASE_BODY, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, breath]);
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] });

  // She turns the figure herself. A drag left or right turns it with her
  // finger, and on release it settles on the nearest quarter: front, side,
  // back, side. It never turns on its own, so what she sees is always the
  // view she chose. It is one flat image, so the back is the front
  // mirrored; at the figure's low opacity that reads as a silhouette seen
  // from behind.
  const angle = useRef(new Animated.Value(0)).current;
  const settled = useRef(0);
  const [quarter, setQuarter] = useState(0);
  const settle = (to: number) => {
    settled.current = to;
    setQuarter((((to / 90) % 4) + 4) % 4);
    if (reduce) angle.setValue(to);
    else Animated.spring(angle, { toValue: to, useNativeDriver: true, speed: 14, bounciness: 2 }).start();
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only a sideways drag is hers to turn with; a vertical one still
        // scrolls the screen.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => angle.setValue(settled.current + g.dx * 0.6),
        onPanResponderRelease: (_, g) => settle(Math.round((settled.current + g.dx * 0.6) / 90) * 90),
        onPanResponderTerminate: () => settle(settled.current),
      }),
    // settle reads only refs and stable setters, so these are its inputs.
    [angle, reduce],
  );
  const rotateY = angle.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });

  const wholeBody = system.points.find((p) => p.region === 'systemic' && p.state === 'lit');

  return (
    <View>
      <View style={b.split}>
        <View style={{ width: COLUMN }} accessibilityRole="list">
          {systems.map((s) => {
            const on = s.label === system.label;
            return (
              <Pressable
                key={s.label}
                onPress={() => setSelected(s.label)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${displayCopy(s.label)}. ${stateWords(s.lead ?? undefined)}${s.lead ? `. ${s.lead.title}` : ''}`}
                style={[b.row, on && b.rowOn]}
              >
                {/* The icon carries the system's colour, the same as its dot
                    on the figure; the name stays white. */}
                <Icon name={icons.get(s.label) ?? 'body'} size={18} color={SYSTEM_DOTS[s.label]?.color ?? C.text} weight={1.8} />
                <Text
                  style={[font('footnote', on ? 'medium' : 'regular'), { color: C.text, flex: 1 }]}
                  numberOfLines={2}
                >
                  {displayCopy(s.short)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{ width: WIDTH }}
          accessible
          accessibilityLabel={`Body figure, ${VIEWS[quarter]} view`}
          accessibilityHint="Swipe up or down to turn it"
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => settle(settled.current + (e.nativeEvent.actionName === 'increment' ? 90 : -90))}
          {...pan.panHandlers}
        >
          <Animated.View style={{ width: WIDTH, height: HEIGHT, transform: [{ perspective: 1200 }, { rotateY }, { scale }] }}>
            {wholeBody ? (
              <Svg style={StyleSheet.absoluteFill} width={WIDTH} height={HEIGHT}>
                <Defs>
                  <RadialGradient id="systemic" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0.45" stopColor={M[wholeBody.meaning]} stopOpacity={0.1} />
                    <Stop offset="1" stopColor={M[wholeBody.meaning]} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={WIDTH / 2} cy={HEIGHT / 2} rx={WIDTH / 2} ry={HEIGHT / 2} fill="url(#systemic)" />
              </Svg>
            ) : null}

            <Image
              source={images.body}
              style={[b.silhouette, { width: WIDTH, height: HEIGHT }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible={false}
            />

            {/* A system shows its own dot, where it sits, in its colour.
                Whole Body shows every system's dot, and tapping one there
                chooses that system. Only on the front: the back is the
                front mirrored, so a dot there would mark the wrong side. */}
            {quarter === 0
              ? systems
                  .filter((s) => system.label === WHOLE_BODY || s.label === system.label)
                  .map((s) => {
                  const dot = SYSTEM_DOTS[s.label];
                  if (!dot) return null;
                  const on = s.label === system.label;
                  const size = on ? 9 : 6;
                  return (
                    <Pressable
                      key={s.label}
                      onPress={() => setSelected(s.label)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${displayCopy(s.label)} on the figure`}
                      style={[
                        b.dot,
                        {
                          left: (dot.x / 100) * WIDTH - size / 2,
                          top: (dot.y / 100) * HEIGHT - size / 2,
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: dot.color,
                        },
                        on && { shadowColor: dot.color },
                        on && b.dotOn,
                      ]}
                    />
                  );
                })
              : null}
          </Animated.View>
          {/* Which way she is looking, and that it turns. */}
          <Text style={[font('caption1'), b.viewLabel]}>{VIEWS[quarter]} · drag to turn</Text>
        </View>
      </View>

      {/* The system, as one card: highlights from her whole record, the
          sources folded in, and Explore, which hands it to Care. */}
      <SystemCard
        label={system.label}
        icon={icons.get(system.label) ?? 'body'}
        color={SYSTEM_DOTS[system.label]?.color ?? C.text}
        highlights={review.highlights}
        explore={review.explore[0] ?? null}
        conditions={conditions}
        sources={review.sources}
        onExplore={(topic) => onExplore(system.label, topic)}
      />
    </View>
  );
}

const b = StyleSheet.create({
  split: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8, borderRadius: RADIUS },
  rowOn: { backgroundColor: C.card },

  silhouette: { ...StyleSheet.absoluteFill, opacity: 0.24 },
  dot: { position: 'absolute' },
  dotOn: { shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  viewLabel: { color: C.secondary, textAlign: 'center', marginTop: 8 },

  detail: { marginTop: 16 },
  item: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  insight: { color: C.text, lineHeight: 24, marginTop: 6, marginBottom: 6 },
  itemSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
});
