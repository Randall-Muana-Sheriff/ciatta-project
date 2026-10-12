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

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { buildMetrics, recordedCount, recordedLine } from '../lib/allMetrics';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useData } from '../state/session';
import { font, GUTTER } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen } from '../ui/kit';
import { MetricCard, METRIC_CARD_GAP } from '../ui/metricCard';
import { L, SPACE } from '../ui/surface';

export function MetricsScreen() {
  const nav = useNav();
  const { days } = useData();

  // Today's own row, when there is one. days arrives oldest first.
  const today = useMemo(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return days.find((x) => x.date === key) ?? null;
  }, [days]);

  const groups = useMemo(() => buildMetrics(today), [today]);
  const counts = useMemo(() => recordedCount(groups), [groups]);

  return (
    <DetailScreen title="Today's metrics" onBack={nav.back}>
      <Text style={[font('body'), s.lede]}>{displayCopy(recordedLine(counts))}</Text>
      <Text style={[font('caption1'), s.note]}>
        A figure that is not here was not recorded. Ciatta leaves it blank rather than filling it with a zero.
      </Text>

      {/*
        The same card Today uses, in the same grid. These were list rows,
        so one figure looked like two different kinds of thing depending
        on which screen she was on.
      */}
      {groups.map((group) => (
        <View key={group.title} style={s.group}>
          <Eyebrow>{group.title}</Eyebrow>
          <View style={s.grid}>
            {group.rows.map((row) => (
              <View key={row.label} style={s.cell}>
                <MetricCard label={row.label} value={row.value} note={row.note} from={row.from} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  lede: { color: L.ink, lineHeight: 24, paddingHorizontal: GUTTER },
  note: { color: L.meta, lineHeight: 18, marginTop: 6, paddingHorizontal: GUTTER },
  group: { marginTop: SPACE.block, paddingHorizontal: GUTTER },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: METRIC_CARD_GAP, marginTop: SPACE.tight },
  cell: { width: '30%', flexGrow: 1 },

});
