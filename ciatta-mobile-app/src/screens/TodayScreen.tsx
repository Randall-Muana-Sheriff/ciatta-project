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
import { usePatternView } from '../state/patternsView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { answerSave, checkIn } from '../../supabase/functions/_shared/checkIn';
import { groupItems } from '../lib/agent/logOffer';
import { CiattaCard } from '../ui/CiattaCard';
import { InsightsSheet } from '../ui/InsightsSheet';
import { JourneyScreen } from './JourneyScreen';
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
import { upcomingVisits, visitWhen } from '../lib/calendarEvents';
import { useDeviceCalendar } from '../state/deviceCalendar';
import { font, GUTTER } from '../theme';
import { SectionHeading, SegmentedControl } from '../ui/kit';
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


const CARD_VIEWS = ['Day', 'Metrics', 'Symptoms', 'Journey'] as const;
type CardView = (typeof CARD_VIEWS)[number];
const CHECKINS_ANSWERED = 'ciatta.checkins.answered';

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
    nav.push('ciatta');
  };
  // The cycle is logged the same way as everything else: the Log screen on
  // Cycle, voice and text first, the step by step form a link inside it.
  const logCycle = () => {
    chooseLogCategory('cycle');
    nav.push('ciatta');
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
  const [patternView, setPatternView] = usePatternView();

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

  // Ciatta's check in. Her conditions shape the question; what she
  // already answered today (kept on this phone) never comes back.
  const [conditions, setConditions] = useState<string[]>([]);
  useEffect(() => {
    repo
      .loadReported()
      .then((r) => setConditions(r.conditions))
      .catch(() => {});
  }, [repo]);
  const [answered, setAnswered] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(CHECKINS_ANSWERED)
      .then((v) => setAnswered(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => {});
  }, []);
  const question = useMemo(
    () =>
      todayDay
        ? checkIn({
            today: { resting_hr: todayDay.restingHR, hrv: todayDay.hrv, sleep_hours: todayDay.sleepHours, temp_deviation: todayDay.tempDeviation },
            baselines,
            conditions,
            answered,
            day: todayKey,
          })
        : null,
    [todayDay, baselines, conditions, answered, todayKey],
  );
  const [checkInNote, setCheckInNote] = useState<string | null>(null);
  const answerCheckIn = async (answer: string | null) => {
    if (!question) return;
    // Only today's keys are kept, so the list never grows past a day.
    const next = [...answered.filter((k) => k.endsWith(todayKey)), question.key];
    setAnswered(next);
    AsyncStorage.setItem(CHECKINS_ANSWERED, JSON.stringify(next)).catch(() => {});
    if (answer == null) return;
    const { text, tapped } = answerSave(question, answer);
    try {
      const saved = await quickSave({ text, key: tapped.length ? 'symptoms' : 'note', tapped, byCategory: tapped.length ? groupItems(tapped) : undefined });
      setCheckInNote(saved ? 'Added to your timeline. Thank you.' : 'That did not save. Nothing was added.');
      if (saved) {
        setLogged((n) => n + 1);
        void reloadDays();
      }
    } catch {
      setCheckInNote('That did not save. Nothing was added.');
    }
  };

  // The patterns card's four views. Day and Journey are shared with the
  // detail screen's own toggle, so the two agree.
  const [cardView, setCardView] = useState<CardView>(() => (patternView === 'Journey' ? 'Journey' : 'Day'));
  const chooseCardView = (v: CardView) => {
    setCardView(v);
    if (v === 'Day') setPatternView('Today');
    if (v === 'Journey') setPatternView('Journey');
  };
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
    <View style={t.fill}>
    <ScrollView style={t.fill} contentContainerStyle={t.body}>

      <View style={t.pad}>
        {/* One row on every phone, the whole name shown: Title 1 where it fits, sized
            down from the screen's width for a long name. */}
        {/* No wordmark: her name is the top of the screen, with the
            calendar beside it. */}
        <View style={t.helloRow}>
          <Text
            style={[font('title1', 'medium'), t.hello, { flex: 1, fontSize: helloSize, lineHeight: Math.round(helloSize * 1.2) }]}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {hello}
          </Text>
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
          Ciatta first: the check in when today gives a reason. What
          Ciatta noticed is the Insights sheet below; what she could try is
          Plans & Protocols, in the corner menu.
        */}
        <CiattaCard checkIn={question} onAnswer={answerCheckIn} answered={checkInNote}>
        </CiattaCard>

        {/* The conversation, one tap away: talk or type, or ask. */}
        <Pressable
          onPress={go('ciatta')}
          accessibilityRole="button"
          accessibilityLabel="Ask Ciatta anything"
          style={({ pressed }) => [t.askBox, pressed && t.pressed]}
        >
          <Text style={[font('body'), t.askText]}>Ask Ciatta anything</Text>
          <Icon name="mic" size={20} color={G.meta} />
        </Pressable>

        {/* The period product she has in, only while one is in. */}
        <ProductNowCard />
          </>
        )}
      </View>
    </ScrollView>
    {/* What Ciatta noticed today, resting over the lower screen and
        sliding up to show every pattern. */}
    {state.state === 'content' ? <InsightsSheet /> : null}
    </View>
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
  askBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: SPACE.near,
    paddingHorizontal: 16,
    minHeight: 52,
    borderRadius: TILE_RADIUS,
    backgroundColor: G.card,
    overflow: 'hidden',
  },
  askText: { flex: 1, color: G.meta },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricsHead: { marginBottom: SPACE.tight },
  patternToggle: { marginBottom: 10 },
  // The timeline brings its own side padding, so the card adds none.
  journeyCard: { paddingHorizontal: 0 },
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
