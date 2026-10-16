import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';

import { type Nav, NavContext, type Screen, type Tab } from './navigation';
import { useRepo, useSession } from './state/session';
import { registerForFindings } from './state/notifications';
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
import { AddRecordScreen } from './screens/AddRecordScreen';
import { MetricDetailScreen } from './screens/MetricDetailScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { InsuranceScreen } from './screens/InsuranceScreen';
import { LabDetailScreen } from './screens/LabDetailScreen';
import { AddLabsScreen } from './screens/AddLabsScreen';
import { AddDocumentScreen } from './screens/AddDocumentScreen';
import { DocumentScreen } from './screens/DocumentScreen';
import { LabReportScreen } from './screens/LabReportScreen';
import { VisitPrepScreen } from './screens/VisitPrepScreen';
import { LabBriefScreen } from './screens/LabBriefScreen';
import { ReferralsScreen } from './screens/ReferralsScreen';
import { ReferralScreen } from './screens/ReferralScreen';
import { BodyMeasurementsScreen } from './screens/BodyMeasurementsScreen';
import { ShareClinicianScreen } from './screens/ShareClinicianScreen';
import { AddProcedureScreen } from './screens/AddProcedureScreen';
import { FoodScanScreen } from './screens/FoodScanScreen';
import { ProcedureScreen } from './screens/ProcedureScreen';
import { ProductSafetyScreen } from './screens/ProductSafetyScreen';
import { NutritionTargetsScreen } from './screens/NutritionTargetsScreen';
import { GutScreen } from './screens/GutScreen';
import { CareRequestScreen } from './screens/CareRequestScreen';
import { ClinicianScreen } from './screens/ClinicianScreen';
import { BookmarksScreen } from './screens/BookmarksScreen';
import { InsightScreen } from './screens/InsightScreen';
import { QuickLogScreen } from './screens/QuickLogScreen';
import { SleepScreen } from './screens/SleepScreen';
import { SymptomsScreen } from './screens/SymptomsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { C } from './theme';
import { CornerNav } from './ui/chrome';
import { chatCardHeight } from './ui/ChatCard';
import { useBodyOpen } from './state/todayMode';
import { PatternsScreen } from './screens/PatternsScreen';
import { YourCareScreen } from './screens/YourCareScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { ExploreAllScreen } from './screens/ExploreAllScreen';
import { Ground, type GroundHue } from './ui/Ground';
import { useUnits } from './state/units';

// The ground each tab washes in. A pair per tab, so moving between them is
// a change of place rather than four screens that look alike. The hues
// carry no meaning here: this is a ground, and nothing on top of it reads
// what colour it is.
const TAB_GROUND: Record<Tab, [GroundHue, GroundHue]> = {
  today: ['measured', 'timeDepth'],
  myhealth: ['reported', 'change'],
  records: ['evidence', 'timeDepth'],
  // Care takes Lavender into Rose: time depth into what she reported,
  // which is what the agent reads and what it is for.
  care: ['timeDepth', 'reported'],
};

const TAB_SCREENS: Record<Tab, ComponentType> = {
  today: TodayScreen,
  myhealth: MyHealthScreen,
  records: RecordsScreen,
  care: YourCareScreen,
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
  gut: GutScreen,
  journey: JourneyScreen,
  patterns: PatternsScreen,
  ciatta: CareScreen,
  explore: ExploreScreen,
  exploreAll: ExploreAllScreen,
  careRequest: CareRequestScreen,
  clinician: ClinicianScreen,
  insight: InsightScreen,
  bookmarks: BookmarksScreen,
  nutritionTargets: NutritionTargetsScreen,
  foodScan: FoodScanScreen,
  procedure: ProcedureScreen,
  addProcedure: AddProcedureScreen,
  addRecord: AddRecordScreen,
  metric: MetricDetailScreen,
  privacy: PrivacyScreen,
  insurance: InsuranceScreen,
  lab: LabDetailScreen,
  addLabs: AddLabsScreen,
  addDocument: AddDocumentScreen,
  document: DocumentScreen,
  labReport: LabReportScreen,
  visitPrep: VisitPrepScreen,
  labBrief: LabBriefScreen,
  referrals: ReferralsScreen,
  referral: ReferralScreen,
  bodyMeasurements: BodyMeasurementsScreen,
  shareClinician: ShareClinicianScreen,
  productSafety: ProductSafetyScreen,
};

// Three places, each with its own stack of detail screens. The corner
// buttons stay on every screen.
export function Root() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Body on Today hides the chat card, so the menu drops to the corner.
  const [bodyOpen] = useBodyOpen();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);

  const nav = useMemo<Nav>(
    () => ({
      tab,
      depth: stack.length,
      push: (screen) => setStack((st) => [...st, screen]),
      back: () => setStack((st) => st.slice(0, -1)),
      goTab: (next, then) => {
        setTab(next);
        setStack(then ? [then] : []);
      },
    }),
    [tab, stack.length],
  );

  // Push: a real account's phone registers for findings once notifications
  // are allowed, and tapping a finding opens what it found.
  const repo = useRepo();
  const { mode } = useSession();
  // Her units, set as the app's active system for every screen.
  useUnits();
  useEffect(() => {
    if (mode === 'real') void registerForFindings(repo);
  }, [mode, repo]);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'evidence') nav.push('evidence');
      // A check in: the question waits on Today.
      if (screen === 'today') nav.goTab('today');
    });
    return () => sub.remove();
  }, [nav]);

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
      <Ground from={TAB_GROUND[tab][0]} to={TAB_GROUND[tab][1]} today={tab === 'today' && !top}>
        {/* The chat is on white paper, up under the status bar too. */}
        <View style={[r.root, { paddingTop: insets.top }, top === 'ciatta' && r.paper]}>
        <View style={r.fill} key={top ? `${tab}:${stack.length}:${top}` : tab}>
          <Current />
        </View>
        {/*
          The plus and the menu float in the bottom right corner, over the
          screen. Screens leave NAV_CLEARANCE at the bottom of their scroll
          so nothing hides beneath them. The plus goes straight to the one
          logging screen.
        */}
        {/* The chat takes the whole screen, and closes back to Today. */}
        {top === 'ciatta' ? null : (
          <CornerNav
            active={tab}
            onGo={(item) => (item.go.kind === 'tab' ? nav.goTab(item.go.tab) : nav.push(item.go.screen))}
            lift={tab === 'today' && !top && !bodyOpen ? chatCardHeight(insets.bottom) : 0}
          />
        )}
        </View>
      </Ground>
    </NavContext.Provider>
  );
}

const r = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  paper: { backgroundColor: '#FFFFFF' },
});
