// Add a lab report: a photo of the paper or the PDF a clinic sent. Ciatta
// has it read, then shows every line it read so she can check it against
// the report, correct it, or leave it out. Nothing is saved until she says
// so, and only the lines she kept.
//
// The file goes to the lab-scan function and from there to OpenAI to be
// read; it is not kept on Ciatta's servers.

import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { isScannerAvailable, scanDocument } from '../../modules/document-scanner';
import { groupByPanel, type LabFlag, type LabResult, labDay, type ScannedTest, testFromFields } from '../lib/labs';
import { chooseReport, takeLabFile } from '../lib/labHandoff';
import { dayFromParts } from '../lib/procedureEffect';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { DetailScreen, PrimaryButton, SecondaryButton, SaveBar, Lead } from '../ui/kit';
import { LabStatusTag } from '../ui/labs';
import { HUE, L, SPACE, TILE_RADIUS, BLEED } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

type Line = { key: string; keep: boolean; name: string; value: string; unit: string; range: string; flag: LabFlag | null; panel: string | null };

const lineFrom = (t: ScannedTest, n: number): Line => ({
  key: `l${n}`,
  keep: true,
  name: t.name,
  value: t.value != null ? String(t.value) : (t.valueText ?? ''),
  unit: t.unit ?? '',
  range: t.rangeText ?? '',
  flag: t.flag,
  panel: t.panel,
});

