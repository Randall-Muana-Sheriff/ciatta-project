// Logging from Today, asking only for what Ciatta does not have yet: the
// cycle during a period or when one is due, how she feels if nothing is
// logged today, food when meals look missing for the hour. Each with quick
// chips that log in one tap, and the box itself, right here, with its own
// mic and its plus for a photo (a meal photo goes to the scan). Nothing
// opens another screen unless she asks for more.

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Attachment } from '../lib/attachments';
import { chipIcon } from '../lib/chipIcons';
import { displayCopy } from '../lib/displayCopy';
import { category } from '../lib/logCategories';
import { FLOW_CHIPS, type LogNeed } from '../lib/logNeeds';
import type { QuickEntry } from '../state/quickLogSave';
import { font } from '../theme';
import { Composer } from './composer';
import { Icon } from './icons';
import { L, TILE_RADIUS } from './surface';


// A quick chip as an entry: flow words are said as a period with that flow,
// so the record reads both.
function chipEntry(key: LogNeed['key'], chip: string): QuickEntry {
  if (key === 'cycle' && FLOW_CHIPS.includes(chip)) return { text: `Period, ${chip.toLowerCase()} flow`, key: 'cycle', tapped: [] };
  return { text: '', key, tapped: [chip] };
}

export function LogBox({
  needs,
  onSave,
  onMealPhoto,
  onMore,
}: {
  needs: LogNeed[];
  onSave: (entry: QuickEntry) => Promise<boolean>;
  onMealPhoto: (uri: string) => void;
  onMore: () => void;
}) {
  const [topic, setTopic] = useState(needs[0]?.key ?? 'symptoms');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [logged, setLogged] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // When what is missing changes (she logged it), lead with what is left.
  useEffect(() => {
    if (!needs.some((n) => n.key === topic)) setTopic(needs[0]?.key ?? 'symptoms');
  }, [needs, topic]);

  const need = needs.find((n) => n.key === topic) ?? null;
  const save = async (entry: QuickEntry, label: string) => {
    setNote(null);
    try {
      if (await onSave(entry)) {
        setLogged((l) => [...l, label]);
        setNote(`Logged ${label.toLowerCase()}.`);
      }
    } catch {
      setNote('That did not save. Try again.');
    }
  };

  return (
    <View style={s.box}>
      {needs.length ? (
        <>
          {needs.length > 1 ? (
            <View style={s.topics}>
              {needs.map((t) => {
                const on = t.key === topic;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTopic(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [s.topic, on && s.topicOn, pressed && s.pressed]}
                  >
                    <Text style={[font('footnote', on ? 'semibold' : 'regular'), { color: on ? L.onPill : L.body }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={[font('title3', 'semibold'), s.prompt]}>{displayCopy(need?.prompt ?? '')}</Text>
          {/* One row, scrolled sideways when there are more than fit. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {(need?.chips ?? []).map((c) => {
              const done = logged.includes(c);
              return (
                <Pressable
                  key={c}
                  disabled={done}
                  onPress={() => void save(chipEntry(topic, c), c)}
                  accessibilityRole="button"
                  accessibilityLabel={done ? `${c}, logged` : `Log ${c}`}
                  style={({ pressed }) => [s.chip, done && s.chipDone, pressed && s.pressed]}
                >
                  <Icon name={done ? 'check' : (chipIcon(c, topic) ?? 'plus')} size={14} color={done ? L.onPill : L.body} />
                  <Text style={[font('footnote', done ? 'semibold' : 'regular'), { color: done ? L.onPill : L.body }]}>{displayCopy(c)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {/* The box, here: what the buttons below open. */}
      <Composer
        value={text}
        onChange={(v) => setText(v)}
        placeholder={displayCopy(category(topic).example)}
        label={`Log ${category(topic).label.toLowerCase()} in your own words`}
        attachments={files}
        onAttachments={(next) => {
          const added = next.find((f) => f.kind === 'photo' && !files.some((x) => x.id === f.id));
          if (topic === 'nutrition' && added) return onMealPhoto(added.uri);
          setFiles(next);
        }}
        onSend={() => {
          const entry = { text, key: topic, tapped: [], files };
          void save(entry, 'it').then(() => {
            setText('');
            setFiles([]);
          });
        }}
      />
      {note ? <Text style={[font('footnote'), s.note]}>{displayCopy(note)}</Text> : null}

      <Pressable onPress={onMore} accessibilityRole="button" hitSlop={8} style={s.more}>
        <Text style={[font('footnote', 'semibold'), { color: L.body }]}>More ways to log</Text>
        <Icon name="chevronRight" size={13} color={L.body} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: 16, gap: 12 },
  topics: { flexDirection: 'row', gap: 6 },
  topic: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: TILE_RADIUS, backgroundColor: L.recessed, overflow: 'hidden' },
  topicOn: { backgroundColor: L.ink, borderColor: L.ink },
  // The prompt in statement type, as every screen's lead sentence is.
  prompt: { color: L.ink, lineHeight: 28, letterSpacing: -0.2 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderColor: L.rule, backgroundColor: L.recessed },
  chipDone: { backgroundColor: L.ink, borderColor: L.ink },
  note: { color: L.meta },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'center' },
  pressed: { opacity: 0.6 },
});
