import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysBetween, parseDay, shortDate, type Episode } from '../data/cycleLog';
import type { Day } from '../data/daily';
import { medications, records } from '../data/sample';
import type { Lens } from '../lib/cycleLens';
import { type CycleSummary, type Signal, tally } from '../lib/cyclePatterns';
import { displayCopy } from '../lib/displayCopy';
import { fmtCount, fmtHours, type MovementSummary } from '../lib/engine';
import type { Screen } from '../navigation';
import { C, font, M, numeral, RADIUS } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { BarRow } from './cycleInputs';
import { BedArc, DotScale, HairlineChart, RangeBar, type Stage, StageLegend, StageRings } from './lineCharts';
import { ChevronRight } from './kit';

// Every metric on one organised page, drawn in hairlines. Colours follow the
// design system's meanings: Sky for measured, Rose for what she reported,
// Lavender for long horizons, Amber for reference ranges, Citron to raise.

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const dateOf = (d: Day) => shortDate(parseDay(d.date));

function Card({
  title,
  meta,
  onPress,
  children,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={d.card}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'header'}
        accessibilityLabel={onPress ? `${title}, open details` : title}
        style={({ pressed }) => [d.cardHead, pressed && d.pressed]}
      >
        <Text style={[font('title3', 'semibold'), { color: C.text, flex: 1 }]}>{title}</Text>
        {meta ? <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(meta)}</Text> : null}
        {onPress ? <ChevronRight /> : null}
      </Pressable>
      {children}
    </View>
  );
}

function Stat({ label, value, sub, color = C.text }: { label: string; value: string; sub?: string; color?: string }) {
  const l = displayCopy(label);
  const v = displayCopy(value);
  const s = sub ? displayCopy(sub) : undefined;
  return (
    <View style={d.stat} accessible accessibilityLabel={`${l}, ${v}${s ? `, ${s}` : ''}`}>
      <Text style={[font('footnote'), { color: C.secondary }]}>{l}</Text>
      <Text style={[numeral(22, 'medium'), { color }]}>{v}</Text>
      {s ? <Text style={[font('caption1'), { color: C.secondary }]}>{s}</Text> : null}
    </View>
  );
}

