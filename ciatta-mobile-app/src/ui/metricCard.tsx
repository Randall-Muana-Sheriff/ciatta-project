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

import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import type { Trend } from '../lib/trend';
import { font } from '../theme';
import { Icon, type IconName } from './icons';
import { Sparkline } from './sparkline';
import { HUE, L, mark } from './surface';

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
  // Which way her recent readings move, drawn as the biomarker tiles
  // drew it: the change with its arrow, and a small line. Absent when
  // there are too few readings to draw one honestly.
  trend?: Trend;
  // The metric's own chart, in its mini size: the same chart the Health
  // dashboard and the metric's screen draw, so it reads the same everywhere.
  // When given, it stands in for the small line.
  chart?: ReactNode;
  // The metric's mark. Given, the card is a glance: the icon in place of
  // the dot, and no chart or line, which belong to All and the metric's
  // own screen.
  icon?: IconName;
  // A colour of its own for the dot and the line, where a screen wants
  // each metric told apart at a glance. Without it the dot says where the
  // figure came from, in the app's meaning colours.
  color?: string;
};

const DOT: Record<MetricCardProps['from'], string> = {
  measured: HUE.measured,
  reported: HUE.reported,
  derived: HUE.timeDepth,
};

export function MetricCard({ label, value, note, from, trend, color, chart, icon }: MetricCardProps) {
  const missing = value == null;
  const spokenTrend = trend?.spoken && !missing ? `, ${trend.spoken}` : '';
  // The width the line actually has, after the change figure has taken
  // what it needs. A fixed width spilled past the edge of any card whose
  // figure ran long, like a step count up 143%.
  const [lineWidth, setLineWidth] = useState(0);
  return (
    <View
      style={[s.card, missing && s.cardMissing]}
      accessible
      accessibilityLabel={`${label}, ${value ?? 'not recorded today'}${note && !missing ? `, ${note}` : ''}${spokenTrend}`}
    >
      <View style={s.head}>
        {icon ? (
          <View style={missing && s.iconMissing}>
            <Icon name={icon} size={18} color={color ?? DOT[from]} weight={1.6} />
          </View>
        ) : (
          <View style={[s.dot, { backgroundColor: color ?? DOT[from] }, missing && s.dotMissing]} />
        )}
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
      {/* The week stays on the card when today has no reading yet, so a
          daily card is never blank where she has history. */}
      {icon ? (
        trend?.change && !missing ? (
          <Text style={[font('caption2', 'semibold'), s.change]} numberOfLines={1}>
            {trend.change}
          </Text>
        ) : null
      ) : chart ? (
        <View>
          {trend?.change && !missing ? (
            <Text style={[font('caption2', 'semibold'), s.change]} numberOfLines={1}>
              {trend.change}
            </Text>
          ) : null}
          <View style={{ marginTop: 4 }}>{chart}</View>
        </View>
      ) : trend && !missing ? (
        <View style={s.trend}>
          {trend.change ? (
            <Text style={[font('caption2', 'semibold'), s.change]} numberOfLines={1}>
              {trend.change}
            </Text>
          ) : (
            <View />
          )}
          <View style={s.line} onLayout={(e) => setLineWidth(Math.floor(e.nativeEvent.layout.width))}>
            {lineWidth > 12 ? (
              <Sparkline
                points={trend.points}
                color={color ?? mark(from === 'reported' ? 'reported' : 'measured')}
                width={Math.min(lineWidth, 48)}
                height={16}
              />
            ) : null}
          </View>
        </View>
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
    // Nothing drawn inside a card leaves it.
    overflow: 'hidden',
  },
  // An absent reading keeps its edge and loses its fill, so the card is
  // still a card and still legible as the place that figure will appear.
  cardMissing: { backgroundColor: 'transparent' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotMissing: { backgroundColor: L.rule },
  iconMissing: { opacity: 0.35 },
  label: { color: L.meta, flex: 1 },
  value: { color: L.ink },
  absent: { color: L.meta },
  note: { color: L.meta },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  // The figure keeps its full width; the line takes what is left.
  change: { color: L.body, flexShrink: 0 },
  line: { flex: 1, minWidth: 0, height: 16, alignItems: 'flex-end' },
});
