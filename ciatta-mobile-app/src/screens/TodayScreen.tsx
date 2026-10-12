import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { type CyclePoint, cycleTrend, fmtHours } from '../lib/engine';
import { countedWindows, cycleToday, cycleTodayLabel, medianLength } from '../lib/cycleModel';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { font, fonts, GUTTER, numeral } from '../theme';
import { Eyebrow, Tile } from '../ui/bento';
import { Wordmark } from '../ui/Wordmark';
import { AXIS, buildDay, type DayChart, VIEW } from '../lib/todayChart';
import type { IntradayPoint } from '../data/repo';
import { ground, HUE, L, mark, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
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
  const { startDraft, accept, watching, setWatching } = useCycle();
  const { today: brief } = useInsights();
  const { windows, signals, lens, profile } = useCycleInsights();
  const { person, today, days, todayIsPlaceholder } = useData();
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

  // Where today sits in her cycle. Null when there is no open cycle or
  // when it has been left open too long to mean anything, and the header
  // then says nothing rather than guessing.
  //
  // Kept as the object rather than only its line, because Metrics shows the
  // two halves apart: the day is a number she can read like a step count,
  // and the phase is the part that means something.
  const cycleNow = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const predicted = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    return cycleToday(open && !open.end ? open : null, predicted, new Date());
  }, [windows, lens, profile]);
  const cycleLabel = useMemo(() => cycleTodayLabel(cycleNow), [cycleNow]);

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
    // What she logged today, on its own rail. Severity sizes the dot, so
    // the rail says how much as well as when.
    const marks = signals
      .filter((sg) => sg.pain && sg.episode.severity != null && sg.date >= startOfDay)
      .map((sg) => ({ at: sg.date, weight: sg.episode.severity as number }));

    return buildDay({
      readings,
      asleep: woke ? [{ from: startOfDay, to: woke }] : [],
      marks,
      usual,
      now: new Date(),
    });
  }, [intraday, days, signals]);
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
  // Nothing is pushed here unconditionally any more. What is left above is
  // only what today's pattern earned: a watch worth setting, a walk worth
  // trying. Preparing for an appointment is always available and has moved
  // to the foot of Worth Doing Next, which is where the things that are
  // always available live.

  return (
    <ScrollView style={t.fill} contentContainerStyle={t.body}>
      {/*
        The concept's shape: the mark sits alone at the top of the screen
        and the day introduces itself underneath.
      */}
      <View style={t.wordmarkRow}>
        <Wordmark />
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
              {(cycleLabel ?? now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).toUpperCase()}
            </Text>
          </View>
          {day ? (
            <DayChartView
              day={day}
              // Everything drawn, said. A chart described only by its line
              // leaves a blind reader without the sleep block and the
              // logs, which are half of what is on it.
              label={[
                `Your heart rate through today, ${day.points.length} readings between ${day.low.toFixed(0)} and ${day.high.toFixed(0)}.`,
                day.asleep.length ? 'Your sleep is shaded at the start of the day.' : '',
                day.marks.length
                  ? `${day.marks.length} ${day.marks.length === 1 ? 'log' : 'logs'} marked below the line.`
                  : '',
                day.usual ? 'Your own usual is the dashed line.' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ) : (
            <Text style={[font('subhead'), t.dayEmpty]}>
              Not enough readings today to draw your day yet. Ciatta will fill this in as your devices record.
            </Text>
          )}
        </View>

        {/* The chart, then the daily brief written from whatever ranks highest. */}
        {/*
          The heading belongs to the card under it, not the card over it.
          Sitting a block below the day chart and a hair above the metrics,
          it read as a footer on the chart. So the gap moved: a section's
          worth above, so it separates from what came before, and almost
          none below, so it binds to what it names.

          All opens the rest of them. Today carries three because three is
          what a glance holds, and the other sixteen have to be reachable
          without that being a reason to crowd this card.
        */}
        <View style={t.sectionHead}>
          <Eyebrow>Metrics</Eyebrow>
          <Pressable
            onPress={go('metrics')}
            accessibilityRole="button"
            accessibilityLabel="All of today's metrics"
            hitSlop={8}
            style={({ pressed }) => [t.all, pressed && t.pressed]}
          >
            <Text style={[font('footnote', 'semibold'), t.allText]}>All</Text>
            <Icon name="chevronRight" size={14} color={L.body} />
          </Pressable>
        </View>
        <View style={t.card}>
        {/*
          Where she is in her cycle, above the three figures, because it is
          the one of the four she carries in her head all day and the one
          that gives the other three their context.

          It is her own logging rather than a device reading, so it is the
          only row here in a semantic colour, and both halves have to be
          earned: cycleToday returns null when there is no open cycle or
          when one has been left open past the point its day count means
          anything, and then the row says that instead of a number.
        */}
        <View style={t.cycleRow}>
          <View>
            <Text style={[font('caption1'), t.pillLabel]}>CYCLE</Text>
            <Text style={[font('headline'), cycleNow ? t.pillValue : t.pillNone]}>
              {cycleNow ? `Day ${cycleNow.day}` : 'No open cycle'}
            </Text>
          </View>
          {cycleNow?.phase ? (
            <Text style={[font('footnote', 'semibold'), t.phase]}>{cycleNow.phase}</Text>
          ) : null}
        </View>

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
          from whatever ranks highest today. Daylight, which the system
          keeps for a single sentence, and never two of them.

          Absent until there is something to say. The standing text was a
          card reading "nothing to compare yet" sitting above a chart that
          had already said so, which is two ways of saying nothing where one
          is plenty.
        */}
        {todayIsPlaceholder ? null : (
          <Tile span={2} emphasis style={t.lead}>
            {today.kicker ? <Text style={[font('caption1'), t.leadEyebrow]}>{today.kicker.toUpperCase()}</Text> : null}
            <Text style={[font('body'), t.leadText]}>{displayCopy(brief.text)}</Text>
          </Tile>
        )}

        {/*
          What today's pattern suggests trying, which only exists when the
          pattern does. The concept calls this the try block and gives it
          one job: the thing she might do about what she just read.
        */}
        {actions.length ? (
          <View style={t.section}>
            <Eyebrow>What you could try</Eyebrow>
            <ListGroup light style={{ marginTop: 10 }}>
              {actions.map((a, n) => (
                <ListRow light key={a.key} first={n === 0} icon={a.icon} title={a.title} sub={a.sub} onPress={a.onPress} />
              ))}
            </ListGroup>
          </View>
        ) : null}

        {/*
          Two ways in, and only two. One adds to the record, the other
          takes the record somewhere, and everything else she might do is
          reachable from the screen it belongs to.
        */}
        <View style={t.section}>
          <Eyebrow>You can</Eyebrow>
          <ListGroup light style={{ marginTop: 10 }}>
            <ListRow
              light
              first
              icon="plus"
              title="Log Cycle Experience and Symptoms"
              sub="Bleeding, pain, symptoms, and what was going on."
              onPress={() => {
                startDraft();
                nav.push('cycleLog');
              }}
            />
            <ListRow
              light
              icon="leaf"
              title="Log Your Day"
              sub="Food, gut, caffeine, and how the day felt."
              onPress={go('dailyLog')}
            />
            <ListRow
              light
              icon="calendarPlus"
              title="Prepare for an Appointment"
              sub="Build a brief from your record to take with you."
              onPress={go('appointment')}
            />
          </ListGroup>
        </View>
      </View>
    </ScrollView>
  );
}

