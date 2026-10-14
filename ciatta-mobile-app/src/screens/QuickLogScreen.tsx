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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STOOL_TYPES } from '../data/cycleLog';
import { chipIcon } from '../lib/chipIcons';
import type { Attachment } from '../lib/attachments';
import { displayCopy } from '../lib/displayCopy';
import { bowelDetail, category, type CategoryKey, LOG_TABS, SYMPTOM_GROUPS } from '../lib/logCategories';
import { mergeFound, readingLine, readQuick } from '../lib/quickLog';
import { userFacingError } from '../lib/userFacingError';
import { handPhoto } from '../lib/scanHandoff';
import { openUse, type ProductUse } from '../lib/periodProducts';
import { tssWarning } from '../lib/productSafety';
import * as ImagePicker from 'expo-image-picker';
import { type Screen, useNav } from '../navigation';
import { useCycle } from '../state/cycleStore';
import { useRepo } from '../state/session';
import { font, GUTTER } from '../theme';
import { Composer } from '../ui/composer';
import { DetailScreen, PrimaryButton, SaveBar } from '../ui/kit';
import { ProductLogger } from '../ui/ProductLogger';
import { Icon } from '../ui/icons';
import { StoolPicture } from '../ui/stoolScale';
import { takeLogCategory, takeLogMode } from '../lib/logHandoff';
import { useQuickLogSave } from '../state/quickLogSave';
import { L, SPACE } from '../ui/surface';
import { GlassFill } from '../ui/frosted';

