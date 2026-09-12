import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Nav, NavContext, type Screen, type Tab } from './navigation';
import { CycleScreen } from './screens/CycleScreen';
import { HealthRecordsScreen } from './screens/HealthRecordsScreen';
import { InsightScreen } from './screens/InsightScreen';
import { JournalScreen } from './screens/JournalScreen';
import { MedicationsScreen } from './screens/MedicationsScreen';
import { MyHealthScreen } from './screens/MyHealthScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SleepScreen } from './screens/SleepScreen';
import { SymptomsScreen } from './screens/SymptomsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { C } from './theme';
import { BottomNav } from './ui/kit';

const TAB_SCREENS: Record<Tab, ComponentType> = {
  today: TodayScreen,
  myhealth: MyHealthScreen,
  profile: ProfileScreen,
};

const DETAIL_SCREENS: Record<Screen, ComponentType> = {
  insight: InsightScreen,
  sleep: SleepScreen,
  cycle: CycleScreen,
  symptoms: SymptomsScreen,
  medications: MedicationsScreen,
  journal: JournalScreen,
  healthrecords: HealthRecordsScreen,
};

// Three tabs, each with its own stack of detail screens. The tab bar stays
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
      <View style={[r.root, { paddingTop: insets.top }]}>
        <View style={r.fill} key={top ? `${tab}:${stack.length}:${top}` : tab}>
          <Current />
        </View>
        <BottomNav active={tab} onTab={(next) => nav.goTab(next)} />
      </View>
    </NavContext.Provider>
  );
}

const r = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { flex: 1 },
});
