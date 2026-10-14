import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { type BodyPoint, readBody } from '../lib/bodyMap';
import { drawsFromLabs } from '../lib/labs';
import { useLabs } from '../state/labs';
import { loggedPoints } from '../lib/systemLogs';
import { useNav } from '../navigation';
import { useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useData, useRepo } from '../state/session';
import { GUTTER } from '../theme';
import { NAV_CLEARANCE } from '../ui/surface';
import { BodySystemView } from '../ui/BodySystemView';
import { askCare } from '../lib/careHandoff';
import { defaultTopic, explorePrompt } from '../lib/systemReview';
import { useAgentContext } from '../state/agentContext';
import { LargeTitle } from '../ui/chrome';
import { RecordsView } from '../ui/RecordsView';
import { SegmentedControl } from '../ui/kit';
import { G } from '../ui/scheme';
import { font } from '../theme';

// The dashboard of every chart lives behind All on Today now; Health is
// her body and her records.
const VIEWS = ['Body', 'Records'] as const;

// Health: her body, system by system, and her records.
export function MyHealthScreen() {
  const nav = useNav();
  const { ranked } = useInsights();
  const { signals, profile } = useCycleInsights();
  const { context } = useAgentContext();
  const [conditions, setConditions] = useState<string[]>([]);
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
  useEffect(() => {
    repo.loadReported().then((r) => setConditions(r.conditions)).catch(() => {});
  }, [repo]);
  const body = useMemo(() => {
    const read = readBody({ signals, days, ranked, draws: drawsFromLabs(labs) });
    return { ...read, systemic: [...read.systemic, ...logged] };
  }, [signals, days, ranked, labs, logged]);

  return (
    <ScrollView style={h.fill} contentContainerStyle={h.body}>
      {/* No logging control here. Logging lives behind the white plus in the
          bottom navigation, which is reachable from every screen, and two
          doors to the same room only made the room harder to find. */}
      <LargeTitle title="Health" />

      <View style={h.pad}>
        <Text style={[font('subhead'), { color: G.body, marginBottom: 16 }]}>Everything about your health, in one place.</Text>
        <SegmentedControl segments={VIEWS} active={view} onChange={setView} />

        {view === 'Body' ? (
          <BodySystemView
            reading={body}
            signals={signals}
            context={context}
            conditions={conditions}
            situations={profile.situations}
            onExplore={(system, topic) => {
              // Care asks it the moment it is in view.
              // With no topic chosen, what she is managing leads: for
              // Reproductive, endometriosis when it is on her record.
              askCare(explorePrompt(system, topic ?? defaultTopic(system, conditions)));
              nav.goTab('care');
            }}
          />
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
