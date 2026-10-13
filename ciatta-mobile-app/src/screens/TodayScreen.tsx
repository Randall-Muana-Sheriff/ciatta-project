import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { headlineMetrics } from '../lib/allMetrics';
import { bloodOxygen, bloodPressure, type VitalCard } from '../lib/vitals';
import { displayCopy } from '../lib/displayCopy';
import {
  clinicalPhase,
  clinicalPhaseLabel,
  countedWindows,
  cycleToday,
  estimatedPhase,
  estimatedPhaseLabel,
  medianLength,
} from '../lib/cycleModel';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { font, fonts, GUTTER } from '../theme';
import { Eyebrow, Tile } from '../ui/bento';
import { Wordmark } from '../ui/Wordmark';
import { smooth } from '../lib/curve';
import { AXIS, buildDay, CHART_KEY_LABEL, chartKey, type ChartKey, type DayChart, VIEW } from '../lib/todayChart';
import type { IntradayPoint } from '../data/repo';
import { ground, HUE, L, mark, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { ListGroup, ListRow } from '../ui/chrome';
import { MetricCard, METRIC_CARD_GAP } from '../ui/metricCard';
import { ProductNowCard } from '../ui/ProductNowCard';
import type { IconName } from '../ui/icons';
import { Icon } from '../ui/icons';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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
      {/*
        What the pattern is made of, named. Only what is drawn right now,
        so the key changes with the day: early on it may be the line alone,
        and her usual, her night and her logs join as they exist.
      */}
      <View style={t.key} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {chartKey(day).map((k) => (
          <View key={k} style={t.keyItem}>
            <KeySwatch kind={k} />
            <Text style={[font('caption2'), t.axisText]}>{CHART_KEY_LABEL[k]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// A small sample of each mark, drawn the way the chart draws it.
function KeySwatch({ kind }: { kind: ChartKey }) {
  return (
    <Svg width={14} height={8} viewBox="0 0 14 8">
      {kind === 'heartRate' ? (
        <Line x1={1} x2={13} y1={4} y2={4} stroke={mark('measured')} strokeWidth={2} strokeLinecap="round" />
      ) : kind === 'usual' ? (
        <Line x1={1} x2={13} y1={4} y2={4} stroke={L.meta} strokeWidth={1.2} strokeDasharray="1.6 2.4" />
      ) : kind === 'asleep' ? (
        <Rect x={1} y={0.5} width={12} height={7} rx={1.5} fill={L.rule} />
      ) : (
        <Circle cx={7} cy={4} r={3} fill={mark('reported')} />
      )}
    </Svg>
  );
}

// One colour per metric on Today's grid, so six cards of the same shape
// are told apart at a glance. An exception to the meaning palette, made on
// this grid only: every one of these is measured, so the meaning colour
// would paint all six the same. Red stays out, kept for escalation.
const METRIC_HUE: Record<string, string> = {
  sleep: '#8E9BFF',
  hrv: '#5ED3C4',
  steps: '#E8C46A',
  bp: '#F27D9B',
  temp: '#F09A5B',
  spo2: '#6FB6F5',
};

type Action = { key: string; icon: IconName; title: string; sub?: string; onPress?: () => void };

export function TodayScreen() {
  const nav = useNav();
  const { startDraft, accept, watching, setWatching } = useCycle();
  const { today: brief } = useInsights();
  const { windows, signals, lens, profile, fertility } = useCycleInsights();
  const { person, today, days, todayIsPlaceholder } = useData();
  const repo = useRepo();

  // Today's measured readings, by the hour they happened. daily_metrics is
  // one row per day, which cannot draw a day.
  // Blood pressure, blood oxygen and weight live in observations rather
  // than on the day row, so they are read separately.
  const [vitals, setVitals] = useState<VitalCard[]>([]);
  useEffect(() => {
    let ignore = false;
    repo
      .loadVitals()
      .then((rows) => {
        if (ignore) return;
        const now = new Date();
        setVitals([bloodPressure(rows, now), bloodOxygen(rows, now)]);
      })
      .catch(() => {
        // The cards say not yet, which is true when the read failed too.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);

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

  // The phase, in the corner of the cycle row.
  //
  // The clinical name when it has been earned: only a confirmed ovulation
  // counts, from a logged test or a temperature shift. Otherwise an
  // estimate, and the label says "Likely" so an estimate is never shown as
  // a position.
  const phaseText = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const confirmed =
      fertility?.confirmedThisCycle && open
        ? ([...(fertility.past ?? [])]
            .reverse()
            .find((o) => o.date >= open.start)?.date ?? null)
        : null;
    const today = new Date();
    const bleeding = !!open && !open.end && cycleNow != null && cycleNow.day <= 5 && cycleNow.phase === 'During period';
    const clinical = clinicalPhase({ date: today, bleeding, ovulation: confirmed });
    if (clinical) return clinicalPhaseLabel(clinical);
    // Nothing confirmed, so an estimate from the day and her own usual
    // length, labelled as one. An empty corner told her nothing about where
    // she is; "Likely follicular" tells her something and says how sure.
    if (!cycleNow) return null;
    return estimatedPhaseLabel(estimatedPhase(cycleNow.day, medianLength(countedWindows(windows, profile))));
  }, [windows, fertility, cycleNow, profile]);

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
      {/*
        The mark centred, the hamburger on the right. Both sides of the row
        reserve the same width, because a wordmark pushed off centre by one
        button is a wordmark set incorrectly.
      */}
      <View style={t.wordmarkRow}>
        <Pressable
          onPress={go('profile')}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={10}
          style={({ pressed }) => [t.menu, pressed && t.pressed]}
        >
          <Icon name="menu" size={26} color={L.ink} />
        </Pressable>
        <Wordmark />
        <Pressable
          onPress={go('calendar')}
          accessibilityRole="button"
          accessibilityLabel="Your calendar"
          hitSlop={10}
          style={({ pressed }) => [t.menu, pressed && t.pressed]}
        >
          <Icon name="calendar" size={25} color={L.ink} />
        </Pressable>
      </View>

      <View style={t.pad}>
        <Text style={[font('title2'), t.hello]} accessibilityRole="header">
          {displayCopy(person ? `${greeting(now)}, ${person.firstName}` : greeting(now))}
        </Text>

        {/*
          Today's patterns: the day itself, or a plain line saying there is
          not enough of it yet. A chart drawn from one reading would be a
          shape Ciatta chose rather than one she produced.
        */}
        <View style={t.dayCard}>
          <View style={t.dayHead}>
            <Text style={[font('caption1'), t.dayHeadText]}>TODAY&rsquo;S PATTERNS</Text>
            {/* The date, not the cycle day: the cycle day has its own row at
                the bottom of this card, and saying it twice made it noise. */}
            <Text style={[font('caption1'), t.dayHeadText]}>
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
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
              Not enough readings today to draw your day yet.
            </Text>
          )}

          {/*
            Where she is in her cycle, under the day it belongs to. It
            lives here rather than among the metrics because it is not a
            metric: it is the context the day is read in, and it is the
            one thing on this card she reported rather than a device
            measured.
          */}
          <View style={t.cycleRow}>
            <View>
              <Text style={[font('caption1'), t.cycleKey]}>CYCLE</Text>
              <Text style={[font('headline'), cycleNow ? t.cycleValue : t.cycleNone]}>
                {cycleNow ? `Day ${cycleNow.day}` : 'No open cycle'}
              </Text>
            </View>
            {phaseText ? <Text style={[font('footnote', 'semibold'), t.phase]}>{phaseText}</Text> : null}
          </View>
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
        {/* The period product she has in, only while one is in. */}
        <ProductNowCard />

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
          Six cards and nothing else. The card holds only metrics now:
          the chart and the cycle moved up into Today's Patterns, where
          the one is the day drawn and the other is the context it is
          read in.
        */}
        <View style={t.grid}>
          {headlineMetrics(days, vitals).map((m) => (
            <View key={m.key} style={t.gridCell}>
              <MetricCard label={m.label} value={m.value} note={m.note} from={m.from} trend={m.trend} color={METRIC_HUE[m.key]} />
            </View>
          ))}
        </View>

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
          <>
          {/*
            Named once, like Metrics above it. "Insights" rather than
            "Today's insights": the screen is Today and the chart card
            above is Today's Patterns, so a third "Today's" would be noise.
            The card itself carries no second label.
          */}
          <View style={t.sectionHead}>
            <Eyebrow>Insights</Eyebrow>
          </View>
          <Tile span={2} emphasis style={t.lead}>
            <Text style={[font('body'), t.leadText]}>{displayCopy(brief.text)}</Text>
          </Tile>
          </>
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
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: 0,
    paddingBottom: 2,
  },
  // Both sides reserve the same width so the mark stays centred.
  menu: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },

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

  // Two across, three down. A grid reads as a set of peers, which is what
  // these are: six readings from one day, none ranked above another.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: METRIC_CARD_GAP },
  gridCell: { width: '30%', flexGrow: 1 },

  cycleKey: { color: L.meta, letterSpacing: 0.9 },
  cycleValue: { color: L.ink },
  // A figure she has not produced today reads as absent, not as zero.
  cycleNone: { color: L.meta },
  lead: { marginTop: SPACE.tight },
  leadText: { color: L.ink, lineHeight: 25 },

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
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
