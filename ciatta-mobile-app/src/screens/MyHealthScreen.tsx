import { useMemo, useState } from 'react';
import { ActionSheetIOS, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadDays } from '../data/daily';
import { records } from '../data/sample';
import { type BodyPoint, readBody, REGION_LOCATION, type RegionId } from '../lib/bodyMap';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { C, font, GUTTER } from '../theme';
import { BodySystemView } from '../ui/BodySystemView';
import { LargeTitle, ToolbarButton } from '../ui/chrome';
import { HealthDashboard } from '../ui/HealthDashboard';
import { SegmentedControl } from '../ui/kit';

const VIEWS = ['Dashboard', 'Body'] as const;

// Health: every metric as a dashboard, or located on the body.
export function MyHealthScreen() {
  const nav = useNav();
  const { startDraft, setFocus } = useCycle();
  const { movement, ranked } = useInsights();
  const { signals, summaries, lens } = useCycleInsights();
  const days = loadDays();
  const [view, setView] = useState<(typeof VIEWS)[number]>('Dashboard');
  const body = useMemo(() => readBody({ signals, days, ranked, draws: records.draws }), [signals, days, ranked]);

  const logCycle = () => {
    startDraft();
    nav.push('cycleLog');
  };
  // Add to the record: a cycle experience or a note.
  const teach = () => {
    if (Platform.OS !== 'ios') return logCycle();
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Add to Your Record', options: ['Log Cycle Experience', 'Add a Note', 'Cancel'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) logCycle();
        if (i === 1) nav.push('journal');
      },
    );
  };

  const openInsight = (id: string) => {
    setFocus(id);
    nav.push('evidence');
  };
  const openPoint = (p: BodyPoint) => {
    if (p.insightId) openInsight(p.insightId);
    else if (p.screen) nav.push(p.screen);
  };
  // Logging from the body starts with that place already chosen.
  const logAt = (region: RegionId) => {
    const location = REGION_LOCATION[region];
    startDraft({ form: location ? { kinds: ['Pain'], locations: [location] } : { kinds: ['Symptoms'] } });
    nav.push('cycleLog');
  };

  return (
    <ScrollView style={h.fill} contentContainerStyle={h.body}>
      <LargeTitle title="Health" trailing={<ToolbarButton icon="plus" label="Add to Your Record" onPress={teach} />} />

      <View style={h.pad}>
        <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>Everything about your health, in one place.</Text>
        <SegmentedControl segments={VIEWS} active={view} onChange={setView} />

        {view === 'Dashboard' ? (
          <HealthDashboard
            days={days}
            movement={movement}
            summaries={summaries}
            signals={signals}
            lens={lens}
            open={nav.push}
            openInsight={openInsight}
            openProfile={() => nav.goTab('profile')}
          />
        ) : (
          <BodySystemView reading={body} onOpen={openPoint} onLog={logAt} />
        )}
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: 32 },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
});
