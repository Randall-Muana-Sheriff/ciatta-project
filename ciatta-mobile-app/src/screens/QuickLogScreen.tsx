// One screen for logging, and the box is the first thing on it.
//
// What this replaces: a plus that opened a menu of three screens, one of
// which opened a fifteen step questionnaire whose first screen was "What
// happened?" and a wall of chips. The box she writes in sat at the bottom
// of every one of those steps, which is to say the fastest part of the
// experience was the last thing she reached.
//
// So: a tab row saying which part of her record this belongs to, the box
// with a real example sentence in it, and send. The questionnaire is one
// link away, unchanged, for the episode worth describing properly.
//
// The sentence is read by lib/quickLog for the vocabulary the record
// already uses, and everything it recognised is printed under the box
// before she sends, so nothing is stored that she has not seen. Words it
// did not recognise are kept verbatim rather than dropped.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { emptyForm, formToEpisode } from '../data/cycleLog';
import { displayCopy } from '../lib/displayCopy';
import { type QuickTab, QUICK_TABS, quickTab, readingLine, readQuick } from '../lib/quickLog';
import { userFacingError } from '../lib/userFacingError';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Composer } from '../ui/composer';
import { DetailScreen, SegmentedControl } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

const LABELS = QUICK_TABS.map((t) => t.label) as [string, string, string];

export function QuickLogScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { add } = useCycle();
  const [key, setKey] = useState<QuickTab>('cycle');
  const [text, setText] = useState('');
  const [spoken, setSpoken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = quickTab(key);
  const reading = useMemo(() => readQuick(text), [text]);
  const recognised = readingLine(reading);

  const send = async () => {
    const said = text.trim();
    if (!said || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (key === 'cycle') {
        // A real episode, through the path the questionnaire uses, so it
        // reaches the same record and the same engine.
        add(
          formToEpisode(
            {
              ...emptyForm(),
              kinds: reading.kinds,
              flow: reading.flow,
              day: reading.daysAgo,
              periodStart: reading.daysAgo,
              context: reading.context,
              note: said,
            },
            false,
          ),
        );
      } else {
        // Her day and her notes both land in the journal, dated, in her
        // words. A day is filed as Context because that is what the record
        // calls food, caffeine, sleep and the rest of what surrounded it.
        await repo.addJournal(said, key === 'day' ? 'Context' : 'Notes');
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
      <View style={q.pad}>
        <SegmentedControl
          segments={LABELS}
          active={tab.label}
          onChange={(label) => setKey((QUICK_TABS.find((t) => t.label === label) ?? QUICK_TABS[0]).key)}
        />

        {/*
          The box, immediately. One line above it says the two ways in,
          because the mic in the corner is the fastest route for someone
          holding a phone in one hand and is easy to miss.
        */}
        <Text style={[font('caption1'), q.hint]}>Type it or say it, in a sentence. For example:</Text>
        <Text style={[font('subhead'), q.example]}>{displayCopy(tab.example)}</Text>

        <Composer
          value={text}
          onChange={(v, how) => {
            setText(v);
            if (how === 'spoken') setSpoken(true);
          }}
          placeholder={tab.example}
          label={`Log ${tab.label.toLowerCase()} in your own words`}
          onSend={send}
          minHeight={120}
        />

        {/*
          What was recognised, shown before it is stored. Reported, not
          measured: these are her words read back, and the only reason to
          print them is so she can correct the sentence if Ciatta read it
          wrong.
        */}
        {recognised ? (
          <Text style={[font('footnote'), q.noted]}>
            Will be saved as: {displayCopy(recognised)}
            {spoken ? ', spoken' : ''}
          </Text>
        ) : text.trim() ? (
          <Text style={[font('footnote'), q.noted]}>Saved in your own words.</Text>
        ) : null}

        {error ? <Text style={[font('footnote'), q.error]}>{displayCopy(error)}</Text> : null}

        {/* The long form, for the episode worth describing properly. */}
        <Pressable
          onPress={() => nav.push(tab.detail as Screen)}
          accessibilityRole="button"
          accessibilityLabel={tab.detailLabel}
          style={({ pressed }) => [q.detail, pressed && q.pressed]}
        >
          <Text style={[font('subhead'), q.detailText]}>{displayCopy(tab.detailLabel)}</Text>
        </Pressable>
      </View>
    </DetailScreen>
  );
}

const q = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER },
  hint: { color: L.meta, marginTop: SPACE.block },
  example: { color: L.body, marginTop: 4, marginBottom: 12, lineHeight: 22 },
  noted: { color: L.meta, marginTop: 10, lineHeight: 18 },
  error: { color: L.ink, marginTop: 10 },
  detail: { marginTop: SPACE.block, paddingVertical: 14, alignItems: 'center' },
  detailText: { color: L.body },
  pressed: { opacity: 0.55 },
});
