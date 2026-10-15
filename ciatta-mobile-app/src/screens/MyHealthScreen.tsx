import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { loadClinicalRecords } from '../data/providers';
import type { DocumentSummary } from '../data/repo';
import { DOC_TYPE_LABEL } from '../lib/documents';
import { chooseDocument } from '../lib/documentHandoff';
import { chooseLab } from '../lib/labHandoff';
import { type HealthOpen, searchHealth } from '../lib/healthSearch';
import type { ClinicalRecord } from '../lib/providers/fhirMap';
import { ListGroup, ListRow } from '../ui/chrome';
import { Icon } from '../ui/icons';
import { TILE_RADIUS } from '../ui/surface';


// Body: her body, system by system, with search across her health and the
// timeline. Records is its own place.
export function MyHealthScreen() {
  const nav = useNav();
  const { ranked } = useInsights();
  const { signals, profile } = useCycleInsights();
  const { context } = useAgentContext();
  const [conditions, setConditions] = useState<string[]>([]);
  const { days } = useData();
  const labs = useLabs();
  const repo = useRepo();

  // Search: what is already on the phone, read once Body is in view.
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  useEffect(() => {
    if (nav.depth > 0) return;
    let ignore = false;
    repo
      .loadDocuments()
      .then((rows) => !ignore && setDocs(rows))
      .catch(() => {});
    loadClinicalRecords()
      .then((rows) => !ignore && setRecords(rows))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo, nav.depth]);
  const results = useMemo(
    () =>
      searchHealth(query, {
        labs,
        documents: docs.map((d) => ({ id: d.id, title: d.title ?? DOC_TYPE_LABEL[d.docType], type: DOC_TYPE_LABEL[d.docType] })),
        records,
      }),
    [query, labs, docs, records],
  );
  const open = (o: HealthOpen) => {
    if (o.kind === 'lab') {
      chooseLab(o.name);
      nav.push('lab');
    } else if (o.kind === 'document') {
      chooseDocument(o.id);
      nav.push('document');
    } else if (o.kind === 'screen') {
      nav.push(o.screen);
    } else if (o.kind === 'tab') {
      nav.goTab(o.tab);
    } else {
      // Body is this screen: clear the search to show it.
      setQuery('');
    }
  };
  // What she logged on the Log screen, placed under the systems it is
  // about. Read again whenever Body is back in view, so a log she just
  // made shows.
  const [logged, setLogged] = useState<BodyPoint[]>([]);
  useEffect(() => {
    if (nav.depth > 1) return;
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
      <LargeTitle title="Body" />

      <View style={h.pad}>
        <Text style={[font('subhead'), { color: G.body, marginBottom: 16 }]}>Everything about your health, in one place.</Text>
        <View style={h.search}>
          <Icon name="search" size={18} color={G.meta} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your health"
            placeholderTextColor={G.meta}
            autoCorrect={false}
            returnKeyType="search"
            style={[font('body'), h.searchInput]}
            accessibilityLabel="Search your health"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
              <Icon name="xmark" size={15} color={G.meta} />
            </Pressable>
          ) : null}
        </View>

        {query.trim().length >= 2 ? (
          results.length ? (
            <ListGroup style={h.results}>
              {results.map((r, n) => (
                <ListRow key={r.key} first={n === 0} title={displayCopy(r.title)} sub={displayCopy(r.sub)} onPress={() => open(r.open)} />
              ))}
            </ListGroup>
          ) : (
            <Text style={[font('subhead'), h.none]}>{displayCopy(`Nothing in your health matches "${query.trim()}".`)}</Text>
          )
        ) : null}

        {/* Records is its own place in the corner menu now; this screen is
            her body, system by system. */}
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
              nav.push('ciatta');
            }}
          />
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: NAV_CLEARANCE },
  pad: { paddingHorizontal: GUTTER, paddingTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: TILE_RADIUS,
    backgroundColor: G.card,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, color: G.ink },
  results: { marginTop: 12, marginBottom: 16 },
  none: { color: G.body, marginTop: 12, lineHeight: 22 },
});
