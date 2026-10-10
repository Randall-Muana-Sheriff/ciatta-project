import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { type CyclePoint, cycleTrend, fmtHours } from '../lib/engine';
import { type Screen, useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData } from '../state/session';
import { font, fonts, GUTTER } from '../theme';
import { ActionTile, BentoRow, Eyebrow, Figure, Masthead, Tile } from '../ui/bento';
import { L, LA } from '../ui/light';
import type { IconName } from '../ui/icons';

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
        <Rect x={xs[last] - 18} y={0} width={36} height={base} rx={6} fill={L.ink} opacity={0.05} />
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

  const dateLine = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={t.fill} contentContainerStyle={t.body}>
      {/*
        Editorial header rather than a photograph. The hero image was the
        darkest thing on the screen and said nothing; the date and the
        greeting say where she is and who is being spoken to, which is what
        a masthead is for.
      */}
      <Masthead
        eyebrow={dateLine}
        title={displayCopy(today.headline)}
        sub={displayCopy(person ? `${greeting(now)}, ${person.firstName}.` : `${greeting(now)}.`)}
      />

      <View style={t.pad}>
        {/*
          One tile is the point of the screen and it is the brief: the
          sentence written from whatever ranks highest today. Inked, so
          nothing else on the page competes with it, and only ever one.
        */}
        <Tile span={2} emphasis>
          <Text style={[font('caption1'), t.leadEyebrow]}>{today.kicker.toUpperCase()}</Text>
          <Text style={[font('body'), t.leadText]}>{displayCopy(brief.text)}</Text>
        </Tile>

        {points.length >= 2 ? (
          <>
            {/*
              The two figures side by side, then the chart under them. A
              figure she can read at a glance and a shape she can read at a
              look are different jobs, and the old card made one object of
              both.
            */}
            <BentoRow>
              <Tile
                onPress={go('cycle')}
                accessibilityLabel={`Cycle length went from ${first.length} to ${latest.length} days. Opens Cycle.`}
              >
                <Figure
                  label="Cycle length"
                  value={`${first.length} to ${latest.length}`}
                  note="days, first to latest"
                  tint={LA.reported}
                />
              </Tile>
              {sleepFrom && sleepTo ? (
                <Tile onPress={go('cycle')} accessibilityLabel={`Sleep in the final week went from ${sleepFrom} to ${sleepTo}. Opens Cycle.`}>
                  <Figure label="Sleep, final week" value={`${sleepFrom} to ${sleepTo}`} note="hours" tint={LA.measured} />
                </Tile>
              ) : (
                <Tile>
                  <Figure label="Sleep, final week" value="Not recorded" note="no nights measured yet" />
                </Tile>
              )}
            </BentoRow>

            <BentoRow>
              <Tile span={2} onPress={go('cycle')} accessibilityLabel="Cycle length and sleep over recent cycles. Opens Cycle.">
                <Text style={[font('footnote'), t.chartLabel]}>Recent cycles</Text>
                <View style={t.chartWrap}>
                  <TrendChart points={points} />
                </View>
              </Tile>
            </BentoRow>
          </>
        ) : null}

        {/*
          What today suggests doing, as tiles rather than a settings list.
          Two to a row, and an odd one takes the full width rather than
          leaving a hole: a bento with a gap in it reads as broken.
        */}
        {actions.length ? (
          <View style={t.section}>
            <Eyebrow>Today</Eyebrow>
            {pairs(actions).map((pair, n) => (
              <BentoRow key={n}>
                {pair.map((a) => (
                  <ActionTile
                    key={a.key}
                    icon={a.icon}
                    title={a.title}
                    sub={a.sub}
                    span={pair.length === 1 ? 2 : 1}
                    onPress={a.onPress}
                  />
                ))}
              </BentoRow>
            ))}
          </View>
        ) : null}

        <View style={t.section}>
          <Eyebrow>Worth doing next</Eyebrow>
          <BentoRow>
            <ActionTile
              icon="plus"
              title="Log cycle experience"
              sub="Bleeding, pain, symptoms, and what was going on."
              onPress={() => {
                startDraft();
                nav.push('cycleLog');
              }}
            />
            <ActionTile
              icon="journey"
              title="Movement"
              sub="Activity against your usual, and what it lines up with."
              onPress={go('movement')}
            />
          </BentoRow>
          <BentoRow>
            <ActionTile icon="bars" title="Track next cycle" sub="Cycle timing and sleep." onPress={go('cycle')} />
            <ActionTile icon="notebook" title="Add a note" sub="Write down what you are noticing." onPress={go('journal')} />
          </BentoRow>
        </View>
      </View>
    </ScrollView>
  );
}

// Two to a row, with any odd one left on its own to take the full width.
function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

const t = StyleSheet.create({
  fill: { flex: 1, backgroundColor: L.bg },
  body: { paddingBottom: 40 },
  pad: { paddingHorizontal: GUTTER },
  section: { marginTop: 30 },

  // The one inked tile. Its eyebrow is the kicker, which was a tinted line
  // floating under the headline and is now the label of the thing it
  // belongs to.
  leadEyebrow: { color: 'rgba(255,255,255,0.6)', letterSpacing: 1.1 },
  leadText: { color: '#FFFFFF', lineHeight: 25, marginTop: 6 },

  chartLabel: { color: L.muted },
  chartWrap: { alignItems: 'center', marginTop: 4 },
  chart: { width: '100%', aspectRatio: 190 / 150 },
});
