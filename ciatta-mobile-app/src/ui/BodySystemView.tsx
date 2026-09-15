import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { profile } from '../data/sample';
import {
  type BodyPoint,
  type BodyReading,
  readSystems,
  REGION_BY_ID,
  REGION_LOCATION,
  REGIONS,
  type RegionId,
  stateWords,
} from '../lib/bodyMap';
import { displayCopy } from '../lib/displayCopy';
import { C, font, GUTTER, M, RADIUS } from '../theme';
import { Panel } from './chrome';
import { Icon } from './icons';
import { images } from './images';
import { LinkButton, SecondaryButton, Tag } from './kit';

// The body view, following the Ciatta design system: the body systems from
// Profile on the left, a neutral silhouette on the right. Choosing a system
// lights only its places; everything else stays quiet. One point size, colour
// as light, and one relationship line with its sentence.

const IMAGE_RATIO = 850 / 1850;
const MAX_HEIGHT = 470;
const COLUMN = 148;
const GAP = 8;
const EASE_BODY = Easing.bezier(0.4, 0, 0.2, 1);

const SOURCE_TONE = { Measured: 'measured', 'You reported': 'logged', Lab: 'lab', Pattern: 'orange' } as const;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// A filled dot for something current, a ring for something earlier, and a
// Mist ring when nothing is recorded.
function StatusDot({ point }: { point: BodyPoint | null }) {
  if (!point) return <View style={[b.dot, b.ring, { borderColor: M.unlit }]} />;
  if (point.state === 'historical') return <View style={[b.dot, b.ring, { borderColor: M.historical }]} />;
  return <View style={[b.dot, { backgroundColor: M[point.meaning] }]} />;
}

