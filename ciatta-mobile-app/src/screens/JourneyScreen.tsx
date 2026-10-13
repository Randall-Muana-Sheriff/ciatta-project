import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type Data, journeyAxis } from '../data/adapter';
import type { Day } from '../data/daily';
import { addDays, shortDate } from '../data/cycleLog';
import { countedWindows, type CycleWindow, medianLength } from '../lib/cycleModel';
import { displayCopy } from '../lib/displayCopy';
import { monthSummary, type Signal } from '../lib/cyclePatterns';
import type { Ovulation } from '../lib/fertility';
import { useCycleInsights } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { C, font, fonts, GUTTER, RADIUS } from '../theme';
import { NAV_CLEARANCE } from '../ui/surface';
import { fmtHours } from '../lib/engine';
import {
  type Bin,
  binFor,
  cycleGaps,
  drawMarkers,
  flareSpans,
  type LaneKey,
  lanesWithData,
  levelBins,
  painCells,
  periodBlocks,
  severityOpacity,
  SLEEP_GUIDE_HOURS,
  sleepBins,
  symptomGrid,
} from '../lib/journeyVisuals';
import { useNav } from '../navigation';
import { METRIC_HUE } from '../ui/metricHue';
import type { BaselineRow } from '../lib/metricDetail';
import { type Axis, axisFor, emptyFor, posIn, type Scale, SCALES } from '../lib/timeAxis';
import { LargeTitle, Panel } from '../ui/chrome';
import { Icon, type IconName } from '../ui/icons';
import { Row } from '../ui/kit';

// The window is chosen now, not assumed. Day reads in hours, year in
// months, and every lane positions against whichever is picked rather than
// against a fixed run of months.

type Lane = LaneKey;

const SYMPTOM_ROWS = 4;
const ROW_H = 26;
const ROW_TOP = 48;

const LANES: { key: Lane; title: string; sub: string; icon: IconName; color: string; height: number }[] = [
  { key: 'cycle', title: 'Cycle', sub: 'Periods, days between', icon: 'target', color: C.coral, height: 96 },
  { key: 'pain', title: 'Pain', sub: 'Worst each day, 0 to 10', icon: 'bandage', color: C.coral, height: 68 },
  { key: 'flare', title: 'Flare ups', sub: 'Start to end', icon: 'flame', color: C.coral, height: 64 },
  { key: 'sleep', title: 'Sleep', sub: 'Against 7 hours', icon: 'moon', color: C.lavender, height: 150 },
  { key: 'symptoms', title: 'Symptoms', sub: 'Most logged', icon: 'triangle', color: C.violet, height: ROW_TOP + SYMPTOM_ROWS * ROW_H + 12 },
  { key: 'hrv', title: 'HRV', sub: 'Daily, against your usual', icon: 'wave', color: METRIC_HUE.hrv, height: 110 },
  { key: 'heart', title: 'Resting heart rate', sub: 'Daily, against your usual', icon: 'heart', color: METRIC_HUE.bp, height: 110 },
  { key: 'temp', title: 'Skin temperature', sub: 'Above or below usual', icon: 'sun', color: METRIC_HUE.temp, height: 110 },
  { key: 'steps', title: 'Steps', sub: 'Each day', icon: 'bars', color: METRIC_HUE.steps, height: 100 },
  { key: 'medications', title: 'Medications', sub: 'While taken', icon: 'pill', color: C.mint, height: 124 },
  { key: 'records', title: 'Records', sub: 'Lab draws, by range', icon: 'doc', color: C.green, height: 88 },
  { key: 'notes', title: 'Notes', sub: 'In your words', icon: 'chat', color: C.indigo, height: 124 },
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

// "cycle, HRV and heart rate": a list as she would say it.
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

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
    <SvgText x={x} y={y} fill={color} opacity={opacity} fontSize={12} fontFamily={fonts.regular} textAnchor="middle">
      {children}
    </SvgText>
  );
}

