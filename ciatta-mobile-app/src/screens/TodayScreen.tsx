import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { type CyclePoint, cycleTrend, fmtHours } from '../lib/engine';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { font, fonts, GUTTER, numeral } from '../theme';
import { Tile } from '../ui/bento';
import { images } from '../ui/images';
import { AXIS, buildDay, type DayChart, VIEW } from '../lib/todayChart';
import type { IntradayPoint } from '../data/repo';
import { ground, L, mark, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/light';
import { ListGroup, ListRow } from '../ui/chrome';
import type { IconName } from '../ui/icons';
import { Icon } from '../ui/icons';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Fits values into a band of the chart, higher values nearer the top.
function scale(vs: number[], top: number, bottom: number) {
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  return (v: number) => (hi === lo ? (top + bottom) / 2 : top + ((hi - v) / (hi - lo)) * (bottom - top));
}

// The last completed cycles, labelled by the month each started, with the
// sleep of each cycle's final week. The latest cycle is shaded.
function TrendChart({ points }: { points: CyclePoint[] }) {
  const W = 190;
  const H = 150;
  const base = 122;
  const xs = points.map((_, i) => (points.length === 1 ? W / 2 : 26 + (i * 138) / (points.length - 1)));
  const days = points.map((p) => p.length);
  const hours = points.map((p) => p.sleep);
  // Only the cycles that actually have a sleep figure set the scale's
  // range: a cycle with no nights recorded must not drag the floor toward a
  // fabricated zero for every other point on the same chart. The dots and
  // path themselves are already gated on p.sleep != null below, so a
  // missing entry's placeholder position is never drawn.
  const knownHours = hours.filter((h): h is number => h != null);
  const cy = scale(days, 24, 64);
  const sy = knownHours.length ? scale(knownHours, 76, 104) : () => 90;
  const line = (ys: number[]) => ys.map((y, i) => `${i ? 'L' : 'M'}${xs[i]},${y}`).join(' ');
  const cys = days.map(cy);
  const sys = hours.map((h) => (h != null ? sy(h) : 90));
  const last = xs.length - 1;
  const label = { fontSize: 11, textAnchor: 'middle' } as const;

  return (
    <View style={t.chart} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Rect x={xs[last] - 18} y={0} width={36} height={base} rx={4} fill={L.ink} opacity={0.05} />
        <Line x1={4} y1={base} x2={W} y2={base} stroke={L.rule} />
        <Path d={line(cys)} stroke={mark('reported')} strokeWidth={2} fill="none" />
        {points.every((p) => p.sleep != null) ? <Path d={line(sys)} stroke={mark('measured')} strokeWidth={2} fill="none" /> : null}
        {xs.map((x, i) => (
          <G key={i}>
            <Circle cx={x} cy={cys[i]} r={3.5} fill={mark('reported')} />
            <SvgText x={x} y={cys[i] - 9} fill={i === last ? mark('reported') : L.meta} fontFamily={fonts.regular} {...label}>
              {days[i]}
            </SvgText>
            {points[i].sleep != null ? <Circle cx={x} cy={sys[i]} r={3.5} fill={mark('measured')} /> : null}
            <SvgText
              x={x}
              y={base + 18}
              fill={i === last ? L.ink : L.meta}
              fontFamily={i === last ? fonts.semibold : fonts.regular}
              {...label}
            >
              {MONTHS[points[i].start.getMonth()]}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

// The day, drawn the way the concept draws it, on this app's ground.
//
// Every stroke is a mark, so each takes a Base step; the wash under the
// line is the same hue's Tint, which is the one place a tint belongs. The
// concept drew all of this in white because its screen was Graphite.
function DayChartView({ day, label }: { day: DayChart; label: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width="100%" height={undefined} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} style={t.day}>
        {/* the night she has already had */}
        {day.asleep.map((a, i) => (
          <Rect key={i} x={a.x} y={0} width={a.width} height={VIEW.base} rx={2} fill={L.rule} />
        ))}

        {/* her own usual, across the hours she was awake */}
        {day.usual ? (
          <Line
            x1={day.usual.from}
            x2={day.usual.to}
            y1={day.usual.y}
            y2={day.usual.y}
            stroke={L.meta}
            strokeDasharray="1.6 2.4"
            strokeWidth={0.6}
          />
        ) : null}
        <Line x1={0} x2={VIEW.w} y1={VIEW.base} y2={VIEW.base} stroke={L.rule} strokeWidth={0.6} />

        <Path d={day.area} fill={ground('measured')} />
        <Path d={day.line} fill="none" stroke={mark('measured')} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* where now is, and the last reading it follows */}
        <Line x1={day.nowX} x2={day.nowX} y1={VIEW.top - 2} y2={VIEW.rail} stroke={L.rule} strokeWidth={0.6} />
        <Circle cx={day.points[day.points.length - 1].x} cy={day.points[day.points.length - 1].y} r={2} fill={mark('measured')} />

        {/* what she logged, on its own rail so it does not fight the line */}
        {day.marks.map((m, i) => (
          <G key={i}>
            <Line x1={m.x} x2={m.x} y1={VIEW.base} y2={VIEW.rail} stroke={L.rule} strokeWidth={0.5} />
            <Circle cx={m.x} cy={VIEW.rail} r={m.r} fill={mark('reported')} />
          </G>
        ))}
      </Svg>
      <View style={t.axis}>
        {AXIS.map((a) => (
          <Text key={a} style={[font('caption2'), t.axisText]}>
            {a}
          </Text>
        ))}
      </View>
    </View>
  );
}

type Action = { key: string; icon: IconName; title: string; sub?: string; onPress?: () => void };

export function TodayScreen() {
  const nav = useNav();
  const { startDraft, accept, setFocus, watching, setWatching } = useCycle();
  const { today: brief } = useInsights();
  const { windows } = useCycleInsights();
  const { person, today, days } = useData();
  const repo = useRepo();

  // Today's measured readings, by the hour they happened. daily_metrics is
  // one row per day, which cannot draw a day.
  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let ignore = false;
    repo
      .loadIntraday(midnight.toISOString())
      .then((rows) => {
        if (!ignore) setIntraday(rows);
      })
      .catch(() => {
        // No chart rather than an invented one.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);

  // Today's own row, when there is one. days arrives oldest first.
  const todayDay = useMemo(() => {
    const iso = new Date();
    const key = `${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}`;
    return days.find((d) => d.date === key) ?? null;
  }, [days]);

  // The day, built only from what arrived. buildDay returns null when there
  // is not enough to draw, which is the honest state on a first morning.
  const day = useMemo(() => {
    const readings = intraday
      .filter((r) => r.metric === 'heart_rate' && r.value != null)
      .map((r) => ({ at: new Date(r.at), value: r.value as number }));
    const sleepEnds = intraday.filter((r) => r.metric === 'sleep_analysis').map((r) => new Date(r.at));
    const woke = sleepEnds.length ? new Date(Math.max(...sleepEnds.map((d) => d.getTime()))) : null;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    // Her own usual for this metric, from her own history and nowhere else.
    const restingHistory = days.map((d) => d.restingHR).filter((v): v is number => v != null);
    const usual = restingHistory.length >= 3
      ? restingHistory.reduce((a, b) => a + b, 0) / restingHistory.length
      : null;
    return buildDay({
      readings,
      asleep: woke ? [{ from: startOfDay, to: woke }] : [],
      marks: [],
      usual,
      now: new Date(),
    });
  }, [intraday, days]);
  const go = (screen: Screen) => () => nav.push(screen);
  const now = new Date();

  // The first and latest of the recent completed cycles, and the sleep of
  // their final weeks.
  const points = cycleTrend(windows, days);
  const first = points[0];
  const latest = points[points.length - 1];
  const sleepFrom = first?.sleep != null ? fmtHours(first.sleep) : null;
  const sleepTo = latest?.sleep != null ? fmtHours(latest.sleep) : null;
  const sleepText = sleepFrom && sleepTo ? ` Sleep in the final week went from ${sleepFrom} to ${sleepTo}.` : '';

  const evidence = (id?: string) => () => {
    setFocus(id ?? null);
    nav.push('evidence');
  };
  const describe = () => {
    startDraft({ form: { kinds: ['Pain'] }, focusNote: true });
    nav.push('cycleLog');
  };

  // Actions that fit the pattern being told today.
  const actions: Action[] = [];
  if (brief.lead?.id === 'combined') {
    const on = watching.nextCycle === true;
    actions.push({
      key: 'watch',
      icon: 'target',
      title: 'Watch Your Next Cycle',
      sub: on ? 'Watching. It will show here when your next cycle ends.' : undefined,
      onPress: on ? undefined : () => setWatching('nextCycle', true),
    });
  }
  if (brief.recommendation) {
    actions.push({
      key: 'walk',
      icon: 'sun',
      title: brief.walkPlanned ? 'Walk Planned for Today' : 'Try a Short Walk Today',
      sub: brief.walkPlanned ? 'The next few days will show how it goes.' : 'Only if it feels appropriate.',
      onPress: brief.walkPlanned ? undefined : () => accept('walk'),
    });
  }
  actions.push(
    { key: 'describe', icon: 'chat', title: 'Describe What Changed', onPress: describe },
    { key: 'prepare', icon: 'calendarPlus', title: 'Prepare for an Appointment', onPress: go('healthrecords') },
    { key: 'evidence', icon: 'doc', title: 'View the Evidence', onPress: evidence(brief.lead?.id) },
  );

  return (
    <ScrollView style={t.fill} contentContainerStyle={t.body}>
      {/*
        The concept's shape: the mark sits alone at the top of the screen
        and the day introduces itself underneath.
      */}
      <View style={t.wordmarkRow}>
        <Image
          source={images.wordmark}
          style={t.wordmark}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Ciatta"
        />
      </View>

      <View style={t.pad}>
        <Text style={[font('title2'), t.hello]} accessibilityRole="header">
          {displayCopy(person ? `${greeting(now)}, ${person.firstName}.` : `${greeting(now)}.`)}
        </Text>

        {/*
          Today's patterns: the day itself, or a plain line saying there is
          not enough of it yet. A chart drawn from one reading would be a
          shape Ciatta chose rather than one she produced.
        */}
        <View style={t.dayCard}>
          <View style={t.dayHead}>
            <Text style={[font('caption1'), t.dayHeadText]}>TODAY&rsquo;S PATTERNS</Text>
            <Text style={[font('caption1'), t.dayHeadText]}>
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </Text>
          </View>
          {day ? (
            <DayChartView
              day={day}
              label={`Your heart rate through today, ${day.points.length} readings between ${day.low.toFixed(0)} and ${day.high.toFixed(0)}.`}
            />
          ) : (
            <Text style={[font('subhead'), t.dayEmpty]}>
              Not enough readings today to draw your day yet. Ciatta will fill this in as your devices record.
            </Text>
          )}
        </View>

        {/* The chart, then the daily brief written from whatever ranks highest. */}
        <View style={t.card}>
        {/*
          Three figures from today, as the concept has them. Each is the
          value actually recorded; a figure with nothing behind it says so
          rather than showing a dash that reads as zero.
        */}
        <View style={t.pills}>
          {[
            ['Sleep', todayDay?.sleepHours != null ? fmtHours(todayDay.sleepHours) : null],
            ['HRV', todayDay?.hrv != null ? `${Math.round(todayDay.hrv)} ms` : null],
            ['Steps', todayDay?.steps != null ? Math.round(todayDay.steps).toLocaleString('en-US') : null],
          ].map(([label, value]) => (
            <View key={label as string} style={t.pill}>
              <Text style={[font('caption1'), t.pillLabel]}>{(label as string).toUpperCase()}</Text>
              <Text style={[font('headline'), value ? t.pillValue : t.pillNone]}>{value ?? 'Not yet'}</Text>
            </View>
          ))}
        </View>

        {points.length >= 2 ? (
          <>
            <Pressable
              onPress={go('cycle')}
              accessibilityRole="button"
              accessibilityLabel={`Cycle length went from ${first.length} to ${latest.length} days.${sleepText} Opens Cycle.`}
              style={({ pressed }) => [t.trend, pressed && t.pressed]}
            >
              <View style={t.trendLeft}>
                <Text style={[font('footnote'), { color: L.meta }]}>Cycle length, days</Text>
                <View style={t.fromTo}>
                  <Text style={[numeral(28), { color: L.meta }]}>{first.length}</Text>
                  <Icon name="arrowRight" size={16} color={L.meta} weight={2} />
                  <Text style={[numeral(28), { color: mark('reported') }]}>{latest.length}</Text>
                </View>
                {sleepFrom && sleepTo ? (
                  <>
                    <Text style={[font('footnote'), { color: L.meta, marginTop: 14 }]}>Sleep, final week</Text>
                    <View style={t.fromTo}>
                      <Text style={[numeral(17), { color: L.meta }]}>{sleepFrom}</Text>
                      <Icon name="arrowRight" size={14} color={L.meta} weight={2} />
                      <Text style={[numeral(17), { color: mark('measured') }]}>{sleepTo}</Text>
                    </View>
                  </>
                ) : null}
              </View>
              <TrendChart points={points} />
            </Pressable>
            <View style={t.divider} />
          </>
        ) : null}
        </View>

        {/*
          The one tile that is the point of the screen: the sentence written
          from whatever ranks highest today. Inked so nothing else competes
          with it, and only ever one, because emphasis applied twice is
          decoration. The kicker is its eyebrow now rather than a tinted
          line floating under the headline.
        */}
        <Tile span={2} emphasis style={t.lead}>
          {today.kicker ? <Text style={[font('caption1'), t.leadEyebrow]}>{today.kicker.toUpperCase()}</Text> : null}
          <Text style={[font('body'), t.leadText]}>{displayCopy(brief.text)}</Text>
        </Tile>

        <ListGroup light style={{ marginTop: 12 }}>
          {actions.map((a, n) => (
            <ListRow light key={a.key} first={n === 0} icon={a.icon} title={a.title} sub={a.sub} onPress={a.onPress} />
          ))}
        </ListGroup>

        <ListGroup light header="Worth Doing Next" style={t.section}>
          <ListRow light
            first
            
icon="plus"
            title="Log Cycle Experience"
            sub="Bleeding, pain, symptoms, and what was going on."
            onPress={() => {
              startDraft();
              nav.push('cycleLog');
            }}
          />
          <ListRow light icon="journey" title="Movement" sub="Activity against your usual, and what it lines up with." onPress={go('movement')} />
          <ListRow light icon="bars" title="Track Next Cycle" sub="Keep an eye on cycle timing and sleep." onPress={go('cycle')} />
          <ListRow light icon="notebook" title="Add a Note" sub="Write down what you're noticing." onPress={go('journal')} />
        </ListGroup>
      </View>
    </ScrollView>
  );
}

const t = StyleSheet.create({
  fill: { flex: 1, backgroundColor: L.canvas },
  body: { paddingBottom: NAV_CLEARANCE, paddingTop: 8 },
  pad: { paddingHorizontal: GUTTER },
  pressed: { opacity: 0.6 },
  section: { marginTop: 28 },
  // The mark alone at the top, as the concept has it.
  wordmarkRow: { alignItems: 'center', paddingTop: 6, paddingBottom: 18 },
  wordmark: { width: 74, height: 22, tintColor: L.ink },
  hello: { color: L.ink, letterSpacing: -0.4 },

  dayCard: {
    marginTop: SPACE.near,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeadText: { color: L.meta, letterSpacing: 0.9 },
  // The viewBox is 132 by 40, so the box it draws into keeps that ratio
  // and the geometry is never stretched.
  day: { width: '100%', aspectRatio: 132 / 40 },
  dayEmpty: { color: L.body, lineHeight: 21, paddingVertical: 10 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { color: L.meta },

  pills: { flexDirection: 'row', gap: SPACE.grid, marginTop: SPACE.grid },
  pill: { flex: 1, backgroundColor: L.recessed, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  pillLabel: { color: L.meta, letterSpacing: 0.9 },
  pillValue: { color: L.ink },
  // A figure she has not produced today reads as absent, not as zero.
  pillNone: { color: L.meta },
  lead: { marginTop: SPACE.block },
  leadEyebrow: { color: L.meta, letterSpacing: 1.1 },
  leadText: { color: L.ink, lineHeight: 25, marginTop: 6 },

  card: { marginTop: SPACE.block, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, padding: 18 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: -8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: L.rule, marginVertical: 16 },
  trendLeft: { width: 136 },
  fromTo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
