import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Nav, NavContext, type Screen, type Tab } from './navigation';
import { CycleHistoryScreen } from './screens/CycleHistoryScreen';
import { CycleLogScreen } from './screens/CycleLogScreen';
import { AppointmentScreen } from './screens/AppointmentScreen';
import { CareScreen } from './screens/CareScreen';
import { MetricsScreen } from './screens/MetricsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ChartScreen } from './screens/ChartScreen';
import { DailyLogScreen } from './screens/DailyLogScreen';
import { ProviderConnectScreen } from './screens/ProviderConnectScreen';
import { CycleProfileScreen } from './screens/CycleProfileScreen';
import { CycleScreen } from './screens/CycleScreen';
import { EvidenceScreen } from './screens/EvidenceScreen';
import { MovementScreen } from './screens/MovementScreen';
import { HealthRecordsScreen } from './screens/HealthRecordsScreen';
import { JournalScreen } from './screens/JournalScreen';
import { JourneyScreen } from './screens/JourneyScreen';
import { MedicationsScreen } from './screens/MedicationsScreen';
import { MyHealthScreen } from './screens/MyHealthScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { NutritionTargetsScreen } from './screens/NutritionTargetsScreen';
import { QuickLogScreen } from './screens/QuickLogScreen';
import { SleepScreen } from './screens/SleepScreen';
import { SymptomsScreen } from './screens/SymptomsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { C } from './theme';
import { BottomNav } from './ui/chrome';
import { Ground, type GroundHue } from './ui/Ground';

// The ground each tab washes in. A pair per tab, so moving between them is
// a change of place rather than four screens that look alike. The hues
// carry no meaning here: this is a ground, and nothing on top of it reads
// what colour it is.
const TAB_GROUND: Record<Tab, [GroundHue, GroundHue]> = {
  today: ['measured', 'timeDepth'],
  myhealth: ['reported', 'change'],
  journey: ['timeDepth', 'measured'],
  // Care takes Lavender into Rose: time depth into what she reported,
  // which is what the agent reads and what it is for.
  care: ['timeDepth', 'reported'],
};

const TAB_SCREENS: Record<Tab, ComponentType> = {
  today: TodayScreen,
  myhealth: MyHealthScreen,
  journey: JourneyScreen,
  care: CareScreen,
};

const DETAIL_SCREENS: Record<Screen, ComponentType> = {
  sleep: SleepScreen,
  cycle: CycleScreen,
  symptoms: SymptomsScreen,
  medications: MedicationsScreen,
  journal: JournalScreen,
  healthrecords: HealthRecordsScreen,
  cycleLog: CycleLogScreen,
  cycleHistory: CycleHistoryScreen,
  evidence: EvidenceScreen,
  movement: MovementScreen,
  cycleProfile: CycleProfileScreen,
  appointment: AppointmentScreen,
  metrics: MetricsScreen,
  providerConnect: ProviderConnectScreen,
  chart: ChartScreen,
  dailyLog: DailyLogScreen,
  profile: ProfileScreen,
  calendar: CalendarScreen,
  quickLog: QuickLogScreen,
  nutritionTargets: NutritionTargetsScreen,
};

// Four tabs, each with its own stack of detail screens. The tab bar stays
// visible on detail screens, as in the reference design.
export function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);

  const nav = useMemo<Nav>(
    () => ({
      tab,
      push: (screen) => setStack((st) => [...st, screen]),
      back: () => setStack((st) => st.slice(0, -1)),
      goTab: (next, then) => {
        setTab(next);
        setStack(then ? [then] : []);
      },
    }),
    [tab],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) {
        nav.back();
        return true;
      }
      if (tab !== 'today') {
        nav.goTab('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [nav, stack.length, tab]);

  const top = stack[stack.length - 1];
  const Current = top ? DETAIL_SCREENS[top] : TAB_SCREENS[tab];

  return (
    <NavContext.Provider value={nav}>
      <Ground from={TAB_GROUND[tab][0]} to={TAB_GROUND[tab][1]}>
        <View style={[r.root, { paddingTop: insets.top }]}>
        <View style={r.fill} key={top ? `${tab}:${stack.length}:${top}` : tab}>
          <Current />
        </View>
        {/*
          The bar floats over the screen rather than sitting under it, which
          is what makes it read as a rounded object instead of a shelf. Each
          screen's own ground shows around it, so a white screen keeps a
          white foot and a dark one keeps a dark one, and screens leave
          NAV_CLEARANCE at the bottom of their scroll so nothing hides
          beneath it.
        */}
        <View style={r.navOver} pointerEvents="box-none">
          {/*
            The plus goes straight to the one logging screen. It used to
            open a menu of three, which asked her to classify what she was
            about to say before she had said it.
          */}
          <BottomNav active={tab} onTab={(next) => nav.goTab(next)} onTrack={() => nav.push('quickLog')} />
          </View>
        </View>
      </Ground>
    </NavContext.Provider>
  );
}

const r = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  navOver: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
