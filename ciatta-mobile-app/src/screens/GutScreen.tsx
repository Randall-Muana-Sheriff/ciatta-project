// The gut, in and out. Out: each bowel movement by its Bristol type on the
// last four weeks, types 3 and 4 shaded as the typical range, the mix of
// hard, typical and loose, how often against the common reference, and what
// came with it. In: when she ate, as a weekday by time window grid, with
// meals a day and the usual time of the last one. See lib/gut.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { STOOL_TYPES } from '../data/cycleLog';
import { displayCopy } from '../lib/displayCopy';
import { type BristolGroup, bristolGroup, gutIn, gutOut } from '../lib/gut';
import { chooseLogCategory, chooseLogMode } from '../lib/logHandoff';
import type { Meal } from '../lib/foodScan';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, PrimaryButton, SegmentedControl, SourceFooter } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { onGround } from '../ui/scheme';
import { GlassFill } from '../ui/frosted';

const VIEWS = ['Out', 'In'] as const;
export const GROUP_COLOR: Record<BristolGroup, string> = { hard: onGround('#E8C46A'), typical: onGround('#9BD36A'), loose: onGround('#EC9658') };
const GROUP_LABEL: Record<BristolGroup, string> = { hard: 'Hard, types 1 and 2', typical: 'Typical, types 3 and 4', loose: 'Loose, types 5 to 7' };
const MEAL = onGround('#EC9658');
const ROW = 15;
const LABEL_W = 18;

export function GutScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { episodes } = useCycle();
  const { days } = useData();
  const [view, setView] = useState<(typeof VIEWS)[number]>('Out');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const since = new Date(Date.now() - 29 * 86400000).toISOString();
    repo.loadMeals(since).then(setMeals).catch(() => {});
  }, [repo]);

  const out = useMemo(() => gutOut({ episodes, days, now: new Date() }), [episodes, days]);
  const inn = useMemo(() => gutIn({ meals, now: new Date() }), [meals]);
  const log = () => {
    chooseLogCategory('gut');
    chooseLogMode('type');
    nav.push('quickLog');
  };

  const slot = width ? (width - LABEL_W) / out.days.length : 0;
  const rated = out.mix.hard + out.mix.typical + out.mix.loose;
  const maxCount = Math.max(1, ...out.counts);
  const maxMeal = Math.max(1, ...inn.grid.flat());

  return (
    <DetailScreen title="Gut" onBack={nav.back} footer={<SourceFooter kind="logged" text="From what you logged. A movement or meal you did not log is not here." />}>
      <SegmentedControl segments={VIEWS} active={view} onChange={setView} />

      {view === 'Out' ? (
        out.count ? (
          <>
            {/* Stool form: the Bristol scale down the side, four weeks across. */}
            <Card title="Stool form" meta="Last 28 days">
              <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: ROW * 7 }}>
                {width ? (
                  <Svg width={width} height={ROW * 7}>
                    <Rect x={LABEL_W} y={ROW * 2} width={width - LABEL_W} height={ROW * 2} rx={4} fill={GROUP_COLOR.typical} opacity={0.12} />
                    {out.types.flatMap((list, i) =>
                      list.map((t, k) =>
                        t == null ? null : (
                          <Circle
                            key={`${i}-${k}`}
                            cx={LABEL_W + slot * i + slot / 2 + (k ? (k % 2 ? 2.5 : -2.5) : 0)}
                            cy={ROW * (t - 1) + ROW / 2}
                            r={Math.min(4.5, slot / 2.5)}
                            fill={GROUP_COLOR[bristolGroup(t)]}
                          />
                        ),
                      ),
                    )}
                  </Svg>
                ) : null}
                {STOOL_TYPES.map(({ type }) => (
                  <Text key={type} style={[font('caption2'), s.rowLabel, { top: ROW * (type - 1) }]}>
                    {type}
                  </Text>
                ))}
              </View>
              <Text style={[font('caption1'), s.note]}>Bristol Stool Form Scale. Shaded: types 3 and 4, the typical range.</Text>
            </Card>

            {/* The mix, as one bar. */}
            <Card title="Type mix" meta={`${out.count} logged`}>
              {rated ? (
                <>
                  <View style={s.mix}>
                    {(['hard', 'typical', 'loose'] as BristolGroup[]).map((g) =>
                      out.mix[g] ? <View key={g} style={[s.mixPart, { flex: out.mix[g], backgroundColor: GROUP_COLOR[g] }]} /> : null,
                    )}
                  </View>
                  {(['hard', 'typical', 'loose'] as BristolGroup[]).map((g) => (
                    <View key={g} style={s.legendRow}>
                      <View style={[s.swatch, { backgroundColor: GROUP_COLOR[g] }]} />
                      <Text style={[font('footnote'), s.body, { flex: 1 }]}>{GROUP_LABEL[g]}</Text>
                      <Text style={[font('footnote', 'semibold'), s.ink]}>{`${Math.round((out.mix[g] / rated) * 100)}%`}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[font('subhead'), s.body]}>Add a type when you log a movement to see the mix.</Text>
              )}
              {out.mix.unrated ? <Text style={[font('caption1'), s.note]}>{`${out.mix.unrated} without a type.`}</Text> : null}
            </Card>

            {/* How often, against the common reference. */}
            <Card title="How often" meta={out.perDay ?? ''}>
              <View style={s.bars}>
                {out.counts.map((c, i) => (
                  <View key={out.days[i]} style={s.barSlot}>
                    <View style={[s.bar, { height: c ? 6 + (c / maxCount) * 44 : 2, opacity: c ? 1 : 0.3 }]} />
                  </View>
                ))}
              </View>
              <Text style={[font('caption1'), s.note]}>A common reference range is 3 a week to 3 a day.</Text>
            </Card>

            {out.pain || out.flags.length || out.blood ? (
              <Card title="With it" meta="Last 28 days">
                {out.pain ? <Line label="Pain with a movement" value={out.pain} /> : null}
                {out.flags.map((f) => (
                  <Line key={f.name} label={f.name} value={f.count} />
                ))}
                {out.blood ? (
                  <>
                    <Line label="Blood" value={out.blood} />
                    <Text style={[font('footnote', 'semibold'), s.flag]}>Blood in stool is worth raising with a clinician.</Text>
                  </>
                ) : null}
              </Card>
            ) : null}

            {out.symptoms.length ? (
              <Card title="Gut symptoms" meta="Days, last 28">
                {out.symptoms.map((x) => (
                  <Line key={x.name} label={x.name} value={x.days} />
                ))}
              </Card>
            ) : null}
          </>
        ) : (
          <Empty text="Log a bowel movement with its Bristol type, and your pattern shows here: form, mix and how often." />
        )
      ) : inn.count ? (
        <>
          <Card title="Meal timing" meta="Last 28 days">
            <View style={s.grid}>
              {inn.grid.map((row, w) => (
                <View key={inn.windows[w]} style={s.gridRow}>
                  <Text style={[font('caption2'), s.window]}>{inn.windows[w]}</Text>
                  {row.map((n, d) => (
                    <View key={d} style={[s.cell, { backgroundColor: n ? MEAL : L.rule, opacity: n ? 0.35 + (n / maxMeal) * 0.65 : 0.6 }]} />
                  ))}
                </View>
              ))}
              <View style={s.gridRow}>
                <View style={s.window} />
                {inn.weekdays.map((d, i) => (
                  <Text key={i} style={[font('caption2'), s.weekday]}>
                    {d}
                  </Text>
                ))}
              </View>
            </View>
          </Card>
          <View style={s.stats}>
            <Stat label="Meals" value={inn.perDay ?? 'Not yet'} />
            <Stat label="Last meal, usually" value={inn.lastMeal ?? 'Not yet'} />
          </View>
        </>
      ) : (
        <Empty text="Log a meal, or snap one, and when you eat shows here by day and time." />
      )}

      <View style={{ marginTop: SPACE.block }}>
        <PrimaryButton label={view === 'Out' ? 'Log a Bowel Movement' : 'Log a Meal'} onPress={view === 'Out' ? log : () => {
          chooseLogCategory('nutrition');
          chooseLogMode('camera');
          nav.push('quickLog');
        }} />
      </View>
    </DetailScreen>
  );
}

