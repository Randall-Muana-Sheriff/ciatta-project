import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLabel, daysBetween, parseDay, shortDate, type Episode } from '../data/cycleLog';
import type { Day } from '../data/daily';
import type { Lens } from '../lib/cycleLens';
import { type CycleSummary, type Signal, tally } from '../lib/cyclePatterns';
import { displayCopy } from '../lib/displayCopy';
import { fmtCount, fmtHours, mostRecentValue, type MovementSummary } from '../lib/engine';
import type { Screen } from '../navigation';
import { useData, useRepo, useSession } from '../state/session';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { categorySummary } from '../lib/categorySummary';
import { category as categoryOf, type CategoryKey } from '../lib/logCategories';
import { productsLine, type ProductUse } from '../lib/periodProducts';
import { airLines, daylightLine, type EnvironmentDay, weatherLines } from '../lib/weather';
import { latestMeal } from '../lib/mealPhoto';
import { labDay, labDraws, type LabResult } from '../lib/labs';
import { medsView } from '../lib/medsView';
import type { Reported } from '../data/repo';
import { LabRangeBar, LabStatusTag } from './labs';
import { caloriesBlock } from '../lib/calories';
import type { Meal } from '../lib/foodScan';
import type { NutritionTargets } from '../lib/nutritionTargets';
import { CaloriesDial } from './CaloriesDial';
import { runEnvironmentSync } from '../state/environmentRun';
import { images } from './images';
import type { JournalView } from '../data/rows';
import { C, font, M, numeral } from '../theme';
import { BarRow } from './cycleInputs';
import { HairlineChart, LengthDots } from './lineCharts';
import { Hypnogram } from './Hypnogram';
import { lastNight, type Night } from '../lib/hypnogram';
import { type BaselineRow, fmt, type MetricKey, type Point, seriesForDays, usualFor, type VitalDay } from '../lib/metricDetail';
import { GROUP, NAME } from '../lib/metricNames';
import { gutOut } from '../lib/gut';
import { chooseMetric } from '../lib/metricHandoff';
import { bloodOxygen, bloodPressure, type VitalCard } from '../lib/vitals';
import { MetricChart } from './MetricChart';
import { METRIC_HUE } from './metricHue';
import { ChevronRight } from './kit';
import { L, TILE_RADIUS } from './surface';
import { GlassFill } from './frosted';

// Every metric on one organised page, drawn in hairlines. Colours follow the
// design system's meanings: Sky for measured, Rose for what she reported,
// Lavender for long horizons, Amber for reference ranges, Citron to raise.

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// A day's own measured values are never treated as zero when absent: every
// baseline below is a median over the days that actually carry that field,
// not over every day in the window.
const nums = (xs: (number | null)[]) => xs.filter((v): v is number => v != null);

