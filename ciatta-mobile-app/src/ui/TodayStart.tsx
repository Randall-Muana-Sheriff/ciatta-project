// Today's empty state: the record holds nothing of hers yet, so the screen
// leads with the way in rather than a chart, six blank cards and an insight
// that has nothing to say. One clear first step, connecting Apple Health,
// which fills the most at once; then the two kinds of logging, kept apart:
// the daily symptoms log, and the cycle experience.
//
// Under it, what this space becomes, so the empty screen says what it is
// waiting for rather than only that it is empty.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { images } from './images';
import { L, SPACE, TILE_RADIUS } from './surface';
import { CardFill } from './cardFill';

export function TodayStart({
  onConnect,
  connecting,
  note,
  onLogSymptoms,
  onLogCycle,
}: {
  onConnect: () => void;
  connecting: boolean;
  note: string | null;
  onLogSymptoms: () => void;
  onLogCycle: () => void;
}) {
  return (
    <>
      <View style={s.card}>
        <CardFill />
        <View style={s.badge}>
          <Icon name="sparkle" size={22} color={L.ink} />
        </View>
        <Text style={[font('title3', 'semibold'), s.title]} accessibilityRole="header">
          Start your record
        </Text>
        <Text style={[font('subhead'), s.sub]}>
          Ciatta finds patterns across your cycle, sleep, heart and how you feel.
        </Text>
        <Pressable
          onPress={onConnect}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityState={{ busy: connecting }}
          style={({ pressed }) => [s.primary, (pressed || connecting) && s.pressed]}
        >
          <Icon name="heart" size={16} color={L.canvas} />
          <Text style={[font('subhead', 'semibold'), s.primaryText]}>{connecting ? 'Connecting' : 'Connect Apple Health'}</Text>
        </Pressable>
        {note ? <Text style={[font('footnote'), s.note]}>{displayCopy(note)}</Text> : null}
        <View style={s.or}>
          <Pill icon="plus" label="Log Today's Symptoms" onPress={onLogSymptoms} />
          <Pill icon="drop" label="Log Cycle Experience" onPress={onLogCycle} />
        </View>
      </View>

      <View style={s.preview}>
        <CardFill />
        <Image source={images.youCan} style={s.previewPhoto} resizeMode="cover" accessible={false} accessibilityIgnoresInvertColors />
        <View style={s.fade} />
        <Text style={[font('footnote'), s.previewText]}>
          Your day, your metrics and what Ciatta notices will appear here after your first few days.
        </Text>
      </View>
    </>
  );
}

function Pill({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.pill, pressed && s.pressed]}>
      <Icon name={icon} size={14} color={L.ink} />
      <Text style={[font('footnote', 'semibold'), s.pillText]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: SPACE.near,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.statement,
    marginBottom: 14,
  },
  title: { color: L.ink, textAlign: 'center' },
  sub: { color: L.body, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  primary: {
    marginTop: 20,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: L.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: L.canvas },
  note: { color: L.meta, textAlign: 'center', marginTop: 10 },
  or: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  pill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999, backgroundColor: L.recessed },
  pillText: { color: L.ink },
  pressed: { opacity: 0.6 },
  preview: {
    marginTop: SPACE.tight,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: L.glass,
    minHeight: 180,
    justifyContent: 'flex-end',
  },
  previewPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.5 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12, 14, 17, 0.45)' },
  previewText: { color: 'rgba(255, 255, 255, 0.88)', textAlign: 'center', paddingHorizontal: 24, paddingBottom: 20, lineHeight: 19 },
});