export function HealthDashboard({
  days,
  movement,
  summaries,
  signals,
  lens,
  open,
  openInsight,
  openProfile,
}: {
  days: Day[];
  movement: MovementSummary;
  summaries: CycleSummary[];
  signals: Signal[];
  lens: Lens;
  open: (screen: Screen) => void;
  openInsight: (id: string) => void;
  openProfile: () => void;
}) {
  const [stage, setStage] = useState<Stage>('Deep');
  const now = new Date();
  const last = days[days.length - 1];
  const last14 = days.slice(-14);
  const last28 = days.slice(-28);
  const base = days.slice(Math.max(0, days.length - 91), days.length - 35);
  const usual = {
    sleep: median(base.map((x) => x.sleepHours)),
    bed: median(base.map((x) => x.timeInBed)),
    rhr: median(base.map((x) => x.restingHR)),
    hrv: median(base.map((x) => x.hrv)),
  };

  // Cycle
  const done = summaries.filter((c) => c.window.length != null);
  const current = summaries[summaries.length - 1] ?? null;

  // Symptoms she logged in the last two months, plus bloating from daily notes.
  const recentEpisodes: Episode[] = signals.filter((s) => daysBetween(s.date, now) <= 60).map((s) => s.episode);
  const symptomTally = tally(recentEpisodes.map((e) => e.symptoms));
  const bloatingDays = days.slice(-60).filter((x) => x.digestion.includes('Bloating')).length;
  if (bloatingDays && !symptomTally.some((t) => t.label === 'Bloating')) symptomTally.push({ label: 'Bloating', count: bloatingDays });
  symptomTally.sort((a, b) => b.count - a.count);
  const symptomMax = Math.max(1, ...symptomTally.map((t) => t.count));

  const latestDraw = records.draws[0];

  return (
    <View style={d.stack}>
      {/* Sleep */}
      <Card title="Sleep" meta={`Last night, ${dateOf(last)}`} onPress={() => open('sleep')}>
        <View style={d.sleepTop}>
          <StageRings stages={last.stages} active={stage} />
          <StageLegend stages={last.stages} active={stage} onPick={setStage} />
        </View>
        <View style={d.tiles}>
          <View style={d.tile} accessible accessibilityLabel={`Total sleep ${fmtHours(last.sleepHours)}, usual ${fmtHours(usual.sleep)}`}>
            <Text style={[font('footnote'), { color: C.secondary }]}>Total Sleep</Text>
            <DotScale value={last.sleepHours} usual={usual.sleep} />
            <Text style={[numeral(20, 'medium'), { color: C.text }]}>{fmtHours(last.sleepHours)}</Text>
            <Text style={[font('caption1'), { color: C.secondary }]}>Usual {fmtHours(usual.sleep)}</Text>
          </View>
          <View
            style={d.tile}
            accessible
            accessibilityLabel={`Time in bed ${fmtHours(last.timeInBed)}, asleep ${Math.round((last.sleepHours / last.timeInBed) * 100)} percent of it`}
          >
            <Text style={[font('footnote'), { color: C.secondary }]}>Time in Bed</Text>
            <BedArc inBed={last.timeInBed} asleep={last.sleepHours} />
            <Text style={[numeral(20, 'medium'), { color: C.text }]}>{fmtHours(last.timeInBed)}</Text>
            <Text style={[font('caption1'), { color: C.secondary }]}>
              Asleep {Math.round((last.sleepHours / last.timeInBed) * 100)}% of it
            </Text>
          </View>
        </View>
        <Text style={[font('footnote'), d.chartLabel]}>Total sleep, last 14 nights</Text>
        <HairlineChart
          values={last14.map((x) => x.sleepHours)}
          usual={usual.sleep}
          color={M.measured}
          first={dateOf(last14[0])}
          last="Last night"
        />
        <Text style={[font('caption1'), d.note]}>Dashed line: your usual. Sleep stages are sample data for now.</Text>
      </Card>

      {/* Movement */}
      <Card title="Movement" meta="Last 7 days" onPress={() => open('movement')}>
        <View style={d.row3}>
          <Stat label="Steps a day" value={fmtCount(movement.steps.recent)} sub={`Usual ${fmtCount(movement.steps.usual)}`} />
          <Stat label="Active min" value={`${Math.round(movement.active.recent)}`} sub={`Usual ${Math.round(movement.active.usual)}`} />
          <Stat label="Workouts" value={`${movement.workouts.recent}`} sub={`Usually ${Math.round(movement.workouts.usual)}`} />
        </View>
        <Text style={[font('footnote'), d.chartLabel]}>Daily steps, last 28 days</Text>
        <HairlineChart
          values={movement.series.map((x) => x.steps)}
          usual={movement.steps.usual}
          color={M.measured}
          first={shortDate(parseDay(movement.series[0].date))}
          last="Today"
        />
      </Card>

      {/* Recovery */}
      <Card title="Recovery" meta="Last 28 days" onPress={() => openInsight('rhrHigh')}>
        <View style={d.tiles}>
          <View style={d.tile}>
            <Stat label="Resting heart rate" value={`${Math.round(last.restingHR)} bpm`} sub={`Usual ${Math.round(usual.rhr)}`} />
            <HairlineChart values={last28.map((x) => x.restingHR)} usual={usual.rhr} color={M.measured} height={44} />
          </View>
          <View style={d.tile}>
            <Stat label="HRV" value={`${Math.round(last.hrv)} ms`} sub={`Usual ${Math.round(usual.hrv)}`} />
            <HairlineChart values={last28.map((x) => x.hrv)} usual={usual.hrv} color={M.measured} height={44} />
          </View>
        </View>
      </Card>

      {/* Cycle */}
      <Card title="Cycle" meta={lens.header.value} onPress={() => open('cycle')}>
        <View style={d.row3}>
          <Stat label={lens.header.label} value={lens.header.value} />
          {lens.secondary ? <Stat label={lens.secondary.label} value={lens.secondary.value} /> : null}
          <Stat label="Pain days" value={`${current?.painDays ?? 0}`} sub="this cycle" color={M.reported} />
        </View>
        {done.length ? (
          <>
            <Text style={[font('footnote'), d.chartLabel]}>Cycle length, last {done.length} cycles</Text>
            <HairlineChart
              values={done.map((c) => c.window.length)}
              color={M.timeDepth}
              dots
              height={52}
              first={shortDate(done[0].window.start)}
              last={shortDate(done[done.length - 1].window.start)}
            />
          </>
        ) : null}
      </Card>

      {/* Pain and flare ups */}
      <Card title="Pain and Flare Ups" meta="By cycle" onPress={() => open('cycleHistory')}>
        <View style={d.row3}>
          <Stat label="Highest this cycle" value={current?.maxSeverity != null ? `${current.maxSeverity} of 10` : 'None'} color={M.reported} />
          <Stat label="Flare ups" value={`${current?.flares ?? 0}`} sub="you reported" color={M.reported} />
          <Stat label="Avg length" value={current?.hours != null ? `${Math.round(current.hours)}h` : 'None'} sub="per episode" />
        </View>
        <Text style={[font('footnote'), d.chartLabel]}>Highest severity, each cycle</Text>
        <HairlineChart values={summaries.map((c) => c.maxSeverity)} color={M.reported} dots height={52} first="Earliest" last="This cycle" />
      </Card>

      {/* Check ins */}
      <Card title="Stress, Energy, Mood" meta="Last 14 days" onPress={() => open('journal')}>
        {(
          [
            { label: 'Stress', key: 'stress' },
            { label: 'Energy', key: 'energy' },
            { label: 'Mood', key: 'mood' },
          ] as const
        ).map((row) => {
          const values = last14.map((x) => x[row.key]);
          const latest = [...values].reverse().find((v) => v != null);
          return (
            <View key={row.key} style={d.checkRow}>
              <View style={{ width: 84 }}>
                <Text style={[font('subhead'), { color: C.text }]}>{row.label}</Text>
                <Text style={[font('caption1'), { color: C.secondary }]}>{latest != null ? `${latest} of 5 today` : 'Not logged'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <HairlineChart values={values} color={M.reported} height={34} />
              </View>
            </View>
          );
        })}
      </Card>

      {/* Symptoms and digestion */}
      <Card title="Symptoms" meta="Last 60 days" onPress={() => open('symptoms')}>
        {symptomTally.slice(0, 5).map((t) => (
          <BarRow key={t.label} label={t.label} count={t.count} max={symptomMax} color={M.reported} unit=" days" />
        ))}
      </Card>

      {/* Medications */}
      <Card title="Medications" meta={`${medications.current.length} current`} onPress={() => open('medications')}>
        {medications.current.map((m, n) => (
          <View key={m.name} style={[d.medRow, n > 0 && d.sep]}>
            <View style={[d.medLine, { backgroundColor: M.measured }]} />
            <View style={{ flex: 1 }}>
              <Text style={[font('subhead'), { color: C.text }]}>
                {m.name} {m.dose}
              </Text>
              <Text style={[font('caption1'), { color: C.secondary }]}>
                {m.timing} · {m.since}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Lab results */}
      <Card title="Lab Results" meta={latestDraw.date} onPress={() => open('healthrecords')}>
        {latestDraw.results.map((r, n) => {
          const value = parseFloat(r.value);
          const [low, high] = r.range.split(' to ').map(Number);
          const out = value < low || value > high;
          return (
            <View
              key={r.name}
              style={[d.labRow, n > 0 && d.sep]}
              accessible
              accessibilityLabel={`${r.name} ${r.value}, range ${r.range}, ${out ? 'outside range' : 'within range'}`}
            >
              <View style={d.labHead}>
                <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>{r.name}</Text>
                <Text style={[font('subhead', 'semibold'), { color: out ? M.attention : C.text }]}>{r.value}</Text>
              </View>
              <RangeBar value={value} low={low} high={high} rangeColor={M.evidence} pointColor={out ? M.attention : C.text} />
              <Text style={[font('caption1'), { color: C.secondary }]}>
                Range {r.range}
                {out ? ' · below range' : ''}
              </Text>
            </View>
          );
        })}
      </Card>

      <ListGroup>
        <ListRow first icon="doc" tint={C.green} title="Health Records" sub="Results and documents" onPress={() => open('healthrecords')} />
        <ListRow icon="chat" tint={C.indigo} title="Your Notes" sub="Everything you've written down" onPress={() => open('journal')} />
        <ListRow icon="layers" tint={C.blue} title="Connected Sources" sub="Apple Health · Lab Records · Manual Entries" onPress={openProfile} />
      </ListGroup>
    </View>
  );
}

const d = StyleSheet.create({
  stack: { gap: 16, marginTop: 4 },
  pressed: { opacity: 0.55 },
  card: { backgroundColor: C.card, borderRadius: RADIUS, padding: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  sleepTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: C.cardHi, borderRadius: 10, padding: 12, gap: 4 },
  row3: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 1 },
  chartLabel: { color: C.secondary, marginTop: 4 },
  note: { color: C.secondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  medLine: { width: 3, alignSelf: 'stretch', borderRadius: 1.5 },
  labRow: { gap: 4, paddingVertical: 8 },
  labHead: { flexDirection: 'row', alignItems: 'baseline' },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
});
