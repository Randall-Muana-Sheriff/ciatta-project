// One metric, one card, everywhere it appears.
//
// Today showed three metrics as pills and the All screen showed nineteen
// as list rows, so the same figure looked like two different kinds of
// thing depending on which screen she was on. One component now, so a
// metric is a metric.
//
// The rule it carries is the app's: a figure that is not there reads as
// absent rather than as zero. There is no state in here that prints a 0
// or a dash for a missing value, and the absent case is styled quietly
// rather than in the ink a real reading gets.

import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { HUE, L, TILE_RADIUS } from './surface';

export type MetricCardProps = {
  label: string;
  // Null means it was not recorded today. Not zero.
  value: string | null;
  // Shown under the value, and only when there is a value to qualify.
  note?: string;
  // Where it came from. A reading from an instrument and a number she
  // typed are different facts, and the dot is how the card says which
  // without a sentence.
  from: 'measured' | 'reported' | 'derived';
};

const DOT: Record<MetricCardProps['from'], string> = {
  measured: HUE.measured,
  reported: HUE.reported,
  derived: HUE.timeDepth,
};

export function MetricCard({ label, value, note, from }: MetricCardProps) {
  const missing = value == null;
  return (
    <View
      style={[s.card, missing && s.cardMissing]}
      accessible
      accessibilityLabel={`${label}, ${value ?? 'not recorded today'}${note && !missing ? `, ${note}` : ''}`}
    >
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: DOT[from] }, missing && s.dotMissing]} />
        <Text style={[font('caption1'), s.label]} numberOfLines={1}>
          {displayCopy(label)}
        </Text>
      </View>
      <Text style={[font('title3', 'semibold'), missing ? s.absent : s.value]} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? 'Not yet'}
      </Text>
      {/* A note qualifies a figure, so with no figure there is nothing to
          qualify and the line is absent rather than orphaned. */}
      {note && !missing ? (
        <Text style={[font('caption2'), s.note]} numberOfLines={1}>
          {displayCopy(note)}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

export const METRIC_CARD_GAP = 10;

const s = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    gap: 4,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  // An absent reading keeps its edge and loses its fill, so the card is
  // still a card and still legible as the place that figure will appear.
  cardMissing: { backgroundColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotMissing: { backgroundColor: L.rule },
  label: { color: L.meta, flex: 1 },
  value: { color: L.ink },
  absent: { color: L.meta },
  note: { color: L.meta },
});
