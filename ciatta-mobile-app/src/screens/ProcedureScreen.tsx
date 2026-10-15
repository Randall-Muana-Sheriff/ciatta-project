// Did the procedure change anything?
//
// Six weeks before against six weeks after, counted from her logs and
// devices (lib/procedureEffect). Laid out as the design shows it: the
// sentence, then Before, the procedure, After, each with its dates and
// symptom days. A side with too little record says so instead.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { type ProcedureEntry, procedureEffect, rangeLine } from '../lib/procedureEffect';
import { takeProcedure } from '../lib/procedureHandoff';
import { useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useData, useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, EmptyNote, Tag } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardFill } from '../ui/cardFill';
import { G } from '../ui/scheme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export function ProcedureScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { days } = useData();
  const { episodes } = useCycle();
  const [procedure] = useState<ProcedureEntry | null>(() => takeProcedure());
  const [symptomNotes, setSymptomNotes] = useState<string[]>([]);

  useEffect(() => {
    repo
      .loadJournal()
      .then((j) => setSymptomNotes(j.months.flatMap((m) => m.items).filter((i) => i.kind === 'Symptoms' && i.at).map((i) => i.at!)))
      .catch(() => {});
  }, [repo]);

  const effect = useMemo(
    () =>
      procedure
        ? procedureEffect({ date: procedure.date, days, episodes, journalSymptomDates: symptomNotes, now: new Date() })
        : null,
    [procedure, days, episodes, symptomNotes],
  );

  if (!procedure || !effect) {
    return (
      <DetailScreen title="Procedure" onBack={nav.back}>
        <EmptyNote text="Choose a procedure from Records to see before and after." />
      </DetailScreen>
    );
  }

  const thin = 'Not enough of your record runs through this yet.';
  return (
    <DetailScreen title={procedure.name} onBack={nav.back}>
      <Text style={[font('title2', 'semibold'), p.question]} accessibilityRole="header">
        Did the procedure change anything?
      </Text>
      {effect.sentence ? <Text style={[font('body'), p.sentence]}>{displayCopy(effect.sentence)}</Text> : null}
      {effect.measures.map((m) => (
        <Text key={m} style={[font('body'), p.sentence]}>
          {displayCopy(m)}
        </Text>
      ))}
      {!effect.sentence && effect.weeksAfter < 6 ? (
        <Text style={[font('body'), p.sentence]}>
          {displayCopy(`${effect.weeksAfter} of 6 weeks after so far. The comparison fills in once all six have passed.`)}
        </Text>
      ) : null}

      <Text style={[font('subhead', 'semibold'), p.title]}>
        {displayCopy(procedure.name)} · {longDate(procedure.date).split(' ').slice(0, 2).join(' ')}
      </Text>

      <View style={p.block}>
        <CardFill />
        <Text style={[font('caption1'), p.meta]}>{rangeLine(effect.before.from, effect.before.to)}</Text>
        <Text style={[font('headline'), p.ink]}>
          {effect.before.enough ? `Symptom days ${effect.before.symptomDays}` : displayCopy(thin)}
        </Text>
        <Text style={[font('footnote', 'semibold'), p.meta]}>Before</Text>
      </View>

      <View style={[p.block, p.procedure]}>
        <CardFill />
        <Text style={[font('caption1'), p.meta]}>{longDate(procedure.date)}</Text>
        <Text style={[font('headline'), p.ink]}>Procedure</Text>
        <View style={{ flexDirection: 'row' }}>
          <Tag label={procedure.source} tone="neutral" />
        </View>
      </View>

      <View style={p.block}>
        <CardFill />
        <Text style={[font('caption1'), p.meta]}>{rangeLine(effect.after.from, effect.after.to)}</Text>
        <Text style={[font('headline'), p.ink]}>
          {effect.weeksAfter < 6
            ? `${effect.weeksAfter} of 6 weeks`
            : effect.after.enough
              ? `Symptom days ${effect.after.symptomDays}`
              : displayCopy(thin)}
        </Text>
        <Text style={[font('footnote', 'semibold'), p.meta]}>After</Text>
      </View>

      <Text style={[font('caption1'), p.close]}>
        Counted from your logs and devices. Other things may have changed around the same time.
      </Text>
    </DetailScreen>
  );
}

const p = StyleSheet.create({
  question: { color: G.ink },
  sentence: { color: G.body, lineHeight: 24, marginTop: SPACE.tight },
  title: { color: G.ink, marginTop: SPACE.block, marginBottom: SPACE.tight },
  block: {
    backgroundColor: L.glass,
    padding: 16,
    gap: 4,
    marginTop: SPACE.tight,
    overflow: 'hidden', borderRadius: TILE_RADIUS },
  procedure: { backgroundColor: L.statement },
  ink: { color: L.ink },
  meta: { color: L.meta },
  close: { color: G.meta, marginTop: SPACE.block, lineHeight: 18 },
});
