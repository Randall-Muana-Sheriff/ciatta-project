import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type Data, journeyAxis } from '../data/adapter';
import { addDays, shortDate } from '../data/cycleLog';
import { countedWindows, type CycleWindow, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { monthSummary, type Signal } from '../lib/cyclePatterns';
import type { Ovulation } from '../lib/fertility';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useData } from '../state/session';
import { C, font, fonts, GUTTER, RADIUS } from '../theme';
import { NAV_CLEARANCE } from '../ui/light';
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
  signals,
  cycle,
  journey,
}: {
  lane: Lane;
  x: (at: Date) => number | null;
  signals: Signal[];
  cycle: CyclePoint[];
  journey: Data['journey'];
}) {
  switch (lane) {
    case 'cycle': {
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
            d={past.map((c, i) => `${i ? 'L' : 'M'}${x(c.at) ?? -99},${y(c.days)}`).join(' ')}
            stroke={C.coral}
            strokeWidth={2}
            fill="none"
          />
          {next && nowPt ? (
            <G>
              <Line x1={x(nowPt.at) ?? -99} y1={y(nowPt.days)} x2={x(next.at) ?? -99} y2={y(next.days)} stroke={C.gray} strokeDasharray="2 3" />
              <Circle cx={x(next.at) ?? -99} cy={y(next.days)} r={3} fill={C.gray} />
              <Label x={x(next.at) ?? -99} y={y(next.days) - 12} opacity={0.7}>
                {next.days}
              </Label>
            </G>
          ) : null}
          {past.map((c, i) =>
            c === nowPt ? (
              <Glow key={i} x={x(c.at) ?? -99} y={y(c.days)} color={C.coral} />
            ) : (
              <Circle key={i} cx={x(c.at) ?? -99} cy={y(c.days)} r={3.5} fill={C.coral} />
            ),
          )}
          {past.map((c, i) => (
            <Label key={`t${i}`} x={x(c.at) ?? -99} y={y(c.days) - 13} color={c === nowPt ? C.coral : C.text}>
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
            .filter((s) => s.pain && s.episode.severity != null)
            .map((s) => {
              const sev = s.episode.severity!;
              return (
                <Circle
                  key={s.episode.id}
                  cx={x(s.date) ?? -99}
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
            .filter((s) => s.episode.flareUpUserReported)
            .map((s) => {
              const cx = x(s.date) ?? -99;
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
    case 'sleep':
      if (!journey) return null;
      return (
        <G>
          {journey.sleep.map((s, i) => {
            const bar = 12 + (s.hours - 6) * 14;
            return (
              <G key={i}>
                <Rect
                  x={x(dateAtMonthPos(s.m)) ?? -99 - 3}
                  y={56 - bar}
                  width={6}
                  height={bar}
                  rx={3}
                  fill={s.expected ? C.gray : C.lavender}
                  opacity={s.expected ? 0.5 : 1}
                />
                {s.label ? (
                  <Label x={x(dateAtMonthPos(s.m)) ?? -99} y={78} color={C.text}>
                    {s.label.replace(' ', '')}
                  </Label>
                ) : null}
              </G>
            );
          })}
        </G>
      );
    case 'symptoms':
      if (!journey) return null;
      return (
        <G>
          {journey.symptoms.map((s, i) => (
            <Circle key={i} cx={x(dateAtMonthPos(s.m)) ?? -99} cy={s.y} r={3.5} fill={s.expected ? C.gray : C.violet} />
          ))}
        </G>
      );
    case 'medications':
      if (!journey) return null;
      return (
        <G>
          {journey.medications.map((med) => {
            const color = med.tone === 'mint' ? C.mint : C.lavender;
            return (
              <G key={med.name}>
                <Line x1={x(dateAtMonthPos(med.from)) ?? -99} y1={med.y} x2={x(dateAtMonthPos(med.to)) ?? -99} y2={med.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
                <Circle cx={x(dateAtMonthPos(med.from)) ?? -99} cy={med.y} r={3.5} fill={color} />
                <Circle cx={x(dateAtMonthPos(med.to)) ?? -99} cy={med.y} r={3.5} fill={color} />
                {med.ongoing ? (
                  <G>
                    <Line x1={x(dateAtMonthPos(med.to)) ?? -99} y1={med.y} x2={x(dateAtMonthPos(med.ongoing)) ?? -99} y2={med.y} stroke={C.gray} strokeDasharray="2 3" />
                    <Circle cx={x(dateAtMonthPos(med.ongoing)) ?? -99} cy={med.y} r={3} fill={C.gray} />
                  </G>
                ) : null}
                <Label x={x(dateAtMonthPos(med.labelAt)) ?? -99} y={med.y - 10} color={C.text}>
                  {med.name}
                </Label>
              </G>
            );
          })}
        </G>
      );
    case 'records':
      if (!journey) return null;
      return (
        <G>
          {journey.records.map((r) => (
            <G key={r.label}>
              <Circle cx={x(dateAtMonthPos(r.m)) ?? -99} cy={36} r={3.5} fill={C.green} />
              <Label x={x(dateAtMonthPos(r.m)) ?? -99} y={60}>
                {r.label}
              </Label>
            </G>
          ))}
        </G>
      );
    case 'notes':
      if (!journey) return null;
      return (
        <G>
          {journey.notes.map((n) => (
            <G key={n.m}>
              {n.m === NOW ? <Glow x={x(dateAtMonthPos(n.m)) ?? -99} y={34} color={C.indigo} /> : <Circle cx={x(dateAtMonthPos(n.m)) ?? -99} cy={34} r={3.5} fill={C.lavender} />}
              {n.lines.map((line, k) => (
                <Label key={line} x={x(dateAtMonthPos(n.m)) ?? -99} y={60 + k * 15}>
                  {line}
                </Label>
              ))}
            </G>
          ))}
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
  const { journey } = useData();
  const { width } = useWindowDimensions();
  const current = windows[windows.length - 1] ?? null;
  const cycle = cycleLane(windows, current, lens.predicts ? medianLength(countedWindows(windows, profile)) : null);
  const [scale, setScale] = useState<Scale>('year');
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Lane[]>([]);

  const axis = useMemo(() => axisFor(scale, new Date()), [scale]);
  const plotW = width - SIDE * 2 - LABEL_W;

  // Every lane places its marks through this, so a mark outside the window
  // is not drawn rather than being pinned to an edge it did not happen at.
  const x = (at: Date): number | null => {
    const p = posIn(axis, at);
    return p == null ? null : p * plotW;
  };

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
        <View style={[j.monthRow, { marginLeft: SIDE + LABEL_W }]}>
          {axis.ticks.map((tick) => (
            <Text
              key={`${tick.label}-${tick.at}`}
              style={[
                font('caption1'),
                { color: C.secondary, position: 'absolute', left: tick.at * plotW - 18, width: 36, textAlign: 'center' },
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>

        {LANES.filter((l) => !hidden.includes(l.key)).map((lane) => (
          <View key={lane.key} style={[j.lane, { height: lane.height }]}>
            <View style={j.laneLabel}>
              <Icon name={lane.icon} size={18} color={lane.color} weight={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>{lane.title}</Text>
                <Text style={[font('caption1'), { color: C.secondary }]}>{lane.sub}</Text>
              </View>
            </View>
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
              <LaneMarks lane={lane.key} x={x} signals={signals} cycle={cycle} journey={journey} />
            </Svg>
          </View>
        ))}
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
  },
  pickerMenu: { marginTop: 6, borderRadius: RADIUS, backgroundColor: C.card, overflow: 'hidden' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  pickedRule: { height: 2, width: 18, borderRadius: 1, marginTop: 3, backgroundColor: 'transparent' },
  lane: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  laneLabel: { width: LABEL_W, flexDirection: 'row', gap: 6, paddingTop: 12, paddingLeft: 8, paddingRight: 4 },

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
