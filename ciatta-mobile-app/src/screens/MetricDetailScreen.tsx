// One metric, opened from its card: the latest reading against her usual
// range, then the timeline read by Day, Week, Month or Year as Journey reads
// it, opening on Day: today hour by hour (last night, for sleep), a week and
// a month a day at a time, a year a month at a time. Then the figures for
// that window, and what belongs beside this metric. Every figure comes
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
  hourly,
  INTRADAY,
  METRIC_TITLE,
  type MetricKey,
  type Range,
  type Reading,
  type Row,
  seriesFor,
  seriesForDays,
  summary,
  usualFor,
  type VitalDay,
} from '../lib/metricDetail';
import { chosenMetric } from '../lib/metricHandoff';
import { useNav } from '../navigation';
import { useData, useRepo } from '../state/session';
import { font, numeral } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, SourceFooter } from '../ui/kit';
import { ViewByPicker } from '../ui/ViewByPicker';
import { MetricChart } from '../ui/MetricChart';
import { Hypnogram } from '../ui/Hypnogram';
import { lastNight, type Night } from '../lib/hypnogram';
import { METRIC_HUE } from '../ui/metricHue';
import { L, SPACE, TILE_RADIUS, BLEED } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

const NEEDS_VITALS: MetricKey[] = ['bp', 'spo2'];

export function MetricDetailScreen({ metric: given }: { metric?: MetricKey } = {}) {
  const nav = useNav();
  const repo = useRepo();
  const { days } = useData();
  const [metric] = useState<MetricKey>(() => given ?? chosenMetric());
  const [range, setRange] = useState<Range>('day');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const [vitals, setVitals] = useState<VitalDay[]>([]);
  const [night, setNight] = useState<Night | null>(null);

  useEffect(() => {
    let ignore = false;
    repo
      .loadBaselines()
      .then((rows) => !ignore && setBaselines(rows))
      .catch(() => {
        // Without her usual, the screen says it is not known yet.
      });
    if (metric === 'sleep') {
      repo
        .loadSleepSamples(new Date(Date.now() - 36 * 3600000).toISOString())
        .then((x) => !ignore && setNight(lastNight(x)))
        .catch(() => {});
    }
    // Today's readings for the Day view, for the metrics a day can show.
    if (INTRADAY[metric].length) {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      repo
        .loadIntraday(midnight.toISOString(), INTRADAY[metric])
        .then((rows) => !ignore && setReadings(rows))
        .catch(() => {});
    }
    if (NEEDS_VITALS.includes(metric)) {
      const since = dayKeys('year', new Date())[0];
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
  // Sleep is a night and skin temperature one reading a night, so their
  // Day is today's own row rather than hours.
  const byHour = range === 'day' && INTRADAY[metric].length > 0;
  // The days the window covers, for the figures beside the chart.
  const dayPoints = useMemo(
    () => (range === 'day' ? seriesForDays(metric, days, vitals, 1, now) : seriesFor(metric, days, vitals, range, now)),
    [metric, days, vitals, range, now],
  );
  const points = useMemo(() => (byHour ? hourly(metric, readings, now) : dayPoints), [byHour, metric, readings, now, dayPoints]);
  // The headline always reads the most recent reading in the year, not
  // only the chosen window, so a short window cannot hide the latest one.
  const latest = useMemo(() => headline(metric, seriesFor(metric, days, vitals, 'year', now), usual, now), [metric, days, vitals, usual, now]);
  const drawn = useMemo(() => bucketize(points, range), [points, range]);
  const figures = useMemo(() => summary(metric, drawn), [metric, drawn]);
  const beside = useMemo(() => extras(metric, days, dayPoints, baselines, now), [metric, days, dayPoints, baselines, now]);
  const color = METRIC_HUE[metric];
  const recorded = drawn.some((p) => p.value != null);
  const title = range === 'day' ? 'Today' : range === 'week' ? 'This week' : range === 'month' ? 'Last month' : 'Last year';
  const legend =
    range === 'day' ? 'Each mark is one hour today.' : range === 'year' ? 'Each bar is a monthly average.' : 'Each mark is one day.';

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

      <ViewByPicker scale={range} onChange={setRange} />

      {range === 'day' && metric === 'sleep' ? (
        // Sleep's day is last night, stage by stage: the same hypnogram the
        // Health dashboard draws.
        <View style={d.card}>
          <CardFill />
          <Text style={[font('footnote', 'semibold'), { color: L.ink, marginBottom: 10 }]}>Last night</Text>
          {night ? <Hypnogram night={night} size="full" /> : <Text style={[font('subhead'), d.legend]}>No sleep recorded last night.</Text>}
        </View>
      ) : range === 'day' && metric === 'temp' ? (
        <View style={d.card}>
          <CardFill />
          <Text style={[font('subhead'), { color: L.body, lineHeight: 21 }]}>
            {displayCopy(
              `Skin temperature is read once a night${dayPoints[0]?.value != null ? '' : ', and there is no reading for last night yet'}. Week, Month and Year show how it moves.`,
            )}
          </Text>
        </View>
      ) : (
        <View style={d.card}>
          <CardFill />
          {byHour && !recorded ? (
            <Text style={[font('subhead'), { color: L.body }]}>No readings yet today.</Text>
          ) : (
            <MetricChart metric={metric} points={drawn} usual={usual} color={color} />
          )}
          <Text style={[font('caption1'), d.legend]}>
            {displayCopy(`${legend}${usual && metric !== 'temp' ? ' Shaded: your usual range.' : ''} Empty means no reading.`)}
          </Text>
        </View>
      )}

      {byHour || range !== 'day' ? <Group title={title} rows={figures} /> : null}
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
        <CardFill />
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
  value: { color: G.ink, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  none: { color: G.meta },
  when: { color: G.meta, marginTop: 2, marginBottom: 4 },
  card: { marginTop: SPACE.near, backgroundColor: L.glass, padding: 14, overflow: 'hidden', ...BLEED },
  legend: { color: L.meta, marginTop: 10, lineHeight: 17 },
  group: { marginTop: SPACE.block },
  list: { marginTop: SPACE.tight, backgroundColor: L.glass, paddingHorizontal: 14, overflow: 'hidden', ...BLEED },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  label: { color: L.body, flex: 1 },
  right: { alignItems: 'flex-end' },
  rowValue: { color: L.ink },
  note: { color: L.meta, marginTop: 2 },
});
