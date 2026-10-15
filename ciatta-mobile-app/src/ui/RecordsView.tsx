// Her records, as one view: lab results and what she added. Shown inline
// as the Health tab's Records view, and inside the Health Records screen
// that other screens link to, so the two can never drift apart.
//
// Labs is a section rather than a tab: this sits under the
// Health tab's own Dashboard, Body, Records control, and a second row of
// tabs under the first is one decision too many.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type RecordEntry, recordEntries } from '../lib/recordEntries';
import { type Screen, useNav } from '../navigation';
import { displayCopy } from '../lib/displayCopy';
import { type LabResult, labDay, labDraws, labStatus, latestSummary } from '../lib/labs';
import { chooseLab, chooseReport } from '../lib/labHandoff';
import { LabRangeBar, LabStatusTag } from './labs';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { EmptyNote, PrimaryButton, SecondaryButton, SectionHeading } from './kit';
import { G } from './scheme';




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
        <SectionHeading title="Labs" />
      </View>
      {summary ? <Text style={[font('subhead'), { color: G.ink, marginBottom: 12 }]}>{displayCopy(summary)}</Text> : null}
      {labs && !labs.length ? (
        <EmptyNote text="No labs yet. They arrive from a provider you connect, or from a lab report you add." />
      ) : null}
      {draws.slice(0, shown).map((d) => (
        <View key={`${d.on}-${d.lab ?? ''}`} style={{ marginBottom: 18 }}>
          <Pressable
            onPress={() => {
              chooseReport({ documentId: d.results.find((x) => x.documentId)?.documentId ?? null, on: d.on, lab: d.lab });
              onOpen('labReport');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open the report from ${labDay(d.on)}`}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Text style={[font('caption1'), { color: G.meta, letterSpacing: 0.4 }]}>{labDay(d.on)}</Text>
            <Text style={[font('caption1'), { color: G.meta, marginBottom: 6 }]}>
              {displayCopy(`${d.lab ?? 'Lab not named'}${d.outside ? ` · ${d.outside} outside range` : ''}`)}
            </Text>
          </Pressable>
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
                  <Text style={[font('subhead'), { color: G.ink, flex: 1 }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[font('subhead', 'semibold'), { color: G.ink }]}>
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
    </View>
  );
}

export function RecordsView({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const repo = useRepo();
  const nav = useNav();
  const [added, setAdded] = useState<RecordEntry[]>([]);

  // What she added herself, read again whenever Records is back in view, so
  // one she just added shows.
  useEffect(() => {
    if (nav.depth > 1) return;
    let ignore = false;
    repo
      .loadJournal()
      .then((view) => {
        if (!ignore) setAdded(recordEntries(view));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);

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
  addHint: { color: G.meta, textAlign: 'center', marginTop: 6 },
});