// median() returns 0 for an empty input, which is right for a plain median
// but wrong as a "usual" shown to her: with no baseline days yet (a new real
// record, or a metric no source has ever measured), there is no usual, and
// a card must say so rather than show a real night above "Usual 0h 00m".
const medianOrNull = (xs: (number | null)[]): number | null => {
  const known = nums(xs);
  return known.length ? median(known) : null;
};


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
      <GlassFill />
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
}: {
  days: Day[];
  movement: MovementSummary;
  summaries: CycleSummary[];
  signals: Signal[];
  lens: Lens;
  open: (screen: Screen) => void;
  openInsight: (id: string) => void;
}) {
  // Last night's stages, for the hypnogram; and her usual ranges, for the
  // shaded band every chart draws.
  const [night, setNight] = useState<Night | null>(null);
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  const { mode } = useSession();
  const repo = useRepo();
  const { episodes } = useCycle();
  const { windows } = useCycleInsights();
  const now = new Date();

  // What the newer cards read: her journal (for the logging categories),
  // her period products, and the weather around her. Each starts empty, and
  // an empty source means its card is simply not drawn.
  const [journal, setJournal] = useState<JournalView | null>(null);
  // Her labs and what she named, for the Labs and Medications cards.
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [reported, setReported] = useState<Reported | null>(null);
  const [productUses, setProductUses] = useState<ProductUse[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentDay[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [daylight, setDaylight] = useState<{ day: string; minutes: number }[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>({});
  const [dialWidth, setDialWidth] = useState(0);
  const [vitalDays, setVitalDays] = useState<VitalDay[]>([]);
  const [vitalCards, setVitalCards] = useState<VitalCard[]>([]);
  useEffect(() => {
    let ignore = false;
    repo.loadJournal().then((j) => !ignore && setJournal(j)).catch(() => {});
    repo.loadLabs().then((l) => !ignore && setLabs(l)).catch(() => {});
    {
      const from = new Date(Date.now() - 28 * 86400000);
      const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      repo
        .loadVitalDays(key, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
        .then((v) => !ignore && setVitalDays(v))
        .catch(() => {});
      repo
        .loadVitals()
        .then((rows) => !ignore && setVitalCards([bloodPressure(rows, new Date()), bloodOxygen(rows, new Date())]))
        .catch(() => {});
    }
    repo.loadBaselines().then((b) => !ignore && setBaselines(b)).catch(() => {});
    repo
      .loadSleepSamples(new Date(Date.now() - 36 * 3600000).toISOString())
      .then((x) => !ignore && setNight(lastNight(x)))
      .catch(() => {});
    repo.loadReported().then((r) => !ignore && setReported(r)).catch(() => {});
    repo.loadProductUses().then((u) => !ignore && setProductUses(u)).catch(() => {});
    // Fetch any weather days still missing (at most once a day, and only
    // if she allowed it), then read what is stored.
    runEnvironmentSync(repo)
      .catch(() => 'failed')
      .then(() => repo.loadEnvironment())
      .then((e) => !ignore && setEnvironment(e))
      .catch(() => {});
    repo.loadMeals(new Date(Date.now() - 30 * 86400000).toISOString()).then((m) => !ignore && setMeals(m)).catch(() => {});
    repo.loadNutritionTargets().then((t) => !ignore && setTargets(t)).catch(() => {});
    repo.loadDaylight(new Date(Date.now() - 8 * 86400000).toISOString()).then((d) => !ignore && setDaylight(d)).catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const mealFrom = (entries: Parameters<typeof latestMeal>[0]) => {
    const found = latestMeal(entries);
    if (found) return { source: { uri: found.uri }, title: found.title, meal: found.meal };
    if (mode === 'demo') return { source: images.sampleMeal, title: 'Yogurt bowl with berries', meal: 'Breakfast' as const };
    return null;
  };
  const calories = useMemo(() => caloriesBlock(meals, targets, new Date()), [meals, targets]);
  const categoryCards = useMemo(() => {
    const entries = (journal?.months ?? []).flatMap((m) => m.items);
    const input = { journal: entries, days, episodes, now: new Date() };
    return CATEGORY_CARDS.map((key) => ({ key, summary: categorySummary(key, input) })).filter(
      (c) => c.summary.rows.length || c.summary.extra || (c.key === 'nutrition' && (mealFrom(entries) || calories)),
    );
  }, [journal, days, episodes, mode, calories]);
  // The Nutrition card's photo: her latest meal photo, or for the example
  // person a sample breakfast.
  const meal = useMemo(() => mealFrom((journal?.months ?? []).flatMap((m) => m.items)), [journal, mode]);
  const periodStart = windows[windows.length - 1]?.start;
  const products = periodStart ? productsLine(productUses, periodStart.toISOString(), now) : null;
  // Weather, air, smoke, pollen, and her own daylight: the card appears
  // once any of them exists.
  const weather = [...weatherLines(environment), ...airLines(environment), ...(daylightLine(daylight) ? [daylightLine(daylight)!] : [])];

  // Undefined until her record holds a day; the "any record at all" cards
  // below wait for one. This is deliberately not "today's data": days
  // always extends through today, which is often an empty placeholder from
  // midnight until her first sync, so a card that shows a single measured
  // day reads back from mostRecentValue instead (below), whichever day that
  // turns out to be.
  const last: Day | undefined = days[days.length - 1];
  const last14 = days.slice(-14);
  const base = days.slice(Math.max(0, days.length - 91), days.length - 35);
  const usual = {
    sleep: medianOrNull(base.map((x) => x.sleepHours)),
    bed: medianOrNull(base.map((x) => x.timeInBed)),
    rhr: medianOrNull(base.map((x) => x.restingHR)),
    hrv: medianOrNull(base.map((x) => x.hrv)),
  };
  // The most recent night with a total sleep figure, whatever day that is;
  // time in bed and the stage rings come from that same night rather than
  // being searched independently, since mixing two different nights under
  // one "Last night" label would say something false about both.
  const sleepEntry = mostRecentValue(days, (x) => x.sleepHours);
  const timeInBed = sleepEntry?.day.timeInBed ?? null;
  // The 14 night chart's own rightmost drawn point, which can differ from
  // sleepEntry when the most recent real night falls outside this window
  // (sleepEntry searches the whole record); the edge label must name that
  // point, the same one HairlineChart itself finds as lastIdx, not
  // wherever the headline figure happens to come from.
  // Resting heart rate and HRV are genuinely on their own cadences in real
  // data, so each looks back independently.
  const rhrEntry = mostRecentValue(days, (x) => x.restingHR);
  const hrvEntry = mostRecentValue(days, (x) => x.hrv);

  // Cycle
  const done = summaries.filter((c) => c.window.length != null);
  const current = summaries[summaries.length - 1] ?? null;

  // A pain figure can be missing for two different reasons and they must not
  // read the same. With no pain logged in this cycle there is genuinely none
  // to report, which is a measured none and may say so. With pain logged but
  // never rated or never timed, the figure is simply not known, and calling
  // that "None" would tell her she had no pain on a day she recorded some.
  // painDays is what separates the two: it counts the distinct days she
  // logged pain, so above zero means the episodes exist and only the figure
  // is missing.
  const painFigure = (value: number | null, format: (v: number) => string): string => {
    if (value != null) return format(value);
    return current?.painDays === 0 ? 'None' : 'Not logged';
  };

  // Symptoms she logged in the last two months, plus bloating from daily notes.
  const recentEpisodes: Episode[] = signals.filter((s) => daysBetween(s.date, now) <= 60).map((s) => s.episode);
  const symptomTally = tally(recentEpisodes.map((e) => e.symptoms));
  const bloatingDays = days.slice(-60).filter((x) => x.digestion.includes('Bloating')).length;
  if (bloatingDays && !symptomTally.some((t) => t.label === 'Bloating')) symptomTally.push({ label: 'Bloating', count: bloatingDays });
  symptomTally.sort((a, b) => b.count - a.count);
  const symptomMax = Math.max(1, ...symptomTally.map((t) => t.count));

  const latestDraw = useMemo(() => labDraws(labs)[0] ?? null, [labs]);

  // Vitals, each with its four weeks and its latest figure.
  const vitalRows = useMemo(() => {
    const temp = mostRecentValue(days, (x) => x.tempDeviation);
    const rows: { key: MetricKey; label: string; value: string | null; points: Point[] }[] = [
      { key: 'bp', label: NAME.bp, value: vitalCards.find((v) => v.key === 'bp')?.value ?? null, points: seriesForDays('bp', days, vitalDays, 28, now) },
      { key: 'spo2', label: NAME.spo2, value: vitalCards.find((v) => v.key === 'spo2')?.value ?? null, points: seriesForDays('spo2', days, vitalDays, 28, now) },
      { key: 'temp', label: NAME.temp, value: temp ? fmt('temp', temp.value) : null, points: seriesForDays('temp', days, vitalDays, 28, now) },
    ];
    return rows.filter((r) => r.points.some((p) => p.value != null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, vitalDays, vitalCards]);
  const gut = useMemo(() => gutOut({ episodes, days, now: new Date() }), [episodes, days]);
  const summaryOf = (key: CategoryKey) =>
    categorySummary(key, { journal: (journal?.months ?? []).flatMap((m) => m.items), days, episodes, now: new Date() }).rows;
  const gutRows = useMemo(() => summaryOf('gut'), [journal, days, episodes]);
  const mindRows = useMemo(() => summaryOf('mind'), [journal, days, episodes]);
  const meds = useMemo(
    () => medsView({ reported, logs: (journal?.months ?? []).flatMap((m) => m.items), now: new Date() }),
    [reported, journal],
  );
  const named = [...meds.medications.map((x) => ({ ...x, kind: 'Medication' })), ...meds.supplements.map((x) => ({ ...x, kind: 'Supplement' }))];

  return (
    <View style={d.stack}>
      {/* Sleep: reads whatever night she most recently has a figure for
          (which is often not today, since today can still be an empty
          placeholder before her first sync), and nothing shown for a night
          nothing measured, rather than a fabricated "0h 00m". */}
      {sleepEntry ? (
      <Card title={GROUP.sleep} meta={dayLabel(sleepEntry.day.date, now)} onPress={() => open('sleep')}>
        {/* Last night, stage by stage: the same hypnogram the Sleep screen
            draws. Absent when her device recorded no stages for it. */}
        {night ? <Hypnogram night={night} /> : null}
        <View style={d.tiles}>
          <View style={d.tile} accessible accessibilityLabel={`Total sleep ${fmtHours(sleepEntry.value)}${usual.sleep != null ? `, usual ${fmtHours(usual.sleep)}` : ''}`}>
            <Text style={[font('footnote'), { color: C.secondary }]}>{NAME.timeAsleep}</Text>
            <Text style={[numeral(20, 'medium'), { color: C.text }]}>{fmtHours(sleepEntry.value)}</Text>
            {usual.sleep != null ? <Text style={[font('caption1'), { color: C.secondary }]}>Usual {fmtHours(usual.sleep)}</Text> : null}
          </View>
          {timeInBed != null ? (
            <View style={d.tile} accessible accessibilityLabel={`Time in bed ${fmtHours(timeInBed)}, asleep ${Math.round((sleepEntry.value / timeInBed) * 100)} percent of it`}>
              <Text style={[font('footnote'), { color: C.secondary }]}>{NAME.timeInBed}</Text>
              <Text style={[numeral(20, 'medium'), { color: C.text }]}>{fmtHours(timeInBed)}</Text>
              <Text style={[font('caption1'), { color: C.secondary }]}>Asleep {Math.round((sleepEntry.value / timeInBed) * 100)}% of it</Text>
            </View>
          ) : null}
        </View>
        <Text style={[font('footnote'), d.chartLabel]}>Total sleep, last 14 nights</Text>
        <MetricChart metric="sleep" points={seriesForDays('sleep', days, [], 14, now)} usual={usualFor('sleep', baselines)} color={METRIC_HUE.sleep} size="card" />
        {usualFor('sleep', baselines) ? <Text style={[font('caption1'), d.note]}>Shaded: your usual range.</Text> : null}
      </Card>
      ) : null}

      {/* Recovery: a tile only draws for a measure the day actually has, and
          each reads independently from whenever it was last measured, since
          resting heart rate and HRV are on their own cadences in real data.
          The card's own meta describes the chart below it (a fixed 28 day
          window, always accurate), but the headline value can come from any
          day mostRecentValue found; each tile's own date goes in its sub
          line rather than letting "Last 28 days" imply a recency the value
          may not have (Fix round 2: date led rather than a staleness bound,
          since hiding a real value would undo Fix round 1, item 2). */}
      {rhrEntry || hrvEntry ? (
      <Card title={GROUP.heart} meta="Last 28 days" onPress={() => openInsight('rhrHigh')}>
        <View style={d.tiles}>
          {rhrEntry ? (
          <View style={d.tile}>
            <Stat
              label={NAME.rhr}
              value={`${Math.round(rhrEntry.value)} bpm`}
              sub={[usual.rhr != null ? `Usual ${Math.round(usual.rhr)}` : null, dayLabel(rhrEntry.day.date, now)].filter(Boolean).join(' · ')}
            />
            <MetricChart metric="rhr" points={seriesForDays('rhr', days, [], 28, now)} usual={usualFor('rhr', baselines)} color={METRIC_HUE.rhr} size="card" />
          </View>
          ) : null}
          {hrvEntry ? (
          <View style={d.tile}>
            <Stat
              label={NAME.hrv}
              value={`${Math.round(hrvEntry.value)} ms`}
              sub={[usual.hrv != null ? `Usual ${Math.round(usual.hrv)}` : null, dayLabel(hrvEntry.day.date, now)].filter(Boolean).join(' · ')}
            />
            <MetricChart metric="hrv" points={seriesForDays('hrv', days, [], 28, now)} usual={usualFor('hrv', baselines)} color={METRIC_HUE.hrv} size="card" />
          </View>
          ) : null}
        </View>
      </Card>
      ) : null}

      {/* Vitals: blood pressure, blood oxygen and skin temperature, each
          with its chart, named as everywhere else. Each opens its screen. */}
      {vitalRows.length ? (
        <Card title={GROUP.vitals} meta="Last 28 days">
          {vitalRows.map((v, n) => (
            <Pressable
              key={v.key}
              onPress={() => {
                chooseMetric(v.key);
                open('metric');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${v.label}, ${v.value ?? 'not recorded'}`}
              style={({ pressed }) => [d.vital, n > 0 && d.sep, pressed && d.pressed]}
            >
              <View style={d.vitalHead}>
                <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>{v.label}</Text>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>{displayCopy(v.value ?? 'Not yet')}</Text>
                <ChevronRight />
              </View>
              <MetricChart metric={v.key} points={v.points} usual={usualFor(v.key, baselines)} color={METRIC_HUE[v.key]} size="card" />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* Movement: a tile only draws for a figure the week actually has. */}
      {movement.series.length ? (
      <Card title={GROUP.movement} meta="Last 7 days" onPress={() => open('movement')}>
        <View style={d.row3}>
          {movement.steps.recent != null ? (
          <Stat
            label={NAME.steps}
            value={fmtCount(movement.steps.recent)}
            sub={movement.steps.usual != null ? `A day · Usual ${fmtCount(movement.steps.usual)}` : 'A day'}
          />
          ) : null}
          {movement.active.recent != null ? (
          <Stat
            label={NAME.active}
            value={`${Math.round(movement.active.recent)}`}
            sub={movement.active.usual != null ? `Usual ${Math.round(movement.active.usual)}` : undefined}
          />
          ) : null}
          <Stat
            label={NAME.workouts}
            value={`${movement.workouts.recent}`}
            sub={movement.workouts.usual != null ? `Usually ${Math.round(movement.workouts.usual)}` : undefined}
          />
        </View>
        <Text style={[font('footnote'), d.chartLabel]}>Daily steps, last 28 days</Text>
        <MetricChart metric="steps" points={seriesForDays('steps', days, [], 28, now)} usual={usualFor('steps', baselines)} color={METRIC_HUE.steps} size="card" />
      </Card>
      ) : null}

      {/* Cycle */}
      <Card title={GROUP.cycle} meta={lens.header.value} onPress={() => open('cycle')}>
        <View style={d.row3}>
          <Stat label={lens.header.label} value={lens.header.value} />
          {lens.secondary ? <Stat label={lens.secondary.label} value={lens.secondary.value} /> : null}
          {/* A logged cycle always has a real count here, zero included.
              No cycle logged at all is not a count of zero pain days, it is
              no record to count, so it says so rather than asserting none. */}
          <Stat label="Pain days" value={current ? `${current.painDays}` : 'Not logged'} sub="this cycle" color={M.reported} />
        </View>
        {done.length ? (
          <>
            <Text style={[font('footnote'), d.chartLabel]}>Cycle length, last {done.length} cycles</Text>
            <LengthDots lengths={done.map((c) => c.window.length as number)} />
          </>
        ) : null}
        {/* Period products, only once she has logged some this period. */}
        {products ? <Text style={[font('subhead'), { color: C.text }]}>{displayCopy(products)}</Text> : null}
      </Card>

      {/* Pain and flare ups. With no cycle logged at all there is nothing on
          this card that is a finding about her: every figure would be an
          absence of a record, and four of them reading "None" would tell her
          she had no pain, no flare ups and no episodes when in truth nothing
          was ever written down. The severity chart below draws from the same
          empty summaries, so the whole card stays hidden until there is a
          cycle, the same way Sleep, Movement, Recovery, Check ins and
          Symptoms already handle having nothing to show. */}
      {current ? (
      <Card title="Pain and Flare Ups" meta="By cycle" onPress={() => open('cycleHistory')}>
        <View style={d.row3}>
          <Stat label="Highest this cycle" value={painFigure(current.maxSeverity, (v) => `${v} of 10`)} color={M.reported} />
          {/* Both counts are real within a logged cycle, zero included. */}
          <Stat label="Flare ups" value={`${current.flares}`} sub="you reported" color={M.reported} />
          <Stat label="Avg length" value={painFigure(current.hours, (v) => `${Math.round(v)}h`)} sub="per episode" />
        </View>
        {summaries.some((c) => c.maxSeverity != null) ? (
          <>
            <Text style={[font('footnote'), d.chartLabel]}>Highest severity, each cycle</Text>
            <HairlineChart values={summaries.map((c) => c.maxSeverity)} color={M.reported} dots height={52} first="Earliest" last="This cycle" />
          </>
        ) : null}
      </Card>
      ) : null}

      {/* Check ins */}
      {last ? (
      <Card title={GROUP.mind} meta="Last 14 days" onPress={() => open('journal')}>
        {(
          [
            { label: NAME.energy, key: 'energy' },
            { label: NAME.mood, key: 'mood' },
            { label: NAME.stress, key: 'stress' },
          ] as const
        ).map((row) => {
          const values = last14.map((x) => x[row.key]);
          // The day the most recent check in came from, not just its
          // value: a check in from earlier in the window is never spoken
          // as today's (the same fault the sleep note above it had).
          const latestDay = [...last14].reverse().find((x) => x[row.key] != null);
          return (
            <View key={row.key} style={d.checkRow}>
              <View style={{ width: 84 }}>
                <Text style={[font('subhead'), { color: C.text }]}>{row.label}</Text>
                <Text style={[font('caption1'), { color: C.secondary }]}>
                  {latestDay ? `${latestDay[row.key]} of 5, ${dayLabel(latestDay.date, now)}` : 'Not logged'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <HairlineChart values={values} color={M.reported} height={34} />
              </View>
            </View>
          );
        })}
        {/* What she logged under Mind, in the same card. */}
        {mindRows.map((r) => (
          <BarRow key={r.item} label={r.item} count={r.days} max={Math.max(1, ...mindRows.map((x) => x.days))} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
        ))}
      </Card>
      ) : null}

      {/* What she logged by category, in the last 30 days. A category she
          has logged nothing in has no card, so a new record stays short. */}
      {categoryCards.filter((c) => c.key === 'nutrition').map(({ key, summary }) => {
        const max = Math.max(1, ...summary.rows.map((r) => r.days));
        if (key === 'nutrition') {
          return (
            <View key={key} style={[d.card, d.mealCard]}>
              <GlassFill />
              <View style={d.mealBody}>
                {/* The card's name first, as every other card has it. */}
                <View style={d.cardHead}>
                  <Text style={[font('title3', 'semibold'), { color: C.text, flex: 1 }]}>{categoryOf(key).label}</Text>
                  <Text style={[font('footnote'), { color: C.secondary }]}>Last 30 days</Text>
                </View>
                {/* Her latest meal, by name and when she ate it. */}
                {meal ? (
                  <Text style={[font('headline'), { color: C.text }]}>
                    {displayCopy(meal.title)}
                    <Text style={[font('subhead'), { color: C.secondary }]}>{`  ${meal.meal}`}</Text>
                  </Text>
                ) : null}
                {/* Calories (design: IMG_4912). Every scanned figure stays
                    marked as an estimate. */}
                {calories ? (
                  <View style={d.cal} onLayout={(e) => setDialWidth(e.nativeEvent.layout.width)}>
                    <Text style={[font('subhead'), { color: C.secondary }]}>{calories.title}</Text>
                    <View style={d.calTop}>
                      <View style={d.calFigure}>
                        <Text style={[numeral(48), { color: C.text }]}>{calories.kcal ?? 'Not yet'}</Text>
                        {calories.kcal ? <Text style={[font('footnote'), { color: C.secondary }]}>KCAL</Text> : null}
                      </View>
                      <View style={d.calSide}>
                        <Text style={[font('footnote'), { color: C.text }]}>{calories.protein} protein</Text>
                        <Text style={[font('footnote'), { color: C.text }]}>{calories.fat} fat</Text>
                      </View>
                    </View>
                    {calories.estimated ? <Text style={[font('caption1'), d.note]}>Estimated from your meal photos</Text> : null}
                    {calories.dial && dialWidth ? (
                      <>
                        <CaloriesDial fill={calories.dial.fill} width={dialWidth} />
                        <Text style={[font('caption1'), d.calDialLabel]}>{calories.dial.label}</Text>
                      </>
                    ) : null}
                    {calories.note ? (
                      <View style={d.calNote}>
                        <Text style={[font('footnote', 'semibold'), { color: C.text }]}>From your record</Text>
                        <Text style={[font('footnote'), d.note]}>{displayCopy(calories.note)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {summary.rows.map((r) => (
                  <BarRow key={r.item} label={r.item} count={r.days} max={max} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
                ))}
              </View>
            </View>
          );
        }
        return (
          <Card key={key} title={categoryOf(key).label} meta="Last 30 days">
            {summary.rows.map((r) => (
              <BarRow key={r.item} label={r.item} count={r.days} max={max} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
            ))}
            {summary.extra ? <Text style={[font('footnote'), d.note]}>{displayCopy(summary.extra)}</Text> : null}
          </Card>
        );
      })}

      {/* Gut: bowel movements by Bristol type, and what she logged under
          Gut. Opens the Gut screen, in and out. */}
      {gut.count || gutRows.length ? (
        <Card title={GROUP.gut} meta="Last 28 days" onPress={() => open('gut')}>
          {gut.count ? (
            <View style={d.row3}>
              <Stat label={NAME.bowel} value={`${gut.count}`} sub={gut.perDay ?? undefined} />
              {gut.mix.hard + gut.mix.typical + gut.mix.loose ? (
                <Stat
                  label="Typical form"
                  value={`${Math.round((gut.mix.typical / (gut.mix.hard + gut.mix.typical + gut.mix.loose)) * 100)}%`}
                  sub="Bristol types 3 and 4"
                />
              ) : null}
            </View>
          ) : null}
          {gutRows.map((r) => (
            <BarRow key={r.item} label={r.item} count={r.days} max={Math.max(1, ...gutRows.map((x) => x.days))} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
          ))}
        </Card>
      ) : null}

      {/* Symptoms and digestion */}
      {symptomTally.length ? (
      <Card title={GROUP.symptoms} meta="Last 60 days" onPress={() => open('symptoms')}>
        {symptomTally.slice(0, 5).map((t) => (
          <BarRow key={t.label} label={t.label} count={t.count} max={symptomMax} color={M.reported} unit=" days" />
        ))}
      </Card>
      ) : null}

      {/* The rest of what she logged by category, in the last 30 days. A category she
          has logged nothing in has no card, so a new record stays short. */}
      {categoryCards.filter((c) => c.key !== 'nutrition').map(({ key, summary }) => {
        const max = Math.max(1, ...summary.rows.map((r) => r.days));
        if (key === 'nutrition') {
          return (
            <View key={key} style={[d.card, d.mealCard]}>
              <GlassFill />
              <View style={d.mealBody}>
                {/* The card's name first, as every other card has it. */}
                <View style={d.cardHead}>
                  <Text style={[font('title3', 'semibold'), { color: C.text, flex: 1 }]}>{categoryOf(key).label}</Text>
                  <Text style={[font('footnote'), { color: C.secondary }]}>Last 30 days</Text>
                </View>
                {/* Her latest meal, by name and when she ate it. */}
                {meal ? (
                  <Text style={[font('headline'), { color: C.text }]}>
                    {displayCopy(meal.title)}
                    <Text style={[font('subhead'), { color: C.secondary }]}>{`  ${meal.meal}`}</Text>
                  </Text>
                ) : null}
                {/* Calories (design: IMG_4912). Every scanned figure stays
                    marked as an estimate. */}
                {calories ? (
                  <View style={d.cal} onLayout={(e) => setDialWidth(e.nativeEvent.layout.width)}>
                    <Text style={[font('subhead'), { color: C.secondary }]}>{calories.title}</Text>
                    <View style={d.calTop}>
                      <View style={d.calFigure}>
                        <Text style={[numeral(48), { color: C.text }]}>{calories.kcal ?? 'Not yet'}</Text>
                        {calories.kcal ? <Text style={[font('footnote'), { color: C.secondary }]}>KCAL</Text> : null}
                      </View>
                      <View style={d.calSide}>
                        <Text style={[font('footnote'), { color: C.text }]}>{calories.protein} protein</Text>
                        <Text style={[font('footnote'), { color: C.text }]}>{calories.fat} fat</Text>
                      </View>
                    </View>
                    {calories.estimated ? <Text style={[font('caption1'), d.note]}>Estimated from your meal photos</Text> : null}
                    {calories.dial && dialWidth ? (
                      <>
                        <CaloriesDial fill={calories.dial.fill} width={dialWidth} />
                        <Text style={[font('caption1'), d.calDialLabel]}>{calories.dial.label}</Text>
                      </>
                    ) : null}
                    {calories.note ? (
                      <View style={d.calNote}>
                        <Text style={[font('footnote', 'semibold'), { color: C.text }]}>From your record</Text>
                        <Text style={[font('footnote'), d.note]}>{displayCopy(calories.note)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {summary.rows.map((r) => (
                  <BarRow key={r.item} label={r.item} count={r.days} max={max} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
                ))}
              </View>
            </View>
          );
        }
        return (
          <Card key={key} title={categoryOf(key).label} meta="Last 30 days">
            {summary.rows.map((r) => (
              <BarRow key={r.item} label={r.item} count={r.days} max={max} color={M.reported} unit={r.days === 1 ? ' day' : ' days'} />
            ))}
            {summary.extra ? <Text style={[font('footnote'), d.note]}>{displayCopy(summary.extra)}</Text> : null}
          </Card>
        );
      })}

      {/* Medications and supplements she named, kept apart, with when
          each was last logged. */}
      {named.length ? (
        <Card title={GROUP.medications} meta={`${meds.medications.length} medications, ${meds.supplements.length} supplements`} onPress={() => open('medications')}>
          {named.map((m, n) => (
            <View key={`${m.kind}-${m.name}`} style={[d.medRow, n > 0 && d.sep]}>
              <View style={[d.medLine, { backgroundColor: m.kind === 'Medication' ? M.measured : M.reported }]} />
              <View style={{ flex: 1 }}>
                <Text style={[font('subhead'), { color: C.text }]}>{displayCopy(m.name)}</Text>
                <Text style={[font('caption1'), { color: C.secondary }]}>
                  {`${m.kind} · ${m.last ? `last logged ${m.last}` : 'not logged yet'}`}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Labs: her latest visit, each result with its status and range. */}
      {latestDraw ? (
        <Card title={GROUP.labs} meta={labDay(latestDraw.on)} onPress={() => open('healthrecords')}>
          {latestDraw.results.map((r, n) => (
            <View key={r.id} style={[d.labRow, n > 0 && d.sep]}>
              <View style={d.labHead}>
                <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>{r.name}</Text>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>
                  {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : (r.valueText ?? '')}
                </Text>
              </View>
              <LabRangeBar result={r} height={5} />
              <LabStatusTag result={r} small />
            </View>
          ))}
        </Card>
      ) : null}

      {/* Weather: the background, never about her body. Drawn only once
          there is weather to show. */}
      {weather.length ? (
      <Card title={GROUP.weather} meta="Last 7 days">
        {weather.map((line) => (
          <Text key={line} style={[font('subhead'), { color: C.text }]}>
            {displayCopy(line)}
          </Text>
        ))}
        <Text style={[font('caption1'), d.note]}>Around you, not about your body.</Text>
      </Card>
      ) : null}

      {/*
        Health Records, Your Notes and Connected Sources used to sit here.
        Records is the Health tab's third view now, notes are reached from
        logging, and sources live in Profile, so three rows of doors to
        elsewhere were taken off the end of the dashboard.
      */}
    </View>
  );
}

// The logging categories that have a dashboard card, in the Log screen's
// order. Cycle has its own card above, Context and Note are not tallies.
// Gut and Mind have cards of their own above, which carry their category's
// rows, so they are not repeated here.
const CATEGORY_CARDS: CategoryKey[] = ['nutrition', 'body', 'skin', 'sexual', 'meds', 'supplements'];

const d = StyleSheet.create({
  // The Nutrition card: no photo across the top; the usual padding.
  mealCard: { padding: 0, overflow: 'hidden', gap: 0 },
  mealBody: { padding: 16, gap: 10 },
  cal: { gap: 6, paddingBottom: 6 },
  calTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  calFigure: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  calSide: { alignItems: 'flex-end', gap: 4, paddingBottom: 8 },
  calDialLabel: { color: C.secondary, textAlign: 'center', marginTop: -8 },
  calNote: { alignItems: 'center', gap: 2, marginTop: 6 },
  stack: { gap: 16, marginTop: 4 },
  pressed: { opacity: 0.55 },
  card: { backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 16, gap: 10, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  sleepTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 10, padding: 12, gap: 4, overflow: 'hidden' },
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
  vital: { gap: 6, paddingVertical: 8 },
  vitalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
