// One body system, one card: its name with Explore in the corner, the
// topics it covers, the highlights from her record, the sources folded
// into one line, and the prompt Explore sends to Care. Nothing to page
// through: the evidence is a tap away inside the card, and the work is
// one tap away in Care.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { topicsFor } from '../lib/systemReview';
import { C, font, RADIUS } from '../theme';
import { Icon, type IconName } from './icons';
import { onGround } from './scheme';
import { L } from './surface';
import { GlassFill } from './frosted';

export function SystemCard({
  label,
  icon,
  color,
  highlights,
  explore,
  conditions,
  sources,
  onExplore,
}: {
  label: string;
  icon: IconName;
  color: string;
  highlights: string[];
  // The first thing worth exploring, when her record shows one.
  explore: string | null;
  conditions: readonly string[];
  // Where the highlights come from, by kind, for the Sources line.
  sources: { kind: string; label: string }[];
  onExplore: (topic?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const topics = topicsFor(label, conditions);
  const kinds = [...new Set(sources.map((s) => s.kind))];
  return (
    <View style={c.card}>
      <GlassFill />
      <View style={c.head}>
        <Icon name={icon} size={20} color={color} weight={1.8} />
        <Text style={[font('title3', 'semibold'), c.title]} accessibilityRole="header">
          {displayCopy(label)}
        </Text>
        <Pressable
          onPress={() => onExplore()}
          accessibilityRole="button"
          accessibilityLabel={`Explore ${label} with Ciatta`}
          hitSlop={8}
          style={({ pressed }) => [c.explore, pressed && c.pressed]}
        >
          <GlassFill />
          <Icon name="sparkle" size={14} color={C.text} />
          <Text style={[font('footnote', 'semibold'), { color: C.text }]}>Explore</Text>
        </Pressable>
      </View>

      {topics.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={c.topics}>
          {topics.map((t) => (
            <Pressable
              key={t}
              onPress={() => onExplore(t)}
              accessibilityRole="button"
              accessibilityLabel={`Explore ${t} with Ciatta`}
              style={({ pressed }) => [c.topic, pressed && c.pressed]}
            >
              <Text style={[font('footnote'), { color: C.text }]}>{displayCopy(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {highlights.length ? (
        <>
          <Text style={[font('headline'), c.highlightsTitle]}>Highlights</Text>
          {highlights.map((h) => (
            <View key={h} style={c.bullet}>
              <View style={[c.dot, { backgroundColor: color }]} />
              <Text style={[font('body'), c.bulletText]}>{displayCopy(h)}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={[font('body'), c.empty]}>Nothing recorded for this system yet.</Text>
      )}

      {explore ? (
        <View style={c.worth}>
          <GlassFill />
          <Text style={[font('footnote', 'semibold'), { color: C.text }]}>Worth exploring</Text>
          <Text style={[font('subhead'), c.worthText]}>{displayCopy(explore)}</Text>
        </View>
      ) : null}

      {sources.length ? (
        <>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => [c.sources, pressed && c.pressed]}
          >
            {kinds.map((k) => (
              <View key={k} style={[c.sourceDot, { backgroundColor: SOURCE_COLOR[k] ?? C.secondary }]} />
            ))}
            <Text style={[font('footnote', 'semibold'), { color: C.text }]}>{`${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`}</Text>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} color={C.secondary} />
          </Pressable>
          {open
            ? sources.map((s) => (
                <Text key={`${s.kind}${s.label}`} style={[font('footnote'), c.sourceLine]}>
                  {displayCopy(`${s.kind}: ${s.label}`)}
                </Text>
              ))
            : null}
        </>
      ) : null}

      {/* What Explore asks, said as a line she can tap. */}
      <Pressable onPress={() => onExplore()} accessibilityRole="button" style={({ pressed }) => [c.ask, pressed && c.pressed]}>
        <Text style={[font('subhead'), c.arrow]}>{'↳'}</Text>
        <Text style={[font('subhead', 'semibold'), c.askText]}>
          {displayCopy(`See the bigger picture, and what is worth exploring`)}
        </Text>
      </Pressable>
    </View>
  );
}

const SOURCE_COLOR: Record<string, string> = {
  Measured: onGround('#789AF3'),
  'You logged': onGround('#F46EB4'),
  Lab: onGround('#F2B863'),
  Provider: onGround('#B188F3'),
};

const c = StyleSheet.create({
  card: { marginTop: 16, backgroundColor: L.glass, borderRadius: RADIUS, padding: 16, gap: 10, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: C.text, flex: 1 },
  explore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: L.glass,
    overflow: 'hidden',
  },
  topics: { gap: 8 },
  topic: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderSub },
  highlightsTitle: { color: C.text, marginTop: 4 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 9 },
  bulletText: { color: C.text, flex: 1, lineHeight: 24 },
  empty: { color: C.secondary },
  sources: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderSub,
  },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  sourceLine: { color: C.secondary, lineHeight: 19 },
  worth: { gap: 4, padding: 12, borderRadius: 12, backgroundColor: L.glass, overflow: 'hidden' },
  worthText: { color: C.text, lineHeight: 21 },
  ask: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 4 },
  arrow: { color: C.secondary },
  askText: { color: C.text, flex: 1, lineHeight: 21 },
  pressed: { opacity: 0.6 },
});
