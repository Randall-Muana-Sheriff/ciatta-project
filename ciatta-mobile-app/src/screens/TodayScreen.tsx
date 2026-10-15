import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { headlineMetrics } from '../lib/allMetrics';
import { bloodOxygen, bloodPressure, type VitalCard } from '../lib/vitals';
import { displayCopy } from '../lib/displayCopy';
import { fitTitle } from '../lib/fitTitle';
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
import { useCyclePosition } from '../state/cyclePosition';
import { useInsights } from '../state/insights';
import { useData, useRepo, useSession } from '../state/session';
import { connectAppleHealth } from '../lib/connectHealth';
import { chooseLogCategory } from '../lib/logHandoff';
import { LogBox } from '../ui/LogBox';
import { LatestActivity } from '../ui/LatestActivity';
import { InsightCards } from '../ui/InsightCards';
import { todayState } from '../lib/todayState';
import { userFacingError } from '../lib/userFacingError';
import { TodayStart } from '../ui/TodayStart';
import { DayPair } from '../ui/DayPair';
import { DAY_READ, dayPatterns } from '../lib/dayPatterns';
import { SymptomCompare } from '../ui/SymptomCompare';
import { symptomStrip, type Range as StripRange } from '../lib/symptomStrip';
import { symptomDays } from '../lib/symptomsView';
import { useSymptomChoice } from '../state/symptomChoice';
import { logNeeds } from '../lib/logNeeds';
import { useQuickLogSave } from '../state/quickLogSave';
import { handPhoto } from '../lib/scanHandoff';
import { BOWEL } from '../lib/logCategories';
import type { IntradayPoint } from '../data/repo';
import type { JournalView } from '../data/rows';
import { actionPlan, type PlanItem, type PlanKey } from '../lib/actionPlan';
import { usePlanDone } from '../state/planDone';
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { useDeviceCalendar } from '../state/deviceCalendar';
import { font, GUTTER } from '../theme';
import { SectionHeading } from '../ui/kit';
import { Wordmark } from '../ui/Wordmark';
import { ground, HUE, L, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { ListGroup, ListRow } from '../ui/chrome';
import { MetricCard, METRIC_CARD_GAP } from '../ui/metricCard';
import { METRIC_HUE } from '../ui/metricHue';
import { METRIC_ICON } from '../ui/metricIcon';
import { chooseMetric } from '../lib/metricHandoff';
import { type BaselineRow, type MetricKey, usualFor } from '../lib/metricDetail';
import { ProductNowCard } from '../ui/ProductNowCard';
import type { IconName } from '../ui/icons';
import { Icon } from '../ui/icons';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';
import { chip } from '../ui/chip';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}


