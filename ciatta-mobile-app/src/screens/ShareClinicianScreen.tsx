// A summary of her record for a clinician, made on her phone as a PDF and
// sent only where she sends it: Mail, Messages, AirDrop, Files or a
// printer. Ciatta keeps no copy and makes no link.
//
// She chooses how far back it reaches and which parts go in. Her own notes
// are off until she turns them on. What each part may say is decided in
// lib/clinicianReport.ts, which is pure and tested; this screen gathers her
// record and shows what will be in the PDF before she makes it.

import * as Print from 'expo-print';
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';

import type { JournalView } from '../data/rows';
import type { Reported } from '../data/repo';
import type { LabResult } from '../lib/labs';
import { DEFAULT_SECTIONS, longDate, reportHtml, reportSections, SECTION_TITLES, type SectionId } from '../lib/clinicianReport';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useCycleInsights } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { C, font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, PrimaryButton, SecondaryButton, SegmentedControl, Lead } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

const SPANS = [
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '12 months', months: 12 },
] as const;

const ORDER: SectionId[] = ['cycle', 'symptoms', 'measurements', 'labs', 'conditions', 'medications', 'supplements', 'notes'];

export function ShareClinicianScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { days, person } = useData();
  const { signals, windows } = useCycleInsights();
  const [span, setSpan] = useState<(typeof SPANS)[number]['label']>('6 months');
  const [include, setInclude] = useState<SectionId[]>(DEFAULT_SECTIONS);
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [reported, setReported] = useState<Reported | null>(null);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    repo.loadJournal().then((j) => !ignore && setJournal(j)).catch(() => {});
    repo.loadReported().then((r) => !ignore && setReported(r)).catch(() => {});
    repo.loadLabs().then((l) => !ignore && setLabs(l)).catch(() => {});
    return () => {
      ignore = true;
    };
  }, [repo]);

  const to = useMemo(() => new Date(), []);
  const from = useMemo(() => {
    const months = SPANS.find((s) => s.label === span)!.months;
    return new Date(to.getFullYear(), to.getMonth() - months, to.getDate());
  }, [span, to]);

  const sections = useMemo(
    () =>
      reportSections(
        {
          from,
          to,
          name: person?.firstName ?? null,
          days,
          episodes: signals.map((s) => ({
            date: s.date,
            kinds: s.episode.kinds,
            symptoms: s.episode.symptoms ?? [],
            severity: s.episode.severity,
          })),
          logs: (journal?.months ?? [])
            .flatMap((m) => m.items)
            .filter((i) => i.at)
            .map((i) => ({ at: new Date(i.at!), category: i.category ?? 'note', items: i.items ?? {}, text: i.text })),
          cycles: windows.filter((w) => w.length != null).map((w) => ({ start: w.start, length: w.length! })),
          reported,
          labs,
        },
        include,
      ),
    [from, to, person, days, signals, journal, windows, reported, labs, include],
  );

  const html = () => reportHtml(sections, { from, to, name: person?.firstName ?? null, made: new Date() });

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: html() });
      await Share.share({ url: uri, title: 'Health summary' });
    } catch (e) {
      setNote(userFacingError(e, 'The summary was not made. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    try {
      await Print.printAsync({ html: html() });
    } catch {
      // Cancelled, or no printer. Nothing to recover from.
    }
  };

  const toggle = (id: SectionId) => setInclude((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <DetailScreen title="Share with a Clinician" onBack={nav.back}>
      <Lead style={s.lede} text={"A summary of your record as a PDF, made on this phone. It goes only where you send it, and Ciatta keeps no copy."} />

      <Eyebrow>How far back</Eyebrow>
      <View style={{ marginTop: SPACE.tight }}>
        <SegmentedControl segments={SPANS.map((x) => x.label)} active={span} onChange={setSpan} />
      </View>
      <Text style={[font('caption1'), s.meta]}>{`${longDate(from)} to ${longDate(to)}`}</Text>

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>What goes in</Eyebrow>
      </View>
      <View style={s.card}>
        {ORDER.map((id, n) => (
          <View key={id} style={[s.row, n > 0 && s.divided]}>
            <View style={{ flex: 1 }}>
              <Text style={[font('subhead'), s.label]}>{SECTION_TITLES[id]}</Text>
              {id === 'notes' ? <Text style={[font('caption1'), s.meta]}>Your own words. Off unless you include them.</Text> : null}
            </View>
            <Switch
              value={include.includes(id)}
              onValueChange={() => toggle(id)}
              trackColor={{ false: C.fill, true: C.green }}
              ios_backgroundColor={C.fill}
              accessibilityLabel={`Include ${SECTION_TITLES[id]}`}
            />
          </View>
        ))}
      </View>

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>What the clinician will see</Eyebrow>
      </View>
      {sections.map((sec) => (
        <View key={sec.id} style={s.card}>
          <View style={s.head}>
            <Text style={[font('headline'), s.label]}>{sec.title}</Text>
            <Text style={[font('caption1'), s.meta]}>{sec.source}</Text>
          </View>
          {sec.rows.length ? (
            sec.rows.map((r, n) => (
              <View key={`${r.label}-${n}`} style={s.line}>
                <Text style={[font('subhead'), s.body, { flex: 1 }]}>{displayCopy(r.label)}</Text>
                <Text style={[font('subhead', 'semibold'), s.label]}>{displayCopy(r.value)}</Text>
                {r.note ? <Text style={[font('caption1'), s.meta]}>{` ${displayCopy(r.note)}`}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={[font('subhead'), s.meta]}>{displayCopy(sec.empty)}</Text>
          )}
        </View>
      ))}

      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        <PrimaryButton label={busy ? 'Making the PDF' : 'Share as PDF'} disabled={busy || !sections.length} onPress={() => void share()} />
        <SecondaryButton label="Print" onPress={() => void print()} />
      </View>
      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 10 }]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  lede: { color: L.ink, lineHeight: 24, marginBottom: SPACE.block },
  meta: { color: L.meta, marginTop: 4 },
  card: { backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: st, borderColor: L.rule, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 4 },
  label: { color: L.ink },
  body: { color: L.body },
});
