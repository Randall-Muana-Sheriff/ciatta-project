import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { type BodyPoint, readBody, WHOLE_BODY } from '../lib/bodyMap';
import { chooseLogCategory } from '../lib/logHandoff';
import { drawsFromLabs } from '../lib/labs';
import { useLabs } from '../state/labs';
import { loggedPoints, SYSTEM_CATEGORY } from '../lib/systemLogs';
import { useNav } from '../navigation';
import { useCycle, useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { C, font, GUTTER } from '../theme';
import { NAV_CLEARANCE } from '../ui/surface';
import { BodySystemView } from '../ui/BodySystemView';
import { LargeTitle } from '../ui/chrome';
import { RecordsView } from '../ui/RecordsView';
import { SegmentedControl } from '../ui/kit';

// The dashboard of every chart lives behind All on Today now; Health is
// her body and her records.
const VIEWS = ['Body', 'Records'] as const;

// Health: her body, system by system, and her records.
export function MyHealthScreen() {
  const nav = useNav();
  const { setFocus } = useCycle();
  const { movement, ranked } = useInsights();
  const { signals, summaries, lens } = useCycleInsights();
  const { days } = useData();
  const labs = useLabs();
  const [view, setView] = useState<(typeof VIEWS)[number]>('Body');
  const repo = useRepo();
  // What she logged on the Log screen, placed under the systems it is
  // about. Read again whenever Body is back in view, so a log she just
  // made shows.
  const [logged, setLogged] = useState<BodyPoint[]>([]);
  useEffect(() => {
    if (view !== 'Body' || nav.depth > 1) return;
    let ignore = false;
    repo
      .loadJournal()
      .then((j) => !ignore && setLogged(loggedPoints(j, new Date())))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, view, nav.depth]);
  const body = useMemo(() => {
    const read = readBody({ signals, days, ranked, draws: drawsFromLabs(labs) });
    return { ...read, systemic: [...read.systemic, ...logged] };
  }, [signals, days, ranked, labs, logged]);

  const openInsight = (id: string) => {
    setFocus(id);
    nav.push('evidence');
  };
  const openPoint = (p: BodyPoint) => {
    if (p.insightId) openInsight(p.insightId);
    else if (p.screen) nav.push(p.screen);
  };
  // Logging from a system opens the Log screen on the category that logs
  // it: Digestive on Gut, Nervous on Mind, the whole body on Note.
  const logFor = (system: string) => {
    chooseLogCategory(system === WHOLE_BODY ? 'note' : (SYSTEM_CATEGORY[system] ?? 'note'));
    nav.push('quickLog');
  };

  return (
    <ScrollView style={h.fill} contentContainerStyle={h.body}>
      {/* No logging control here. Logging lives behind the white plus in the
          bottom navigation, which is reachable from every screen, and two
          doors to the same room only made the room harder to find. */}
      <LargeTitle title="Health" />

      <View style={h.pad}>
        <Text style={[font('subhead'), { color: C.secondary, marginBottom: 16 }]}>Everything about your health, in one place.</Text>
        <SegmentedControl segments={VIEWS} active={view} onChange={setView} />

        {view === 'Body' ? (
          <BodySystemView reading={body} onOpen={openPoint} onLog={logFor} />
        ) : (
          <RecordsView onOpen={nav.push} />
        )}
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
});
