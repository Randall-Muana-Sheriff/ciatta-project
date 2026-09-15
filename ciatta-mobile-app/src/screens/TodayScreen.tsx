import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { person, today } from '../data/sample';
import { dailyBrief } from '../lib/cyclePatterns';
import { displayCopy } from '../lib/displayCopy';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { C, font, fonts, GUTTER, numeral, RADIUS } from '../theme';
import { LargeTitle, ListGroup, ListRow, Panel, PanelTitle } from '../ui/chrome';
import { Icon } from '../ui/icons';
import { images } from '../ui/images';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Cycle length and sleep over the last four months, current month shaded.
function TrendChart() {
  const W = 190;
  const H = 150;
  const base = 122;
  const xs = [26, 72, 118, 164];
  const cy = (v: number) => 24 + (29 - v) * 13;
  const sy = (h: number) => 76 + (7.08 - h) * 28;
  const line = (ys: number[]) => ys.map((y, i) => `${i ? 'L' : 'M'}${xs[i]},${y}`).join(' ');
  const cys = today.cycleDays.map(cy);
  const sys = today.sleepHours.map(sy);
  const last = xs.length - 1;
  const label = { fontSize: 11, textAnchor: 'middle' } as const;

  return (
    <View style={t.chart} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Rect x={xs[last] - 18} y={0} width={36} height={base} rx={4} fill={C.white} opacity={0.06} />
        <Line x1={4} y1={base} x2={W} y2={base} stroke={C.separator} />
        <Path d={line(cys)} stroke={C.coral} strokeWidth={2} fill="none" />
        <Path d={line(sys)} stroke={C.lavender} strokeWidth={2} fill="none" />
        {xs.map((x, i) => (
          <G key={i}>
            <Circle cx={x} cy={cys[i]} r={3.5} fill={C.coral} />
            <SvgText x={x} y={cys[i] - 9} fill={i === last ? C.coral : C.secondary} fontFamily={fonts.regular} {...label}>
              {today.cycleDays[i]}
            </SvgText>
            <Circle cx={x} cy={sys[i]} r={3.5} fill={C.lavender} />
            <SvgText
              x={x}
              y={base + 18}
              fill={i === last ? C.text : C.secondary}
              fontFamily={i === last ? fonts.semibold : fonts.regular}
              {...label}
            >
              {today.months[i]}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

export function TodayScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();
  const { observations } = useCycleInsights();
  const go = (screen: Screen) => () => nav.push(screen);
  const logCycle = (focusNote = false) => () => {
    startDraft({ form: { kinds: ['Pain'] }, focusNote });
    nav.push('cycleLog');
  };
  const now = new Date();
  // The longest running change leads; other patterns live on Cycle.
  const noticed = observations.find((o) => o.id === 'duration') ?? observations[0];

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

      <LargeTitle
        eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        title="Today"
      />

      <View style={t.pad}>
        <Text style={[font('body'), { color: C.secondary, marginTop: 12 }]}>
          {greeting(now)}, {person.firstName}.
        </Text>
        <Text style={[font('title1'), { color: C.text, marginTop: 4 }]}>{displayCopy(today.headline)}</Text>
        <View style={t.kicker}>
          <Icon name="sparkle" size={15} color={C.tint} weight={1.8} />
          <Text style={[font('footnote', 'semibold'), { color: C.tint }]}>{today.kicker}</Text>
        </View>

        <Pressable
          onPress={go('cycle')}
          accessibilityRole="button"
          accessibilityLabel={`Cycle length went from ${today.cycle.from} to ${today.cycle.to} days. Sleep went from ${today.sleep.from} to ${today.sleep.to}. Opens Cycle.`}
          style={({ pressed }) => [t.trend, pressed && t.pressed]}
        >
          <View style={t.trendLeft}>
            <Text style={[font('footnote'), { color: C.secondary }]}>Cycle length, days</Text>
            <View style={t.fromTo}>
              <Text style={[numeral(28), { color: C.secondary }]}>{today.cycle.from}</Text>
              <Icon name="arrowRight" size={16} color={C.secondary} weight={2} />
              <Text style={[numeral(28), { color: C.coral }]}>{today.cycle.to}</Text>
            </View>
            <Text style={[font('footnote'), { color: C.secondary, marginTop: 14 }]}>Sleep, hours</Text>
            <View style={t.fromTo}>
              <Text style={[numeral(17), { color: C.secondary }]}>{today.sleep.from}</Text>
              <Icon name="arrowRight" size={14} color={C.secondary} weight={2} />
              <Text style={[numeral(17), { color: C.lavender }]}>{today.sleep.to}</Text>
            </View>
          </View>
          <TrendChart />
        </Pressable>

        {/* One daily brief: the finding, then every pattern currently showing. */}
        <Panel style={t.section}>
          <PanelTitle icon="sparkle">Today's Pattern</PanelTitle>
          <Text style={[font('body'), t.brief]}>{displayCopy(dailyBrief(today.brief, observations))}</Text>
        </Panel>

        {noticed ? (
          <View>
            <ListGroup style={{ marginTop: 12 }}>
              <ListRow first icon="clock" tint={C.coral} title="Track Next Episode" onPress={logCycle()} />
              <ListRow icon="calendarPlus" tint={C.green} title="Prepare for an Appointment" onPress={go('healthrecords')} />
              <ListRow icon="chat" tint={C.indigo} title="Describe What Changed" onPress={logCycle(true)} />
              <ListRow icon="doc" tint={C.blue} title="View the Evidence" onPress={go('cycleHistory')} />
            </ListGroup>
          </View>
        ) : null}

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
          <ListRow
            icon="bars"
            tint={C.coral}
            title="Track Next Cycle"
            sub="Keep an eye on cycle timing and sleep."
            onPress={go('cycle')}
          />
          <ListRow
            icon="notebook"
            tint={C.indigo}
            title="Add a Note"
            sub="Write down what you're noticing."
            onPress={go('journal')}
          />
          <ListRow
            icon="calendarPlus"
            tint={C.green}
            title="Prepare for an Appointment"
            sub="Turn this into a clinician summary."
            onPress={go('healthrecords')}
          />
          <ListRow
            icon="doc"
            tint={C.blue}
            title="View the Evidence"
            sub="The data, sources, and reasoning behind this insight."
            onPress={go('insight')}
          />
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

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },

  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: C.card,
    borderRadius: RADIUS,
    padding: 16,
    paddingRight: 8,
  },
  trendLeft: { width: 136 },
  fromTo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chart: { flex: 1, aspectRatio: 190 / 150 },
});
