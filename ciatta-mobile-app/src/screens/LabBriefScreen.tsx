// A lab decoding brief: her result beside the range her lab printed, its
// trend across her own results, and the questions worth asking. Built by
// lib/agent/tasks.ts. It says what was measured; it never says what a
// result means for her.

import * as Print from 'expo-print';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { labBrief, labBriefHtml } from '../lib/agent/tasks';
import { displayCopy } from '../lib/displayCopy';
import { chooseLab, chosenLab } from '../lib/labHandoff';
import { useNav } from '../navigation';
import { useLabs } from '../state/labs';
import { font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, EmptyNote, PrimaryButton, SecondaryButton } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { GlassFill } from '../ui/frosted';

export function LabBriefScreen() {
  const nav = useNav();
  const labs = useLabs();
  const [name] = useState(() => chosenLab());
  const brief = useMemo(() => labBrief(labs, name), [labs, name]);
  const [note, setNote] = useState<string | null>(null);

  if (!brief) {
    return (
      <DetailScreen title="Lab Brief" onBack={nav.back}>
        <EmptyNote text="No results for this test yet." />
      </DetailScreen>
    );
  }
  const share = async () => {
    setNote(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: labBriefHtml(brief, { made: new Date() }) });
      await Share.share({ url: uri, title: `${brief.title} lab brief` });
    } catch {
      setNote('The page was not made. Try again.');
    }
  };

  return (
    <DetailScreen title={brief.title} onBack={nav.back}>
      <View style={s.card}>
        <GlassFill />
        {brief.rows.map((r, n) => (
          <View key={r.label} style={[s.row, n > 0 && s.divided]}>
            <Text style={[font('subhead'), s.body, { flex: 1 }]}>{r.label}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[font('subhead', 'semibold'), s.ink]}>{displayCopy(r.value)}</Text>
              {r.note ? <Text style={[font('caption1'), s.meta]}>{displayCopy(r.note)}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      {brief.trend ? <Text style={[font('subhead'), s.ink, { marginTop: SPACE.near }]}>{displayCopy(brief.trend)}</Text> : null}

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Questions to ask</Eyebrow>
      </View>
      <View style={[s.card, { gap: 10 }]}>
        <GlassFill />
        {brief.questions.map((q) => (
          <Text key={q} style={[font('subhead'), s.ink]}>
            {displayCopy(q)}
          </Text>
        ))}
      </View>
      <Text style={[font('footnote'), s.meta, { marginTop: SPACE.near, lineHeight: 18 }]}>{displayCopy(brief.note)}</Text>

      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        <PrimaryButton label="Share as PDF" onPress={() => void share()} />
        <SecondaryButton
          label="See Every Result"
          onPress={() => {
            chooseLab(brief.title);
            nav.push('lab');
          }}
        />
        <SecondaryButton label="Prepare for a Visit" onPress={() => nav.push('visitPrep')} />
      </View>
      {note ? <Text style={[font('footnote'), s.meta]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: L.rule },
  body: { color: L.body },
  ink: { color: L.ink },
  meta: { color: L.meta },
});
