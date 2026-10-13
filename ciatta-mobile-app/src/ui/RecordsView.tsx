// Her records, as one view: lab results, documents, and what her
// providers sent. Shown inline as the Health tab's Records view, and inside
// the Health Records screen that other screens link to, so the two can
// never drift apart.
//
// Labs and Documents are sections rather than tabs: this sits under the
// Health tab's own Dashboard, Body, Records control, and a second row of
// tabs under the first is one decision too many.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loadClinicalRecords } from '../data/providers';
import { type ProcedureEntry, procedureList } from '../lib/procedureEffect';
import { chooseProcedure, prefillProcedure } from '../lib/procedureHandoff';
import { type RecordEntry, recordEntries } from '../lib/recordEntries';
import { type Screen, useNav } from '../navigation';
import { displayCopy } from '../lib/displayCopy';
import { type LabResult, labDay, labDraws, labStatus, latestSummary } from '../lib/labs';
import { chooseLab } from '../lib/labHandoff';
import { LabRangeBar, LabStatusTag } from './labs';
import { useData, useRepo } from '../state/session';
import { C, font } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { EmptyNote, PrimaryButton, Row, SecondaryButton } from './kit';
import { Eyebrow } from './bento';




// Labs, by visit, newest first. Each result shows its value, its status as
// the lab or its range gives it, and where it sits on the lab's range.
function LabsSection({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const repo = useRepo();
  const nav = useNav();
  const [labs, setLabs] = useState<LabResult[] | null>(null);
  useEffect(() => {
    if (nav.depth > 1) return;
    let ignore = false;
    repo
      .loadLabs()
      .then((rows) => !ignore && setLabs(rows))
      .catch(() => !ignore && setLabs([]));
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);

  const draws = useMemo(() => labDraws(labs ?? []), [labs]);
  const summary = useMemo(() => latestSummary(labs ?? []), [labs]);
  const [shown, setShown] = useState(3);

  return (
    <View>
      <View style={hr.section}>
        <Eyebrow>Labs</Eyebrow>
      </View>
      {summary ? <Text style={[font('subhead'), { color: C.text, marginBottom: 12 }]}>{displayCopy(summary)}</Text> : null}
      {labs && !labs.length ? (
        <EmptyNote text="No labs yet. They arrive from a provider you connect, or from a lab report you add." />
      ) : null}
      {draws.slice(0, shown).map((d) => (
        <View key={`${d.on}-${d.lab ?? ''}`} style={{ marginBottom: 18 }}>
          <Text style={[font('caption1'), { color: C.muted, letterSpacing: 0.4 }]}>{labDay(d.on)}</Text>
          <Text style={[font('caption1'), { color: C.muted, marginBottom: 6 }]}>
            {displayCopy(`${d.lab ?? 'Lab not named'}${d.outside ? ` · ${d.outside} outside range` : ''}`)}
          </Text>
          {d.results.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                chooseLab(r.name);
                onOpen('lab');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${r.value ?? r.valueText ?? ''} ${r.unit ?? ''}, ${labStatus(r).label}`}
              style={({ pressed }) => [hr.result, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <View style={hr.labTop}>
                  <Text style={[font('subhead'), { color: C.text, flex: 1 }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[font('subhead', 'semibold'), { color: C.text }]}>
                    {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : (r.valueText ?? '')}
                  </Text>
                </View>
                <View style={hr.labTop}>
                  <LabStatusTag result={r} small />
                  <View style={{ flex: 1, maxWidth: 120 }}>
                    <LabRangeBar result={r} height={4} />
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
      {draws.length > shown ? <SecondaryButton label="Show Earlier Labs" onPress={() => setShown((n) => n + 5)} /> : null}
      <View style={{ paddingTop: 12 }}>
        <SecondaryButton label="Add a Lab Report" onPress={() => onOpen('addLabs')} />
      </View>
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

      {/* Labs: from her providers and from reports she had read. */}
      <LabsSection onOpen={onOpen} />

      {records?.documents.length ? (
        <>
          <View style={hr.section}>
            <Eyebrow>Documents</Eyebrow>
          </View>
          {records.documents.map((d, n) => (
            <Row key={d.sub} first={n === 0} title={d.title} sub={`${d.sub} · ${d.kind}`} onPress={() => onOpen('addRecord')} />
          ))}
        </>
      ) : null}

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
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.borderSub,
  },
  section: { marginTop: 24, marginBottom: 10 },
  labTop: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  addHint: { color: C.muted, textAlign: 'center', marginTop: 6 },
});
