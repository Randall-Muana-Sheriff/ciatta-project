// All of today's metrics, behind Today's three.
//
// Today shows Sleep, HRV and Steps because three is what a glance holds.
// This is the rest of the row, and it exists so that "All" has somewhere
// honest to go: a list of every figure Ciatta could have for today, each
// either recorded or plainly not.
//
// What it must not become is a wall of zeros. A day with nothing on it is
// a day with nothing on it, and the count at the top says so in a sentence
// rather than leaving a page of "Not yet" to imply something is broken.
//
// Measured and reported sit in one list but never look alike: each row
// says which it is, because a heart rate variability reading and a mood
// she typed are not the same kind of fact and a list that blurred them
// would be the exact error the rest of the app refuses.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildMetrics, type MetricRow, recordedCount, recordedLine } from '../lib/allMetrics';
import { bloodOxygen, bloodPressure, type VitalCard, weight } from '../lib/vitals';
import { displayCopy } from '../lib/displayCopy';
import { metricForRow } from '../lib/metricDetail';
import { chooseMetric } from '../lib/metricHandoff';
import { useNav } from '../navigation';
import { useData, useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { Icon } from '../ui/icons';
import { DetailScreen } from '../ui/kit';
import { HUE, L, SPACE, TILE_RADIUS } from '../ui/surface';

export function MetricsScreen() {
  const nav = useNav();
  const { days } = useData();
  const repo = useRepo();

  // Weight joins blood pressure and blood oxygen here. All three live in
  // observations, so none of them reaches the Day object the rest of the
  // app reads.
  const [vitals, setVitals] = useState<VitalCard[]>([]);
  useEffect(() => {
    let ignore = false;
    repo
      .loadVitals()
      .then((rows) => {
        if (ignore) return;
        const now = new Date();
        setVitals([bloodPressure(rows, now), bloodOxygen(rows, now), weight(rows, now)]);
      })
      .catch(() => {
        // The section is simply absent, rather than showing empty rows.
      });
    return () => {
      ignore = true;
    };
  }, [repo]);

  // Today's own row, when there is one. days arrives oldest first.
  const today = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return days.find((x) => x.date === key) ?? null;
  }, [days]);

  const groups = useMemo(() => buildMetrics(today, vitals), [today, vitals]);
  const counts = useMemo(() => recordedCount(groups), [groups]);

  return (
    <DetailScreen title="Today's metrics" onBack={nav.back}>
      <Text style={[font('body'), s.lede]}>{displayCopy(recordedLine(counts))}</Text>
      <Text style={[font('caption1'), s.note]}>
        A figure that is not here was not recorded. Ciatta leaves it blank rather than filling it with a zero.
      </Text>

      {/*
        A list, not a grid. Today abbreviates because a third of a row
        cannot hold "Heart rate variability"; here there is a whole line
        per metric, so every name is spelled out and nothing is guessed
        at from an abbreviation.
      */}
      {groups.map((group) => (
        <View key={group.title} style={s.group}>
          <Eyebrow>{group.title}</Eyebrow>
          <View style={s.card}>
            {group.rows.map((row, n) => (
              <Row
                key={row.label}
                row={row}
                first={n === 0}
                onOpen={
                  metricForRow(row.label)
                    ? () => {
                        chooseMetric(metricForRow(row.label)!);
                        nav.push('metric');
                      }
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      ))}
    </DetailScreen>
  );
}

// One metric on one line: its name, where it came from, and the figure.
function Row({ row, first, onOpen }: { row: MetricRow; first: boolean; onOpen?: () => void }) {
  const missing = row.value == null;
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      style={({ pressed }) => [s.row, !first && s.divided, pressed && s.pressed]}
      accessible
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={`${row.label}, ${row.value ?? 'not recorded'}${
        row.from === 'reported' ? ', you reported this' : ''
      }`}
    >
      <View style={s.left}>
        <Text style={[font('subhead'), s.label]}>{displayCopy(row.label)}</Text>
        {row.note ? <Text style={[font('caption2'), s.rowNote]}>{displayCopy(row.note)}</Text> : null}
      </View>
      {/*
        Reported rows carry Rose, which is the meaning: she said it. A
        measured row carries nothing, because measured is the default
        everywhere else and marking it would make the quiet case look
        like the exception.
      */}
      {row.from === 'reported' && !missing ? <View style={s.dot} /> : null}
      <Text style={[font('subhead', missing ? 'regular' : 'semibold'), missing ? s.missing : s.value]}>
        {row.value ?? 'Not yet'}
      </Text>
      {onOpen ? <Icon name="chevronRight" size={14} color={L.meta} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.hairlineWidth;

const s = StyleSheet.create({
  lede: { color: L.ink, lineHeight: 24, paddingHorizontal: GUTTER },
  note: { color: L.meta, lineHeight: 18, marginTop: 6, paddingHorizontal: GUTTER },
  group: { marginTop: SPACE.block, paddingHorizontal: GUTTER },
  card: {
    marginTop: SPACE.tight,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: st,
    borderColor: L.rule,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divided: { borderTopWidth: st, borderTopColor: L.rule },
  left: { flex: 1 },
  label: { color: L.body },
  rowNote: { color: L.meta, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: HUE.reported },
  value: { color: L.ink },
  missing: { color: L.meta },
  pressed: { opacity: 0.6 },

});
