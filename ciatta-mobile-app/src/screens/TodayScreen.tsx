import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { type CyclePoint, cycleTrend, fmtHours } from '../lib/engine';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData } from '../state/session';
import { C, font, fonts, GUTTER, numeral, RADIUS } from '../theme';
import { LargeTitle, ListGroup, ListRow } from '../ui/chrome';
import type { IconName } from '../ui/icons';
import { Icon } from '../ui/icons';
import { images } from '../ui/images';

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
        <Rect x={xs[last] - 18} y={0} width={36} height={base} rx={4} fill={C.white} opacity={0.06} />
        <Line x1={4} y1={base} x2={W} y2={base} stroke={C.separator} />
        <Path d={line(cys)} stroke={C.coral} strokeWidth={2} fill="none" />
        {points.every((p) => p.sleep != null) ? <Path d={line(sys)} stroke={C.lavender} strokeWidth={2} fill="none" /> : null}
        {xs.map((x, i) => (
          <G key={i}>
            <Circle cx={x} cy={cys[i]} r={3.5} fill={C.coral} />
            <SvgText x={x} y={cys[i] - 9} fill={i === last ? C.coral : C.secondary} fontFamily={fonts.regular} {...label}>
              {days[i]}
            </SvgText>
            {points[i].sleep != null ? <Circle cx={x} cy={sys[i]} r={3.5} fill={C.lavender} /> : null}
            <SvgText
              x={x}
              y={base + 18}
              fill={i === last ? C.text : C.secondary}
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

type Action = { key: string; icon: IconName; tint: string; title: string; sub?: string; onPress?: () => void };

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
      tint: C.coral,
      title: 'Watch Your Next Cycle',
      sub: on ? 'Watching. It will show here when your next cycle ends.' : undefined,
      onPress: on ? undefined : () => setWatching('nextCycle', true),
    });
  }
  if (brief.recommendation) {
    actions.push({
      key: 'walk',
      icon: 'sun',
      tint: C.green,
      title: brief.walkPlanned ? 'Walk Planned for Today' : 'Try a Short Walk Today',
      sub: brief.walkPlanned ? 'The next few days will show how it goes.' : 'Only if it feels appropriate.',
      onPress: brief.walkPlanned ? undefined : () => accept('walk'),
    });
  }
  actions.push(
    { key: 'describe', icon: 'chat', tint: C.indigo, title: 'Describe What Changed', onPress: describe },
    { key: 'prepare', icon: 'calendarPlus', tint: C.green, title: 'Prepare for an Appointment', onPress: go('healthrecords') },
    { key: 'evidence', icon: 'doc', tint: C.blue, title: 'View the Evidence', onPress: evidence(brief.lead?.id) },
  );

  return (
    <ScrollView style={t.fill} contentContainerStyle={t.body}>
      <View style={t.hero} pointerEvents="none">
        <Image source={images.horizon} style={t.heroImg} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.bg} stopOpacity={0.5} />
              <Stop offset="1" stopColor={C.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>

      <LargeTitle eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} />

      <View style={t.pad}>
        <Text style={[font('body'), { color: C.secondary, marginTop: 12 }]}>
          {displayCopy(person ? `${greeting(now)}, ${person.firstName}.` : `${greeting(now)}.`)}
        </Text>
        <Text style={[font('title1'), { color: C.text, marginTop: 4 }]}>{displayCopy(today.headline)}</Text>
        <Text style={[font('footnote', 'semibold'), t.kicker]}>{today.kicker}</Text>

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
                <Text style={[font('footnote'), { color: C.secondary }]}>Cycle length, days</Text>
                <View style={t.fromTo}>
                  <Text style={[numeral(28), { color: C.secondary }]}>{first.length}</Text>
                  <Icon name="arrowRight" size={16} color={C.secondary} weight={2} />
                  <Text style={[numeral(28), { color: C.coral }]}>{latest.length}</Text>
                </View>
                {sleepFrom && sleepTo ? (
                  <>
                    <Text style={[font('footnote'), { color: C.secondary, marginTop: 14 }]}>Sleep, final week</Text>
                    <View style={t.fromTo}>
                      <Text style={[numeral(17), { color: C.secondary }]}>{sleepFrom}</Text>
                      <Icon name="arrowRight" size={14} color={C.secondary} weight={2} />
                      <Text style={[numeral(17), { color: C.lavender }]}>{sleepTo}</Text>
                    </View>
                  </>
                ) : null}
              </View>
              <TrendChart points={points} />
            </Pressable>
            <View style={t.divider} />
          </>
        ) : null}
        <Text style={[font('body'), t.brief]}>{displayCopy(brief.text)}</Text>
        </View>

        <ListGroup style={{ marginTop: 12 }}>
          {actions.map((a, n) => (
            <ListRow key={a.key} first={n === 0} icon={a.icon} tint={a.tint} title={a.title} sub={a.sub} onPress={a.onPress} />
          ))}
        </ListGroup>

        <ListGroup header="Worth Doing Next" style={t.section}>
          <ListRow
            first
            icon="plus"
            tint={C.coral}
            title="Log Cycle Experience"
            sub="Bleeding, pain, symptoms, and what was going on."
            onPress={() => {
              startDraft();
              nav.push('cycleLog');
            }}
          />
          <ListRow icon="journey" tint={C.lavender} title="Movement" sub="Activity against your usual, and what it lines up with." onPress={go('movement')} />
          <ListRow icon="bars" tint={C.coral} title="Track Next Cycle" sub="Keep an eye on cycle timing and sleep." onPress={go('cycle')} />
          <ListRow icon="notebook" tint={C.indigo} title="Add a Note" sub="Write down what you're noticing." onPress={go('journal')} />
        </ListGroup>
      </View>
    </ScrollView>
  );
}

const t = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: 32 },
  pad: { paddingHorizontal: GUTTER },
  pressed: { opacity: 0.55 },
  section: { marginTop: 28 },
  brief: { color: C.text, lineHeight: 26 },

  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  heroImg: { width: '100%', height: '100%', opacity: 0.5 },

  kicker: { color: C.tint, marginTop: 10 },

  card: { marginTop: 24, backgroundColor: C.card, borderRadius: RADIUS, padding: 16 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: -8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginVertical: 16 },
  trendLeft: { width: 136 },
  fromTo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