export function AddLabsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [lines, setLines] = useState<Line[]>([]);
  const [lab, setLab] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<{ base64: string; kind: 'image' | 'pdf'; checksum: string } | null>(null);
  const [meta, setMeta] = useState<{ orderingClinician: string | null; specimen: string | null; pages: number | null; unreadable: number[]; multipleDates: boolean }>({
    orderingClinician: null,
    specimen: null,
    pages: null,
    unreadable: [],
    multipleDates: false,
  });
  const [duplicate, setDuplicate] = useState<{ id: string; on: string } | null>(null);
  const canScan = isScannerAvailable();

  const read = async (base64: string, kind: 'image' | 'pdf') => {
    setNote(null);
    setDuplicate(null);
    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    const seen = await repo.findLabReport(checksum).catch(() => null);
    if (seen) {
      setDuplicate(seen);
      return;
    }
    setStage('reading');
    try {
      const scan = await repo.scanLab(base64, kind);
      if (scan.notLab || !scan.tests.length) {
        setNote(scan.notLab ? 'This does not look like a lab report. Nothing was saved.' : 'Ciatta could not read any results from this file. Nothing was saved.');
        setStage('pick');
        return;
      }
      setFile({ base64, kind, checksum });
      setMeta({ orderingClinician: scan.orderingClinician, specimen: scan.specimen, pages: scan.pages, unreadable: scan.unreadablePages, multipleDates: scan.multipleDates });
      setLines(scan.tests.map(lineFrom));
      setLab(scan.lab ?? '');
      if (scan.on) {
        const [y, m, d] = scan.on.split('-');
        setYear(y);
        setMonth(String(Number(m)));
        setDay(String(Number(d)));
      }
      setStage('review');
    } catch (e) {
      setNote(userFacingError(e, 'The report could not be read. Try again.'));
      setStage('pick');
    }
  };

  // A lab report found through Scan or Upload a Document is read here.
  useEffect(() => {
    const f = takeLabFile();
    if (f) void read(f.base64, f.kind);
    // read is stable for a once on open handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromPhoto = async () => {
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (picked.canceled || !picked.assets?.length) return;
      // Large enough to read small print, small enough to send.
      const ref = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 1800 }).renderAsync();
      const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (out.base64) await read(out.base64, 'image');
    } catch {
      setNote('That photo did not open.');
    }
  };

  const [scanning, setScanning] = useState(false);
  const fromScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const scanned = await scanDocument();
      if (!scanned) return;
      await read(await new File(scanned.uri).base64(), 'pdf');
    } catch {
      setNote('The scan did not open. Try again.');
    } finally {
      setScanning(false);
    }
  };

  const fromPdf = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.length) return;
      await read(await new File(picked.assets[0].uri).base64(), 'pdf');
    } catch {
      setNote('That PDF did not open.');
    }
  };

  const on = dayFromParts(day, month, year);
  const kept = lines.filter((l) => l.keep).map((l) => testFromFields(l)).filter((t): t is ScannedTest => t != null);
  const edit = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!on || !kept.length || saving || !file) return;
    setSaving(true);
    setNote(null);
    try {
      const id = await repo.saveLabReport({
        file: { base64: file.base64, kind: file.kind },
        checksum: file.checksum,
        on,
        lab: lab.trim() || null,
        orderingClinician: meta.orderingClinician,
        specimen: meta.specimen,
        pages: meta.pages,
        tests: kept,
      });
      chooseReport({ documentId: id, on, lab: lab.trim() || null });
      nav.back();
      nav.push('labReport');
    } catch (e) {
      setNote(userFacingError(e, 'Your report did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  // The status as it will read once saved, so she sees it while checking.
  const preview = (l: Line): LabResult | null => {
    const t = testFromFields(l);
    return t ? { ...t, id: l.key, status: 'final', source: 'report', lab: null, on: on ?? '' } : null;
  };

  const renderLine = (l: Line) => {
    const p = preview(l);
    return (
      <View key={l.key} style={[s.card, !l.keep && { opacity: 0.45 }]}>
        <CardFill />
        <View style={s.head}>
          <TextInput value={l.name} onChangeText={(v) => edit(l.key, { name: v })} style={[font('headline'), s.ink, { flex: 1 }]} accessibilityLabel="Test name" />
          <Switch
            value={l.keep}
            onValueChange={(v) => edit(l.key, { keep: v })}
            trackColor={{ false: C.fill, true: C.green }}
            ios_backgroundColor={C.fill}
            accessibilityLabel={`Keep ${l.name}`}
          />
        </View>
        <View style={s.fields}>
          <View style={{ flex: 1 }}>
            <Text style={[font('caption2'), s.meta]}>Result</Text>
            <TextInput value={l.value} onChangeText={(v) => edit(l.key, { value: v })} style={[font('body'), s.input]} accessibilityLabel="Result" />
          </View>
          <View style={{ width: 90 }}>
            <Text style={[font('caption2'), s.meta]}>Unit</Text>
            <TextInput value={l.unit} onChangeText={(v) => edit(l.key, { unit: v })} style={[font('body'), s.input]} accessibilityLabel="Unit" autoCapitalize="none" />
          </View>
        </View>
        <Text style={[font('caption2'), s.meta, { marginTop: 8 }]}>Range on the report</Text>
        <TextInput value={l.range} onChangeText={(v) => edit(l.key, { range: v })} placeholder="None printed" placeholderTextColor={L.meta} style={[font('body'), s.input]} accessibilityLabel="Range on the report" />
        {p ? (
          <View style={{ marginTop: 10 }}>
            <LabStatusTag result={p} small />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <DetailScreen
      title="Add a Lab Report"
      onBack={nav.back}
      footer={
        stage === 'review' ? (
          <SaveBar
            label={saving ? 'Saving' : `Save ${kept.length} ${kept.length === 1 ? 'Result' : 'Results'}`}
            disabled={!on || !kept.length || saving}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      {stage === 'pick' ? (
        <>
          <Lead style={s.lede} text={"Scan a paper report, or upload the PDF from your patient portal. Ciatta reads every page, then you check each line before anything is saved."} />
          <View style={{ gap: 12 }}>
            {canScan ? <PrimaryButton label="Scan a Paper Report" onPress={() => void fromScan()} disabled={scanning} /> : null}
            {canScan ? (
              <SecondaryButton label="Upload a PDF" onPress={() => void fromPdf()} />
            ) : (
              <PrimaryButton label="Upload a PDF" onPress={() => void fromPdf()} />
            )}
            <SecondaryButton label="Choose a Photo" onPress={() => void fromPhoto()} />
          </View>
          {duplicate ? (
            <View style={[s.card, { marginTop: SPACE.near }]}>
              <CardFill />
              <Text style={[font('subhead'), s.ink]}>{displayCopy(`You added this report on ${labDay(duplicate.on)}. It is already in your labs.`)}</Text>
            </View>
          ) : null}
          <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near }]}>
            The report is sent to OpenAI to be read. The original is kept privately in your Ciatta account so you can check any result against it, and you can remove it at any time.
          </Text>
        </>
      ) : null}

      {stage === 'reading' ? <Lead style={s.lede} text={"Reading your report."} /> : null}

      {stage === 'review' ? (
        <>
          <Lead style={s.lede} text={"Check each line against your report. Correct anything that was read wrong, or switch it off."} />
          <Text style={[font('caption1'), s.label]}>Lab</Text>
          <TextInput value={lab} onChangeText={setLab} placeholder="For example, Quest Diagnostics" placeholderTextColor={G.meta} style={[font('body'), s.input]} accessibilityLabel="Lab" />
          <Text style={[font('caption1'), s.label]}>Collected on</Text>
          <View style={s.dateRow}>
            <TextInput value={day} onChangeText={setDay} placeholder="Day" keyboardType="number-pad" maxLength={2} placeholderTextColor={G.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Day" />
            <TextInput value={month} onChangeText={setMonth} placeholder="Month" keyboardType="number-pad" maxLength={2} placeholderTextColor={G.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Month, as a number" />
            <TextInput value={year} onChangeText={setYear} placeholder="Year" keyboardType="number-pad" maxLength={4} placeholderTextColor={G.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Year" />
          </View>
          {!on ? <Text style={[font('footnote'), s.meta, { marginTop: 6 }]}>Add the day the sample was taken, as it is on the report.</Text> : null}

          {meta.multipleDates ? (
            <Text style={[font('footnote'), s.warn, { marginTop: 10 }]}>
              This file has results from more than one day, and they will all be saved under the date above. Switch off the lines from other days, and add those as their own report.
            </Text>
          ) : null}
          {meta.unreadable.length ? (
            <Text style={[font('footnote'), s.warn, { marginTop: 10 }]}>
              {meta.unreadable.length === 1
                ? `Page ${meta.unreadable[0]} could not be read. Check it against your report.`
                : `Pages ${meta.unreadable.join(', ')} could not be read. Check them against your report.`}
            </Text>
          ) : null}

          {groupByPanel(lines).map((group) => (
            <View key={group.title} style={{ marginTop: SPACE.block }}>
              <Text style={[font('footnote', 'semibold'), s.panel]}>{displayCopy(group.title)}</Text>
              {group.items.map(renderLine)}
            </View>
          ))}

          <View style={{ marginTop: SPACE.block, gap: 12 }}>
            <SecondaryButton label="Read a Different Report" onPress={() => setStage('pick')} />
          </View>
        </>
      ) : null}

      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 12 }]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  lede: { color: G.ink, lineHeight: 24, marginBottom: SPACE.near },
  meta: { color: L.meta },
  ink: { color: L.ink },
  panel: { color: G.body, marginBottom: 2 },
  warn: { color: HUE.attention },

  label: { color: G.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: G.ink, backgroundColor: G.fill, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  dateRow: { flexDirection: 'row', gap: 8 },
  part: { flex: 1, textAlign: 'center' },
  card: { marginTop: 12, backgroundColor: L.glass, padding: 14, overflow: 'hidden', ...BLEED },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fields: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
