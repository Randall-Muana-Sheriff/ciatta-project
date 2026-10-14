// Add a lab report: a photo of the paper or the PDF a clinic sent. Ciatta
// has it read, then shows every line it read so she can check it against
// the report, correct it, or leave it out. Nothing is saved until she says
// so, and only the lines she kept.
//
// The file goes to the lab-scan function and from there to OpenAI to be
// read; it is not kept on Ciatta's servers.

import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { type LabFlag, type LabResult, type ScannedTest, testFromFields } from '../lib/labs';
import { dayFromParts } from '../lib/procedureEffect';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { DetailScreen, PrimaryButton, SecondaryButton, SaveBar, Lead } from '../ui/kit';
import { LabStatusTag } from '../ui/labs';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';

type Line = { key: string; keep: boolean; name: string; value: string; unit: string; range: string; flag: LabFlag | null };

const lineFrom = (t: ScannedTest, n: number): Line => ({
  key: `l${n}`,
  keep: true,
  name: t.name,
  value: t.value != null ? String(t.value) : (t.valueText ?? ''),
  unit: t.unit ?? '',
  range: t.rangeText ?? '',
  flag: t.flag,
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

  const read = async (base64: string, kind: 'image' | 'pdf') => {
    setStage('reading');
    setNote(null);
    try {
      const scan = await repo.scanLab(base64, kind);
      if (scan.notLab || !scan.tests.length) {
        setNote(scan.notLab ? 'That does not look like a lab report.' : 'No results could be read from it. Try a clearer photo.');
        setStage('pick');
        return;
      }
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

  const fromCamera = async (camera: boolean) => {
    try {
      if (camera) {
        const ok = await ImagePicker.requestCameraPermissionsAsync();
        if (!ok.granted) {
          setNote('The camera needs permission. You can turn it on in Settings.');
          return;
        }
      }
      const picked = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (picked.canceled || !picked.assets?.length) return;
      // Large enough to read small print, small enough to send.
      const ref = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 1800 }).renderAsync();
      const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      if (out.base64) await read(out.base64, 'image');
    } catch {
      setNote('That photo did not open.');
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
    if (!on || !kept.length || saving) return;
    setSaving(true);
    setNote(null);
    try {
      await repo.saveLabs(kept, on, lab.trim() || null);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'Your labs did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  // The status as it will read once saved, so she sees it while checking.
  const preview = (l: Line): LabResult | null => {
    const t = testFromFields(l);
    return t ? { ...t, id: l.key, status: 'final', source: 'report', lab: null, on: on ?? '' } : null;
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
          <Lead style={s.lede} text={"A photo of your report, or the PDF your clinic sent. Ciatta reads each result, then you check every line before anything is saved."} />
          <View style={{ gap: 12 }}>
            <PrimaryButton label="Take a Photo of a Report" onPress={() => void fromCamera(true)} />
            <SecondaryButton label="Choose a Photo" onPress={() => void fromCamera(false)} />
            <SecondaryButton label="Choose a PDF" onPress={() => void fromPdf()} />
          </View>
          <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near }]}>
            The report is sent to OpenAI to be read and is not kept on Ciatta's servers.
          </Text>
        </>
      ) : null}

      {stage === 'reading' ? <Lead style={s.lede} text={"Reading your report."} /> : null}

      {stage === 'review' ? (
        <>
          <Lead style={s.lede} text={"Check each line against your report. Correct anything that was read wrong, or switch it off."} />
          <Text style={[font('caption1'), s.label]}>Lab</Text>
          <TextInput value={lab} onChangeText={setLab} placeholder="For example, Quest Diagnostics" placeholderTextColor={L.meta} style={[font('body'), s.input]} accessibilityLabel="Lab" />
          <Text style={[font('caption1'), s.label]}>Collected on</Text>
          <View style={s.dateRow}>
            <TextInput value={day} onChangeText={setDay} placeholder="Day" keyboardType="number-pad" maxLength={2} placeholderTextColor={L.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Day" />
            <TextInput value={month} onChangeText={setMonth} placeholder="Month" keyboardType="number-pad" maxLength={2} placeholderTextColor={L.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Month, as a number" />
            <TextInput value={year} onChangeText={setYear} placeholder="Year" keyboardType="number-pad" maxLength={4} placeholderTextColor={L.meta} style={[font('body'), s.input, s.part]} accessibilityLabel="Year" />
          </View>
          {!on ? <Text style={[font('footnote'), s.meta, { marginTop: 6 }]}>Add the day the sample was taken, as it is on the report.</Text> : null}

          {lines.map((l) => {
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
          })}

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
  lede: { color: L.ink, lineHeight: 24, marginBottom: SPACE.near },
  meta: { color: L.meta },
  ink: { color: L.ink },
  label: { color: L.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  dateRow: { flexDirection: 'row', gap: 8 },
  part: { flex: 1, textAlign: 'center' },
  card: { marginTop: 12, backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 14, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fields: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
