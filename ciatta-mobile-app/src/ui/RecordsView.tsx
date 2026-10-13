// Her records, as one view: lab results, documents, and what her
// providers sent. Shown inline as the Health tab's Records view, and inside
// the Health Records screen that other screens link to, so the two can
// never drift apart.
//
// Results and Documents are sections rather than tabs: this sits under the
// Health tab's own Dashboard, Body, Records control, and a second row of
// tabs under the first is one decision too many.

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import type { Data } from '../data/adapter';
import { type Screen } from '../navigation';
import { useData } from '../state/session';
import { C, font, numeral } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { EmptyNote, Row, SecondaryButton, Tag } from './kit';
import { Eyebrow } from './bento';

type Draw = NonNullable<Data['records']>['draws'][number];

function DrawGroup({ draw }: { draw: Draw }) {
  return (
    <View>
      <Text style={[font('caption1'), { color: C.muted, letterSpacing: 0.4, marginBottom: 4 }]}>{draw.date}</Text>
      <Text style={[font('caption1'), { color: C.muted, marginBottom: 10 }]}>{draw.lab}</Text>
      {draw.results.map((r) => (
        <View key={r.name} style={hr.result}>
          <Text style={[font('subhead'), { color: C.text, flex: 1 }]}>{r.name}</Text>
          <View style={hr.resultRight}>
            <Text style={[font('subhead', 'semibold'), { color: C.secondary }]}>{r.value}</Text>
            <Text style={[font('caption1'), { color: C.muted }]}>{r.range}</Text>
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

export function RecordsView({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { records } = useData();
  return (
    <View>
      {records ? (
        <>
          <View style={hr.section}>
            <Eyebrow>Results</Eyebrow>
          </View>
          <View style={{ marginBottom: 20 }}>
            <Text style={[font('caption1'), { color: C.muted, marginBottom: 4 }]}>{records.highlight.name}</Text>
            <View style={hr.highlight}>
              <View style={hr.baseline}>
                <Text style={[numeral(52), hr.bigNum]}>{records.highlight.value}</Text>
                <Text style={[font('title3'), { color: C.secondary, marginLeft: 4 }]}>{records.highlight.unit}</Text>
              </View>
              <Tag label={records.highlight.status} tone="in" />
            </View>
            <Text style={[font('subhead', 'semibold'), { color: C.blueLink }]}>{records.highlight.change}</Text>
          </View>

          <DrawGroup draw={records.draws[0]} />

          <View style={hr.lowNote}>
            <Tag label="Low" tone="low" size={10} />
            <Text style={[font('footnote'), { color: C.amberInk, flex: 1 }]}>{records.lowNote}</Text>
          </View>

          <View style={hr.gap}>
            <Dashes />
            <Text style={[font('caption1'), { color: C.blueLink }]}>{records.gap}</Text>
            <Dashes />
          </View>

          <DrawGroup draw={records.draws[1]} />
          <Row title={records.older.date} sub={records.older.lab} value={records.older.count} valueColor={C.secondary} />

          <View style={{ paddingTop: 16 }}>
            <SecondaryButton label="Import Results" />
          </View>

          <View style={hr.section}>
            <Eyebrow>Documents</Eyebrow>
          </View>
          {records.documents.map((d, n) => (
            <Row key={d.sub} first={n === 0} title={d.title} sub={`${d.sub} · ${d.kind}`} onPress={() => {}} />
          ))}
          <View style={{ paddingTop: 16 }}>
            <SecondaryButton label="Add a Document" />
          </View>
        </>
      ) : (
        <View style={hr.section}>
          <EmptyNote text="No lab results or documents yet. They appear here as you add them or connect a provider." />
        </View>
      )}

      <ListGroup header="From your providers" footer="Results and notes your hospital sent, in their words." style={hr.section}>
        <ListRow first icon="doc" title="Provider records" sub="Results, conditions and medications" onPress={() => onOpen('chart')} />
      </ListGroup>
    </View>
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
  section: { marginTop: 24, marginBottom: 10 },
});
