// Medications and supplements, from her own record, kept apart: what she
// named, when she last logged each, what she logged in the last 30 days,
// and the changes she logged in her own words. No reminders to take
// anything and no adherence score. The counting is in lib/medsView.ts.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Reported } from '../data/repo';
import type { JournalView } from '../data/rows';
import { displayCopy } from '../lib/displayCopy';
import { chooseLogCategory } from '../lib/logHandoff';
import { medsView, type NamedItem } from '../lib/medsView';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { DetailScreen, EmptyNote, SecLabel, SecondaryButton, SourceFooter } from '../ui/kit';
import { L, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';

function ItemCard({ item, kind }: { item: NamedItem; kind: string }) {
  return (
    <View style={m.card} accessible accessibilityLabel={`${item.name}, ${kind}, ${item.last ? `last logged ${item.last}` : 'not logged yet'}`}>
      <CardFill />
      <View style={m.between}>
        <Text style={[font('callout', 'semibold'), { color: C.text, flex: 1 }]}>{displayCopy(item.name)}</Text>
        <Text style={[font('footnote'), { color: C.secondary }]}>{kind}</Text>
      </View>
      <Text style={[font('footnote'), { color: C.secondary, marginTop: 4 }]}>
        {item.last ? `Last logged ${item.last} · ${item.days} ${item.days === 1 ? 'day' : 'days'} logged` : 'Not logged yet'}
      </Text>
    </View>
  );
}

export function MedicationsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [reported, setReported] = useState<Reported | null>(null);
  const [journal, setJournal] = useState<JournalView | null>(null);
  useEffect(() => {
    if (nav.depth > 1 && journal) return;
    repo.loadReported().then(setReported).catch(() => {});
    repo.loadJournal().then(setJournal).catch(() => {});
    // Read again when she comes back from logging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, nav.depth]);

  const view = useMemo(
    () => medsView({ reported, logs: (journal?.months ?? []).flatMap((x) => x.items), now: new Date() }),
    [reported, journal],
  );
  const log = (key: 'meds' | 'supplements') => {
    chooseLogCategory(key);
    nav.push('quickLog');
  };
  const nothing = !view.medications.length && !view.supplements.length && !view.month.length && !view.changes.length;

  return (
    <DetailScreen
      title="Medications"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="You named and logged these. There are no reminders to take anything." />}
    >
      {nothing ? <EmptyNote text="No medications or supplements yet. Log one, and it appears here." /> : null}

      {view.medications.length ? (
        <>
          <SecLabel right={`${view.medications.length}`}>Medications</SecLabel>
          {view.medications.map((x) => (
            <ItemCard key={x.name} item={x} kind="Medication" />
          ))}
        </>
      ) : null}

      {view.supplements.length ? (
        <View style={{ marginTop: 12 }}>
          <SecLabel right={`${view.supplements.length}`}>Supplements</SecLabel>
          {view.supplements.map((x) => (
            <ItemCard key={x.name} item={x} kind="Supplement" />
          ))}
        </View>
      ) : null}

      {view.month.length ? (
        <View style={{ marginTop: 12 }}>
          <SecLabel right="Days logged">Last 30 days</SecLabel>
          <View style={m.card}>
            <CardFill />
            {view.month.map((x, n) => (
              <View key={x.label} style={[m.between, n > 0 && m.divided]}>
                <Text style={[font('subhead'), { color: C.text }]}>{x.label}</Text>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>{x.days}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {view.changes.length ? (
        <View style={{ marginTop: 12 }}>
          <SecLabel right="As you logged them">Changes</SecLabel>
          {view.changes.map((c, n) => (
            <View key={`${c.label}-${n}`} style={m.card}>
              <CardFill />
              <View style={m.between}>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>{c.label}</Text>
                <Text style={[font('footnote'), { color: C.secondary }]}>{c.on}</Text>
              </View>
              {c.words ? <Text style={[font('footnote'), { color: C.secondary, marginTop: 4 }]}>{displayCopy(c.words)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 20, gap: 12 }}>
        <SecondaryButton label="Log in Medications" onPress={() => log('meds')} />
        <SecondaryButton label="Log in Supplements" onPress={() => log('supplements')} />
      </View>
    </DetailScreen>
  );
}

const m = StyleSheet.create({
  card: {
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 2 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule, marginTop: 8, paddingTop: 8 },
});
