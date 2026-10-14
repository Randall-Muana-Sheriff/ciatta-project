// Symptoms, side by side, and compared. A row per symptom she chose to
// follow (or, until she chooses, the ones she logged most), a dot per day,
// today's column marked. + Symptoms opens every symptom, grouped as the Log
// screen groups them, to choose which to follow. Compare sets two of them
// against each other, or one against her sleep, HRV, resting heart rate or
// steps, and says what her own days show. See lib/symptomCorrelation.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Day } from '../data/daily';
import { chipIcon } from '../lib/chipIcons';
import { displayCopy } from '../lib/displayCopy';
import { SYMPTOM_GROUPS } from '../lib/logCategories';
import { COMPARE_METRICS, type CompareMetric, metricCorrelation, symptomCorrelation, windowDays } from '../lib/symptomCorrelation';
import type { Range, Strip } from '../lib/symptomStrip';
import { font } from '../theme';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { HUE, L, TILE_RADIUS } from './surface';
import { onGround } from './scheme';
import { GlassFill } from './frosted';

const RANGES: { key: Range; label: string }[] = [
  { key: '7', label: '7 day' },
  { key: '28', label: '28 day' },
  { key: '90', label: '3 month' },
];
const ROW_COLORS = [onGround('#7CC6D6'), onGround('#F2B863'), onGround('#B188F3'), onGround('#F27D9B'), onGround('#9BD36A'), onGround('#EC9658')];

type Pick = { kind: 'symptom'; name: string } | { kind: 'metric'; key: CompareMetric };
const same = (a: Pick, b: Pick) => (a.kind === 'symptom' && b.kind === 'symptom' ? a.name === b.name : a.kind === 'metric' && b.kind === 'metric' && a.key === b.key);