function Card({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.head}>
        <Eyebrow>{title}</Eyebrow>
        <Text style={[font('caption1'), s.meta]}>{displayCopy(meta)}</Text>
      </View>
      <View style={s.card}><GlassFill />{children}</View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.legendRow}>
      <Text style={[font('subhead'), s.body, { flex: 1 }]}>{displayCopy(label)}</Text>
      <Text style={[font('subhead', 'semibold'), s.ink]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.card, s.stat]}>
      <GlassFill />
      <Text style={[font('caption1'), s.meta]}>{label}</Text>
      <Text style={[font('title3', 'semibold'), s.ink]}>{displayCopy(value)}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={[s.card, { marginTop: SPACE.near }]}>
      <GlassFill />
      <Text style={[font('subhead'), s.body, { lineHeight: 21 }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.hairlineWidth;
const s = StyleSheet.create({
  section: { marginTop: SPACE.block },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 14, overflow: 'hidden' },
  meta: { color: L.meta },
  note: { color: L.meta, marginTop: 10, lineHeight: 17 },
  body: { color: L.body },
  ink: { color: L.ink },
  flag: { color: onGround('#EC5D4A'), marginTop: 8 },
  rowLabel: { position: 'absolute', left: 0, width: LABEL_W, color: L.meta, lineHeight: ROW },
  mix: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 10 },
  mixPart: { height: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 52 },
  barSlot: { flex: 1, alignItems: 'center' },
  bar: { width: '60%', borderRadius: 2, backgroundColor: GROUP_COLOR.typical },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  window: { width: 54, color: L.meta },
  cell: { flex: 1, height: 22, borderRadius: 5 },
  weekday: { flex: 1, textAlign: 'center', color: L.meta },
  stats: { flexDirection: 'row', gap: 10, marginTop: SPACE.near },
  stat: { flex: 1, gap: 4 },
});
