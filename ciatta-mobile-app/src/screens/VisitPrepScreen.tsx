// Visit prep: what changed, labs outside their range, what she takes, her
// referrals, and the questions worth asking, each one hers to keep or drop,
// with room for her own. Shared or printed as a page she takes with her.
// Built by lib/agent/tasks.ts from her record; nothing is sent by Ciatta.

import * as Print from 'expo-print';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { visitPrep, visitPrepHtml } from '../lib/agent/tasks';
import { displayCopy } from '../lib/displayCopy';
import { useNav } from '../navigation';
import { useAgentContext } from '../state/agentContext';
import { useData } from '../state/session';
import { C, font } from '../theme';
import { Eyebrow } from '../ui/bento';
import { DetailScreen, EmptyNote, PrimaryButton, SecondaryButton, Lead } from '../ui/kit';
import { L, SPACE, TILE_RADIUS } from '../ui/surface';
import { CardPhoto } from '../ui/cardFill';
import { G } from '../ui/scheme';

export function VisitPrepScreen() {
  const nav = useNav();
  const { person } = useData();
  const { context } = useAgentContext();
  const prep = useMemo(() => visitPrep(context, new Date()), [context]);
  const [dropped, setDropped] = useState<string[]>([]);
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const questions = [...prep.questions.filter((q) => !dropped.includes(q)), ...own];
  const page = () => visitPrepHtml({ sections: prep.sections, questions }, { name: person?.firstName ?? null, made: new Date() });

  const share = async () => {
    setNote(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: page() });
      await Share.share({ url: uri, title: 'Visit prep' });
    } catch {
      setNote('The page was not made. Try again.');
    }
  };

  return (
    <DetailScreen title="Visit Prep" onBack={nav.back}>
      <Lead style={s.lede} text={"From your own record. Keep the questions you want, add your own, and take it with you."} />
      {!prep.sections.length ? <EmptyNote text="Nothing in your record stands out for a visit yet. You can still add your own questions." /> : null}
      {prep.sections.map((sec) => (
        <View key={sec.title} style={{ marginTop: SPACE.near }}>
          <Eyebrow>{sec.title}</Eyebrow>
          <View style={s.card}>
            <CardPhoto />
            {sec.lines.map((l) => (
              <Text key={l} style={[font('subhead'), s.line]}>
                {displayCopy(l)}
              </Text>
            ))}
          </View>
        </View>
      ))}

      <View style={{ marginTop: SPACE.block }}>
        <Eyebrow>Questions to ask</Eyebrow>
      </View>
      <View style={s.card}>
        <CardPhoto />
        {prep.questions.map((q) => (
          <View key={q} style={s.row}>
            <Text style={[font('subhead'), s.line, { flex: 1 }]}>{displayCopy(q)}</Text>
            <Switch
              value={!dropped.includes(q)}
              onValueChange={(on) => setDropped((d) => (on ? d.filter((x) => x !== q) : [...d, q]))}
              trackColor={{ false: C.fill, true: C.green }}
              ios_backgroundColor={C.fill}
              accessibilityLabel="Keep this question"
            />
          </View>
        ))}
        {own.map((q) => (
          <Text key={q} style={[font('subhead'), s.line]}>
            {displayCopy(q)}
          </Text>
        ))}
        <View style={s.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add your own question"
            placeholderTextColor={L.meta}
            style={[font('body'), s.input]}
            onSubmitEditing={() => {
              if (draft.trim()) setOwn((o) => [...o, draft.trim()]);
              setDraft('');
            }}
            returnKeyType="done"
            accessibilityLabel="Add your own question"
          />
        </View>
      </View>

      <View style={{ marginTop: SPACE.block, gap: 12 }}>
        <PrimaryButton label="Share as PDF" onPress={() => void share()} />
        <SecondaryButton label="Print" onPress={() => void Print.printAsync({ html: page() }).catch(() => {})} />
        <SecondaryButton label="Add the Full Summary" onPress={() => nav.push('shareClinician')} />
      </View>
      {note ? <Text style={[font('footnote'), s.meta]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  lede: { color: G.ink, lineHeight: 24 },
  meta: { color: G.meta, marginTop: 10 },
  card: { marginTop: SPACE.tight, backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 14, gap: 10, overflow: 'hidden' },
  line: { color: L.ink, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
});
