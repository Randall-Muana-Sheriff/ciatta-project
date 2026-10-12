import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type Data, journeyAxis } from '../data/adapter';
import type { Day } from '../data/daily';
import { addDays, shortDate } from '../data/cycleLog';
import { countedWindows, type CycleWindow, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { monthSummary, type Signal } from '../lib/cyclePatterns';
import type { Ovulation } from '../lib/fertility';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useData } from '../state/session';
import { C, font, fonts, GUTTER, RADIUS } from '../theme';
import { NAV_CLEARANCE } from '../ui/surface';
import { sleepPoints, sleepScale, symptomPlacement, symptomPoints } from '../lib/journeyLanes';
import { type Axis, axisFor, emptyFor, posIn, type Scale, SCALES } from '../lib/timeAxis';
import { LargeTitle, Panel } from '../ui/chrome';
import { Icon, type IconName } from '../ui/icons';
import { ChevronRight, Row, SecondaryButton } from '../ui/kit';

// The window is chosen now, not assumed. Day reads in hours, year in
// months, and every lane positions against whichever is picked rather than
// against a fixed run of months.

type Lane = 'cycle' | 'pain' | 'flare' | 'sleep' | 'symptoms' | 'medications' | 'records' | 'notes';

const LANES: { key: Lane; title: string; sub: string; icon: IconName; color: string; height: number }[] = [
  { key: 'cycle', title: 'Cycle', sub: 'Length, days', icon: 'target', color: C.coral, height: 104 },
  { key: 'pain', title: 'Pain', sub: 'Severity, reported', icon: 'wave', color: C.coral, height: 92 },
  { key: 'flare', title: 'Flare ups', sub: 'You reported', icon: 'flame', color: C.coral, height: 64 },
  { key: 'sleep', title: 'Sleep', sub: 'Total, hours', icon: 'moon', color: C.lavender, height: 108 },
  { key: 'symptoms', title: 'Symptoms', sub: 'Logged', icon: 'triangle', color: C.violet, height: 100 },
  { key: 'medications', title: 'Medications', sub: 'Active', icon: 'pill', color: C.mint, height: 104 },
  { key: 'records', title: 'Records', sub: 'Results', icon: 'doc', color: C.green, height: 96 },
  { key: 'notes', title: 'Notes', sub: 'What you said', icon: 'chat', color: C.indigo, height: 112 },
];

const SIDE = 8;
const LABEL_W = 124;
const NOW = journeyAxis.now;

// The sample lanes carry month positions rather than dates. This turns one
// back into a date so every lane, hers and the example's, is placed by the
// same axis instead of two systems sharing a chart.
function dateAtMonthPos(m: number): Date {
  const i = Math.floor(m);
  const base = journeyAxis.monthDate(i);
  const inMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return new Date(base.getFullYear(), base.getMonth(), 1 + Math.round((m - i) * inMonth));
}

type CyclePoint = { at: Date; days: number; expected?: boolean };

// Each completed cycle sits on the day it ended, at its length. The expected
// point is the current cycle's start plus the usual length, only when timing
// is predictable. Dates rather than month positions, so the axis decides
// what is in view rather than this function assuming seven months.
function cycleLane(windows: CycleWindow[], current: CycleWindow | null, usual: number | null): CyclePoint[] {
  const points: CyclePoint[] = windows
    .filter((w) => w.end && w.length != null)
    .map((w) => ({ at: w.end as Date, days: w.length as number }));
  if (current && usual != null) points.push({ at: addDays(current.start, usual), days: usual, expected: true });
  return points;
}

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

function Label({
  x,
  y,
  color = C.secondary,
  opacity = 1,
  children,
}: {
  x: number;
  y: number;
  color?: string;
  opacity?: number;
  children: string | number;
}) {
  return (
    <SvgText x={x} y={y} fill={color} opacity={opacity} fontSize={11} fontFamily={fonts.regular} textAnchor="middle">
      {children}
    </SvgText>
  );
}

function Glow({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={10} fill={color} opacity={0.25} />
      <Circle cx={x} cy={y} r={5} fill={C.bg} stroke={color} strokeWidth={2.5} />
    </G>
  );
}

