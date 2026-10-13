import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { headlineMetrics } from '../lib/allMetrics';
import { bloodOxygen, bloodPressure, type VitalCard } from '../lib/vitals';
import { displayCopy } from '../lib/displayCopy';
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
import { useInsights } from '../state/insights';
import { intelligenceLine, patternReadiness } from '../lib/patternReadiness';
import { todayInsight } from '../lib/todayInsight';
import { useData, useRepo, useSession } from '../state/session';
import { connectAppleHealth } from '../lib/connectHealth';
import { chooseLogCategory, chooseLogMode } from '../lib/logHandoff';
import { LogBox } from '../ui/LogBox';
import { todayState } from '../lib/todayState';
import { userFacingError } from '../lib/userFacingError';
import { TodayStart } from '../ui/TodayStart';
import { DayPair } from '../ui/DayPair';
import { DAY_READ, dayPatterns } from '../lib/dayPatterns';
import { SymptomCompare } from '../ui/SymptomCompare';
import { symptomStrip, type Range as StripRange } from '../lib/symptomStrip';
import { symptomDays } from '../lib/symptomsView';
import type { IntradayPoint } from '../data/repo';
import type { JournalView } from '../data/rows';
import { actionPlan, type PlanItem, type PlanKey } from '../lib/actionPlan';
import { usePlanDone } from '../state/planDone';
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { useDeviceCalendar } from '../state/deviceCalendar';
import { font, fonts, GUTTER } from '../theme';
import { Eyebrow, Tile } from '../ui/bento';
import { Wordmark } from '../ui/Wordmark';
import { ground, HUE, L, mark, NAV_CLEARANCE, SPACE, TILE_RADIUS } from '../ui/surface';
import { ListGroup, ListRow } from '../ui/chrome';
import { images } from '../ui/images';
import { MetricCard, METRIC_CARD_GAP } from '../ui/metricCard';
import { METRIC_HUE } from '../ui/metricHue';
import { METRIC_ICON } from '../ui/metricIcon';
import { chooseMetric } from '../lib/metricHandoff';
import { type BaselineRow, type MetricKey, usualFor } from '../lib/metricDetail';
import { ProductNowCard } from '../ui/ProductNowCard';
import type { IconName } from '../ui/icons';
import { Icon } from '../ui/icons';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

type Action = { key: string; icon: IconName; title: string; sub?: string; onPress?: () => void };

