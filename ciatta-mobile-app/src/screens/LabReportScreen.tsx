// One lab report: the whole of it at a glance. The count of what is high,
// low and in range, each panel with what is outside range first, and the
// original file one tap away. Everything here is drawn from the results
// saved from the report; nothing is interpreted.

import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { displayCopy } from '../lib/displayCopy';
import { chooseLab, chosenReport } from '../lib/labHandoff';
import { countLine, reportPanels, reportResults } from '../lib/labReport';
import { changeSinceLast, type LabResult, labDay, labHistory, labStatus } from '../lib/labs';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { CardFill } from '../ui/cardFill';
import { DetailScreen, EmptyNote, SecondaryButton } from '../ui/kit';
import { LabRangeBar, LabStatusTag, STATUS_COLOR } from '../ui/labs';
import { G } from '../ui/scheme';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';

const MINI_H = 44;

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

      {/* PART 2 SECTIONS: body systems and cycle follow */}

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 10 },
  cell: { width: '47%', gap: 2 },
});
