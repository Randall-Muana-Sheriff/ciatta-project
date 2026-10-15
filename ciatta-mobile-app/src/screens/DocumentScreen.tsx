// One medical document: what it is, what it says, what was filed from it,
// and the original one tap away. Everything here is what the document said
// and she kept; nothing is interpreted. Part B adds the analysis below.

import * as Print from 'expo-print';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import type { DocumentDetail } from '../data/repo';
import { displayCopy } from '../lib/displayCopy';
import { chosenDocument } from '../lib/documentHandoff';
import { countedWindows, medianLength } from '../lib/cycleModel';
import { docAnalysisHtml, documentUrgentLines, extractionFingerprint, type StoredDocAnalysis } from '../lib/documentAnalysis';
import { DOC_TYPE_LABEL, toSnake } from '../lib/documents';
import { cycleDayAt } from '../lib/labCycle';
import { useCycleInsights } from '../state/cycleStore';
import { labDay } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { G } from '../ui/scheme';
import { HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';

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

function AnalysisList({ title, items }: { title: string; items: { head: string; body: string; chip?: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: SPACE.near }}>
      <Text style={[font('footnote', 'semibold'), { color: G.body }]}>{title}</Text>
      <View style={s.card}>
        <CardFill />
        {items.map((item, n) => (
          <View key={`${item.head}${n}`} style={[s.item, n > 0 && s.divided]}>
            <View style={s.top}>
              <Text style={[font('subhead', 'semibold'), s.ink, { flex: 1 }]}>{displayCopy(item.head)}</Text>
              {item.chip ? <Text style={[font('caption2', 'semibold'), s.chip]}>{displayCopy(item.chip)}</Text> : null}
            </View>
            {item.body ? <Text style={[font('subhead'), s.ink]}>{displayCopy(item.body)}</Text> : null}
          </View>
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
  const [stored, setStored] = useState<StoredDocAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const { windows, profile } = useCycleInsights();
  const usual = useMemo(() => medianLength(countedWindows(windows, profile)), [windows, profile]);

  const analyse = useCallback(async () => {
    if (!id || !doc || analysing) return;
    setAnalysing(true);
    setAnalysisNote(null);
    try {
      const at = cycleDayAt(doc.on, windows, usual);
      setStored(await repo.analyzeDocument(id, at ? { day: at.day, phase: at.phase, usual_length: usual } : null));
    } catch (e) {
      setAnalysisNote(e instanceof Error ? e.message : 'The analysis could not be written just now.');
    } finally {
      setAnalysing(false);
    }
  }, [id, doc, analysing, repo, windows, usual]);

  // Read the stored analysis; write one the first time the document opens.
  useEffect(() => {
    if (!id || !doc) return;
    let ignore = false;
    repo
      .loadDocumentAnalysis(id)
      .then((s) => {
        if (ignore) return;
        if (s) setStored(s);
        else void analyse();
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
    // analyse is stable enough for a once per document read; listing it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doc, repo]);

  const share = useCallback(async () => {
    if (!stored || !doc) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: docAnalysisHtml(doc.title ?? DOC_TYPE_LABEL[doc.docType], doc.on, stored) });
      await Share.share({ url: uri, title: 'Document analysis' });
    } catch {
      setAnalysisNote('The analysis could not be shared just now.');
    }
  }, [stored, doc]);

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
  const urgent = documentUrgentLines(toSnake(x), stored?.analysis ?? null);
  const stale = stored ? stored.factsHash !== extractionFingerprint(toSnake(x)) : false;
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

      {urgent.length ? (
        <View style={[s.card, s.urgent]}>
          <CardFill />
          <Text style={[font('headline'), s.urgentHead]}>Needs prompt attention</Text>
          {urgent.map((line) => (
            <Text key={line} style={[font('subhead'), s.ink, { marginTop: 4 }]}>
              {displayCopy(line)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Clinical AI analysis</Eyebrow>
        <Text style={[font('footnote', 'semibold'), s.label]}>Clinical AI analysis. Not a diagnosis. Discuss it with your clinician.</Text>
        {analysing ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>Analysing your document.</Text> : null}
        {analysisNote ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>{displayCopy(analysisNote)}</Text> : null}
        {stored ? (
          <>
            <Text style={[font('caption1'), s.meta, { marginTop: 4 }]}>
              {displayCopy(`Written by ${stored.model} on ${labDay(stored.createdAt.slice(0, 10))} from this document and your record.`)}
            </Text>
            {stale ? <Text style={[font('subhead'), s.flagText, { marginTop: 8 }]}>This document has changed since this was written.</Text> : null}
            <View style={s.card}>
              <CardFill />
              <Text style={[font('body'), s.ink, { paddingVertical: 12 }]}>{displayCopy(stored.analysis.summary)}</Text>
            </View>
            <AnalysisList title="Terms explained" items={stored.analysis.terms.map((t) => ({ head: t.term, body: t.meaning }))} />
            <AnalysisList title="Findings" items={stored.analysis.findings.map((f) => ({ head: f.item, body: [f.explanation, f.relevance ?? ''].filter(Boolean).join(' ') }))} />
            <AnalysisList title="Patterns" items={stored.analysis.patterns.map((p) => ({ head: p.title, body: `${p.explanation} (${p.items.join(', ')})` }))} />
            <AnalysisList
              title="Conditions to consider"
              items={stored.analysis.considerations.map((c) => ({ head: c.condition, chip: `${c.confidence} confidence`, body: `How it is confirmed: ${c.how_confirmed} Based on ${c.items.join(', ')}.` }))}
            />
            <AnalysisList title="Next steps" items={stored.analysis.next_steps.map((n) => ({ head: n.step, body: n.reason }))} />
            <AnalysisList title="Questions for your clinician" items={stored.analysis.questions.map((q) => ({ head: q, body: '' }))} />
            <View style={{ marginTop: SPACE.near, gap: 12 }}>
              <SecondaryButton label="Share or Print" onPress={() => void share()} />
              <SecondaryButton label="Analyze Again" onPress={() => void analyse()} />
            </View>
          </>
        ) : !analysing ? (
          <View style={{ marginTop: SPACE.near }}>
            <SecondaryButton label="Analyze This Document" onPress={() => void analyse()} />
          </View>
        ) : null}
      </View>

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
  item: { paddingVertical: 12, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgent: { borderWidth: 1, borderColor: HUE.escalation, paddingVertical: 12, marginTop: SPACE.near },
  urgentHead: { color: HUE.escalation },
  label: { color: G.ink, marginTop: 4 },
  flagText: { color: HUE.attention },
  chip: { color: L.meta, borderWidth: 1, borderColor: L.rule, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