// Cycle, pain and flare ups come from her episodes. The other lanes are drawn
// from the sample journey, so they stay empty without it.
function LaneMarks({
  lane,
  x,
  axisFrom,
  axisTo,
  signals,
  cycle,
  days,
  journey,
  plotW,
}: {
  lane: Lane;
  x: (at: Date) => number | null;
  axisFrom: Date;
  axisTo: Date;
  signals: Signal[];
  cycle: CyclePoint[];
  days: readonly Day[];
  journey: Data['journey'];
  plotW: number;
}) {
  // Where a month position lands, or null when it is outside the window.
  const at = (m: number) => x(dateAtMonthPos(m));

  // A span that starts before the window or ends after it still happened
  // during it. Clamping draws the part that is in view, where filtering on
  // both ends would hide a medication she has taken all year from every
  // view shorter than a year.
  const span = (fromM: number, toM: number): [number, number] | null => {
    const a = dateAtMonthPos(fromM);
    const b = dateAtMonthPos(toM);
    const pa = x(a);
    const pb = x(b);
    if (pa == null && pb == null) {
      // Both ends outside: in view only if the span brackets the window.
      if (!(a <= axisFrom && b >= axisTo)) return null;
      return [0, plotW];
    }
    return [pa ?? 0, pb ?? plotW];
  };
  // eslint-disable-next-line prefer-const
  switch (lane) {
    case 'cycle': {
      // Only the cycles in view. A point outside the window used to be
      // placed at a sentinel off the canvas, which drew the path out to
      // the left and back again across the whole lane.
      cycle = cycle.filter((c) => x(c.at) != null);
      if (cycle.length === 0) return null;
      // Filtered above, so every point here has a position. Asserted once
      // rather than each call site falling back to a sentinel that can
      // never be reached and reads as though it can.
      const px = (c: CyclePoint) => x(c.at) as number;
      // Lengths fill the lane, longer cycles higher.
      const all = cycle.map((c) => c.days);
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      const y = (v: number) => (hi === lo ? 52 : 26 + ((hi - v) / (hi - lo)) * 52);
      const past = cycle.filter((c) => !c.expected);
      const next = cycle.find((c) => c.expected);
      const nowPt = past[past.length - 1];
      return (
        <G>
          <Path
            d={past.map((c, i) => `${i ? 'L' : 'M'}${px(c)},${y(c.days)}`).join(' ')}
            stroke={C.coral}
            strokeWidth={2}
            fill="none"
          />
          {next && nowPt ? (
            <G>
              <Line x1={px(nowPt)} y1={y(nowPt.days)} x2={px(next)} y2={y(next.days)} stroke={C.gray} strokeDasharray="2 3" />
              <Circle cx={px(next)} cy={y(next.days)} r={3} fill={C.gray} />
              <Label x={px(next)} y={y(next.days) - 12} opacity={0.7}>
                {next.days}
              </Label>
            </G>
          ) : null}
          {past.map((c, i) =>
            c === nowPt ? (
              <Glow key={i} x={px(c)} y={y(c.days)} color={C.coral} />
            ) : (
              <Circle key={i} cx={px(c)} cy={y(c.days)} r={3.5} fill={C.coral} />
            ),
          )}
          {past.map((c, i) => (
            <Label key={`t${i}`} x={px(c)} y={y(c.days) - 13} color={c === nowPt ? C.coral : C.text}>
              {c.days}
            </Label>
          ))}
        </G>
      );
    }
    case 'pain':
      // Higher and stronger dots are more severe episodes.
      return (
        <G>
          {signals
            .filter((s) => s.pain && s.episode.severity != null && x(s.date) != null)
            .map((s) => {
              const sev = s.episode.severity!;
              return (
                <Circle
                  key={s.episode.id}
                  cx={x(s.date) as number}
                  cy={76 - sev * 5.5}
                  r={3 + sev * 0.25}
                  fill={C.coral}
                  opacity={0.55 + sev * 0.045}
                />
              );
            })}
        </G>
      );
    case 'flare':
      return (
        <G>
          {signals
            .filter((s) => s.episode.flareUpUserReported && x(s.date) != null)
            .map((s) => {
              const cx = x(s.date) as number;
              return (
                <Rect
                  key={s.episode.id}
                  x={cx - 5}
                  y={26}
                  width={10}
                  height={10}
                  rx={2}
                  fill={C.coral}
                  transform={`rotate(45 ${cx} 31)`}
                />
              );
            })}
        </G>
      );
    case 'sleep': {
      // Her own nights, placed by date. This lane used to come from
      // sample.journey, which positions points by month index on a seven
      // month strip, so in real mode it drew nothing at all.
      const pts = sleepPoints(days);
      if (!pts.length) return null;
      const y = sleepScale(pts, 96);
      // One label per point is unreadable at a month or a year. The last
      // night in view gets the number; the rest carry the shape.
      const lastIn = [...pts].reverse().find((pt) => x(pt.at) != null);
      return (
        <G>
          {pts.map((pt, i) => {
            const cx = x(pt.at);
            if (cx == null) return null;
            const top = y(pt.hours);
            return (
              <G key={i}>
                {/* The bar is 6 wide, so it is offset by half to sit on
                    its point. */}
                <Rect x={cx - 3} y={top} width={6} height={Math.max(2, 96 - top)} rx={3} fill={C.lavender} />
                {pt === lastIn ? (
                  <Label x={cx} y={112} color={C.text}>
                    {pt.label.replace(' ', '')}
                  </Label>
                ) : null}
              </G>
            );
          })}
        </G>
      );
    }
    case 'symptoms': {
      // Every log she made, at the severity she gave it. Not averaged per
      // day: a mean would flatten a nine and a four into two sixes.
      const pts = symptomPoints(signals);
      if (!pts.length) return null;
      return (
        <G>
          {pts.map((pt, i) => {
            const cx = x(pt.at);
            if (cx == null) return null;
            const place = symptomPlacement(pt, 88);
            return <Circle key={i} cx={cx} cy={place.y} r={place.r} fill={C.violet} />;
          })}
        </G>
      );
    }
    case 'medications':
      if (!journey) return null;
      return (
        <G>
          {journey.medications.map((med) => {
            const color = med.tone === 'mint' ? C.mint : C.lavender;
            // Clamped rather than filtered: a medication taken all year is
            // in view in every window, even when neither of its ends is.
            const line = span(med.from, med.to);
            if (!line) return null;
            const [x1, x2] = line;
            const fromIn = at(med.from);
            const toIn = at(med.to);
            const ongoing = med.ongoing == null ? null : span(med.to, med.ongoing);
            const labelX = at(med.labelAt);
            return (
              <G key={med.name}>
                <Line x1={x1} y1={med.y} x2={x2} y2={med.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
                {/* The end caps are only drawn where the end itself is in
                    view, so a clamped line does not grow a dot at the edge
                    that reads as the day she started or stopped. */}
                {fromIn != null ? <Circle cx={fromIn} cy={med.y} r={3.5} fill={color} /> : null}
                {toIn != null ? <Circle cx={toIn} cy={med.y} r={3.5} fill={color} /> : null}
                {ongoing ? (
                  <G>
                    <Line x1={ongoing[0]} y1={med.y} x2={ongoing[1]} y2={med.y} stroke={C.gray} strokeDasharray="2 3" />
                    {med.ongoing != null && at(med.ongoing) != null ? (
                      <Circle cx={at(med.ongoing) as number} cy={med.y} r={3} fill={C.gray} />
                    ) : null}
                  </G>
                ) : null}
                {labelX != null ? (
                  <Label x={labelX} y={med.y - 10} color={C.text}>
                    {med.name}
                  </Label>
                ) : null}
              </G>
            );
          })}
        </G>
      );
    case 'records':
      if (!journey) return null;
      return (
        <G>
          {journey.records.map((r) => {
            const cx = at(r.m);
            return cx == null ? null : (
              <G key={r.label}>
                <Circle cx={cx} cy={36} r={3.5} fill={C.green} />
                <Label x={cx} y={60}>
                  {r.label}
                </Label>
              </G>
            );
          })}
        </G>
      );
    case 'notes':
      if (!journey) return null;
      return (
        <G>
          {journey.notes.map((n) => {
            const cx = at(n.m);
            if (cx == null) return null;
            return (
            <G key={n.m}>
              {n.m === NOW ? <Glow x={cx} y={34} color={C.indigo} /> : <Circle cx={cx} cy={34} r={3.5} fill={C.lavender} />}
              {n.lines.map((line, k) => (
                <Label key={line} x={cx} y={60 + k * 15}>
                  {line}
                </Label>
              ))}
            </G>
            );
          })}
        </G>
      );
  }
}

const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' });

// What a month looked like, next to the month before it.
function MonthDetail({
  index,
  signals,
  windows,
  ovulations,
  journey,
}: {
  index: number;
  signals: Signal[];
  windows: CycleWindow[];
  ovulations: Ovulation[] | null;
  journey: Data['journey'];
}) {
  const d = journeyAxis.monthDate(index);
  const prev = journeyAxis.monthDate(index - 1);
  const ms = monthSummary(signals, d.getFullYear(), d.getMonth());
  const before = monthSummary(signals, prev.getFullYear(), prev.getMonth());
  const ended = windows.filter((w) => w.end && w.length != null && sameMonth(w.end, d)).map((w) => w.length!);
  const sleep = journey?.sleep.find((s) => s.label && Math.round(s.m) === index);
  const change =
    ms.maxSeverity != null && before.maxSeverity != null && ms.maxSeverity !== before.maxSeverity
      ? `, ${ms.maxSeverity > before.maxSeverity ? 'up' : 'down'} from ${before.maxSeverity}/10`
      : '';
  const ov = ovulations?.find((o) => o.date.getFullYear() === d.getFullYear() && o.date.getMonth() === d.getMonth());

  return (
    <Panel style={j.detail}>
      <Text style={[font('headline'), { color: C.text }]}>
        {monthName(d)} {d.getFullYear()}
      </Text>
      <Text style={[font('footnote'), { color: C.secondary, marginBottom: 4 }]}>Tap a month above to compare.</Text>
      <Row first title="Cycle" value={ended.length ? `${ended.join(' and ')} days` : 'No cycle ended'} />
      <Row title="Pain" value={ms.locations.length ? ms.locations.join(' · ') : 'None logged'} />
      <Row title="Severity" value={ms.maxSeverity != null ? `${ms.maxSeverity}/10${change}` : 'None logged'} />
      <Row title="Flare up" value={ms.flares ? `Yes, user reported (${ms.flares})` : 'None reported'} />
      {ms.bowel ? (
        <Row title="Bowel movements" value={`${ms.bowel} logged${ms.bowelPain ? `, ${ms.bowelPain} with pain` : ''}`} />
      ) : null}
      {ovulations ? (
        <Row
          title="Ovulation"
          value={ov ? `${ov.source === 'temperature' ? 'Confirmed by temperature' : 'Positive test'}, around ${shortDate(ov.date)}` : 'Not confirmed'}
        />
      ) : null}
      <Row title="Sleep" value={sleep?.label ?? 'No data'} />
      <Row title="Stress" value={ms.stress ? `Noted in ${ms.stress} ${ms.stress === 1 ? 'episode' : 'episodes'}` : 'Not logged'} />
    </Panel>
  );
}

export function JourneyScreen() {
  const nav = useNav();
  const { startDraft } = useCycle();
  const { signals, fertility, windows, lens, profile } = useCycleInsights();
  const { journey, days } = useData();
  const { width } = useWindowDimensions();
  const current = windows[windows.length - 1] ?? null;
  const cycle = cycleLane(windows, current, lens.predicts ? medianLength(countedWindows(windows, profile)) : null);
  // Opens on the day. A year is the view she arrives at last, not first:
  // the question on opening Journey is what today has looked like, and the
  // dropdown is right there for the longer windows.
  const [scale, setScale] = useState<Scale>('day');
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Lane[]>([]);

  const axis = useMemo(() => axisFor(scale, new Date()), [scale]);

  // The plot gets the width its scale needs rather than the width the
  // screen happens to have. Twenty four hours squeezed into 230 points is
  // a chart nobody can read, so a slot has a floor and the whole thing
  // scrolls sideways when the sum is wider than the phone.
  const SLOT_MIN: Record<Scale, number> = { day: 46, week: 62, month: 40, year: 74 };
  const visibleW = width - SIDE * 2 - LABEL_W;
  const plotW = Math.max(visibleW, axis.slots * SLOT_MIN[scale]);

  // Where the plot opens. Now at the right hand edge, with one slot of air
  // after it so the current hour is not flush against the frame.
  const openAt = useMemo(() => {
    const furthest = Math.max(0, plotW - visibleW);
    if (scale !== 'day') return furthest;
    const nowAt = posIn(axis, new Date());
    if (nowAt == null) return furthest;
    return Math.min(furthest, Math.max(0, nowAt * plotW - visibleW + SLOT_MIN.day));
    // SLOT_MIN is a literal in this component and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis, scale, plotW, visibleW]);

  // Every lane places its marks through this, so a mark outside the window
  // is not drawn rather than being pinned to an edge it did not happen at.
  const x = (at: Date): number | null => {
    const p = posIn(axis, at);
    return p == null ? null : p * plotW;
  };

  const shownLanes = LANES.filter((l) => !hidden.includes(l.key));

  // Whether anything at all falls in the window, so the chart can say it
  // is empty instead of showing a grid with nothing on it.
  const nothingInView =
    cycle.every((c) => posIn(axis, c.at) == null) &&
    signals.every((sg) => posIn(axis, sg.date) == null) &&
    !journey;

  const toggle = (lane: Lane) =>
    setHidden((h) => (h.includes(lane) ? h.filter((l) => l !== lane) : [...h, lane]));

  return (
    <ScrollView style={j.fill} contentContainerStyle={j.body}>
      <LargeTitle title="Journey" />

      <View style={j.pad}>
        <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>
          Your cycle, pain, sleep, symptoms, medications, results, and notes on one timeline.
        </Text>
        {/*
          The window, as a dropdown rather than four fixed spans. Day reads
          in hours and year in months, and the axis under the lanes is built
          from whichever is chosen.
        */}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`View by ${SCALES.find((v) => v.key === scale)?.label}`}
          style={j.picker}
        >
          <Text style={[font('subhead', 'semibold'), { color: C.text }]}>
            View by {SCALES.find((v) => v.key === scale)?.label}
          </Text>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={C.secondary} />
        </Pressable>
        {open ? (
          <View style={j.pickerMenu}>
            {SCALES.map((v) => (
              <Pressable
                key={v.key}
                onPress={() => {
                  setScale(v.key);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: v.key === scale }}
                style={j.pickerItem}
              >
                <Text style={[font('subhead', v.key === scale ? 'semibold' : 'regular'), { color: C.text }]}>{v.label}</Text>
                {v.key === scale ? <Icon name="check" size={16} color={C.text} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={j.grid}>
        {/* The axis, built from the chosen window rather than a fixed run
            of months. Labels sit where the axis puts them. */}
        <View style={j.chartRow}>
          {/*
            The labels are a column of their own rather than the first cell
            of each lane, so they stay put while the plot scrolls. A lane
            whose name has scrolled off is a row of dots.
          */}
          <View style={j.labelCol}>
            <View style={j.axisSpacer} />
            {shownLanes.map((lane) => (
              <View key={lane.key} style={[j.laneLabel, { height: lane.height }]}>
                <Icon name={lane.icon} size={18} color={lane.color} weight={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={[font('subhead', 'semibold'), { color: C.text }]} numberOfLines={1}>
                    {lane.title}
                  </Text>
                  <Text style={[font('caption1'), { color: C.secondary }]} numberOfLines={1}>
                    {lane.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Wider than the phone at most scales, so she lands on now.
            //
            // Week, month and year end today, so their right hand edge is
            // now and landing there is landing on it. A day does not: it
            // runs midnight to midnight, so its right hand edge is tonight,
            // and opening there showed her the empty hours she has not
            // lived yet. The day scrolls to the current hour instead.
            contentOffset={{ x: openAt, y: 0 }}
          >
            <View style={{ width: plotW }}>
              <View style={[j.axisSpacer, j.axisRow]}>
                {axis.ticks.map((tick) => (
                  <Text
                    key={`${tick.label}-${tick.at}`}
                    style={[
                      font('caption1'),
                      j.axisLabel,
                      { left: tick.at * plotW - 24 },
                    ]}
                    numberOfLines={1}
                  >
                    {tick.label}
                  </Text>
                ))}
              </View>

              {shownLanes.map((lane) => (
                <View key={lane.key} style={[j.lanePlot, { height: lane.height }]}>
                  <Svg width={plotW} height={lane.height}>
                    {/* One rule per axis label, so the grid matches what is
                        written under it at any scale. */}
                    {axis.ticks.map((tick) => (
                      <Line
                        key={`${tick.label}-${tick.at}`}
                        x1={tick.at * plotW}
                        y1={0}
                        x2={tick.at * plotW}
                        y2={lane.height}
                        stroke={C.text}
                        opacity={0.07}
                      />
                    ))}
                    <LaneMarks
                      lane={lane.key}
                      x={x}
                      axisFrom={axis.from}
                      axisTo={axis.to}
                      signals={signals}
                      cycle={cycle}
                      days={days}
                      journey={journey}
                      plotW={plotW}
                    />
                  </Svg>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/*
          An empty window says which window it is. "Nothing yet" and
          "nothing this week" are different facts, and the second is not
          discouraging.
        */}
        {nothingInView ? <Text style={[font('subhead'), j.empty]}>{emptyFor(scale)}</Text> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={j.legend}>
        {LANES.map((lane) => {
          const on = !hidden.includes(lane.key);
          return (
            <Pressable
              key={lane.key}
              onPress={() => toggle(lane.key)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Show ${lane.title}`}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[j.chip, !on && j.chipOff]}
            >
              <View style={[j.chipDot, { backgroundColor: on ? lane.color : C.tertiary }]} />
              <Text style={[font('footnote', 'medium'), { color: on ? C.text : C.secondary }]}>{lane.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={j.pad}>
        {/*
          The detail below the chart stays on the current month. Picking a
          month by tapping its label went with the month axis, and a day or
          a week does not have a month to pick.
        */}
        <MonthDetail
          index={NOW}
          signals={signals}
          windows={windows}
          ovulations={fertility.show ? fertility.past : null}
          journey={journey}
        />

        {journey ? (
          <Pressable onPress={() => nav.push('insight')} accessibilityRole="button" style={({ pressed }) => pressed && j.pressed}>
            <Panel style={j.insight}>
              <Icon name="sparkle" size={24} color={C.tint} weight={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={[font('footnote', 'semibold'), { color: C.tint }]}>
                  Something changed in {monthName(journeyAxis.monthDate(NOW))}
                </Text>
                <Text style={[font('headline'), { color: C.text, marginTop: 2 }]}>{displayCopy(journey.insight.headline)}</Text>
                <Text style={[font('subhead'), { color: C.secondary, marginTop: 2 }]}>See what happened during this time.</Text>
              </View>
              <ChevronRight />
            </Panel>
          </Pressable>
        ) : null}

        <View style={{ marginTop: 16, gap: 12 }}>
          <SecondaryButton
            label="Log Cycle Experience"
            onPress={() => {
              startDraft();
              nav.push('cycleLog');
            }}
          />
          <SecondaryButton label="Show Key Insights" onPress={() => nav.push('insight')} />
        </View>
      </View>
    </ScrollView>
  );
}

const j = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
  pressed: { opacity: 0.55 },

  grid: { marginTop: 12, paddingHorizontal: SIDE },
  now: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.coral, opacity: 0.1, borderRadius: 8 },
  monthRow: { flexDirection: 'row', paddingBottom: 8 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderSub,
  },
  pickerMenu: {
    marginTop: 6,
    borderRadius: RADIUS,
    backgroundColor: C.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderSub,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  pickedRule: { height: 2, width: 18, borderRadius: 1, marginTop: 3, backgroundColor: 'transparent' },
  chartRow: { flexDirection: 'row' },
  labelCol: { width: LABEL_W },
  axisSpacer: { height: 26 },
  axisRow: { position: 'relative' },
  axisLabel: { color: C.secondary, position: 'absolute', top: 6, width: 48, textAlign: 'center' },
  laneLabel: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 12,
    paddingLeft: 8,
    paddingRight: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
  lanePlot: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  empty: { color: C.secondary, paddingHorizontal: 8, paddingTop: 16 },

  legend: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: C.fill,
  },
  chipOff: { backgroundColor: C.card },
  chipDot: { width: 10, height: 10, borderRadius: 5 },

  detail: { marginBottom: 16 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS },
});