// Cycle, pain and flare ups come from her episodes. The other lanes are drawn
// from the sample journey, so they stay empty without it.
function LaneMarks({
  lane,
  x,
  axisFrom,
  axisTo,
  bin,
  signals,
  windows,
  cycle,
  days,
  journey,
  draws,
  plotW,
  height,
  onNote,
  baselines,
}: {
  lane: Lane;
  x: (at: Date) => number | null;
  axisFrom: Date;
  axisTo: Date;
  bin: Bin;
  signals: Signal[];
  windows: CycleWindow[];
  cycle: CyclePoint[];
  days: readonly Day[];
  journey: Data['journey'];
  draws: NonNullable<Data['records']>['draws'];
  plotW: number;
  height: number;
  onNote: () => void;
  baselines: readonly BaselineRow[];
}) {
  // Where a month position lands, or null when it is outside the window.
  const at = (m: number) => x(dateAtMonthPos(m));
  const span0 = axisFrom.getTime();
  const span1 = axisTo.getTime();
  // A stretch of time as two x positions, clamped to the window, or null
  // when none of it is in view. A period that began before the window
  // still shows the part of it that falls inside.
  const stretch = (a: Date, b: Date): [number, number] | null => {
    const s0 = a.getTime();
    const s1 = b.getTime();
    if (s1 <= span0 || s0 >= span1) return null;
    const f = (t: number) => ((Math.min(span1, Math.max(span0, t)) - span0) / (span1 - span0)) * plotW;
    return [f(s0), f(s1)];
  };
  const span = (fromM: number, toM: number) => stretch(dateAtMonthPos(fromM), dateAtMonthPos(toM));

  switch (lane) {
    case 'cycle': {
      // Each period as a block as long as she bled, darker for heavier
      // flow, and the days from one period to the next written between
      // them. A length outside 24 to 38 days is in amber, the colour for
      // ranges.
      const blocks = periodBlocks(signals);
      const gaps = cycleGaps(windows);
      const next = cycle.find((c) => c.expected);
      const nextAt = next ? stretch(next.at, addDays(next.at, 5)) : null;
      const top = 44;
      return (
        <G>
          <Line x1={0} x2={plotW} y1={top + 28} y2={top + 28} stroke={C.text} opacity={0.08} />
          {blocks.map((b, i) => {
            const p = stretch(b.start, b.end);
            if (!p) return null;
            return (
              <Rect
                key={`b${i}`}
                x={p[0]}
                y={top}
                width={Math.max(3, p[1] - p[0] - 1)}
                height={28}
                rx={6}
                fill={C.coral}
                opacity={b.flow == null ? 0.5 : 0.35 + b.flow * 0.16}
              />
            );
          })}
          {nextAt ? (
            <Rect x={nextAt[0]} y={top} width={Math.max(3, nextAt[1] - nextAt[0])} height={28} rx={6} fill="none" stroke={C.gray} strokeDasharray="3 3" />
          ) : null}
          {gaps.map((g, i) => {
            const cx = x(g.mid);
            return cx == null ? null : (
              <Label key={`g${i}`} x={cx} y={30} color={g.outside ? C.amber : C.secondary}>
                {`${g.days}d`}
              </Label>
            );
          })}
        </G>
      );
    }
    case 'pain': {
      // A strip of days, each at her worst rating that day, one colour
      // darker as it rises. A day with no rating is left empty.
      const cells = painCells(signals, bin);
      return (
        <G>
          <Rect x={0} y={14} width={plotW} height={38} rx={6} fill={C.text} opacity={0.04} />
          {cells.map((c, i) => {
            const p = stretch(c.start, c.end);
            return p ? (
              <Rect key={i} x={p[0]} y={14} width={Math.max(3, p[1] - p[0] - 2)} height={38} rx={4} fill={C.coral} opacity={severityOpacity(c.severity)} />
            ) : null;
          })}
        </G>
      );
    }
    case 'flare':
      // From when it started to when it ended. One with no end is a
      // moment, drawn as a diamond rather than given a length.
      return (
        <G>
          {flareSpans(signals).map((f, i) => {
            if (f.until) {
              const p = stretch(f.at, f.until);
              return p ? <Rect key={i} x={p[0]} y={22} width={Math.max(6, p[1] - p[0])} height={20} rx={10} fill={C.coral} /> : null;
            }
            const cx = x(f.at);
            return cx == null ? null : (
              <Rect key={i} x={cx - 8} y={24} width={16} height={16} rx={3} fill={C.coral} transform={`rotate(45 ${cx} 32)`} />
            );
          })}
        </G>
      );
    case 'sleep': {
      // Each night, or each week's average over a year, as a bar up or
      // down from seven hours, the line the AASM and SRS recommend adults
      // sleep at or above. Short nights hang below it.
      const nights = sleepBins(days, bin);
      const guide = height / 2;
      const reach = Math.max(2, ...nights.map((n) => Math.abs(n.hours - SLEEP_GUIDE_HOURS)));
      const y = (h: number) => guide - ((h - SLEEP_GUIDE_HOURS) / reach) * (height / 2 - 14);
      const lastIn = [...nights].reverse().find((n) => stretch(n.start, n.end));
      return (
        <G>
          <Line x1={0} x2={plotW} y1={guide} y2={guide} stroke={C.text} opacity={0.22} strokeDasharray="3 4" />
          <SvgText x={4} y={guide - 4} fill={C.tertiary} fontSize={10} fontFamily={fonts.regular}>
            7h
          </SvgText>
          {nights.map((n, i) => {
            const p = stretch(n.start, n.end);
            if (!p) return null;
            const w = Math.min(18, Math.max(4, (p[1] - p[0]) * 0.6));
            const cx = (p[0] + p[1]) / 2;
            const a = Math.min(guide, y(n.hours));
            const b = Math.max(guide, y(n.hours));
            return (
              <G key={i}>
                <Rect x={cx - w / 2} y={a} width={w} height={Math.max(2, b - a)} rx={w / 2} fill={C.lavender} opacity={n.hours < SLEEP_GUIDE_HOURS ? 0.55 : 1} />
                {n === lastIn ? (
                  <Label x={cx} y={n.hours < SLEEP_GUIDE_HOURS ? b + 13 : a - 5} color={C.text}>
                    {fmtHours(n.hours).replace(' ', '')}
                  </Label>
                ) : null}
              </G>
            );
          })}
        </G>
      );
    }
    case 'symptoms': {
      // A row for each symptom she logs most, a cell for each day (or week
      // over a year) she logged it, darker for higher severity.
      const grid = symptomGrid(signals, bin, SYMPTOM_ROWS);
      return (
        <G>
          {grid.map((row, r) => (
            <G key={row.symptom}>
              <Rect x={0} y={ROW_TOP + r * ROW_H} width={plotW} height={ROW_H - 6} rx={4} fill={C.text} opacity={0.04} />
              {row.cells.map((c, i) => {
                const p = stretch(c.start, c.end);
                return p ? (
                  <Rect key={i} x={p[0]} y={ROW_TOP + r * ROW_H} width={Math.max(3, p[1] - p[0] - 2)} height={ROW_H - 6} rx={4} fill={C.violet} opacity={severityOpacity(c.severity)} />
                ) : null;
              })}
            </G>
          ))}
        </G>
      );
    }
    case 'hrv':
    case 'heart': {
      // A level read against her own usual range, which is shaded when the
      // server has enough history to know it. HRV as a dot per day, since
      // each night is its own reading; resting heart rate as a line, which
      // is how a steady level is followed. Gaps stay gaps.
      const get = lane === 'hrv' ? (d: Day) => d.hrv : (d: Day) => d.restingHR;
      const bins = levelBins(days, get, bin);
      const usual = baselines.find((b) => b.metric === (lane === 'hrv' ? 'hrv' : 'resting_hr') && b.sufficient && b.low != null && b.high != null);
      const color = lane === 'hrv' ? METRIC_HUE.hrv : METRIC_HUE.bp;
      const values = [...bins.map((b) => b.value), ...(usual ? [usual.low!, usual.high!] : [])];
      if (!values.length) return null;
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      const pad = Math.max(1, (hi - lo) * 0.15);
      const y = (v: number) => 14 + (1 - (v - (lo - pad)) / (hi - lo + pad * 2)) * (height - 32);
      const pts = bins
        .map((b) => ({ b, p: stretch(b.start, b.end) }))
        .filter((e): e is { b: (typeof bins)[number]; p: [number, number] } => e.p != null)
        .map(({ b, p }) => ({ x: (p[0] + p[1]) / 2, y: y(b.value), b }));
      const unit = lane === 'hrv' ? 'ms' : 'bpm';
      const last = pts[pts.length - 1];
      // Consecutive bins only, so a line never bridges a gap.
      const step = bin === 'week' ? 7 * 86400000 : 86400000;
      const runs: (typeof pts)[] = [];
      pts.forEach((pt, i) => {
        const prev = pts[i - 1];
        if (!prev || pt.b.start.getTime() - prev.b.start.getTime() > step * 1.5) runs.push([pt]);
        else runs[runs.length - 1].push(pt);
      });
      return (
        <G>
          {usual ? (
            <Rect x={0} y={y(usual.high!)} width={plotW} height={Math.max(2, y(usual.low!) - y(usual.high!))} fill={color} opacity={0.1} />
          ) : null}
          {lane === 'heart'
            ? runs.filter((r) => r.length > 1).map((r, i) => (
                <Path key={i} d={r.map((pt, k) => `${k ? 'L' : 'M'}${pt.x},${pt.y}`).join(' ')} stroke={color} strokeWidth={2.5} fill="none" />
              ))
            : null}
          {pts.map((pt, i) => (
            <Circle key={i} cx={pt.x} cy={pt.y} r={lane === 'hrv' ? 4.5 : 3} fill={color} />
          ))}
          {last ? (
            <Label x={last.x} y={last.y - 10} color={C.text}>
              {`${Math.round(last.b.value)} ${unit}`}
            </Label>
          ) : null}
        </G>
      );
    }
    case 'temp': {
      // Already a difference from her usual, so bars go up or down from a
      // usual line, as a temperature chart across a cycle is read.
      const bins = levelBins(days, (d) => d.tempDeviation, bin);
      const mid = height / 2;
      const reach = Math.max(0.5, ...bins.map((b) => Math.abs(b.value)));
      return (
        <G>
          <Line x1={0} x2={plotW} y1={mid} y2={mid} stroke={C.text} opacity={0.22} strokeDasharray="3 4" />
          <SvgText x={4} y={mid - 4} fill={C.tertiary} fontSize={10} fontFamily={fonts.regular}>
            Usual
          </SvgText>
          {bins.map((b, i) => {
            const p = stretch(b.start, b.end);
            if (!p) return null;
            const w = Math.min(18, Math.max(4, (p[1] - p[0]) * 0.6));
            const cx = (p[0] + p[1]) / 2;
            const tip = mid - (b.value / reach) * (mid - 12);
            return (
              <Rect key={i} x={cx - w / 2} y={Math.min(mid, tip)} width={w} height={Math.max(2, Math.abs(tip - mid))} rx={w / 2} fill={METRIC_HUE.temp} opacity={b.value >= 0 ? 1 : 0.55} />
            );
          })}
        </G>
      );
    }
    case 'steps': {
      // An amount, so bars stand on zero.
      const bins = levelBins(days, (d) => d.steps, bin);
      const top = Math.max(1, ...bins.map((b) => b.value));
      const floor = height - 16;
      const lastIn = [...bins].reverse().find((b) => stretch(b.start, b.end));
      return (
        <G>
          <Line x1={0} x2={plotW} y1={floor} y2={floor} stroke={C.text} opacity={0.1} />
          {bins.map((b, i) => {
            const p = stretch(b.start, b.end);
            if (!p) return null;
            const w = Math.min(18, Math.max(4, (p[1] - p[0]) * 0.6));
            const cx = (p[0] + p[1]) / 2;
            const h = (b.value / top) * (floor - 20);
            return (
              <G key={i}>
                <Rect x={cx - w / 2} y={floor - h} width={w} height={Math.max(2, h)} rx={w / 3} fill={METRIC_HUE.steps} />
                {b === lastIn ? (
                  <Label x={cx} y={floor - h - 6} color={C.text}>
                    {Math.round(b.value).toLocaleString('en-US')}
                  </Label>
                ) : null}
              </G>
            );
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
            // A bar while she takes it, clamped to the window so one taken
            // all year shows in every view. Where it carries on past what
            // is recorded, the bar continues as an outline.
            const line = span(med.from, med.to);
            const ongoing = med.ongoing == null ? null : span(med.to, med.ongoing);
            const labelX = at(med.labelAt);
            if (!line && !ongoing) return null;
            return (
              <G key={med.name}>
                {line ? <Rect x={line[0]} y={med.y + 8} width={Math.max(6, line[1] - line[0])} height={16} rx={8} fill={color} /> : null}
                {ongoing ? (
                  <Rect x={ongoing[0]} y={med.y + 8} width={Math.max(6, ongoing[1] - ongoing[0])} height={16} rx={8} fill="none" stroke={color} strokeDasharray="3 3" />
                ) : null}
                {labelX != null ? (
                  <Label x={labelX} y={med.y} color={C.text}>
                    {med.name}
                  </Label>
                ) : null}
              </G>
            );
          })}
        </G>
      );
    case 'records':
      // A marker per lab draw: an open ring when every result sat inside
      // its range, a filled amber marker with the count when any did not.
      return (
        <G>
          {drawMarkers(draws).map((d) => {
            const cx = x(d.at);
            if (cx == null) return null;
            return (
              <G key={d.at.toISOString()}>
                {d.outside ? (
                  <Rect x={cx - 9} y={25} width={18} height={18} rx={3} fill={C.amber} transform={`rotate(45 ${cx} 34)`} />
                ) : (
                  <Circle cx={cx} cy={34} r={9} fill="none" stroke={C.green} strokeWidth={2.5} />
                )}
                <Label x={cx} y={66} color={d.outside ? C.amber : C.secondary}>
                  {d.outside ? `${d.outsideCount} of ${d.count} outside` : 'All in range'}
                </Label>
              </G>
            );
          })}
        </G>
      );
    case 'notes':
      if (!journey) return null;
      // A pin where she wrote, with her words under it. Tapping one opens
      // her notes.
      return (
        <G>
          {journey.notes.map((n) => {
            const cx = at(n.m);
            if (cx == null) return null;
            return (
              <G key={n.m} onPress={onNote}>
                <Line x1={cx} x2={cx} y1={24} y2={50} stroke={C.indigo} strokeWidth={2} opacity={0.6} />
                <Circle cx={cx} cy={18} r={8} fill={C.indigo} />
                {n.lines.map((line, k) => (
                  <Label key={line} x={cx} y={68 + k * 16} color={C.secondary}>
                    {`${k === 0 ? '\u201C' : ''}${line}${k === n.lines.length - 1 ? '\u201D' : ''}`}
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
  const { signals, fertility, windows, lens, profile } = useCycleInsights();
  const { journey, days, records } = useData();
  const nav = useNav();
  const repo = useRepo();
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  useEffect(() => {
    let ignore = false;
    repo
      .loadBaselines()
      .then((rows) => !ignore && setBaselines(rows))
      .catch(() => {
        // Without her usual, the levels are drawn without a shaded range.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);
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
  const SLOT_MIN: Record<Scale, number> = { day: 64, week: 92, month: 56, year: 110 };
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

  // Only the lanes she has given Ciatta something for. A woman who tracks
  // her cycle and wears a ring sees a cycle, HRV and heart rate, not a
  // column of empty lanes for things she has never logged.
  const draws = records?.draws ?? [];
  const available = useMemo(
    () =>
      lanesWithData({
        periods: periodBlocks(signals).length + windows.length,
        pain: signals.filter((sg) => sg.pain && sg.episode.severity != null).length,
        flares: flareSpans(signals).length,
        symptoms: signals.filter((sg) => sg.episode.symptoms?.length).length,
        sleep: days.filter((d) => d.sleepHours != null).length,
        hrv: days.filter((d) => d.hrv != null).length,
        heart: days.filter((d) => d.restingHR != null).length,
        temp: days.filter((d) => d.tempDeviation != null).length,
        steps: days.filter((d) => d.steps != null).length,
        medications: journey?.medications.length ?? 0,
        records: drawMarkers(draws).length,
        notes: journey?.notes.length ?? 0,
      }),
    [signals, windows, days, journey, draws],
  );
  const lanesHere = LANES.filter((l) => available.includes(l.key));
  const shownLanes = lanesHere.filter((l) => !hidden.includes(l.key));
  const symptomNames = useMemo(() => symptomGrid(signals, binFor(scale), SYMPTOM_ROWS).map((r) => r.symptom), [signals, scale]);

  // Whether anything at all falls in the window, so the chart can say it
  // is empty instead of showing a grid with nothing on it.
  const nothingInView =
    lanesHere.length > 0 &&
    cycle.every((c) => posIn(axis, c.at) == null) &&
    signals.every((sg) => posIn(axis, sg.date) == null) &&
    days.every((d) => posIn(axis, new Date(`${d.date}T12:00:00`)) == null) &&
    !journey;

  const toggle = (lane: Lane) =>
    setHidden((h) => (h.includes(lane) ? h.filter((l) => l !== lane) : [...h, lane]));

  return (
    <ScrollView style={j.fill} contentContainerStyle={j.body}>
      <LargeTitle title="Journey" />

      <View style={j.pad}>
        <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>
          {displayCopy(
            lanesHere.length
              ? `Your ${listWords(lanesHere.map((l) => (l.key === 'hrv' ? 'HRV' : l.title.toLowerCase())))} on one timeline.`
              : 'Nothing here yet. Log a period or a symptom, or connect a device, and it appears on this timeline.',
          )}
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

      {lanesHere.length ? (
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
                  {/* The symptom grid's rows are named here, where the
                      names stay put while the plot scrolls. */}
                  {lane.key === 'symptoms'
                    ? symptomNames.map((name) => (
                        <Text key={name} style={[font('caption2'), j.rowName]} numberOfLines={1}>
                          {displayCopy(name)}
                        </Text>
                      ))
                    : null}
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
                      bin={binFor(scale)}
                      signals={signals}
                      windows={windows}
                      cycle={cycle}
                      days={days}
                      journey={journey}
                      draws={records?.draws ?? []}
                      plotW={plotW}
                      height={lane.height}
                      onNote={() => nav.push('journal')}
                      baselines={baselines}
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
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={j.legend}>
        {lanesHere.map((lane) => {
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

        {/*
          No "Something changed" card here. A change worth her attention
          reaches her as a push notification, when it happens, rather than
          waiting on this tab for her to come and find it.
        */}
        {/* Logging lives behind the plus in the bottom navigation, on every
            screen, so Journey does not carry a second way in. */}
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
  rowName: { color: C.tertiary, height: ROW_H, lineHeight: ROW_H },
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
});
