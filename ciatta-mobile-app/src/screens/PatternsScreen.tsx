// Today's patterns, opened from its card on Today.
//
// Two views of the same day under one toggle. Today is the card in full:
// the summary without its three line limit, the chart taller, every
// reading today with her usual beside it, and where she is in her cycle.
// Journey is the timeline from the Journey screen, unchanged, opening on
// the day. The choice is kept for the session, so coming back opens the
// view she left.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IntradayPoint } from '../data/repo';
import { DAY_READ, dayPatterns, readingRows } from '../lib/dayPatterns';
import { displayCopy } from '../lib/displayCopy';
import { chooseLogCategory } from '../lib/logHandoff';
import { type BaselineRow, usualFor } from '../lib/metricDetail';
import { useNav } from '../navigation';
import { useCyclePosition } from '../state/cyclePosition';
import { PATTERN_VIEWS, usePatternView } from '../state/patternsView';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { CardFill } from '../ui/cardFill';
import { DayPair } from '../ui/DayPair';
import { DetailScreen, SectionHeading, SegmentedControl } from '../ui/kit';
import { G } from '../ui/scheme';
import { ground, HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';
import { JourneyScreen } from './JourneyScreen';


export function PatternsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [view, choose] = usePatternView();

  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let ignore = false;
    repo
      .loadIntraday(midnight.toISOString(), DAY_READ)
      .then((rows) => !ignore && setIntraday(rows))
      .catch(() => {});
    repo
      .loadBaselines()
      .then((rows) => !ignore && setBaselines(rows))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const dayView = useMemo(() => dayPatterns(intraday, new Date()), [intraday]);
  // Usual only where a baseline means the same thing as the reading. Her
  // resting heart rate is not a usual for heart rate across the day.
  const usual = useMemo(
    () => ({
      hrv: usualFor('hrv', baselines)?.median,
      oxygen_saturation: usualFor('spo2', baselines)?.median,
    }),
    [baselines],
  );
  const rows = useMemo(() => readingRows(dayView, usual), [dayView, usual]);
  const { cycleNow, phaseText } = useCyclePosition();
  const now = new Date();

  return (
    <DetailScreen title="Today's patterns" onBack={nav.back}>
      <View style={p.pad}>
        <Text style={[font('subhead'), p.date]}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <SegmentedControl segments={PATTERN_VIEWS} active={view} onChange={choose} />
      </View>

      {view === 'Today' ? (
        <View style={p.pad}>
          <View style={p.card}>
            <CardFill />
            {dayView.series.length ? (
              <DayPair view={dayView} usual={{ hrv: usual.hrv, oxygen_saturation: usual.oxygen_saturation }} full />
            ) : (
              <Text style={[font('subhead'), p.empty]}>
                Your day appears here as your watch or ring sends heart rate, HRV and steps.
              </Text>
            )}
          </View>

          <Pressable
            disabled={!!cycleNow}
            onPress={() => {
              chooseLogCategory('cycle');
              nav.push('ciatta');
            }}
            accessibilityRole={cycleNow ? undefined : 'button'}
            style={({ pressed }) => [p.card, p.cycleRow, pressed && !cycleNow ? p.pressed : null]}
          >
            <CardFill />
            <View>
              <Text style={[font('caption1'), p.key]}>CYCLE</Text>
              <Text style={[font('headline'), { color: cycleNow ? L.ink : L.meta }]}>
                {cycleNow ? `Day ${cycleNow.day}` : 'No logged cycle'}
              </Text>
            </View>
            {phaseText ? (
              <Text style={[font('footnote', 'semibold'), p.phase]}>{displayCopy(phaseText)}</Text>
            ) : !cycleNow ? (
              <Text style={[font('footnote', 'semibold'), p.phase]}>Log a period</Text>
            ) : null}
          </Pressable>

          {rows.length ? (
            <>
              <View style={p.heading}>
                <SectionHeading title="Every reading today" />
              </View>
              <View style={p.card}>
                <CardFill />
                {rows.map((r, n) => (
                  <View key={r.key} style={[p.reading, n > 0 && p.divided]}>
                    <Text style={[font('subhead', 'semibold'), { color: L.ink, flex: 1 }]}>{r.label}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[font('subhead'), { color: L.ink }]}>{displayCopy(r.range)}</Text>
                      {r.usual ? <Text style={[font('caption1'), { color: L.meta }]}>{displayCopy(r.usual)}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <JourneyScreen embedded />
      )}
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;

const p = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER, gap: SPACE.near, marginBottom: SPACE.near },
  date: { color: G.meta },
  card: {
    backgroundColor: L.glass,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden', borderRadius: TILE_RADIUS },
  empty: { color: L.body, lineHeight: 21, paddingVertical: 10 },
  cycleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  key: { color: L.meta, letterSpacing: 0.9 },
  phase: {
    color: HUE.reported,
    backgroundColor: ground('reported'),
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  heading: { marginTop: SPACE.tight },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  pressed: { opacity: 0.55 },
});
