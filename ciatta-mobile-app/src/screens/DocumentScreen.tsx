// One medical document: what it is, what it says, what was filed from it,
// and the original one tap away. Everything here is what the document said
// and she kept; nothing is interpreted. Part B adds the analysis below.

import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DocumentDetail } from '../data/repo';
import { displayCopy } from '../lib/displayCopy';
import { chosenDocument } from '../lib/documentHandoff';
import { DOC_TYPE_LABEL } from '../lib/documents';
import { labDay } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { G } from '../ui/scheme';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

function Section({ title, lines }: { title: string; lines: (string | null | undefined)[] }) {
  const kept = lines.filter((l): l is string => !!l);
  if (!kept.length) return null;
  return (
    <View style={{ marginTop: SPACE.block }}>
      <Eyebrow>{title}</Eyebrow>
      <View style={s.card}>
        <CardFill />
        {kept.map((line, n) => (
          <Text key={`${line}${n}`} style={[font('subhead'), s.ink, s.line, n > 0 && s.divided]}>
            {displayCopy(line)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function DocumentScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [id] = useState(() => chosenDocument());
  const [doc, setDoc] = useState<DocumentDetail | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return setDoc(null);
    repo.loadDocument(id).then(setDoc).catch(() => setDoc(null));
  }, [id, repo]);

  const openOriginal = useCallback(async () => {
    if (!id) return;
    const url = await repo.labReportFile(id);
    if (!url) return setNote('The original could not be opened just now.');
    await WebBrowser.openBrowserAsync(url);
  }, [id, repo]);

  const remove = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Remove this document?',
      'The document, its original, and what was filed from it are removed from Ciatta. Items you already had stay. A plan it replaced is not restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void repo
              .removeDocument(id)
              .then(() => nav.back())
              .catch(() => setNote('The document could not be removed just now. Nothing was changed.')),
        },
      ],
    );
  }, [id, repo, nav]);

  if (!doc) {
    return (
      <DetailScreen title="Document" onBack={nav.back}>
        {doc === null ? <EmptyNote text="This document was not found." /> : null}
      </DetailScreen>
    );
  }

  const x = doc.extraction;
  const v = x.visit;
  return (
    <DetailScreen title={displayCopy(doc.title ?? DOC_TYPE_LABEL[doc.docType])} onBack={nav.back}>
      <Text style={[font('caption1'), s.meta]}>{displayCopy([DOC_TYPE_LABEL[doc.docType], labDay(doc.on), x.clinician, x.facility].filter(Boolean).join(', '))}</Text>
      <Pressable onPress={() => void openOriginal()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text style={[font('subhead', 'semibold'), s.link]}>View original</Text>
      </Pressable>
      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 8 }]}>{displayCopy(note)}</Text> : null}

      {v ? (
        <>
          <Section title="Reason for the visit" lines={[v.reason]} />
          <Section title="Diagnoses" lines={v.diagnoses.map((d) => `${d.name}${d.status === 'new' ? ' (new)' : ''}`)} />
          <Section title="Medications started or changed" lines={[...v.medicationsStarted, ...v.medicationsChanged].map((m) => [m.name, m.strength, m.dose, m.frequency].filter(Boolean).join(', '))} />
          <Section title="Medications stopped" lines={v.medicationsStopped.map((m) => m.name)} />
          <Section title="Procedures" lines={v.procedures.map((p) => [p.name, p.date ? labDay(p.date) : null].filter(Boolean).join(', '))} />
          <Section title="Follow ups" lines={v.followUps.map((f) => [f.specialty, f.clinician, f.reason, f.when].filter(Boolean).join(', '))} />
          <Section title="Instructions" lines={v.instructions} />
          <Section title="Allergies" lines={v.allergies.map((a) => [a.substance, a.reaction].filter(Boolean).join(', '))} />
        </>
      ) : null}
      {x.report ? (
        <>
          <Section title={x.report.study ?? 'Study'} lines={[x.report.bodySite ? `Body area: ${x.report.bodySite}` : null]} />
          <Section title="Findings" lines={[x.report.findings]} />
          <Section title="Impression" lines={[x.report.impression]} />
        </>
      ) : null}
      {x.prescription ? <Section title="Medications" lines={x.prescription.medications.map((m) => [m.name, m.strength, m.dose, m.frequency, m.prescriber].filter(Boolean).join(', '))} /> : null}
      {x.referral ? <Section title="Referral" lines={[x.referral.specialty, x.referral.clinician, x.referral.reason, x.referral.referredBy ? `Referred by ${x.referral.referredBy}` : null]} /> : null}
      {x.insurance ? <Section title="Insurance" lines={[x.insurance.provider, x.insurance.plan, x.insurance.memberId ? `Member ${x.insurance.memberId}` : null]} /> : null}
      {x.other ? <Section title="About" lines={[x.other.description]} /> : null}

      <Section
        title="Filed from this document"
        lines={[
          doc.filed.conditions.length ? `Conditions: ${doc.filed.conditions.join(', ')}` : null,
          doc.filed.allergies.length ? `Allergies: ${doc.filed.allergies.join(', ')}` : null,
          doc.filed.medications.length ? `Medications: ${doc.filed.medications.join(', ')}` : null,
          doc.filed.procedures.length ? `Procedures: ${doc.filed.procedures.join(', ')}` : null,
          doc.filed.referrals.length ? `Referrals: ${doc.filed.referrals.join(', ')}` : null,
          doc.linked.length ? `${doc.linked.length} already in your record, linked` : null,
        ]}
      />

      {/* PART B ANALYSIS */}

      <View style={{ marginTop: SPACE.section }}>
        <SecondaryButton label="Remove This Document" onPress={remove} />
      </View>
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  meta: { color: G.meta },
  ink: { color: L.ink },
  link: { color: G.ink, textDecorationLine: 'underline', marginTop: 4 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  line: { paddingVertical: 10 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
});
