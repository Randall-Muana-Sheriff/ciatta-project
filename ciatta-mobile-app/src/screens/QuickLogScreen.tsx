// One screen for logging, and the box is the first thing on it.
//
// What this replaces: a plus that opened a menu of three screens, one of
// which opened a fifteen step questionnaire whose first screen was "What
// happened?" and a wall of chips. The box she writes in sat at the bottom
// of every one of those steps, which is to say the fastest part of the
// experience was the last thing she reached.
//
// So: a row of eight categories saying what this is mostly about, one tap
// chips for the common things in that category, the box with a real
// example sentence in it, and send. One sentence may name several
// categories; lib/quickLog's planSave files each part where the record
// already keeps it. The detailed forms are one link away, for the entry
// worth describing properly.
//
// The sentence is read by lib/quickLog for the vocabulary the record
// already uses, and everything it recognised is printed under the box
// before she sends, so nothing is stored that she has not seen. Words it
// did not recognise are kept verbatim rather than dropped.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { emptyForm, formToEpisode } from '../data/cycleLog';
import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { CATEGORIES, category, type CategoryKey } from '../lib/logCategories';
import { mergeFound, planSave, readingLine, readQuick } from '../lib/quickLog';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Composer } from '../ui/composer';
import { DetailScreen } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

export function QuickLogScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { add } = useCycle();
  const [key, setKey] = useState<CategoryKey>('cycle');
  const [tapped, setTapped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [spoken, setSpoken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = category(key);
  const reading = useMemo(() => readQuick(text), [text]);
  const recognised = readingLine(
    tapped.length ? mergeFound(reading.found, { [key]: tapped }) : reading.found,
    reading.flow,
    reading.daysAgo,
  );

  // Switching category clears the chips, which belong to the category they
  // were tapped in. Her words stay: she may have chosen the category after
  // writing the sentence.
  const choose = (next: CategoryKey) => {
    setKey(next);
    setTapped([]);
  };
  const toggle = (item: string) =>
    setTapped((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));

  const send = async () => {
    if (saving) return;
    const plan = planSave({ text, selected: key, tapped, files });
    if (!plan) return;
    const said = text.trim();
    setSaving(true);
    setError(null);
    try {
      const day = new Date();
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (plan.episode) {
        add(
          formToEpisode(
            {
              ...emptyForm(),
              kinds: plan.episode.kinds,
              flow: plan.episode.flow,
              day: plan.episode.daysAgo,
              periodStart: plan.episode.daysAgo,
              context: plan.episode.context,
              note: plan.wordsGoTo === 'episode' ? said : '',
              attachments: plan.wordsGoTo === 'episode' ? files : [],
            },
            false,
          ),
        );
      }
      if (plan.daily) {
        await repo.saveDailyLog({
          day: iso,
          digestion: plan.daily.digestion,
          ...(plan.wordsGoTo === 'daily' && said ? { note: said } : {}),
          ...(plan.wordsGoTo === 'daily' && files.length ? { attachments: files } : {}),
        });
      }
      if (plan.journal) {
        await repo.addJournal(said, plan.journal.kind, files, { category: plan.journal.category, items: plan.journal.items });
      }
      nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen title="Log" onBack={nav.back}>
      {/* Eight subjects, one row, scrolled sideways: the label is the choice. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.cats}>
        {CATEGORIES.map((c) => {
          const on = c.key === key;
          return (
            <Pressable
              key={c.key}
              onPress={() => choose(c.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [q.cat, on && q.catOn, pressed && q.pressed]}
            >
              <Text style={[font('subhead', on ? 'semibold' : 'regular'), on ? q.catTextOn : q.catText]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={q.pad}>
        {cat.quick.length ? (
          <View style={q.chips}>
            {cat.quick.map((item) => {
              const on = tapped.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [q.chip, on && q.chipOn, pressed && q.pressed]}
                >
                  <Text style={[font('footnote', on ? 'semibold' : 'regular'), on ? q.chipTextOn : q.chipText]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={[font('caption1'), q.hint]}>Or type it or say it, in a sentence. For example:</Text>
        <Text style={[font('subhead'), q.example]}>{displayCopy(cat.example)}</Text>

        <Composer
          value={text}
          onChange={(v, how) => {
            setText(v);
            if (how === 'spoken') setSpoken(true);
          }}
          placeholder={cat.example}
          label={`Log ${cat.label.toLowerCase()} in your own words`}
          attachments={files}
          onAttachments={setFiles}
          onSend={send}
        />

        {recognised ? (
          <Text style={[font('footnote'), q.noted]}>
            Will be saved as: {displayCopy(recognised)}
            {spoken ? ', spoken' : ''}
          </Text>
        ) : text.trim() ? (
          <Text style={[font('footnote'), q.noted]}>Saved in your own words, under {cat.label}.</Text>
        ) : null}

        {error ? <Text style={[font('footnote'), q.error]}>{displayCopy(error)}</Text> : null}

        {cat.detail && cat.detailLabel ? (
          <Pressable
            onPress={() => nav.push(cat.detail as Screen)}
            accessibilityRole="button"
            accessibilityLabel={cat.detailLabel}
            style={({ pressed }) => [q.detail, pressed && q.pressed]}
          >
            <Text style={[font('subhead'), q.detailText]}>{displayCopy(cat.detailLabel)}</Text>
          </Pressable>
        ) : null}
      </View>
    </DetailScreen>
  );
}

const q = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER },
  cats: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 4 },
  cat: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.recessed,
  },
  catOn: { backgroundColor: L.ink, borderColor: L.ink },
  catText: { color: L.body },
  catTextOn: { color: L.canvas },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACE.near },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  chipOn: { backgroundColor: L.statement, borderColor: L.ink },
  chipText: { color: L.body },
  chipTextOn: { color: L.ink },
  hint: { color: L.meta, marginTop: SPACE.block },
  example: { color: L.body, marginTop: 4, marginBottom: 12, lineHeight: 22 },
  noted: { color: L.meta, marginTop: 10, lineHeight: 18 },
  error: { color: L.ink, marginTop: 10 },
  detail: { marginTop: SPACE.block, paddingVertical: 14, alignItems: 'center' },
  detailText: { color: L.body },
  pressed: { opacity: 0.55 },
});
