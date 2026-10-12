// One metric, as a card on Today's grid.
//
// The All screen is a list rather than a grid, deliberately. Today is a
// glance at six figures and abbreviates to fit three across; All is a
// reference list with a whole line per metric, where every name is
// spelled out. Two shapes because they answer two questions, not because
// nobody chose.
//
// The rule it carries is the app's: a figure that is not there reads as
// absent rather than as zero. There is no state in here that prints a 0
// or a dash for a missing value, and the absent case is styled quietly
// rather than in the ink a real reading gets.

import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { HUE, L } from './surface';

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
      <Text style={[font('headline'), missing ? s.absent : s.value]} numberOfLines={1} adjustsFontSizeToFit>
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
  // The proportions of the three across row this replaced: compact
  // enough that three sit in a row without the value shrinking to fit.
  card: {
    flex: 1,
    minHeight: 74,
    justifyContent: 'center',
    gap: 3,
    backgroundColor: L.recessed,
    borderRadius: 14,
    borderWidth: st,
    borderColor: L.rule,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  // An absent reading keeps its edge and loses its fill, so the card is
  // still a card and still legible as the place that figure will appear.
  cardMissing: { backgroundColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotMissing: { backgroundColor: L.rule },
  label: { color: L.meta, flex: 1 },
  value: { color: L.ink },
  absent: { color: L.meta },
  note: { color: L.meta },
});
