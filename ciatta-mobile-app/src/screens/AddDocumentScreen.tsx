// Scan or upload any medical document. Ciatta reads it and works out what
// it is, shows every item it found under where it will be filed, marks what
// she already has, and files only what she keeps. A lab report goes to Add
// a Lab Report, which reads labs.

import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { chooseDocument } from '../lib/documentHandoff';
import { buildFilings, DOC_TYPE_LABEL, type DocType, type DocumentScan, insuranceFrom, type ReviewItem, reviewItems, TARGET_HEADING, type Target } from '../lib/documents';
import { chooseLabFile } from '../lib/labHandoff';
import { labDay } from '../lib/labs';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, Lead, PrimaryButton, SaveBar, SecondaryButton } from '../ui/kit';
import { G } from '../ui/scheme';
import { HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';
import { type Captured, useCapture } from '../ui/useCapture';

const ORDER: Target[] = ['conditions', 'allergies', 'medications', 'stop_medications', 'procedures', 'referrals', 'insurance'];
const TYPES: DocType[] = ['visit', 'imaging', 'pathology', 'prescription', 'referral', 'insurance', 'lab_report', 'other'];

export function AddDocumentScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [stage, setStage] = useState<'pick' | 'reading' | 'review'>('pick');
  const [file, setFile] = useState<(Captured & { checksum: string }) | null>(null);
  const [scan, setScan] = useState<DocumentScan | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; on: string } | null>(null);
  const [replacePlan, setReplacePlan] = useState(false);
  const [saving, setSaving] = useState(false);

  const read = async (f: Captured, as?: DocType) => {
    setNote(null);
    setDuplicate(null);
    const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, f.base64);
    if (!as) {
      const seen = await repo.findDocument(checksum).catch(() => null);
      if (seen) {
        setDuplicate({ id: seen.id, on: seen.on });
        return;
      }
    }
    setStage('reading');
    try {
      const s = await repo.scanDocument(f.base64, f.kind, as);
      if (s.notMedical) {
        setNote('This does not look like a medical document. Nothing was saved.');
        setStage('pick');
        return;
      }
      if (s.docType === 'lab_report') {
        chooseLabFile(f);
        nav.back();
        nav.push('addLabs');
        return;
      }
      setFile({ ...f, checksum });
      setScan(s);
      setItems(reviewItems(s, await repo.loadExistingForDocuments().catch(() => ({ conditions: [], medications: [] }))));
      setStage('review');
    } catch (e) {
      setNote(userFacingError(e, 'The document could not be read. Try again.'));
      setStage('pick');
    }
  };

  const capture = useCapture((f) => void read(f));
  useEffect(() => {
    if (capture.note) setNote(capture.note);
  }, [capture.note]);

  const edit = (key: string, patch: Partial<ReviewItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const hasPlan = items.some((i) => i.target === 'insurance' && i.keep);

  const save = async () => {
    if (!file || !scan || saving) return;
    setSaving(true);
    setNote(null);
    try {
      const id = await repo.saveDocument({
        file: { base64: file.base64, kind: file.kind },
        checksum: file.checksum,
        scan,
        filings: buildFilings(items, scan.date),
        insurance: hasPlan && replacePlan ? insuranceFrom(items) : null,
      });
      chooseDocument(id);
      nav.back();
      nav.push('document');
    } catch (e) {
      setNote(userFacingError(e, 'The document did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Add a Document"
      onBack={nav.back}
      footer={stage === 'review' ? <SaveBar label={saving ? 'Saving' : 'Save Document'} disabled={saving} onPress={() => void save()} /> : undefined}
    >
      {stage === 'pick' ? (
        <>
          <Lead style={s.lede} text={"Visit summaries, imaging and pathology reports, prescriptions, referrals, insurance cards and lab reports. Ciatta reads it, then you check every item before anything is filed."} />
          <View style={{ gap: 12 }}>
            {capture.canScan ? <PrimaryButton label="Scan a Paper Document" onPress={() => void capture.scan()} disabled={capture.scanning} /> : null}
            {capture.canScan ? <SecondaryButton label="Upload a PDF" onPress={() => void capture.pdf()} /> : <PrimaryButton label="Upload a PDF" onPress={() => void capture.pdf()} />}
            <SecondaryButton label="Choose a Photo" onPress={() => void capture.photo()} />
          </View>
          {duplicate ? (
            <Pressable
              onPress={() => {
                chooseDocument(duplicate.id);
                nav.push('document');
              }}
              accessibilityRole="button"
              style={[s.card, { marginTop: SPACE.near }]}
            >
              <CardFill />
              <Text style={[font('subhead'), s.ink, { paddingVertical: 12 }]}>{displayCopy(`You added this document on ${labDay(duplicate.on)}. Tap to open it.`)}</Text>
            </Pressable>
          ) : null}
          <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near }]}>
            The document is sent to OpenAI to be read. The original is kept privately in your Ciatta account, and you can remove it at any time.
          </Text>
        </>
      ) : null}

      {stage === 'reading' ? <Lead style={s.lede} text={"Reading your document."} /> : null}

      {stage === 'review' && scan ? (
        <>
          <Text style={[font('caption1'), s.meta]}>Read as</Text>
          <View style={s.types}>
            {TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => file && t !== scan.docType && void read(file, t)}
                accessibilityRole="button"
                accessibilityState={{ selected: t === scan.docType }}
                style={[s.type, t === scan.docType && s.typeOn]}
              >
                <Text style={[font('caption1', t === scan.docType ? 'semibold' : 'regular'), s.ink]}>{DOC_TYPE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[font('subhead'), s.ink, { marginTop: SPACE.near }]}>
            {displayCopy([scan.title, scan.date ? labDay(scan.date) : null, scan.clinician, scan.facility].filter(Boolean).join(', '))}
          </Text>
          {scan.multipleDates ? <Text style={[font('footnote'), s.warn, { marginTop: 8 }]}>This document covers more than one date. Check the items against it.</Text> : null}
          {scan.unreadablePages.length ? (
            <Text style={[font('footnote'), s.warn, { marginTop: 8 }]}>
              {`Page${scan.unreadablePages.length > 1 ? 's' : ''} ${scan.unreadablePages.join(', ')} could not be read. Check against your document.`}
            </Text>
          ) : null}
          {scan.report ? (
            <View style={s.card}>
              <CardFill />
              {scan.report.findings ? <Text style={[font('subhead'), s.ink, s.block]}>{displayCopy(`Findings: ${scan.report.findings}`)}</Text> : null}
              {scan.report.impression ? <Text style={[font('subhead', 'semibold'), s.ink, s.block]}>{displayCopy(`Impression: ${scan.report.impression}`)}</Text> : null}
            </View>
          ) : null}
          {scan.visit?.instructions.length ? (
            <View style={s.card}>
              <CardFill />
              {scan.visit.instructions.map((line) => (
                <Text key={line} style={[font('subhead'), s.ink, s.block]}>
                  {displayCopy(line)}
                </Text>
              ))}
            </View>
          ) : null}
          {scan.other?.description ? <Text style={[font('subhead'), s.ink, { marginTop: SPACE.near }]}>{displayCopy(scan.other.description)}</Text> : null}

          {ORDER.filter((t) => items.some((i) => i.target === t)).map((t) => (
            <View key={t} style={{ marginTop: SPACE.block }}>
              <Text style={[font('footnote', 'semibold'), { color: G.body }]}>{TARGET_HEADING[t]}</Text>
              <View style={s.card}>
                <CardFill />
                {items
                  .filter((i) => i.target === t)
                  .map((i, n) => (
                    <View key={i.key} style={[s.row, n > 0 && s.divided, !i.keep && { opacity: 0.45 }]}>
                      <View style={{ flex: 1 }}>
                        <TextInput value={i.title} onChangeText={(v) => edit(i.key, { title: v, value: { ...i.value, name: v, ...(t === 'referrals' ? { specialty: v } : {}), ...(t === 'insurance' ? { provider: v } : {}) } })} style={[font('subhead', 'semibold'), s.ink]} accessibilityLabel="Item" />
                        {i.detail ? <Text style={[font('caption1'), s.meta]}>{displayCopy(i.detail)}</Text> : null}
                        {i.existingId ? <Text style={[font('caption1'), s.meta]}>{t === 'stop_medications' ? 'In your Medications; it will be marked stopped' : 'Already in your record; it will be linked, not added again'}</Text> : null}
                      </View>
                      <Switch value={i.keep} onValueChange={(v) => edit(i.key, { keep: v })} trackColor={{ false: C.fill, true: C.green }} ios_backgroundColor={C.fill} accessibilityLabel={`Keep ${i.title}`} />
                    </View>
                  ))}
              </View>
            </View>
          ))}

          {hasPlan ? (
            <View style={[s.row, { marginTop: SPACE.near }]}>
              <Text style={[font('subhead'), s.ink, { flex: 1 }]}>Replace your current plan with this card</Text>
              <Switch value={replacePlan} onValueChange={setReplacePlan} trackColor={{ false: C.fill, true: C.green }} ios_backgroundColor={C.fill} accessibilityLabel="Replace your current plan" />
            </View>
          ) : null}

          {!items.length ? <Text style={[font('subhead'), s.meta, { marginTop: SPACE.near }]}>Nothing to file from this document. It will be kept, with its original.</Text> : null}
          <View style={{ marginTop: SPACE.block }}>
            <SecondaryButton label="Read a Different Document" onPress={() => setStage('pick')} />
          </View>
        </>
      ) : null}

      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 12 }]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  lede: { color: G.ink, lineHeight: 24, marginBottom: SPACE.near },
  meta: { color: L.meta },
  ink: { color: L.ink },
  warn: { color: HUE.attention },
  block: { paddingVertical: 8 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  type: { borderWidth: 1, borderColor: L.rule, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  typeOn: { borderColor: L.ink },
});
