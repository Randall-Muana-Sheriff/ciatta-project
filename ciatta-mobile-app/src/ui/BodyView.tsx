// Her body, system by system: the body map and each system with what her
// record says about it. Shown on Today under the Explore toggle; Explore on
// a system asks Ciatta about it in the chat.

import { useEffect, useMemo, useState } from 'react';

import { askCare } from '../lib/careHandoff';
import { type BodyPoint, readBody } from '../lib/bodyMap';
import { drawsFromLabs } from '../lib/labs';
import { loggedPoints } from '../lib/systemLogs';
import { defaultTopic, explorePrompt } from '../lib/systemReview';
import { useNav } from '../navigation';
import { useAgentContext } from '../state/agentContext';
import { useCycleInsights } from '../state/cycleStore';
import { useInsights } from '../state/insights';
import { useLabs } from '../state/labs';
import { useData, useRepo } from '../state/session';
import { BodySystemView } from './BodySystemView';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { groupItems } from '../lib/agent/logOffer';
import type { RegionId } from '../lib/bodyMap';
import { painItemFor } from '../lib/bodyTap';
import { displayCopy } from '../lib/displayCopy';
import { useQuickLogSave } from '../state/quickLogSave';
import { font } from '../theme';
import { PAPER } from './paper';
import { G } from './scheme';

export function BodyView() {
  const nav = useNav();
  const repo = useRepo();
  const { ranked } = useInsights();
  const { signals, profile } = useCycleInsights();
  const { context } = useAgentContext();
  const { days } = useData();
  const labs = useLabs();
  const [conditions, setConditions] = useState<string[]>([]);
  // What she told Ciatta, placed under the systems it is about. Read again
  // when Today is back in view, so something she just said shows.
  const [logged, setLogged] = useState<BodyPoint[]>([]);
  useEffect(() => {
    if (nav.depth > 0) return;
    let ignore = false;
    repo
      .loadJournal()
      .then((j) => !ignore && setLogged(loggedPoints(j, new Date())))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);
  useEffect(() => {
    repo
      .loadReported()
      .then((r) => setConditions(r.conditions))
      .catch(() => {});
  }, [repo]);
  const body = useMemo(() => {
    const read = readBody({ signals, days, ranked, draws: drawsFromLabs(labs) });
    return { ...read, systemic: [...read.systemic, ...logged] };
  }, [signals, days, ranked, labs, logged]);

  // A tap on the body: Ciatta asks, in a small bubble, whether to log pain
  // there. One tap logs it; nothing is saved without it.
  const save = useQuickLogSave();
  const [asking, setAsking] = useState<RegionId | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const logPain = async (region: RegionId) => {
    const { items, place } = painItemFor(region);
    setAsking(null);
    try {
      const ok = await save({ text: `Pain in my ${place}`, key: 'symptoms', tapped: items, byCategory: groupItems(items) });
      setSaid(ok ? `Logged pain in your ${place}.` : 'That did not save. Nothing was logged.');
    } catch {
      setSaid('That did not save. Nothing was logged.');
    }
  };

  return (
    <View>
      {asking ? (
        <View style={v.bubble} accessibilityLiveRegion="polite">
          <Text style={[font('subhead'), v.text]}>{displayCopy(`Pain in your ${painItemFor(asking).place}? Would you like to log it?`)}</Text>
          <View style={v.actions}>
            <Pressable onPress={() => void logPain(asking)} accessibilityRole="button" hitSlop={6} style={({ pressed }) => [v.primary, pressed && v.pressed]}>
              <Text style={[font('footnote', 'semibold'), { color: PAPER.onPill }]}>Log pain</Text>
            </Pressable>
            <Pressable onPress={() => setAsking(null)} accessibilityRole="button" hitSlop={10}>
              <Text style={[font('footnote'), { color: PAPER.meta }]}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : said ? (
        <Pressable onPress={() => setSaid(null)} accessibilityRole="button" accessibilityHint="Dismiss" style={v.bubble}>
          <Text style={[font('subhead'), v.text]}>{displayCopy(said)}</Text>
        </Pressable>
      ) : (
        <Text style={[font('footnote'), v.hint]}>Tap where it hurts to log pain there.</Text>
      )}
    <BodySystemView
      reading={body}
      signals={signals}
      context={context}
      conditions={conditions}
      situations={profile.situations}
      onExplore={(system, topic) => {
        // With no topic chosen, what she is managing leads: for
        // Reproductive, endometriosis when it is on her record.
        askCare(explorePrompt(system, topic ?? defaultTopic(system, conditions)));
        nav.push('ciatta');
      }}
      onTapBody={(region) => {
        setSaid(null);
        setAsking(region);
      }}
    />
    </View>
  );
}

const v = StyleSheet.create({
  // A bubble of the chat, on its white paper.
  bubble: { backgroundColor: PAPER.bg, borderRadius: 18, padding: 14, marginBottom: 12, gap: 10 },
  text: { color: PAPER.ink, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  primary: { backgroundColor: PAPER.pill, borderRadius: 999, minHeight: 36, paddingHorizontal: 16, justifyContent: 'center' },
  hint: { color: G.meta, marginBottom: 8 },
  pressed: { opacity: 0.6 },
});
