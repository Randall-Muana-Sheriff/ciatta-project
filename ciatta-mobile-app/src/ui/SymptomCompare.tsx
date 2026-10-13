// Symptoms, side by side: a row per symptom with her latest rating, a dot
// per day (or per week over three months), filled where she logged it, and
// today's column marked. Compare picks two rows and says how often they
// came on the same day. A minimal take on a symptom tracker's home card.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { type Range, type Strip, together } from '../lib/symptomStrip';
import { font } from '../theme';
import { Icon } from './icons';
import { HUE, L, TILE_RADIUS } from './surface';

const RANGES: { key: Range; label: string }[] = [
  { key: '7', label: '7 day' },
  { key: '28', label: '28 day' },
  { key: '90', label: '3 month' },
];
const ROW_COLORS = ['#7CC6D6', '#F2B863', '#B188F3', '#F27D9B'];

export function SymptomCompare({
  strip,
  range,
  onRange,
  onLog,
  onAll,
}: {
  strip: Strip;
  range: Range;
  onRange: (r: Range) => void;
  onLog: () => void;
  onAll: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const n = strip.cols.length;
  const dot = n > 14 ? 7 : 12;

  const pick = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name].slice(-2)));

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
              const on = picked.includes(r.name);
              const color = ROW_COLORS[ri % ROW_COLORS.length];
              return (
                <Pressable
                  key={r.name}
                  disabled={!comparing}
                  onPress={() => pick(r.name)}
                  accessibilityRole={comparing ? 'checkbox' : undefined}
                  accessibilityState={comparing ? { checked: on } : undefined}
                  accessibilityLabel={`${r.name}, logged on ${r.cells.filter(Boolean).length} of ${n}${r.severity != null ? `, latest severity ${r.severity} of 10` : ''}`}
                  style={[s.row, s.symptom, ri > 0 && s.rule, comparing && on && s.picked]}
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
              <Text style={[font('footnote'), s.compareLine]}>
                {picked.length === 2 ? displayCopy(together(strip, picked[0], picked[1])) : 'Choose two symptoms to compare.'}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[font('subhead'), s.empty]}>No symptoms logged in this window. Logged ones line up here day by day.</Text>
        )}

        <View style={s.buttons}>
          <Pressable onPress={onLog} accessibilityRole="button" style={({ pressed }) => [s.btn, pressed && s.pressed]}>
            <Icon name="plus" size={15} color={L.ink} />
            <Text style={[font('footnote', 'semibold'), s.ink]}>Symptoms</Text>
          </Pressable>
          {strip.rows.length > 1 ? (
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
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  card: {
    marginTop: 10,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    padding: 14,
  },
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
  compareLine: { color: L.ink, marginTop: 10, lineHeight: 19 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: L.statement,
  },
  btnOn: { backgroundColor: HUE.measured },
  pressed: { opacity: 0.6 },
});