const t = StyleSheet.create({
  // Transparent: the ground behind Root is what paints this screen, and
  // a flat fill here would cover the shift.
  fill: { flex: 1 },
  // No padding above the mark. Root has already inset the screen past the
  // camera, and the Wordmark carries its own clear space, so anything added
  // here is a third gap stacked on two that already exist.
  body: { paddingBottom: NAV_CLEARANCE, paddingTop: 0 },
  pad: { paddingHorizontal: GUTTER },
  pressed: { opacity: 0.6 },
  section: { marginTop: 28 },
  // The mark alone at the top, as the concept has it.
  // Centred and as high as the mark is allowed to sit, which is the way
  // Oura's own wordmark opens its home screen: the mark first, tight under
  // the status bar, and the day introducing itself underneath.
  //
  // The gap above it is the Wordmark's own padding and nothing else. The
  // Constitution sets clear space on all four sides at the cap height, so
  // that gap is the floor: further up would be the mark touching the camera
  // cutout, which is the one thing the clear space rule exists to prevent.
  wordmarkRow: { alignItems: 'center', paddingTop: 0, paddingBottom: 2 },
  hello: { color: L.ink, letterSpacing: -0.4 },

  dayCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
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

  // The cycle sits on its own full width row above the three pills, and
  // divides from them, so it reads as the context rather than as a fourth
  // figure of the same kind.
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.rule,
  },
  // Reported, which is the meaning this one carries: she logged it.
  phase: {
    color: HUE.reported,
    backgroundColor: ground('reported'),
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },

  pills: { flexDirection: 'row', gap: SPACE.grid, marginTop: SPACE.grid },
  pill: {
    flex: 1,
    backgroundColor: L.recessed,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  pillLabel: { color: L.meta, letterSpacing: 0.9 },
  pillValue: { color: L.ink },
  // A figure she has not produced today reads as absent, not as zero.
  pillNone: { color: L.meta },
  lead: { marginTop: SPACE.block },
  leadEyebrow: { color: L.meta, letterSpacing: 1.1 },
  leadText: { color: L.ink, lineHeight: 25, marginTop: 6 },

  // The heading row: a section's worth of air above it, almost none below,
  // so it reads down onto the card it names rather than up at the chart.
  sectionHead: {
    marginTop: SPACE.section,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  allText: { color: L.body },

  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: -8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: L.rule, marginVertical: 16 },
  trendLeft: { width: 136 },
  fromTo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
