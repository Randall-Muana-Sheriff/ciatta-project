// Her records, as one view: lab results, documents, and what her
// providers sent. Shown inline as the Health tab's Records view, and inside
// the Health Records screen that other screens link to, so the two can
// never drift apart.
//
// Results and Documents are sections rather than tabs: this sits under the
// Health tab's own Dashboard, Body, Records control, and a second row of
// tabs under the first is one decision too many.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import type { Data } from '../data/adapter';
import { loadClinicalRecords } from '../data/providers';
import { type ProcedureEntry, procedureList } from '../lib/procedureEffect';
import { chooseProcedure, prefillProcedure } from '../lib/procedureHandoff';
import { type RecordEntry, recordEntries } from '../lib/recordEntries';
import { type Screen, useNav } from '../navigation';
import { displayCopy } from '../lib/displayCopy';
import { useData, useRepo } from '../state/session';
import { C, font, numeral } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { EmptyNote, PrimaryButton, Row, SecondaryButton, Tag } from './kit';
import { Eyebrow } from './bento';

type Draw = NonNullable<Data['records']>['draws'][number];

const LAB_PANELS = ['Substance Levels', 'Other Panels'];

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
  const repo = useRepo();
  const nav = useNav();
  const [procedures, setProcedures] = useState<{ dated: ProcedureEntry[]; undated: string[] }>({ dated: [], undated: [] });
  const [added, setAdded] = useState<RecordEntry[]>([]);

  // Her procedures: the ones she added, the dated ones her providers sent,
  // and surgeries she named at onboarding that still need a date. Read
  // again whenever Records is back in view, so one she just added shows.
  useEffect(() => {
    if (nav.depth > 1) return;
    let ignore = false;
    repo
      .loadJournal()
      .then((view) => {
        if (!ignore) setAdded(recordEntries(view));
      })
      .catch(() => {});
    Promise.all([
      repo.loadAddedProcedures().catch(() => []),
      loadClinicalRecords().catch(() => []),
      repo.loadReported().catch(() => null),
    ]).then(([added, clinical, reported]) => {
      if (!ignore) setProcedures(procedureList(added, clinical, reported?.surgeries ?? []));
    });
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shown = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  };
  return (
    <View>
      {/* Every way a record reaches her, in one place: voice, camera, an
          image, a PDF or a video, through the same box every log uses. */}
      <View style={{ marginTop: 8 }}>
        <PrimaryButton label="Add to Your Records" onPress={() => onOpen('addRecord')} />
        <Text style={[font('caption1'), hr.addHint]}>Voice, camera, image, PDF or a procedure</Text>
      </View>

      {added.length ? (
        <ListGroup header="Added by you" style={hr.section}>
          {added.map((r, n) => (
            <ListRow key={r.key} first={n === 0} icon="doc" title={displayCopy(r.title)} sub={displayCopy(r.sub)} />
          ))}
        </ListGroup>
      ) : null}

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

          {/* Lab panels that are not parts of the body, so they sit with
              results rather than among the body systems. */}
          {LAB_PANELS.map((name) => (
            <Row key={name} title={name} sub="Lab panel" value="None yet" valueColor={C.muted} />
          ))}

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
            <SecondaryButton label="Add a Document" onPress={() => onOpen('addRecord')} />
          </View>
        </>
      ) : (
        <View style={hr.section}>
          <EmptyNote text="No lab results or documents yet. They appear here as you add them or connect a provider." />
        </View>
      )}

      {/* Procedures, each opening what her record did either side of it.
          Adding one lives behind Add to Your Records. */}
      {procedures.dated.length || procedures.undated.length ? (
        <ListGroup header="Procedures" footer="Tap one to see six weeks before and after, from your own record." style={hr.section}>
          {procedures.dated.map((p, n) => (
            <ListRow
              key={p.id}
              first={n === 0}
              icon="doc"
              title={p.name}
              sub={`${shown(p.date)} · ${p.source}`}
              onPress={() => {
                chooseProcedure(p);
                onOpen('procedure');
              }}
            />
          ))}
          {procedures.undated.map((name, n) => (
            <ListRow
              key={`u-${name}`}
              first={procedures.dated.length === 0 && n === 0}
              title={name}
              sub="Add the date to see before and after"
              onPress={() => {
                prefillProcedure(name);
                onOpen('addProcedure');
              }}
            />
          ))}
        </ListGroup>
      ) : null}

      {/* What her hospital sends arrives once she connects it. */}
      <View style={hr.section}>
        <SecondaryButton label="Connect a Provider" onPress={() => onOpen('providerConnect')} />
      </View>
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
  addHint: { color: C.muted, textAlign: 'center', marginTop: 6 },
});
