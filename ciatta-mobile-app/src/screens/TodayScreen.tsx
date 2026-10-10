import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { type CyclePoint, cycleTrend, fmtHours } from '../lib/engine';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData } from '../state/session';
import { font, fonts, GUTTER, numeral } from '../theme';
import { Tile } from '../ui/bento';
import { L, LA, TILE_RADIUS } from '../ui/light';
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
        <Line x1={4} y1={base} x2={W} y2={base} stroke={L.line} />
        <Path d={line(cys)} stroke={LA.reported} strokeWidth={2} fill="none" />
        {points.every((p) => p.sleep != null) ? <Path d={line(sys)} stroke={LA.measured} strokeWidth={2} fill="none" /> : null}
        {xs.map((x, i) => (
          <G key={i}>
            <Circle cx={x} cy={cys[i]} r={3.5} fill={LA.reported} />
            <SvgText x={x} y={cys[i] - 9} fill={i === last ? LA.reported : L.muted} fontFamily={fonts.regular} {...label}>
              {days[i]}
            </SvgText>
            {points[i].sleep != null ? <Circle cx={x} cy={sys[i]} r={3.5} fill={LA.measured} /> : null}
            <SvgText
              x={x}
              y={base + 18}
              fill={i === last ? L.ink : L.muted}
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

type Action = { key: string; icon: IconName; title: string; sub?: string; onPress?: () => void };

export function TodayScreen() {
  const nav = useNav();
  const { startDraft, accept, setFocus, watching, setWatching } = useCycle();
  const { today: brief } = useInsights();
  const { windows } = useCycleInsights();
  const { person, today, days } = useData();
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
        The app sets light status bar content for the dark record. On a
        white page that paints the clock and the battery white on white.
      */}
      <StatusBar style="dark" />
      {/*
        The date, the day's line, and who is being spoken to. Same three
        pieces as before, set as a masthead now that there is no photograph
        behind them to compete with.
      */}
      <View style={t.pad}>
        <Text style={[font('caption1'), t.eyebrow]}>
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </Text>
        <Text style={[font('largeTitle'), t.headline]} accessibilityRole="header">
          {displayCopy(today.headline)}
        </Text>
        <Text style={[font('body'), t.greeting]}>
          {displayCopy(person ? `${greeting(now)}, ${person.firstName}.` : `${greeting(now)}.`)}
        </Text>

        {/* The chart, then the daily brief written from whatever ranks highest. */}
        <View style={t.card}>
        {points.length >= 2 ? (
          <>
            <Pressable
              onPress={go('cycle')}
              accessibilityRole="button"
              accessibilityLabel={`Cycle length went from ${first.length} to ${latest.length} days.${sleepText} Opens Cycle.`}
              style={({ pressed }) => [t.trend, pressed && t.pressed]}
            >
              <View style={t.trendLeft}>
                <Text style={[font('footnote'), { color: L.muted }]}>Cycle length, days</Text>
                <View style={t.fromTo}>
                  <Text style={[numeral(28), { color: L.muted }]}>{first.length}</Text>
                  <Icon name="arrowRight" size={16} color={L.muted} weight={2} />
                  <Text style={[numeral(28), { color: LA.reported }]}>{latest.length}</Text>
                </View>
                {sleepFrom && sleepTo ? (
                  <>
                    <Text style={[font('footnote'), { color: L.muted, marginTop: 14 }]}>Sleep, final week</Text>
                    <View style={t.fromTo}>
                      <Text style={[numeral(17), { color: L.muted }]}>{sleepFrom}</Text>
                      <Icon name="arrowRight" size={14} color={L.muted} weight={2} />
                      <Text style={[numeral(17), { color: LA.measured }]}>{sleepTo}</Text>
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
  fill: { flex: 1, backgroundColor: L.bg },
  body: { paddingBottom: 40, paddingTop: 8 },
  pad: { paddingHorizontal: GUTTER },
  pressed: { opacity: 0.6 },
  section: { marginTop: 28 },
  eyebrow: { color: L.muted, letterSpacing: 1.1 },
  headline: { color: L.ink, letterSpacing: -0.8, marginTop: 6 },
  greeting: { color: L.muted, marginTop: 8 },
  lead: { marginTop: 20 },
  leadEyebrow: { color: 'rgba(255,255,255,0.6)', letterSpacing: 1.1 },
  leadText: { color: '#FFFFFF', lineHeight: 25, marginTop: 6 },

  card: { marginTop: 24, backgroundColor: L.field, borderRadius: TILE_RADIUS, padding: 16 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: -8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: L.line, marginVertical: 16 },
  trendLeft: { width: 136 },
  fromTo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
