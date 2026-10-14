import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { JournalView } from '../data/rows';
import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { C, font } from '../theme';
import { Composer } from '../ui/composer';
import { DetailScreen, EmptyNote, SegmentedControl, SecondaryButton, SourceFooter, Tag } from '../ui/kit';
import { GlassFill } from '../ui/frosted';

const FILTERS = ['All', 'Notes', 'Symptoms', 'Context'] as const;

export function JournalScreen() {
  const nav = useNav();
  const repo = useRepo();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
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
    if ((!trimmed && !files.length) || saving) return;
    setSaving(true);
    setError(null);
    try {
      await repo.addJournal(trimmed, filter === 'All' ? 'Notes' : filter, files);
      await load();
      setText('');
      setFiles([]);
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
            <View key={item.date + item.text} style={j.card}>
              <GlassFill />
              {item.text ? (
                <Text style={[font('subhead'), { color: C.text, lineHeight: 22, marginBottom: 8 }]}>{displayCopy(item.text)}</Text>
              ) : null}
              {/* Named, not opened: the file stays on her phone. */}
              {item.attachments?.map((f) => (
                <Text key={f.id} style={[font('caption1'), { color: C.muted, marginBottom: 6 }]} numberOfLines={1}>
                  {f.name}
                </Text>
              ))}
              <View style={j.cardFoot}>
                <Text style={[font('caption1'), { color: C.muted }]}>{item.date}</Text>
                <Tag label={item.tag} tone={item.usedInInsight ? 'amber' : 'neutral'} />
              </View>
            </View>
          ))}
        </View>
      ))}

      {journal && journal.count === 0 ? <EmptyNote text="No notes yet. Anything you write here is saved as yours." /> : null}

      {composing ? (
        <View style={{ paddingTop: 12 }}>
          {/*
            The same box as everywhere else. Send saves the entry, which is
            what the Save Entry button did, so the button is gone: one
            gesture for committing what she wrote, in the same corner, on
            every screen that takes her words.

            The plus as well, like every box she logs in. Files are kept in
            the entry's metadata, the same way an episode keeps them.
          */}
          <Composer
            value={text}
            onChange={setText}
            placeholder="What are you noticing?"
            label="What are you noticing"
            attachments={files}
            onAttachments={setFiles}
            onSend={() => {
              if ((text.trim() || files.length) && !saving) void save();
            }}
          />
          {error ? <Text style={[font('footnote'), { color: C.tint, marginTop: 10 }]}>{error}</Text> : null}
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
  card: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderSub,
    overflow: 'hidden',
  },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
