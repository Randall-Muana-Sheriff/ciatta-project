// One lab report: the whole of it at a glance. The count of what is high,
// low and in range, each panel with what is outside range first, and the
// original file one tap away. Everything here is drawn from the results
// saved from the report; nothing is interpreted.

import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Print from 'expo-print';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { chooseLab, chosenReport } from '../lib/labHandoff';
import { countLine, reportPanels, reportResults } from '../lib/labReport';
import { SYSTEM_DOTS, WHOLE_BODY } from '../lib/bodyMap';
import { ACTION_WORDS, ANALYSIS_LABEL, analysisHtml, analysisStale, criticalResults, type StoredAnalysis } from '../lib/labAnalysis';
import { changeSinceLast, isOutside, type LabResult, labDay, labHistory, labStatus, testKey } from '../lib/labs';
import { reportSystems } from '../lib/labSystems';
import { countedWindows, estimatedPhaseLabel, medianLength } from '../lib/cycleModel';
import { chosenRange, cycleDayAt, cycleLine, isCycleHormone, phaseRangeLine, phaseRanges } from '../lib/labCycle';
import { useCycleInsights } from '../state/cycleStore';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { LabRangeBar, LabStatusTag, STATUS_COLOR } from '../ui/labs';
import { G } from '../ui/scheme';
import { images } from '../ui/images';
import { HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';

const MINI_H = 44;

function AnalysisList({ title, items }: { title: string; items: { head: string; body: string; chip?: string }[] }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: SPACE.near }}>
      <Text style={[font('footnote', 'semibold'), { color: G.body }]}>{title}</Text>
      <View style={s.card}>
        <CardFill />
        {items.map((item, n) => (
          <View key={`${item.head}${n}`} style={[s.row, n > 0 && s.divided]}>
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

function MiniTrend({ history }: { history: LabResult[] }) {
  const [width, setWidth] = useState(0);
  const pts = history.filter((h) => h.value != null);
  const lo = Math.min(...pts.map((p) => p.value!));
  const hi = Math.max(...pts.map((p) => p.value!));
  const t0 = Date.parse(pts[0].on);
  const t1 = Date.parse(pts[pts.length - 1].on);
  const x = (on: string) => 4 + (t1 === t0 ? 0.5 : (Date.parse(on) - t0) / (t1 - t0)) * (width - 8);
  const y = (v: number) => 4 + (hi === lo ? 0.5 : 1 - (v - lo) / (hi - lo)) * (MINI_H - 8);
  return (
    <View style={{ height: MINI_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <Svg width={width} height={MINI_H}>
          <Polyline points={pts.map((p) => `${x(p.on)},${y(p.value!)}`).join(' ')} fill="none" stroke={L.meta} strokeWidth={1.5} />
          {pts.map((p) => (
            <Circle key={p.id} cx={x(p.on)} cy={y(p.value!)} r={3} fill={STATUS_COLOR[labStatus(p).key]} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const FIGURE_H = 300;
const FIGURE_W = FIGURE_H * (850 / 1850);

// The figure with a dot for each system this report touches, ringed where
// a result is outside its range, and a row per system that opens its
// results. Tests in no system are listed under Whole Body.
function BodySystems({ results }: { results: LabResult[] }) {
  const { systems, whole } = useMemo(() => reportSystems(results), [results]);
  const [open, setOpen] = useState<string | null>(null);
  if (!systems.length && !whole.length) return null;
  const rows = [...systems.map((x) => ({ key: x.system, results: x.results, flagged: x.flagged })), ...(whole.length ? [{ key: WHOLE_BODY, results: whole, flagged: whole.some(isOutside) }] : [])];
  return (
    <View style={{ marginTop: SPACE.block }}>
      <Eyebrow>Body systems</Eyebrow>
      <View style={[s.card, s.bodyCard]}>
        <CardFill />
        <View style={{ width: FIGURE_W, height: FIGURE_H }}>
          <Image source={images.body} style={{ width: FIGURE_W, height: FIGURE_H, opacity: 0.85 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          {systems.map((x) => {
            const dot = SYSTEM_DOTS[x.system];
            if (!dot) return null;
            return (
              <View
                key={x.system}
                style={[
                  s.dot,
                  { left: (dot.x / 100) * FIGURE_W - 7, top: (dot.y / 100) * FIGURE_H - 7, backgroundColor: dot.color },
                  x.flagged && { borderColor: HUE.attention, borderWidth: 3 },
                ]}
              />
            );
          })}
        </View>
        <View style={{ flex: 1 }}>
          {rows.map((row, n) => (
            <View key={row.key}>
              <Pressable
                onPress={() => setOpen((o) => (o === row.key ? null : row.key))}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === row.key }}
                style={({ pressed }) => [s.sysRow, n > 0 && s.divided, pressed && { opacity: 0.6 }]}
              >
                <View style={[s.swatch, { backgroundColor: SYSTEM_DOTS[row.key]?.color ?? L.meta }]} />
                <Text style={[font('subhead'), s.ink, { flex: 1 }]}>{row.key}</Text>
                <Text style={[font('caption1'), row.flagged ? s.flag : s.meta]}>
                  {row.flagged ? `${row.results.filter(isOutside).length} outside` : `${row.results.length}`}
                </Text>
              </Pressable>
              {open === row.key
                ? row.results.map((r) => (
                    <View key={r.id} style={s.sysResult}>
                      <Text style={[font('caption1'), s.ink, { flex: 1 }]} numberOfLines={1}>
                        {displayCopy(r.name)}
                      </Text>
                      <LabStatusTag result={r} small />
                    </View>
                  ))
                : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function LabReportScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [key] = useState(() => chosenReport());
  const [labs, setLabs] = useState<LabResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    repo.loadLabs().then(setLabs).catch(() => setLabs([]));
  }, [repo]);

  const results = useMemo(() => (key && labs ? reportResults(labs, key) : []), [key, labs]);
  const { windows, profile } = useCycleInsights();
  const usual = useMemo(() => medianLength(countedWindows(windows, profile)), [windows, profile]);
  const cycle = useMemo(() => (key ? cycleDayAt(key.on, windows, usual) : null), [key, windows, usual]);
  const [stored, setStored] = useState<StoredAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);

  const analyse = useCallback(async () => {
    if (!key?.documentId || analysing) return;
    setAnalysing(true);
    setAnalysisNote(null);
    try {
      setStored(
        await repo.analyzeLabReport(key.documentId, cycle ? { day: cycle.day, phase: cycle.phase, usual_length: usual } : null),
      );
    } catch (e) {
      setAnalysisNote(e instanceof Error ? e.message : 'The analysis could not be written just now.');
    } finally {
      setAnalysing(false);
    }
  }, [key, analysing, repo, cycle, usual]);

  // Read the stored analysis; write one the first time a report is opened.
  useEffect(() => {
    if (!key?.documentId || !labs) return;
    let ignore = false;
    repo
      .loadLabAnalysis(key.documentId)
      .then((s) => {
        if (ignore) return;
        if (s) setStored(s);
        else void analyse();
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
    // analyse is stable enough for a once per report read; listing it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, labs, repo]);

  const critical = useMemo(() => criticalResults(results), [results]);
  const stale = stored && labs ? analysisStale(stored, results, labs) : false;
  const share = useCallback(async () => {
    if (!stored || !key) return;
    const { uri } = await Print.printToFileAsync({ html: analysisHtml(key.lab ?? 'Lab report', key.on, stored) });
    await Share.share({ url: uri, title: 'Lab report analysis' });
  }, [stored, key]);
  const panels = useMemo(() => reportPanels(results), [results]);
  const trends = useMemo(
    () =>
      panels
        .map((p) => ({
          title: p.title,
          items: p.items
            .map((result) => ({ result, history: labHistory(labs ?? [], result.name).filter((h) => h.value != null) }))
            .filter((t) => t.history.length >= 2),
        }))
        .filter((p) => p.items.length),
    [panels, labs],
  );

  const openOriginal = useCallback(async () => {
    if (!key?.documentId) return;
    const url = await repo.labReportFile(key.documentId);
    if (!url) {
      setNote('The original could not be opened just now.');
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  }, [key, repo]);

  const remove = useCallback(() => {
    if (!key?.documentId) return;
    Alert.alert(
      'Remove this report?',
      'This report and the results read from it are removed from Ciatta. Your records at your provider are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            void repo
              .removeLabReport(key.documentId!)
              .then(() => nav.back())
              .catch(() => setNote('The report could not be removed just now. Nothing was changed.')),
        },
      ],
    );
  }, [key, repo, nav]);

  if (!key || (labs && !results.length)) {
    return (
      <DetailScreen title="Lab Report" onBack={nav.back}>
        {labs ? <EmptyNote text="This report has no results." /> : null}
      </DetailScreen>
    );
  }

  return (
    <DetailScreen title={key.lab ?? 'Lab Report'} onBack={nav.back}>
      <Text style={[font('caption1'), s.meta]}>{displayCopy(`Collected ${labDay(key.on)}`)}</Text>
      <Text style={[font('title3', 'semibold'), s.count]}>{displayCopy(countLine(results))}</Text>
      {critical.length || stored?.analysis.urgent.length ? (
        <View style={[s.card, s.urgent]}>
          <CardFill />
          <Text style={[font('headline'), s.urgentHead]}>Needs prompt attention</Text>
          {(stored?.analysis.urgent.length
            ? stored.analysis.urgent.map((u) => `${u.test} ${u.value}. ${u.reason} ${ACTION_WORDS[u.action]}.`)
            : critical.map((r) => `${r.name} ${r.value ?? r.valueText}${r.unit ? ` ${r.unit}` : ''} was flagged as critical by the lab. Contact your clinician today.`)
          ).map((line) => (
            <Text key={line} style={[font('subhead'), s.ink, { marginTop: 4 }]}>
              {displayCopy(line)}
            </Text>
          ))}
        </View>
      ) : null}
      {key.documentId ? (
        <Pressable onPress={() => void openOriginal()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={[font('subhead', 'semibold'), s.link]}>View original</Text>
        </Pressable>
      ) : (
        <Text style={[font('caption1'), s.meta]}>From your provider</Text>
      )}
      {note ? <Text style={[font('footnote'), s.meta, { marginTop: 8 }]}>{displayCopy(note)}</Text> : null}

      {panels.map((panel) => (
        <View key={panel.title} style={{ marginTop: SPACE.block }}>
          <Eyebrow>{displayCopy(panel.title)}</Eyebrow>
          <View style={s.card}>
            <CardFill />
            {panel.items.map((r, n) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  chooseLab(r.name);
                  nav.push('lab');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [s.row, n > 0 && s.divided, pressed && { opacity: 0.6 }]}
              >
                <View style={s.top}>
                  <Text style={[font('subhead'), s.ink, { flex: 1 }]} numberOfLines={2}>
                    {displayCopy(r.name)}
                  </Text>
                  <Text style={[font('subhead', 'semibold'), s.ink]}>
                    {r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : displayCopy(r.valueText ?? '')}
                  </Text>
                </View>
                <View style={s.top}>
                  <LabStatusTag result={r} small />
                  <View style={{ flex: 1, maxWidth: 140 }}>
                    <LabRangeBar result={r} height={4} />
                  </View>
                </View>
                {isCycleHormone(r.name) ? (
                  <View style={{ gap: 2 }}>
                    <Text style={[font('caption1'), s.meta]}>{displayCopy(cycleLine(cycle))}</Text>
                    {phaseRanges(r.rangeText).length ? (
                      <Text style={[font('caption1'), s.meta]}>
                        {displayCopy(
                          phaseRangeLine(
                            phaseRanges(r.rangeText),
                            chosenRange(phaseRanges(r.rangeText), cycle?.likely ?? null),
                            cycle ? estimatedPhaseLabel(cycle.likely) : null,
                          ),
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {stored?.analysis.findings
                  .filter((f) => testKey(f.test) === testKey(r.name))
                  .map((f) => (
                    <Text key={f.test} style={[font('caption1'), s.finding]}>
                      {displayCopy(f.explanation)}
                    </Text>
                  ))}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {trends.length ? (
        <View style={{ marginTop: SPACE.block }}>
          <Eyebrow>Panel trends</Eyebrow>
          {trends.map((panel) => (
            <View key={panel.title} style={s.card}>
              <CardFill />
              <Text style={[font('footnote', 'semibold'), s.ink, { marginTop: 12 }]}>{displayCopy(panel.title)}</Text>
              <View style={s.grid}>
                {panel.items.map(({ result, history }) => (
                  <View key={result.id} style={s.cell}>
                    <Text style={[font('caption2'), s.meta]} numberOfLines={1}>
                      {displayCopy(result.name)}
                    </Text>
                    <MiniTrend history={history} />
                    <Text style={[font('caption2'), s.meta]} numberOfLines={1}>
                      {displayCopy(changeSinceLast(history))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <BodySystems results={results} />

      {key.documentId ? (
        <View style={{ marginTop: SPACE.block }}>
          <Eyebrow>Clinical AI analysis</Eyebrow>
          <Text style={[font('footnote', 'semibold'), s.label]}>{ANALYSIS_LABEL}</Text>
          {analysing ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>Analysing your report.</Text> : null}
          {analysisNote ? <Text style={[font('subhead'), s.meta, { marginTop: 8 }]}>{displayCopy(analysisNote)}</Text> : null}
          {stored ? (
            <>
              <Text style={[font('caption1'), s.meta, { marginTop: 4 }]}>
                {displayCopy(`Written by ${stored.model} on ${labDay(stored.createdAt.slice(0, 10))} from the results above.`)}
              </Text>
              {stale ? <Text style={[font('subhead'), s.flagText, { marginTop: 8 }]}>Your results have changed since this was written.</Text> : null}
              <View style={s.card}>
                <CardFill />
                <Text style={[font('body'), s.ink, { paddingVertical: 12 }]}>{displayCopy(stored.analysis.summary)}</Text>
              </View>
              <AnalysisList title="Findings" items={stored.analysis.findings.map((f) => ({ head: `${f.test}, ${f.value}`, body: [f.explanation, f.common_causes.length ? `Common causes: ${f.common_causes.join(', ')}.` : '', f.relevance ?? ''].filter(Boolean).join(' ') }))} />
              <AnalysisList title="Patterns" items={stored.analysis.patterns.map((p) => ({ head: p.title, body: `${p.explanation} (${p.tests.join(', ')})` }))} />
              <AnalysisList
                title="Conditions to consider"
                items={stored.analysis.considerations.map((c) => ({ head: c.condition, chip: `${c.confidence} confidence`, body: `How it is confirmed: ${c.how_confirmed} Based on ${c.tests.join(', ')}.` }))}
              />
              <AnalysisList title="Suggested next tests" items={stored.analysis.next_tests.map((n) => ({ head: n.test, body: n.reason }))} />
              <AnalysisList title="Questions for your clinician" items={stored.analysis.questions.map((q) => ({ head: q, body: '' }))} />
              <View style={{ marginTop: SPACE.near, gap: 12 }}>
                <SecondaryButton label="Share or Print" onPress={() => void share()} />
                {stale ? <SecondaryButton label="Analyze Again" onPress={() => void analyse()} /> : null}
              </View>
            </>
          ) : !analysing ? (
            <View style={{ marginTop: SPACE.near }}>
              <SecondaryButton label="Analyze This Report" onPress={() => void analyse()} />
            </View>
          ) : null}
        </View>
      ) : null}

      {key.documentId ? (
        <View style={{ marginTop: SPACE.section }}>
          <SecondaryButton label="Remove This Report" onPress={remove} />
        </View>
      ) : null}
      <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near, lineHeight: 18 }]}>Ranges are each lab's own.</Text>
    </DetailScreen>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  meta: { color: G.meta },
  ink: { color: L.ink },
  count: { color: G.ink, marginTop: 6, marginBottom: 6 },
  link: { color: G.ink, textDecorationLine: 'underline', marginTop: 4 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingHorizontal: 14, overflow: 'hidden' },
  row: { paddingVertical: 12, gap: 6 },
  divided: { borderTopWidth: st, borderTopColor: G.rule },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgent: { borderWidth: 1, borderColor: HUE.escalation, paddingVertical: 12, marginTop: SPACE.near },
  urgentHead: { color: HUE.escalation },
  finding: { color: L.body, lineHeight: 18 },
  label: { color: G.ink, marginTop: 4 },
  flagText: { color: HUE.attention },
  chip: { color: L.meta, borderWidth: 1, borderColor: L.rule, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 10 },
  cell: { width: '47%', gap: 2 },
  bodyCard: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  sysRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  flag: { color: HUE.attention },
  sysResult: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingBottom: 8 },
});
