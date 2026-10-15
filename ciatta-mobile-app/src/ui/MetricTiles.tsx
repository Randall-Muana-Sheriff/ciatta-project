// Her individual metrics as tiles: value, how it sits against her usual,
// and the trend, each opening its own page. The same tiles Today showed,
// read here from the same sources, with the ones a pattern is about first.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { headlineMetrics } from '../lib/allMetrics';
import { chooseMetric } from '../lib/metricHandoff';
import type { BaselineRow, MetricKey } from '../lib/metricDetail';
import { bloodOxygen, bloodPressure, type VitalCard } from '../lib/vitals';
import { useNav } from '../navigation';
import { useData, useRepo } from '../state/session';
import { chip } from './chip';
import { MetricCard, METRIC_CARD_GAP } from './metricCard';
import { METRIC_HUE } from './metricHue';
import { METRIC_ICON } from './metricIcon';

// A reading's key in the agent's words, as a tile's key.
const TILE_FOR: Record<string, string> = { sleep_hours: 'sleep', resting_hr: 'rhr', hrv: 'hrv', steps: 'steps' };

export function MetricTiles({ first = [] }: { first?: readonly string[] }) {
  const nav = useNav();
  const repo = useRepo();
  const { days } = useData();
  const [vitals, setVitals] = useState<VitalCard[]>([]);
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  useEffect(() => {
    let ignore = false;
    Promise.all([repo.loadVitals(), repo.loadBaselines().catch(() => [] as BaselineRow[])])
      .then(([rows, usual]) => {
        if (ignore) return;
        const now = new Date();
        const median = (metric: string) => {
          const b = usual.find((x) => x.metric === metric);
          return b?.sufficient ? b.median : null;
        };
        setBaselines(usual);
        setVitals([bloodPressure(rows, now, median('blood_pressure_systolic')), bloodOxygen(rows, now, median('oxygen_saturation'))]);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const tiles = useMemo(() => {
    const all = headlineMetrics(days, vitals, new Date(), baselines);
    const lead = first.map((k) => TILE_FOR[k] ?? k);
    return [...all.filter((m) => lead.includes(m.key)), ...all.filter((m) => !lead.includes(m.key))];
  }, [days, vitals, baselines, first]);

  return (
    <View style={t.grid}>
      {tiles.map((m) => (
        <Pressable
          key={m.key}
          style={({ pressed }) => [chip.tile, t.cell, pressed && t.pressed]}
          onPress={() => {
            chooseMetric(m.key as MetricKey);
            nav.push('metric');
          }}
          accessibilityRole="button"
          accessibilityLabel={`${m.label}, ${m.value ?? 'not recorded today'}${m.note && m.value ? `, ${m.note}` : ''}`}
          accessibilityHint="Opens this metric over time"
        >
          <MetricCard label={m.label} value={m.value} note={m.note} from={m.from} trend={m.trend} color={METRIC_HUE[m.key]} icon={METRIC_ICON[m.key]} />
        </Pressable>
      ))}
    </View>
  );
}

const t = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: METRIC_CARD_GAP },
  cell: { width: '30%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 8 },
  pressed: { opacity: 0.55 },
});