export function QuickLogScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { startDraft } = useCycle();
  // A category that now lives under Symptoms opens Symptoms.
  const [key, setKey] = useState<CategoryKey>(() => {
    const k = takeLogCategory() ?? 'symptoms';
    return (['body', 'mind', 'skin', 'sexual'] as CategoryKey[]).includes(k) ? 'symptoms' : k;
  });
  // How she chose to log, from the button that opened this: the box opens
  // listening, typing or on the camera. A meal photo goes to the scan.
  const [mode] = useState(() => takeLogMode());
  const [tapped, setTapped] = useState<string[]>([]);
  // Under Gut: the Bristol type of a bowel movement, one tap. Choosing one
  // logs the movement with it.
  const [stool, setStool] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [spoken, setSpoken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What has already landed for this entry, so a retry after a failure
  // does not save any part of it twice. An edit makes it a new entry.
  const done = useRef(new Set<string>());
  const [pickNote, setPickNote] = useState<string | null>(null);
  // What she has in, so warning signs written in any category are checked
  // against it as she types.
  const [inNow, setInNow] = useState<ProductUse | null>(null);
  // Her own medicines and supplements, from her profile, offered as chips
  // under their own category so a tap names the one she means.
  const [own, setOwn] = useState<{ meds: string[]; supplements: string[] }>({ meds: [], supplements: [] });
  useEffect(() => {
    const clean = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
    repo
      .loadReported()
      .then((r) => setOwn({ meds: clean(r.medications), supplements: clean(r.supplements) }))
      .catch(() => {});
  }, [repo]);
  useEffect(() => {
    repo.loadProductUses().then((u) => setInNow(openUse(u))).catch(() => {});
  }, [repo]);
  const urgent = tssWarning(`${text} ${tapped.join(' ')}`, inNow);
  const pickMeal = async (from: 'camera' | 'library') => {
    setPickNote(null);
    try {
      if (from === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPickNote('Ciatta needs camera permission for this. You can turn it on in Settings, or choose a photo instead.');
          return;
        }
      }
      const picked =
        from === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (picked.canceled || !picked.assets?.length) return;
      handPhoto(picked.assets[0].uri);
      nav.push('foodScan');
    } catch {
      setPickNote('That did not open.');
    }
  };
  useEffect(() => {
    done.current = new Set();
  }, [text, tapped, files, key, stool]);
  useEffect(() => {
    if (mode === 'camera' && key === 'nutrition') void pickMeal('camera');
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cat = category(key);
  const mine = key === 'meds' ? own.meds : key === 'supplements' ? own.supplements : [];
  const chips = [...mine.filter((x) => !cat.quick.includes(x)), ...cat.quick];
  const reading = useMemo(() => readQuick(text), [text]);
  // A bowel movement she tapped or wrote, with the way into its full detail.
  const bowel = bowelDetail([...(key === 'gut' ? tapped : []), ...(reading.found.gut ?? [])]);
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
    setStool(null);
  };
  const toggle = (item: string) =>
    setTapped((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));

  const save = useQuickLogSave();
  const send = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await save({ text, key, tapped, files, stool }, done.current);
      if (saved) nav.back();
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Log"
      onBack={nav.back}
      // Save, always in reach: under the screen, above the keyboard. It
      // saves words, taps, a stool type or files, whichever she gave.
      footer={
        <SaveBar
          label={saving ? 'Saving' : 'Save'}
          disabled={saving || !(text.trim() || tapped.length || stool != null || files.length)}
          onPress={() => void send()}
        />
      }
    >
      {/* The subjects, one row, scrolled sideways: the label is the choice.
          Every symptom is under Symptoms. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={q.cats}>
        {LOG_TABS.map(category).map((c) => {
          const on = c.key === key;
          return (
            <Pressable
              key={c.key}
              onPress={() => choose(c.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [q.cat, on && q.catOn, pressed && q.pressed]}
            >
              <GlassFill />
              <Text style={[font('subhead', on ? 'semibold' : 'regular'), on ? q.catTextOn : q.catText]}>{displayCopy(c.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={q.pad}>
        {/* Say it, type it or snap it: the box first, with the example
            as its placeholder. Taps and forms follow for whoever wants them. */}
        <Text style={[font('caption1'), q.hint]}>Say it, type it, or add a photo with the plus.</Text>
        <Composer
          value={text}
          onChange={(v, how) => {
            setText(v);
            if (how === 'spoken') setSpoken(true);
          }}
          placeholder={displayCopy(cat.example)}
          label={`Log ${cat.label.toLowerCase()} in your own words`}
          attachments={files}
          onAttachments={(next) => {
            // Under Nutrition, a photo added with the plus is a meal to
            // read, so it goes to the scan rather than sitting as a file.
            const added = next.find((f) => f.kind === 'photo' && !files.some((x) => x.id === f.id));
            if (key === 'nutrition' && added) {
              handPhoto(added.uri);
              nav.push('foodScan');
              return;
            }
            setFiles(next);
          }}
          onSend={send}
          start={mode === 'camera' && key === 'nutrition' ? null : mode}
        />

        {/* Toxic shock warning signs with a tampon, cup or disc in: said at
            once, before anything else, whatever category she is in. */}
        {urgent ? (
          <Pressable onPress={() => nav.push('productSafety')} accessibilityRole="button" style={q.urgent}>
            <Text style={[font('subhead', 'semibold'), q.urgentText]}>{displayCopy(urgent)}</Text>
            <Text style={[font('footnote'), q.urgentText]}>Warning signs and what to do</Text>
          </Pressable>
        ) : null}

        {recognised ? (
          <Text style={[font('footnote'), q.noted]}>
            Will be saved as: {displayCopy(recognised)}
            {spoken ? ', spoken' : ''}
          </Text>
        ) : text.trim() ? (
          <Text style={[font('footnote'), q.noted]}>{displayCopy(`Saved in your own words, under ${cat.label}.`)}</Text>
        ) : null}

        {error ? <Text style={[font('footnote'), q.error]}>{displayCopy(error)}</Text> : null}

        {/* A bowel movement by its Bristol type: the seven pictures, one tap. */}
        {key === 'gut' ? (
          <>
            <Text style={[font('caption1'), q.orTap]}>Bowel movement, by type</Text>
            <View style={q.stools}>
              {STOOL_TYPES.map(({ type, word }) => {
                const on = stool === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setStool(on ? null : type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Type ${type}, ${displayCopy(word)}`}
                    style={({ pressed }) => [q.stool, on && q.chipOn, pressed && q.pressed]}
                  >
                    <GlassFill />
                    <StoolPicture type={type} color={on ? L.ink : L.body} width={30} />
                    <Text style={[font('caption2', on ? 'semibold' : 'regular'), on ? q.chipTextOn : q.chipText]}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
            {stool != null ? (
              <Text style={[font('footnote'), q.noted]}>
                {displayCopy(`Type ${stool}, ${STOOL_TYPES[stool - 1].word.toLowerCase()}. ${stool <= 2 ? 'On the hard side' : stool <= 4 ? 'The typical range' : 'On the loose side'} of the Bristol scale.`)}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* Every symptom, grouped as she would look for one. */}
        {key === 'symptoms'
          ? SYMPTOM_GROUPS.map((g) => (
              <View key={g.label} style={q.group}>
                <Text style={[font('footnote', 'semibold'), q.groupTitle]}>{g.label}</Text>
                <View style={q.chips}>
                  {g.items.map((item) => {
                    const on = tapped.includes(item);
                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggle(item)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={({ pressed }) => [q.chip, on && q.chipOn, pressed && q.pressed]}
                      >
                        <Icon name={chipIcon(item, g.category) ?? 'plus'} size={15} color={on ? L.ink : L.body} />
                        <Text style={[font('footnote', on ? 'semibold' : 'regular'), on ? q.chipTextOn : q.chipText]}>{displayCopy(item)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          : null}

        {chips.length ? <Text style={[font('caption1'), q.orTap]}>Or tap</Text> : null}
        {chips.length ? (
          <View style={q.chips}>
            {chips.map((item) => {
              const on = tapped.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [q.chip, on && q.chipOn, pressed && q.pressed]}
                >
                  <Icon name={chipIcon(item, key) ?? 'plus'} size={15} color={on ? L.ink : L.body} />
                  <Text style={[font('footnote', on ? 'semibold' : 'regular'), on ? q.chipTextOn : q.chipText]}>{displayCopy(item)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}


        {/* Products are logged by tap and saved at once, under Cycle only. */}
        {key === 'cycle' ? <ProductLogger /> : null}

        {/* A meal photo is read for its foods and figures, here and only
            here. Camera first; her library one tap away. */}
        {key === 'nutrition' ? (
          <View style={q.scan}>
            <PrimaryButton label="Scan a Meal" onPress={() => void pickMeal('camera')} />
            <Pressable onPress={() => void pickMeal('library')} accessibilityRole="button" style={({ pressed }) => [q.detail, pressed && q.pressed]}>
              <Text style={[font('subhead'), q.detailText]}>Choose a meal photo instead</Text>
            </Pressable>
            {pickNote ? <Text style={[font('footnote'), q.noted]}>{displayCopy(pickNote)}</Text> : null}
          </View>
        ) : null}


        {/*
          The stool scale, pain and flags live in the bowel step of the full
          form. Her words and files go with her, so nothing typed here is lost.
        */}
        {bowel ? (
          <Pressable
            onPress={() => {
              startDraft({ form: { ...bowel.draft.form, note: text.trim(), attachments: files } });
              nav.push('cycleLog');
            }}
            accessibilityRole="button"
            accessibilityLabel={bowel.label}
            style={({ pressed }) => [q.detail, pressed && q.pressed]}
          >
            <Text style={[font('subhead', 'semibold'), q.detailText]}>{displayCopy(bowel.label)}</Text>
          </Pressable>
        ) : null}

        {cat.detail && cat.detailLabel ? (
          <Pressable
            onPress={() => {
              // The step by step cycle form opens on a fresh entry, carrying
              // what she already wrote here.
              if (cat.detail === 'cycleLog') startDraft({ form: { note: text.trim(), attachments: files } });
              nav.push(cat.detail as Screen);
            }}
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
  orTap: { color: L.meta, marginTop: SPACE.near },
  group: { marginTop: SPACE.near },
  groupTitle: { color: L.ink },
  stools: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginTop: 8 },
  stool: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.glass,
    overflow: 'hidden',
  },
  cats: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 4 },
  cat: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.glass,
    overflow: 'hidden',
  },
  catOn: { backgroundColor: L.ink, borderColor: L.ink },
  catText: { color: L.body },
  catTextOn: { color: L.canvas },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  chipOn: { backgroundColor: L.statement, borderColor: L.ink },
  chipText: { color: L.body },
  chipTextOn: { color: L.ink },
  hint: { color: L.meta, marginTop: SPACE.near, marginBottom: 10 },
  noted: { color: L.meta, marginTop: 10, lineHeight: 18 },
  error: { color: L.ink, marginTop: 10 },
  detail: { marginTop: SPACE.block, paddingVertical: 14, alignItems: 'center' },
  detailText: { color: L.body },
  pressed: { opacity: 0.55 },
  scan: { marginTop: SPACE.block, gap: 4 },
  urgent: {
    marginTop: 12,
    gap: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EC5D4A',
    backgroundColor: 'rgba(236, 93, 74, 0.12)',
  },
  urgentText: { color: L.ink, lineHeight: 20 },
});