export function BodySystemView({
  reading,
  onOpen,
  onLog,
}: {
  reading: BodyReading;
  onOpen: (point: BodyPoint) => void;
  onLog: (region: RegionId) => void;
}) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const HEIGHT = Math.min(MAX_HEIGHT, (width - GUTTER * 2 - COLUMN - GAP) / IMAGE_RATIO);
  const WIDTH = HEIGHT * IMAGE_RATIO;
  const place = (id: RegionId) => {
    const r = REGION_BY_ID[id];
    return r.x == null || r.y == null ? null : { x: (r.x / 100) * WIDTH, y: (r.y / 100) * HEIGHT };
  };

  const icons = new Map(profile.bodySystems.map((s) => [s.label, s.icon]));
  const systems = useMemo(() => readSystems(reading, profile.bodySystems.map((s) => s.label)), [reading]);
  const [selected, setSelected] = useState<string>(
    () =>
      systems.find((s) => reading.lead && s.regions.includes(reading.lead))?.label ??
      systems.find((s) => s.lead?.state === 'lit')?.label ??
      systems[0].label,
  );
  const system = systems.find((s) => s.label === selected) ?? systems[0];
  const active = new Set(system.points);
  const activeRegions = new Set(system.regions);
  const systemFor = (id: RegionId) => systems.find((s) => s.regions.includes(id))?.label;

  const breath = useRef(new Animated.Value(0)).current;
  // The only continuous motion in the product: about one percent over five
  // and a half seconds, with a hold at the top. Reduce Motion holds still.
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

  const byRegion = new Map(reading.points.map((p) => [p.region, p]));
  const wholeBody = system.points.find((p) => p.region === 'systemic' && p.state === 'lit');
  const showThread = !!reading.thread && activeRegions.has(reading.thread.from);
  const from = showThread ? place(reading.thread!.from) : null;
  const to = showThread ? place(reading.thread!.to) : null;
  // A place in this system with nothing logged yet, so she can add to it.
  const loggable = system.regions.find((r) => REGION_LOCATION[r] && !byRegion.has(r));

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
                <Icon name={icons.get(s.label) ?? 'body'} size={18} color={on ? C.text : C.secondary} weight={1.8} />
                <Text
                  style={[font('footnote', on ? 'medium' : 'regular'), { color: on ? C.text : C.secondary, flex: 1 }]}
                  numberOfLines={2}
                >
                  {displayCopy(s.short)}
                </Text>
                <StatusDot point={s.lead} />
              </Pressable>
            );
          })}
        </View>

        <Animated.View style={{ width: WIDTH, height: HEIGHT, transform: [{ scale }] }}>
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

          <Svg style={StyleSheet.absoluteFill} width={WIDTH} height={HEIGHT} pointerEvents="none">
            {/* Places with nothing logged: a Mist ring, brighter when it belongs to the chosen system. */}
            {REGIONS.map((r) => {
              const pos = place(r.id);
              if (!pos || byRegion.has(r.id)) return null;
              const mine = activeRegions.has(r.id);
              return (
                <Circle key={r.id} cx={pos.x} cy={pos.y} r={mine ? 5 : 4} fill="none" stroke={mine ? C.secondary : M.unlit} strokeWidth={mine ? 1.5 : 1.2} />
              );
            })}

            {/* The relationship, drawn at right angles, only with its system. */}
            {from && to ? (
              <Path d={`M${from.x + 7},${from.y} H${WIDTH * 0.84} V${to.y} H${to.x + 7}`} stroke={M.change} strokeWidth={1} fill="none" opacity={0.9} />
            ) : null}

            {reading.points.map((p) => {
              const pos = place(p.region);
              if (!pos || !p.halo || !active.has(p)) return null;
              return (
                <Circle key={`h-${p.region}`} cx={pos.x} cy={pos.y} r={26} fill={M[p.meaning]} opacity={0.07} />
              );
            })}
            {reading.points.map((p) => {
              const pos = place(p.region);
              if (!pos || !p.halo || !active.has(p)) return null;
              return <Circle key={`i-${p.region}`} cx={pos.x} cy={pos.y} r={15} fill={M[p.meaning]} opacity={0.18} />;
            })}
            {reading.points.map((p) => {
              const pos = place(p.region);
              if (!pos) return null;
              const opacity = active.has(p) ? 1 : 0.3;
              return p.state === 'lit' ? (
                <Circle key={`p-${p.region}`} cx={pos.x} cy={pos.y} r={5} fill={M[p.meaning]} opacity={opacity} />
              ) : (
                <Circle key={`p-${p.region}`} cx={pos.x} cy={pos.y} r={5} fill={C.bg} stroke={M.historical} strokeWidth={1.5} opacity={opacity} />
              );
            })}
          </Svg>

          {/* 44 point targets; a place selects the system it belongs to. */}
          {REGIONS.map((r) => {
            const pos = place(r.id);
            const owner = systemFor(r.id);
            if (!pos || !owner) return null;
            const p = byRegion.get(r.id);
            return (
              <Pressable
                key={`t-${r.id}`}
                onPress={() => setSelected(owner)}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}. ${stateWords(p)}${p ? `. ${p.title}` : ''}`}
                style={[b.target, { left: pos.x - 22, top: pos.y - 22 }]}
              />
            );
          })}
        </Animated.View>
      </View>

      <Panel style={b.detail}>
        <Text style={[font('footnote', 'semibold'), { color: system.lead ? M[system.lead.meaning] : C.secondary }]}>
          {stateWords(system.lead ?? undefined)}
        </Text>
        <Text style={[font('title3', 'semibold'), { color: C.text, marginTop: 2 }]}>{displayCopy(system.label)}</Text>
        {system.points.length ? (
          system.points.map((p, n) => (
            <View key={`${p.region}-${p.title}`} style={[b.item, n > 0 && b.itemSep]}>
              <Text style={[font('headline'), { color: C.text }]}>{p.title}</Text>
              <Text style={[font('footnote'), { color: C.secondary }]}>
                {p.region === 'systemic' ? 'Whole body' : REGION_BY_ID[p.region].label}
              </Text>
              <Text style={[font('body'), { color: C.text, marginTop: 4, lineHeight: 24 }]}>{p.detail}</Text>
              <View style={b.tagRow}>
                <Tag label={p.source} tone={SOURCE_TONE[p.source]} />
              </View>
              {p.insightId || p.screen ? (
                <LinkButton label={p.insightId ? 'See the Evidence' : 'Open Details'} onPress={() => onOpen(p)} />
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[font('body'), { color: C.secondary, marginTop: 6 }]}>Nothing recorded for this system yet.</Text>
        )}
        {loggable ? (
          <View style={{ marginTop: 12 }}>
            <SecondaryButton label="Log Something Here" onPress={() => onLog(loggable)} />
          </View>
        ) : null}
      </Panel>

      {showThread ? (
        <Panel style={b.detail}>
          <View style={b.threadHead}>
            <View style={b.threadLine} />
            <Text style={[font('footnote', 'semibold'), { color: M.change }]}>
              Related · {REGION_BY_ID[reading.thread!.from].label} and sleep
            </Text>
          </View>
          <Text style={[font('body'), { color: C.text, marginTop: 6, lineHeight: 24 }]}>{reading.thread!.sentence}</Text>
        </Panel>
      ) : null}

      <View style={b.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={b.legendItem}>
          <View style={[b.dot, { backgroundColor: C.text }]} />
          <Text style={[font('caption1'), { color: C.secondary }]}>Current</Text>
        </View>
        <View style={b.legendItem}>
          <View style={[b.dot, b.ring, { borderColor: M.historical }]} />
          <Text style={[font('caption1'), { color: C.secondary }]}>Earlier</Text>
        </View>
        <View style={b.legendItem}>
          <View style={[b.dot, b.ring, { borderColor: M.unlit }]} />
          <Text style={[font('caption1'), { color: C.secondary }]}>Nothing recorded</Text>
        </View>
        <View style={b.legendItem}>
          <View style={[b.legendLine, { backgroundColor: M.change }]} />
          <Text style={[font('caption1'), { color: C.secondary }]}>Related</Text>
        </View>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  split: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8, borderRadius: RADIUS },
  rowOn: { backgroundColor: C.card },

  silhouette: { ...StyleSheet.absoluteFill, opacity: 0.24 },
  target: { position: 'absolute', width: 44, height: 44 },

  dot: { width: 9, height: 9, borderRadius: 4.5 },
  ring: { backgroundColor: 'transparent', borderWidth: 1.5 },

  detail: { marginTop: 16 },
  item: { paddingVertical: 10 },
  itemSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  tagRow: { flexDirection: 'row', marginTop: 10 },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  threadLine: { width: 18, height: 1, backgroundColor: M.change },

  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 16, height: 1 },
});