export function TodayScreen() {
  const nav = useNav();
  const { accept, watching, setWatching, episodes } = useCycle();
  const { today: brief, ranked } = useInsights();
  const { windows, signals, lens, profile, fertility } = useCycleInsights();
  const { person, today, days, todayIsPlaceholder } = useData();
  const { setFocus } = useCycle();
  const insightCard = useMemo(() => {
    const ready = patternReadiness(days);
    const found = ranked.filter((i) => i.triage === 'Surface' || i.triage === 'Investigate').length;
    const watching = ranked.filter((i) => i.triage === 'Watch').length;
    return todayInsight({ leadId: brief.lead?.id ?? null, leadText: brief.text, fallback: intelligenceLine(days, ready, found, watching) });
  }, [brief, ranked, days]);
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
    chooseLogCategory('body');
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

  // Where today sits in her cycle. Null when there is no open cycle or
  // when it has been left open too long to mean anything, and the header
  // then says nothing rather than guessing.
  //
  // Kept as the object rather than only its line, because Metrics shows the
  // two halves apart: the day is a number she can read like a step count,
  // and the phase is the part that means something.
  const cycleNow = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const predicted = lens.predicts ? medianLength(countedWindows(windows, profile)) : null;
    return cycleToday(open && !open.end ? open : null, predicted, new Date());
  }, [windows, lens, profile]);

  // The phase, in the corner of the cycle row.
  //
  // The clinical name when it has been earned: only a confirmed ovulation
  // counts, from a logged test or a temperature shift. Otherwise an
  // estimate, and the label says "Likely" so an estimate is never shown as
  // a position.
  const phaseText = useMemo(() => {
    const open = windows[windows.length - 1] ?? null;
    const confirmed =
      fertility?.confirmedThisCycle && open
        ? ([...(fertility.past ?? [])]
            .reverse()
            .find((o) => o.date >= open.start)?.date ?? null)
        : null;
    const today = new Date();
    const bleeding = !!open && !open.end && cycleNow != null && cycleNow.day <= 5 && cycleNow.phase === 'During period';
    const clinical = clinicalPhase({ date: today, bleeding, ovulation: confirmed });
    if (clinical) return clinicalPhaseLabel(clinical);
    // Nothing confirmed, so an estimate from the day and her own usual
    // length, labelled as one. An empty corner told her nothing about where
    // she is; "Likely follicular" tells her something and says how sure.
    if (!cycleNow) return null;
    return estimatedPhaseLabel(estimatedPhase(cycleNow.day, medianLength(countedWindows(windows, profile))));
  }, [windows, fertility, cycleNow, profile]);

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
  useEffect(() => {
    repo.loadJournal().then(setJournal).catch(() => {});
  }, [repo, nav.depth]);
  const [stripRange, setStripRange] = useState<StripRange>('7');
  const strip = useMemo(
    () =>
      symptomStrip(
        symptomDays({ signals, logs: (journal?.months ?? []).flatMap((m) => m.items), days, now: new Date() }),
        stripRange,
        new Date(),
      ),
    [signals, journal, days, stripRange],
  );

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
        <Pressable
          onPress={go('profile')}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={10}
          style={({ pressed }) => [t.menu, pressed && t.pressed]}
        >
          <Icon name="menu" size={26} color={L.ink} />
        </Pressable>
        <Wordmark />
        <Pressable
          onPress={go('calendar')}
          accessibilityRole="button"
          accessibilityLabel="Your calendar"
          hitSlop={10}
          style={({ pressed }) => [t.menu, pressed && t.pressed]}
        >
          <Icon name="calendar" size={25} color={L.ink} />
        </Pressable>
      </View>

      <View style={t.pad}>
        <Text style={[font('title2'), t.hello]} accessibilityRole="header">
          {displayCopy(person ? `${greeting(now)}, ${person.firstName}` : greeting(now))}
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
        <View style={t.dayCard}>
          <View style={t.dayHead}>
            <Text style={[font('caption1'), t.dayHeadText]}>TODAY&rsquo;S PATTERNS</Text>
            <Text style={[font('caption1'), t.dayHeadText]}>
              {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
            </Text>
          </View>
          {/*
            The day itself, from her wearable: two metrics at a time on the
            day's hours, so one can be read against the other.
          */}
          {dayView.series.length ? (
            <DayPair view={dayView} />
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
        </View>

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

        <View style={t.sectionHead}>
          <Eyebrow>Metrics</Eyebrow>
          <Pressable
            onPress={go('metrics')}
            accessibilityRole="button"
            accessibilityLabel="All your metrics, as a dashboard or a list"
            hitSlop={8}
            style={({ pressed }) => [t.all, pressed && t.pressed]}
          >
            <Text style={[font('footnote', 'semibold'), t.allText]}>All</Text>
            <Icon name="chevronRight" size={14} color={L.body} />
          </Pressable>
        </View>
        {state.measured ? (
        <View style={t.card}>
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
                style={({ pressed }) => [t.gridCell, pressed && t.pressed]}
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

        {/*
          The one tile that is the point of the screen: the sentence written
          from whatever ranks highest today. Daylight, which the system
          keeps for a single sentence, and never two of them.

          Absent until there is something to say. The standing text was a
          card reading "nothing to compare yet" sitting above a chart that
          had already said so, which is two ways of saying nothing where one
          is plenty.
        */}
        {/*
          Named once, like Metrics above it. Her lead insight, from the
          engine reading her own record, opening its evidence; until there
          is one, what Ciatta is doing with her record. Shown for a live
          record as well as the example one.
        */}
        <View style={t.sectionHead}>
          <Eyebrow>Insights</Eyebrow>
        </View>
        <Pressable
          disabled={!insightCard.evidence}
          onPress={() => {
            if (!insightCard.evidence) return;
            setFocus(insightCard.evidence);
            nav.push('evidence');
          }}
          accessibilityRole={insightCard.evidence ? 'button' : undefined}
          accessibilityHint={insightCard.evidence ? 'Opens the evidence behind it' : undefined}
          style={({ pressed }) => [pressed && insightCard.evidence ? t.pressed : null]}
        >
          <Tile span={2} emphasis style={t.lead}>
            <Text style={[font('body'), t.leadText]}>{displayCopy(insightCard.text)}</Text>
          </Tile>
        </Pressable>

        {/*
          What today's pattern suggests trying, which only exists when the
          pattern does. The concept calls this the try block and gives it
          one job: the thing she might do about what she just read.
        */}
        <View style={t.section}>
          <View style={t.planHead}>
            <Eyebrow>What you could try</Eyebrow>
            {plan.length ? (
              <Text style={[font('caption1'), t.planCount]}>
                {`${plan.filter((p) => done.includes(p.key)).length} of ${plan.length} done`}
              </Text>
            ) : null}
          </View>
          {plan.length ? (
            <View style={t.plan}>
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
                      {ticked ? <Icon name="check" size={14} color={L.canvas} weight={2} /> : null}
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
              <Icon name="check" size={20} color={L.meta} />
              <Text style={[font('subhead', 'semibold'), t.planTitle]}>Nothing needs doing today</Text>
              <Text style={[font('footnote'), t.planWhy, { textAlign: 'center' }]}>
                Your plan is built each morning from your sleep, heart, cycle and logs. New items appear here as readings arrive.
              </Text>
            </View>
          )}
          <Text style={[font('caption2'), t.planNote]}>Suggestions from your own record, not medical advice.</Text>
        </View>

          </>
        )}

        {/*
          Two ways in, and only two. One adds to the record, the other
          takes the record somewhere, and everything else she might do is
          reachable from the screen it belongs to.
        */}
        <View style={t.section}>
          <Eyebrow>You can</Eyebrow>
          {/* As the Nutrition card was: the photo across the top, edge to
              edge, with its label on it, and the actions beneath. */}
          <View style={t.youCan}>
            <Image source={images.youCan} style={t.youCanPhoto} resizeMode="cover" accessibilityIgnoresInvertColors accessible={false} />
            <View style={t.youCanPill}>
              <Text style={[font('caption1', 'semibold'), t.youCanPillText]}>FOR TODAY</Text>
            </View>
            {/* Logging, one step from here: the topic, then speak, type or
                take a photo. The Log screen opens already doing it. */}
            <LogBox
              onLog={(topic, how) => {
                chooseLogCategory(topic);
                chooseLogMode(how);
                nav.push('quickLog');
              }}
            />
          </View>
        </View>

        {/* Symptoms side by side, below the ways in. */}
        {state.state === 'content' ? (
          <View style={t.section}>
            <SymptomCompare strip={strip} range={stripRange} onRange={setStripRange} onLog={logSymptoms} onAll={go('symptoms')} />
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
  section: { marginTop: 28 },
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
  hello: { color: L.ink, letterSpacing: -0.4 },

  dayCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    marginTop: SPACE.near,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeadText: { color: L.meta, letterSpacing: 0.9 },
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
  gridCell: { width: '30%', flexGrow: 1 },

  cycleKey: { color: L.meta, letterSpacing: 0.9 },
  cycleValue: { color: L.ink },
  // A figure she has not produced today reads as absent, not as zero.
  cycleNone: { color: L.meta },
  lead: { marginTop: SPACE.tight },
  leadText: { color: L.ink, lineHeight: 25 },

  // The heading row: a section's worth of air above it, almost none below,
  // so it reads down onto the card it names rather than up at the chart.
  sectionHead: {
    marginTop: SPACE.section,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  allText: { color: L.body },

  youCan: {
    marginTop: 10,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: L.recessed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  youCanPhoto: { width: '100%', height: 160 },
  youCanPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  youCanPillText: { color: '#FFFFFF', letterSpacing: 0.6 },
  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  chart: { flex: 1, aspectRatio: 190 / 150 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planCount: { color: L.meta },
  plan: {
    marginTop: 10,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    paddingHorizontal: 14,
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
  planNote: { color: L.meta, marginTop: 8 },
});