export function SymptomCompare({
  strip,
  range,
  onRange,
  seen,
  days,
  chosen,
  onChoose,
  onAll,
}: {
  strip: Strip;
  range: Range;
  onRange: (r: Range) => void;
  seen: ReadonlyMap<string, ReadonlyMap<string, number | null>>;
  days: readonly Day[];
  chosen: string[];
  onChoose: (names: string[]) => void;
  onAll: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<Pick[]>([]);
  const [choosing, setChoosing] = useState(false);
  const n = strip.cols.length;
  const dot = n > 14 ? 7 : 12;

  // Two at a time: a third replaces the older; tapping one chosen lets it go.
  const pick = (p: Pick) => setPicked((prev) => (prev.some((x) => same(x, p)) ? prev.filter((x) => !same(x, p)) : [...prev, p].slice(-2)));
  const isPicked = (p: Pick) => picked.some((x) => same(x, p));

  const result = useMemo(() => {
    const window = windowDays(range, new Date());
    const daysOf = (name: string) => new Set(seen.get(name)?.keys() ?? []);
    const syms = picked.filter((p): p is { kind: 'symptom'; name: string } => p.kind === 'symptom');
    const metric = picked.find((p): p is { kind: 'metric'; key: CompareMetric } => p.kind === 'metric');
    if (syms.length === 2) return symptomCorrelation(syms[0].name, daysOf(syms[0].name), syms[1].name, daysOf(syms[1].name), window).sentence;
    if (syms.length === 1 && metric) return metricCorrelation(syms[0].name, daysOf(syms[0].name), metric.key, days, window).sentence;
    if (!syms.length && metric) return 'Choose a symptom to set against it.';
    return syms.length === 1 ? 'Choose a second symptom, or your sleep, HRV, RHR or steps.' : 'Choose two to compare.';
  }, [picked, range, seen, days]);

  return (
    <View>
      <View style={s.head}>
        <Text style={[font('headline'), s.ink]}>Symptoms</Text>
        <Pressable onPress={onAll} accessibilityRole="button" hitSlop={8} style={s.all}>
          <Text style={[font('footnote', 'semibold'), { color: L.body }]}>All</Text>
          <Icon name="chevronRight" size={14} color={L.body} />
        </Pressable>
      </View>
      <View style={s.card}>
        <GlassFill />
        <View style={s.ranges}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => onRange(r.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: r.key === range }}
              style={[s.range, r.key === range && s.rangeOn]}
            >
              <Text style={[font('footnote', r.key === range ? 'semibold' : 'regular'), { color: r.key === range ? L.canvas : L.body }]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        {strip.rows.length ? (
          <>
            {strip.labels.length ? (
              <View style={s.row}>
                <View style={s.name} />
                <View style={s.cells}>
                  {strip.labels.map((l, i) => (
                    <View key={i} style={[s.cellBox, i === n - 1 && s.todayHead]}>
                      <Text style={[font('caption2', i === n - 1 ? 'semibold' : 'regular'), { color: i === n - 1 ? L.canvas : L.meta }]}>{l}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {strip.rows.map((r, ri) => {
              const p: Pick = { kind: 'symptom', name: r.name };
              const on = comparing && isPicked(p);
              const color = ROW_COLORS[ri % ROW_COLORS.length];
              return (
                <Pressable
                  key={r.name}
                  disabled={!comparing}
                  onPress={() => pick(p)}
                  accessibilityRole={comparing ? 'checkbox' : undefined}
                  accessibilityState={comparing ? { checked: on } : undefined}
                  accessibilityLabel={`${r.name}, logged on ${r.cells.filter(Boolean).length} of ${n}${r.severity != null ? `, latest severity ${r.severity} of 10` : ''}`}
                  style={[s.row, s.symptom, ri > 0 && s.rule, on && s.picked]}
                >
                  <View style={s.name}>
                    <Text numberOfLines={1} style={[font('subhead'), s.ink]}>
                      {displayCopy(r.name)}
                    </Text>
                    {r.severity != null ? <Text style={[font('caption1'), s.meta]}>{`severity ${r.severity}/10`}</Text> : null}
                  </View>
                  <View style={s.cells}>
                    {r.cells.map((c, i) => (
                      <View key={i} style={[s.cellBox, i === n - 1 && s.todayCol]}>
                        <View
                          style={
                            c
                              ? { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color, opacity: c.severity != null ? 0.45 + c.severity / 20 : 0.8 }
                              : { width: 4, height: 4, borderRadius: 2, backgroundColor: L.rule }
                          }
                        />
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}

            {comparing ? (
              <>
                <Text style={[font('caption1'), s.meta, { marginTop: 12 }]}>Or set one against</Text>
                <View style={s.metrics}>
                  {COMPARE_METRICS.map((m) => {
                    const p: Pick = { kind: 'metric', key: m.key };
                    const on = isPicked(p);
                    return (
                      <Pressable key={m.key} onPress={() => pick(p)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[s.metric, on && s.metricOn]}>
                        <Text style={[font('footnote', on ? 'semibold' : 'regular'), { color: on ? L.canvas : L.body }]}>{m.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[font('subhead'), s.result]} accessibilityLiveRegion="polite">
                  {displayCopy(result)}
                </Text>
              </>
            ) : null}
          </>
        ) : (
          <Text style={[font('subhead'), s.empty]}>Choose the symptoms you want to follow, and they line up here day by day.</Text>
        )}

        <View style={s.buttons}>
          <Pressable onPress={() => setChoosing(true)} accessibilityRole="button" style={({ pressed }) => [s.btn, pressed && s.pressed]}>
            <Icon name="plus" size={15} color={L.ink} />
            <Text style={[font('footnote', 'semibold'), s.ink]}>Symptoms</Text>
          </Pressable>
          {strip.rows.length ? (
            <Pressable
              onPress={() => {
                setComparing((v) => !v);
                setPicked([]);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: comparing }}
              style={({ pressed }) => [s.btn, s.btnOn, pressed && s.pressed]}
            >
              <Icon name="layers" size={15} color={L.canvas} />
              <Text style={[font('footnote', 'semibold'), { color: L.canvas }]}>{comparing ? 'Done' : 'Compare'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <SymptomPicker
        visible={choosing}
        chosen={chosen.length ? chosen : strip.rows.map((r) => r.name)}
        logged={[...seen.keys()]}
        onDone={(next) => {
          onChoose(next);
          setPicked([]);
          setChoosing(false);
        }}
      />
    </View>
  );
}

// Every symptom, grouped as the Log screen groups them, and any others she
// logged in her own words, to choose which the card follows.
function SymptomPicker({ visible, chosen, logged, onDone }: { visible: boolean; chosen: string[]; logged: string[]; onDone: (names: string[]) => void }) {
  const [on, setOn] = useState<string[]>(chosen);
  const known = new Set(SYMPTOM_GROUPS.flatMap((g) => g.items));
  const groups = [...SYMPTOM_GROUPS.map((g) => ({ label: g.label, items: g.items, category: g.category })), ...(logged.some((x) => !known.has(x)) ? [{ label: 'Others you logged', items: logged.filter((x) => !known.has(x)), category: 'body' as const }] : [])];
  const toggle = (x: string) => setOn((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]));
  return (
    <Sheet
      visible={visible}
      title="Symptoms to follow"
      sub={`${on.length} chosen. Logged or not, each lines up on Today to compare.`}
      onShow={() => setOn(chosen)}
      onDone={() => onDone(on)}
    >
      {groups.map((g) => (
        <View key={g.label} style={{ marginTop: 16 }}>
          <Text style={[font('footnote', 'semibold'), s.ink]}>{g.label}</Text>
          <View style={s.pickChips}>
            {g.items.map((x) => {
              const sel = on.includes(x);
              return (
                <Pressable key={x} onPress={() => toggle(x)} accessibilityRole="checkbox" accessibilityState={{ checked: sel }} style={[s.pickChip, sel && s.pickChipOn]}>
                  <Icon name={chipIcon(x, g.category) ?? 'plus'} size={14} color={sel ? L.canvas : L.body} />
                  <Text style={[font('footnote', sel ? 'semibold' : 'regular'), { color: sel ? L.canvas : L.body }]}>{displayCopy(x)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  card: { marginTop: 10, backgroundColor: L.recessed, borderRadius: TILE_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, padding: 14, overflow: 'hidden' },
  ranges: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  range: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: L.statement },
  rangeOn: { backgroundColor: HUE.measured },
  row: { flexDirection: 'row', alignItems: 'center' },
  symptom: { paddingVertical: 8 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  picked: { backgroundColor: L.statement, borderRadius: 8 },
  name: { width: '38%', paddingRight: 8 },
  cells: { flex: 1, flexDirection: 'row' },
  cellBox: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 20 },
  todayHead: { backgroundColor: HUE.measured, borderRadius: 10 },
  todayCol: { backgroundColor: L.statement, borderRadius: 4 },
  ink: { color: L.ink },
  meta: { color: L.meta },
  empty: { color: L.body, lineHeight: 21, paddingVertical: 6 },
  metrics: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metric: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  metricOn: { backgroundColor: L.ink, borderColor: L.ink },
  result: { color: L.ink, marginTop: 12, lineHeight: 21 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, minHeight: 40, borderRadius: 999, backgroundColor: L.statement },
  btnOn: { backgroundColor: HUE.measured },
  pressed: { opacity: 0.6 },
  pickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule, backgroundColor: L.recessed },
  pickChipOn: { backgroundColor: L.ink, borderColor: L.ink },
});
