import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { JournalView } from '../data/rows';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { DetailScreen, EmptyNote, PrimaryButton, SegmentedControl, SecondaryButton, SourceFooter, Tag } from '../ui/kit';

const FILTERS = ['All', 'Notes', 'Symptoms', 'Context'] as const;

export function JournalScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => repo.loadJournal().then(setJournal).catch(() => {});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const months = (journal?.months ?? [])
    .map((g) => ({ ...g, items: g.items.filter((it) => filter === 'All' || it.kind === filter) }))
    .filter((g) => g.items.length > 0);
  const shown = months.reduce((n, g) => n + g.items.length, 0);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await repo.addJournal(trimmed, filter === 'All' ? 'Notes' : filter);
      await load();
      setText('');
      setComposing(false);
    } catch (e) {
      setError(userFacingError(e, 'That entry did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Your Notes"
      onBack={nav.back}
      footer={<SourceFooter kind="logged" text="Yours, dated, never overwritten by a device or a clinic" />}
    >
      <SegmentedControl segments={FILTERS} active={filter} onChange={setFilter} />

      {journal ? (
        <View style={j.between}>
          <Text style={[font('caption2', 'semibold'), { color: C.muted }]}>
            {filter === 'All' ? `${journal.count} entries` : `${shown} shown`}
          </Text>
          <Text style={[font('caption1'), { color: C.muted }]}>{journal.since}</Text>
        </View>
      ) : null}

      {months.map((group) => (
        <View key={group.month} style={{ marginBottom: 4 }}>
          <Text style={[font('caption2', 'semibold'), { color: C.rose, marginBottom: 8 }]}>{group.month}</Text>
          {group.items.map((item) => (
            <Pressable
              key={item.date + item.text}
              disabled={!item.usedInInsight}
              onPress={() => nav.push('insight')}
              accessibilityRole={item.usedInInsight ? 'button' : undefined}
              style={({ pressed }) => [j.card, pressed && { opacity: 0.7 }]}
            >
              <Text style={[font('subhead'), { color: C.text, lineHeight: 22, marginBottom: 8 }]}>{displayCopy(item.text)}</Text>
              <View style={j.cardFoot}>
                <Text style={[font('caption1'), { color: C.muted }]}>{item.date}</Text>
                <Tag label={item.tag} tone={item.usedInInsight ? 'amber' : 'neutral'} />
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      {journal && journal.count === 0 ? <EmptyNote text="No notes yet. Anything you write here is saved as yours." /> : null}

      {composing ? (
        <View style={{ paddingTop: 12 }}>
          <TextInput
            style={[j.card, font('subhead'), { color: C.text }]}
            multiline
            value={text}
            onChangeText={setText}
            placeholder="What are you noticing?"
            placeholderTextColor={C.muted}
            accessibilityLabel="What are you noticing"
            autoFocus
          />
          {error ? <Text style={[font('footnote'), { color: C.tint, marginBottom: 8 }]}>{error}</Text> : null}
          <PrimaryButton label="Save Entry" onPress={save} disabled={!text.trim() || saving} />
        </View>
      ) : (
        <View style={{ paddingTop: 12 }}>
          <SecondaryButton label="Add an Entry" onPress={() => setComposing(true)} />
        </View>
      )}
    </DetailScreen>
  );
}

const j = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
