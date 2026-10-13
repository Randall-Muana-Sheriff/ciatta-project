// One metric, opened from its card: the latest reading against her usual
// range, the chosen range drawn day by day (or week by week), the figures
// for that range, and what belongs beside this metric. Every figure comes
// from her own record; see lib/metricDetail.ts for the rules.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import {
  type BaselineRow,
  bucketize,
  dayKeys,
  extras,
  headline,
  METRIC_TITLE,
  type MetricKey,
  type Range,
  RANGES,
  type Row,
  seriesFor,
  summary,
  usualFor,
  type VitalDay,
} from '../lib/metricDetail';
import { chosenMetric } from '../lib/metricHandoff';
import { useNav } from '../navigation';
import { useData, useRepo } from '../state/session';
import { font, numeral } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, SegmentedControl, SourceFooter } from '../ui/kit';
import { MetricChart } from '../ui/MetricChart';
import { METRIC_HUE } from '../ui/metricHue';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

const LABELS = RANGES.map((r) => r.label);
const NEEDS_VITALS: MetricKey[] = ['bp', 'spo2'];

export function MetricDetailScreen({ metric: given }: { metric?: MetricKey } = {}) {
  const nav = useNav();
  const repo = useRepo();
  const { days } = useData();
  const [metric] = useState<MetricKey>(() => given ?? chosenMetric());
  const [range, setRange] = useState<Range>('month');
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const [vitals, setVitals] = useState<VitalDay[]>([]);

  useEffect(() => {
    let ignore = false;
    repo
      .loadBaselines()
      .then((rows) => !ignore && setBaselines(rows))
      .catch(() => {
        // Without her usual, the screen says it is not known yet.
      });
    if (NEEDS_VITALS.includes(metric)) {
      const since = dayKeys('6m', new Date())[0];
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      repo
        .loadVitalDays(since, tz)
        .then((rows) => !ignore && setVitals(rows))
        .catch(() => {
          // No readings drawn rather than invented ones.
        });
    }
    return () => {
      ignore = true;
    };
  }, [repo, metric]);

  const now = useMemo(() => new Date(), []);
  const usual = useMemo(() => usualFor(metric, baselines), [metric, baselines]);
  const points = useMemo(() => seriesFor(metric, days, vitals, range, now), [metric, days, vitals, range, now]);
  // The headline always reads the most recent reading in six months, not
  // only the chosen range, so a short range cannot hide the latest one.
  const latest = useMemo(() => headline(metric, seriesFor(metric, days, vitals, '6m', now), usual, now), [metric, days, vitals, usual, now]);
  const drawn = useMemo(() => bucketize(points, range), [points, range]);
  const figures = useMemo(() => summary(metric, points), [metric, points]);
  const beside = useMemo(() => extras(metric, days, points, baselines, now), [metric, days, points, baselines, now]);
  const color = METRIC_HUE[metric];
  const label = RANGES.find((r) => r.key === range)!.label;
  const weekly = range === '3m' || range === '6m';

  return (
    <DetailScreen
      title={METRIC_TITLE[metric]}
      onBack={nav.back}
      footer={
        <SourceFooter
          kind="measured"
          text="Synced from your connected devices. Your usual range is worked out from your own readings from 5 to 13 weeks ago."
        />
      }
    >
      <View style={d.head} accessible accessibilityLabel={latest.value ? `${latest.value}, ${latest.when}. ${latest.compare ?? ''}` : 'No reading yet'}>
        <Text style={[numeral(44), d.value, !latest.value && d.none]}>{latest.value ?? 'Not yet'}</Text>
        {latest.when ? <Text style={[font('subhead'), d.when]}>{latest.when}</Text> : null}
        {latest.compare ? <Text style={[font('subhead', 'semibold'), { color }]}>{displayCopy(latest.compare)}</Text> : null}
        {!latest.value ? <Text style={[font('subhead'), d.when]}>Nothing recorded in the last six months.</Text> : null}
      </View>

      <SegmentedControl segments={LABELS} active={label} onChange={(l) => setRange(RANGES.find((r) => r.label === l)!.key)} />

      <View style={d.card}>
        <MetricChart metric={metric} points={drawn} usual={usual} color={color} />
        <Text style={[font('caption1'), d.legend]}>
          {displayCopy(
            `${weekly ? 'Each bar is a weekly average.' : 'Each mark is one day.'}${usual && metric !== 'temp' ? ' Shaded: your usual range.' : ''} A day with no reading is left empty.`,
          )}
        </Text>
      </View>

      <Group title={label === 'Week' ? 'This week' : `Last ${label.toLowerCase()}`} rows={figures} />
      {beside.map((s) => (
        <Group key={s.title} title={s.title} rows={s.rows} />
      ))}
    </DetailScreen>
  );
}

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View style={d.group}>
      <Eyebrow>{displayCopy(title)}</Eyebrow>
      <View style={d.list}>
        {rows.map((r, n) => (
          <View key={`${r.label}-${n}`} style={[d.row, n > 0 && d.divided]} accessible accessibilityLabel={`${r.label}, ${r.value}${r.note ? `, ${r.note}` : ''}`}>
            <Text style={[font('subhead'), d.label]}>{displayCopy(r.label)}</Text>
            <View style={d.right}>
              <Text style={[font('subhead', 'semibold'), d.rowValue]}>{displayCopy(r.value)}</Text>
              {r.note ? <Text style={[font('caption2'), d.note]}>{displayCopy(r.note)}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.hairlineWidth;

const d = StyleSheet.create({
  head: { marginBottom: SPACE.near },
  value: { color: L.ink, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  none: { color: L.meta },
  when: { color: L.meta, marginTop: 2, marginBottom: 4 },
  card: { marginTop: SPACE.near, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: st, borderColor: L.rule, padding: 14 },
  legend: { color: L.meta, marginTop: 10, lineHeight: 17 },
  group: { marginTop: SPACE.block },
  list: { marginTop: SPACE.tight, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: st, borderColor: L.rule, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  label: { color: L.body, flex: 1 },
  right: { alignItems: 'flex-end' },
  rowValue: { color: L.ink },
  note: { color: L.meta, marginTop: 2 },
});
