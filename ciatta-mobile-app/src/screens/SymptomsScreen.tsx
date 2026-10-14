// Symptoms, from her own logs: a twelve week grid of the ones she logs
// most, then every symptom of the last 90 days by how many days she logged
// it, each opening its last day, worst rating and how it compares with the
// month before. The counting is in lib/symptomsView.ts and is tested.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { JournalView } from '../data/rows';
import { displayCopy } from '../lib/displayCopy';
import { chooseLogCategory } from '../lib/logHandoff';
import { symptomsView } from '../lib/symptomsView';
import { useNav } from '../navigation';
import { useCycleInsights } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { C, font } from '../theme';
import { DetailScreen, EmptyNote, Expandable, Facts, SecLabel, SecondaryButton, SegmentedControl, SourceFooter } from '../ui/kit';
import { L } from '../ui/surface';

export function SymptomsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { days } = useData();
  const { signals } = useCycleInsights();
  const [journal, setJournal] = useState<JournalView | null>(null);
  useEffect(() => {
    if (nav.depth > 1 && journal) return;
    repo.loadJournal().then(setJournal).catch(() => setJournal({ count: 0, since: '', months: [] }));
    // Read again when she comes back from logging one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, nav.depth]);

  const view = useMemo(
    () =>
      symptomsView({
        signals,
        logs: (journal?.months ?? []).flatMap((m) => m.items),
        days,
        now: new Date(),
      }),
    [signals, journal, days],
  );
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState<string | null>(null);
  const shown = view.list.filter((s) => filter === 'All' || s.group === filter);
  const most = Math.max(1, ...view.grid.flatMap((r) => r.counts));

  const logOne = () => {
    chooseLogCategory('symptoms');
    nav.push('quickLog');
  };

  return (
    <DetailScreen
      title="Symptoms"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Entered by you, dated as you entered it" />}
    >
      {!view.list.length ? (
        <>
          <EmptyNote text="No symptoms logged in the last 90 days." />
          <View style={{ paddingTop: 20 }}>
            <SecondaryButton label="Log a Symptom" onPress={logOne} />
          </View>
        </>
      ) : (
        <>
          {view.groups.length > 2 ? (
            <SegmentedControl segments={view.groups} active={view.groups.includes(filter) ? filter : 'All'} onChange={setFilter} scroll />
          ) : null}

          <SecLabel right="Last 12 weeks">Most logged</SecLabel>
          <View style={s.grid}>
            {view.grid.map((row) => (
              <View key={row.name} style={s.gridRow} accessible accessibilityLabel={`${row.name}, logged on ${row.counts.reduce((a, b) => a + b, 0)} days in 12 weeks`}>
                <Text style={[font('caption1'), s.gridName]} numberOfLines={1}>
                  {displayCopy(row.name)}
                </Text>
                <View style={s.cells}>
                  {row.counts.map((n, i) => (
                    <View key={i} style={[s.cell, { backgroundColor: n ? C.violet : 'rgba(255,255,255,0.05)', opacity: n ? 0.3 + (n / most) * 0.7 : 1 }]} />
                  ))}
                </View>
              </View>
            ))}
            <Text style={[font('caption2'), s.meta]}>Each square is a week. Darker is more days logged.</Text>
          </View>

          <SecLabel right="Days logged, last 90">Every symptom</SecLabel>
          {shown.map((sym, n) => (
            <Expandable
              key={sym.name}
              first={n === 0}
              title={sym.name}
              sub={sym.group}
              value={String(sym.days)}
              open={open === sym.name}
              onToggle={() => setOpen(open === sym.name ? null : sym.name)}
            >
              <Facts
                rows={[
                  { label: 'Last logged', value: sym.last },
                  { label: 'Worst rating', value: sym.worst != null ? `${sym.worst} of 10` : 'None given' },
                  ...(sym.versus ? [{ label: 'Lately', value: sym.versus }] : []),
                ]}
              />
            </Expandable>
          ))}

          <View style={{ paddingTop: 20 }}>
            <SecondaryButton label="Log a Symptom" onPress={logOne} />
          </View>
        </>
      )}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  grid: { marginBottom: 24, gap: 8 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gridName: { color: L.body, width: 96 },
  cells: { flex: 1, flexDirection: 'row', gap: 3 },
  cell: { flex: 1, height: 18, borderRadius: 4 },
  meta: { color: L.meta, marginTop: 4 },
});