export function TodayScreen() {
  const nav = useNav();
  const { width: screenWidth } = useWindowDimensions();
  const { accept, watching, setWatching, episodes } = useCycle();
  const { today: brief, ranked } = useInsights();
  const { windows, signals, lens, profile, fertility } = useCycleInsights();
  const { person, days } = useData();
  const repo = useRepo();
  const { mode, userId, reloadDays } = useSession();
  const week = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + 8 * 86400000) };
  }, []);
  const calendar = useDeviceCalendar(week.from, week.to);
  const nextVisit = useMemo(() => upcomingVisits(calendar.events, new Date(), 7)[0] ?? null, [calendar.events]);

  // Which Today she meets: the empty state with the way in, or her day.
  const state = useMemo(() => todayState({ days, windows: windows.length, logs: signals.length }), [days, windows, signals]);

  // The two kinds of logging, apart and named the same everywhere: the
  // daily symptoms log, and the cycle experience.
  const logSymptoms = () => {
    chooseLogCategory('symptoms');
    nav.push('quickLog');
  };
  // The cycle is logged the same way as everything else: the Log screen on
  // Cycle, voice and text first, the step by step form a link inside it.
  const logCycle = () => {
    chooseLogCategory('cycle');
    nav.push('quickLog');
  };

  // Connecting Apple Health from Today, the same sequence Profile and
  // onboarding run, then her days read again so Today fills in place.
  const [connecting, setConnecting] = useState(false);
  const [connectNote, setConnectNote] = useState<string | null>(null);
  const connect = async () => {
    if (mode === 'demo') {
      setConnectNote('This is an example person. Sign in to connect your own sources.');
      return;
    }
    if (!userId || connecting) return;
    setConnecting(true);
    try {
      const result = await connectAppleHealth({
        userId,
        saveStatus: (kind, status, lastSyncedAt) => repo.saveSourceStatus(kind, status, lastSyncedAt),
        onNote: setConnectNote,
      });
      setConnectNote(result.connected ? null : result.message);
      await reloadDays();
    } catch (e) {
      setConnectNote(userFacingError(e, 'Apple Health did not connect. Try again.'));
    } finally {
      setConnecting(false);
    }
  };

  // Today's measured readings, by the hour they happened. daily_metrics is
  // one row per day, which cannot draw a day.
  // Blood pressure, blood oxygen and weight live in observations rather
  // than on the day row, so they are read separately.
  const [vitals, setVitals] = useState<VitalCard[]>([]);
  // Her usual for each metric, so each card's arrow measures against it.
  const [baselines, setBaselines] = useState<BaselineRow[]>([]);
  useEffect(() => {
    let ignore = false;
    Promise.all([repo.loadVitals(), repo.loadBaselines().catch(() => [] as BaselineRow[])])
      .then(([rows, usual]) => {
        if (ignore) return;
        const now = new Date();
        const median = (metric: string) => {
          const b = usual.find((x) => x.metric === metric);
          return b?.sufficient ? b.median : null;
        };
        setBaselines(usual);
        setVitals([bloodPressure(rows, now, median('blood_pressure_systolic')), bloodOxygen(rows, now, median('oxygen_saturation'))]);
      })
      .catch(() => {
        // The cards say not yet, which is true when the read failed too.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);

  // Where today sits in her cycle, and its phase, shared with the Today's
  // patterns detail so the two never disagree.
  const { cycleNow, phaseText } = useCyclePosition();

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // Today's own row, when there is one. days arrives oldest first.
  const todayDay = useMemo(() => {
    const iso = new Date();
    const key = `${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}`;
    return days.find((d) => d.date === key) ?? null;
  }, [days]);

  const go = (screen: Screen) => () => nav.push(screen);
  const now = new Date();

  // Today's plan: what she could do today, each item with its reason in
  // her own numbers. See lib/actionPlan.
  const usualOf = (key: 'sleep' | 'hrv' | 'rhr' | 'steps') => usualFor(key, baselines);
  const usualLength = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
  const loggedToday =
    episodes.some((e) => e.date === todayKey) ||
    (!!todayDay && ([todayDay.mood, todayDay.energy, todayDay.stress].some((v) => v != null) || todayDay.foods.length > 0));
  const plan = actionPlan({
    days,
    usual: {
      sleep: usualOf('sleep')?.median ?? null,
      hrv: usualOf('hrv'),
      rhr: usualOf('rhr'),
      steps: usualOf('steps')?.median ?? null,
    },
    cycle: cycleNow ? { day: cycleNow.day, usualLength, bleeding: cycleNow.phase === 'During period' } : null,
    loggedToday,
    visit: nextVisit ? { title: nextVisit.title, when: visitWhen(nextVisit, now) } : null,
    watchSuggested: brief.lead?.id === 'combined' && watching.nextCycle !== true,
    raise: ranked.find((i) => i.triage === 'Investigate')?.title ?? null,
    walkSuggested: !!brief.recommendation && !brief.walkPlanned,
    now,
  });
  const { done, toggle } = usePlanDone(now);
  const PLAN_ICON: Record<PlanKey, IconName> = {
    visit: 'calendarPlus', prepare: 'stethoscope', flow: 'drop', period: 'drop', recover: 'heartPulse', sleep: 'sleep', walk: 'steps', watch: 'target', log: 'plus',
  };
  const openMetric = (key: MetricKey) => {
    chooseMetric(key);
    nav.push('metric');
  };
  const doItem = (item: PlanItem) => {
    switch (item.key) {
      case 'visit':
      case 'prepare':
        return nav.push('appointment');
      case 'flow':
        return logCycle();
      case 'period':
        return nav.push('cycle');
      case 'recover':
        return openMetric('hrv');
      case 'sleep':
        return openMetric('sleep');
      case 'walk':
        if (brief.recommendation && !brief.walkPlanned) accept('walk');
        return openMetric('steps');
      case 'watch':
        setWatching('nextCycle', true);
        return toggle('watch');
      case 'log':
        return logSymptoms();
    }
  };

  // Today's Patterns: today's wearable readings, hour by hour. Labs are
  // snapshots and the cycle runs in months, so neither is drawn on a day.
  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    let ignore = false;
    repo
      .loadIntraday(midnight.toISOString(), DAY_READ)
      .then((rows) => !ignore && setIntraday(rows))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);
  const dayView = useMemo(() => dayPatterns(intraday, new Date()), [intraday]);

  // Symptoms side by side, from every place she logs them.
  const [journal, setJournal] = useState<JournalView | null>(null);
  // Read again after anything is logged from Today, so what is asked for
  // next reflects it.
  const [logged, setLogged] = useState(0);
  useEffect(() => {
    repo.loadJournal().then(setJournal).catch(() => {});
  }, [repo, nav.depth, logged]);
  const [mealsToday, setMealsToday] = useState(0);
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    repo
      .loadMeals(midnight.toISOString())
      .then((m) => setMealsToday(m.length))
      .catch(() => {});
  }, [repo, nav.depth, logged]);
  const [stripRange, setStripRange] = useState<StripRange>('7');
  // The symptoms she chose to follow and compare, and every day each was
  // logged, from every place she logs them.
  const [chosen, setChosen] = useSymptomChoice();
  const seen = useMemo(
    () => symptomDays({ signals, logs: (journal?.months ?? []).flatMap((m) => m.items), days, now: new Date() }),
    [signals, journal, days],
  );
  const strip = useMemo(() => symptomStrip(seen, stripRange, new Date(), 4, chosen), [seen, stripRange, chosen]);

  // What the You can box asks for: only what is not logged yet today.
  const quickSave = useQuickLogSave();
  const needs = useMemo(() => {
    const today = todayKey;
    const symptomsToday = [...seen.values()].some((d) => d.has(today));
    const cycleToday = episodes.some((e) => e.date === today && e.kinds.some((k) => k !== 'Pain' && k !== BOWEL));
    const frequent = [...seen.entries()].sort((a, b) => b[1].size - a[1].size).map(([name]) => name);
    const usual = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    return logNeeds({
      symptomsToday,
      cycleToday,
      mealsToday: mealsToday + (todayDay?.foods.length ? 1 : 0),
      cycle: cycleNow ? { day: cycleNow.day, usualLength: usual, bleeding: cycleNow.phase === 'During period' } : null,
      frequent,
      now: new Date(),
    });
  }, [seen, episodes, mealsToday, todayDay, cycleNow, lens, windows, profile, todayKey]);

  const hello = displayCopy(person ? `${greeting(now)}, ${person.firstName}` : greeting(now));
  const helloSize = fitTitle(hello, screenWidth - GUTTER * 2);

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
        {/* Profile lives in the corner menu now; the space stays so the
            wordmark stays centred. */}
        <View style={t.menu} />
        <Wordmark />
        <Pressable
          onPress={go('calendar')}
          accessibilityRole="button"
          accessibilityLabel="Your calendar"
          hitSlop={10}
          style={({ pressed }) => [t.menu, pressed && t.pressed]}
        >
          <Icon name="calendar" size={25} color={G.ink} />
        </Pressable>
      </View>

      <View style={t.pad}>
        {/* One row on every phone, the whole name shown: Title 1 where it fits, sized
            down from the screen's width for a long name. */}
        <Text
          style={[font('title1', 'medium'), t.hello, { fontSize: helloSize, lineHeight: Math.round(helloSize * 1.2) }]}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {hello}
        </Text>

        {state.state === 'empty' ? (
          <TodayStart
            onConnect={() => void connect()}
            connecting={connecting}
            note={connectNote}
            onLogSymptoms={logSymptoms}
            onLogCycle={logCycle}
          />
        ) : (
          <>
        {/*
          Today's patterns: the day itself, or a plain line saying there is
          not enough of it yet. A chart drawn from one reading would be a
          shape Ciatta chose rather than one she produced.
        */}
        <View style={t.headed}>
          <SectionHeading
            title="Today's patterns"
            right={
              <Pressable onPress={go('patterns')} accessibilityRole="button" accessibilityLabel="Open Today's patterns" hitSlop={8} style={t.all}>
                <Text style={[font('subhead'), t.headRight]}>{now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <Icon name="chevronRight" size={14} color={G.meta} />
              </Pressable>
            }
          />
        </View>
        {/*
          The whole card opens the detail: the day in full, and a toggle to
          the Journey timeline. The chips inside still switch the pair, and
          the cycle row still logs a period when none is open.
        */}
        <Pressable
          onPress={go('patterns')}
          accessibilityRole="button"
          accessibilityHint="Opens Today's patterns, with your Journey timeline"
          style={({ pressed }) => [t.dayCard, pressed && t.cardPressed]}
        >
          <CardFill />
          {/*
            The day itself, from her wearable: two metrics at a time on the
            day's hours, so one can be read against the other.
          */}
          {dayView.series.length ? (
            <DayPair
              view={dayView}
              usual={{
                hrv: usualFor('hrv', baselines)?.median,
                oxygen_saturation: usualFor('spo2', baselines)?.median,
              }}
            />
          ) : (
            <Text style={[font('subhead'), t.dayEmpty]}>
              Your day appears here as your watch or ring sends heart rate, HRV and steps.
            </Text>
          )}

          {/*
            Where she is in her cycle, under the day it belongs to. It
            lives here rather than among the metrics because it is not a
            metric: it is the context the day is read in, and it is the
            one thing on this card she reported rather than a device
            measured.
          */}
          <Pressable
            disabled={!!cycleNow}
            onPress={logCycle}
            accessibilityRole={cycleNow ? undefined : 'button'}
            accessibilityHint={cycleNow ? undefined : 'Opens Log Cycle Experience'}
            style={({ pressed }) => [t.cycleRow, pressed && !cycleNow ? t.pressed : null]}
          >
            <View>
              <Text style={[font('caption1'), t.cycleKey]}>CYCLE</Text>
              <Text style={[font('headline'), cycleNow ? t.cycleValue : t.cycleNone]}>
                {cycleNow ? `Day ${cycleNow.day}` : 'No logged cycle'}
              </Text>
            </View>
            {phaseText ? (
              <Text style={[font('footnote', 'semibold'), t.phase]}>{phaseText}</Text>
            ) : !cycleNow ? (
              <Text style={[font('footnote', 'semibold'), t.phase]}>Log a period</Text>
            ) : null}
          </Pressable>
        </Pressable>

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

        <View style={t.section}>
          <SectionHeading
            title="Metrics"
            right={
          <Pressable
            onPress={go('metrics')}
            accessibilityRole="button"
            accessibilityLabel="All your metrics, as a dashboard or a list"
            hitSlop={8}
            style={({ pressed }) => [t.all, pressed && t.pressed]}
          >
            <Text style={[font('footnote', 'semibold'), t.allText]}>All</Text>
            <Icon name="chevronRight" size={14} color={G.body} />
          </Pressable>
            }
          />
        </View>
        {state.measured ? (
        // One container on a photograph, and the six as frosted glass tiles
        // over it.
        <View style={t.metricsCard}>
          <CardFill />
          {/*
            Six cards and nothing else. The card holds only metrics now:
            the chart and the cycle moved up into Today's Patterns, where
            the one is the day drawn and the other is the context it is
            read in.
          */}
          <View style={t.grid}>
            {headlineMetrics(days, vitals, new Date(), baselines).map((m) => (
              <Pressable
                key={m.key}
                style={({ pressed }) => [chip.tile, t.gridCell, pressed && t.pressed]}
                onPress={() => {
                  chooseMetric(m.key as MetricKey);
                  nav.push('metric');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}, ${m.value ?? 'not recorded today'}${m.note && m.value ? `, ${m.note}` : ''}`}
                accessibilityHint="Opens this metric over time"
              >
                <MetricCard
                  label={m.label}
                  value={m.value}
                  note={m.note}
                  from={m.from}
                  trend={m.trend}
                  color={METRIC_HUE[m.key]}
                  icon={METRIC_ICON[m.key]}
                />
              </Pressable>
            ))}
          </View>
  
          </View>
        ) : (
          // Nothing measured yet: one row that says how to fill this,
          // rather than six cards reading Not yet.
          <ListGroup light style={{ marginTop: SPACE.tight }}>
            <ListRow
              light
              first
              icon="heart"
              title={connecting ? 'Connecting' : 'Connect a Source'}
              sub={connectNote ?? 'Connect Apple Health to see your sleep, HRV, steps and more each day.'}
              onPress={connecting ? undefined : () => void connect()}
            />
          </ListGroup>
        )}

          </>
        )}

        {/*
          Two ways in, and only two. One adds to the record, the other
          takes the record somewhere, and everything else she might do is
          reachable from the screen it belongs to.
        */}
        <View style={t.section}>
          <SectionHeading title="You can log" />
          <View style={t.youCan}>
            <CardFill />
            {/* Logging, one step from here: the topic, then speak, type or
                take a photo. The Log screen opens already doing it. */}
            <LogBox
              needs={needs}
              onSave={async (entry) => {
                const saved = await quickSave(entry);
                if (saved) {
                  setLogged((n) => n + 1);
                  void reloadDays();
                }
                return saved;
              }}
              onMealPhoto={(uri) => {
                handPhoto(uri);
                nav.push('foodScan');
              }}
              onMore={() => nav.push('quickLog')}
            />
          </View>
        </View>

        {/* Research that connects to her own record. */}
        {state.state === 'content' ? (
          <View style={t.section}>
            <InsightCards />
          </View>
        ) : null}

        {state.state !== 'empty' ? (
          <>
        {/*
          What today's pattern suggests trying, which only exists when the
          pattern does. The concept calls this the try block and gives it
          one job: the thing she might do about what she just read.
        */}
        <View style={t.section}>
          <SectionHeading
            title="What you could try"
            right={
              plan.length ? (
                <Text style={[font('subhead'), t.headRight]}>
                  {`${plan.filter((p) => done.includes(p.key)).length} of ${plan.length} done`}
                </Text>
              ) : undefined
            }
          />
          {plan.length ? (
            <View style={t.plan}>
              <CardFill />
              {plan.map((item, n) => {
                const ticked = done.includes(item.key);
                return (
                  <View key={item.key} style={[t.planRow, n > 0 && t.planRule]}>
                    <Pressable
                      onPress={() => toggle(item.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ticked }}
                      accessibilityLabel={`Mark ${item.title} done`}
                      hitSlop={8}
                      style={[t.tick, ticked && t.tickOn]}
                    >
                      {ticked ? <Icon name="check" size={14} color={L.onPill} weight={2} /> : null}
                    </Pressable>
                    <Pressable
                      onPress={() => doItem(item)}
                      accessibilityRole="button"
                      style={({ pressed }) => [t.planBody, pressed && t.pressed]}
                    >
                      <View style={t.planTitleRow}>
                        <Icon name={PLAN_ICON[item.key]} size={16} color={ticked ? L.meta : L.ink} />
                        <Text style={[font('subhead', 'semibold'), ticked ? t.planDone : t.planTitle]}>{displayCopy(item.title)}</Text>
                      </View>
                      <Text style={[font('footnote'), t.planWhy]}>{displayCopy(item.why)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            // Nothing earned today: said, with when the plan comes back.
            <View style={[t.plan, t.planEmpty]}>
              <CardFill />
              <Icon name="check" size={20} color={L.meta} />
              <Text style={[font('subhead', 'semibold'), t.planTitle]}>Nothing needs doing today</Text>
              <Text style={[font('footnote'), t.planWhy, { textAlign: 'center' }]}>
                Your plan is built each morning from your sleep, heart, cycle and logs. New items appear here as readings arrive.
              </Text>
            </View>
          )}
        </View>

        </>
        ) : null}
        {/* Symptoms side by side, below the ways in. */}
        {state.state === 'content' ? (
          <View style={t.section}>
            <SymptomCompare
              strip={strip}
              range={stripRange}
              onRange={setStripRange}
              seen={seen}
              days={days}
              chosen={chosen}
              onChoose={setChosen}
              onAll={go('symptoms')}
            />
          </View>
        ) : null}

        {/* The latest thing in her record, last on the page. */}
        {state.state === 'content' ? (
          <View style={t.section}>
            <LatestActivity />
          </View>
        ) : null}
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
  section: { marginTop: SPACE.section },
  headed: { marginTop: SPACE.near },
  headRight: { color: G.meta },
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
  hello: { color: G.ink, letterSpacing: 0.2 },

  dayCard: {
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.8 },
  dayEmpty: { color: L.body, lineHeight: 21, paddingVertical: 10 },

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
  // Each metric its own card, on the same ground as every other card.
  metricsCard: { borderRadius: TILE_RADIUS, overflow: 'hidden', backgroundColor: L.glass, padding: 10 },
  // Each metric as the body system chips are drawn: no fill, a hairline
  // edge (chip.tile), on the card's own glow.
  gridCell: {
    width: '30%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  cycleKey: { color: L.meta, letterSpacing: 0.9 },
  cycleValue: { color: L.ink },
  // A figure she has not produced today reads as absent, not as zero.
  cycleNone: { color: L.meta },

  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  allText: { color: G.body },

  youCan: {
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: L.glass,
  },
  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    padding: 18,
    overflow: 'hidden',
  },
  chart: { flex: 1, aspectRatio: 190 / 150 },
  plan: {
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  planRow: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  planRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: L.meta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickOn: { backgroundColor: L.ink, borderColor: L.ink },
  planBody: { flex: 1, gap: 4 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { color: L.ink },
  planDone: { color: L.meta, textDecorationLine: 'line-through' },
  planWhy: { color: L.body, lineHeight: 19 },
  planEmpty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
});
