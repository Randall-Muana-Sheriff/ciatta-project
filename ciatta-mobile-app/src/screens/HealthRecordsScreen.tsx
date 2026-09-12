import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { records } from '../data/sample';
import { useNav } from '../navigation';
import { C, caps, sans } from '../theme';
import { DetailScreen, FilterPills, Row, SecondaryButton, SourceFooter, Tag } from '../ui/kit';

const TABS = ['Results', 'Documents'] as const;

type Draw = (typeof records.draws)[number];

function DrawGroup({ draw }: { draw: Draw }) {
  return (
    <View>
      <Text style={[sans(12), caps, { color: C.muted, letterSpacing: 0.4, marginBottom: 4 }]}>{draw.date}</Text>
      <Text style={[sans(12), { color: C.muted, marginBottom: 10 }]}>{draw.lab}</Text>
      {draw.results.map((r) => (
        <View key={r.name} style={hr.result}>
          <Text style={[sans(15), { color: C.text, flex: 1 }]}>{r.name}</Text>
          <View style={hr.resultRight}>
            <Text style={[sans(14, 500), { color: C.secondary }]}>{r.value}</Text>
            <Text style={[sans(12), { color: C.muted }]}>{r.range}</Text>
            <Tag label={r.status} tone={r.status === 'In' ? 'in' : 'low'} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Dashes() {
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height={2}>
        <Line x1={0} y1={1} x2="100%" y2={1} stroke={C.border} strokeWidth={2} strokeDasharray="4 4" />
      </Svg>
    </View>
  );
}

export function HealthRecordsScreen() {
  const nav = useNav();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Results');
  const hl = records.highlight;

  return (
    <DetailScreen title="Health records" onBack={nav.back} footer={<SourceFooter kind="lab" text={records.source} />}>
      <FilterPills pills={TABS} active={tab} onChange={setTab} />

      {tab === 'Results' ? (
        <>
          <View style={{ marginBottom: 20 }}>
            <Text style={[sans(12), { color: C.muted, marginBottom: 4 }]}>{hl.name}</Text>
            <View style={hr.highlight}>
              <View style={hr.baseline}>
                <Text style={[sans(52, 600), hr.bigNum]}>{hl.value}</Text>
                <Text style={[sans(20), { color: C.secondary, marginLeft: 4 }]}>{hl.unit}</Text>
              </View>
              <Tag label={hl.status} tone="in" />
            </View>
            <Text style={[sans(14, 500), { color: C.blueLink }]}>{hl.change}</Text>
          </View>

          <DrawGroup draw={records.draws[0]} />

          <View style={hr.lowNote}>
            <Tag label="Low" tone="low" size={10} />
            <Text style={[sans(13), { color: C.amberInk, flex: 1 }]}>{records.lowNote}</Text>
          </View>

          <View style={hr.gap}>
            <Dashes />
            <Text style={[sans(12), { color: C.blueLink }]}>{records.gap}</Text>
            <Dashes />
          </View>

          <DrawGroup draw={records.draws[1]} />
          <Row title={records.older.date} sub={records.older.lab} value={records.older.count} valueColor={C.secondary} />

          <View style={{ paddingTop: 16 }}>
            <SecondaryButton label="Import results" />
          </View>
        </>
      ) : (
        <>
          {records.documents.map((d, n) => (
            <Row key={d.sub} first={n === 0} title={d.title} sub={`${d.sub} · ${d.kind}`} onPress={() => {}} />
          ))}
          <View style={{ paddingTop: 16 }}>
            <SecondaryButton label="Add a document" />
          </View>
        </>
      )}
    </DetailScreen>
  );
}

const hr = StyleSheet.create({
  highlight: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  bigNum: { color: C.text, letterSpacing: -2, fontVariant: ['tabular-nums'], lineHeight: 58 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.borderSub,
  },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lowNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.lowBg,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 12,
  },
  gap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingBottom: 14 },
});
