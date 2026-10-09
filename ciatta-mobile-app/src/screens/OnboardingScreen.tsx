import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayCopy } from '../lib/displayCopy';
import {
  AGE_RANGES,
  type AgeRange,
  type Answers,
  buildReflection,
  correctionTarget,
  emptyAnswers,
  INTENTS,
  type Intent,
  LIFE_STAGES,
  type LifeStage,
  type StepId,
  stepsFor,
} from '../lib/onboarding';
import { connectAppleHealth } from '../lib/connectHealth';
import { useDictation } from '../lib/dictation';
import { useRepo, useSession } from '../state/session';
import { C, font, GUTTER, RADIUS } from '../theme';
import { TextButton } from '../ui/chrome';
import { ChoiceChips, RemovableChips, StepHeader, StepProgress } from '../ui/cycleInputs';
import { Card, PrimaryButton, SecondaryButton } from '../ui/kit';

// The first session.
//
// Tell, clarify, connect, reflect, correct, begin. The order is the point: she
// says what is going on in her own words before Ciatta offers a single
// checkbox, because a questionnaire asked first teaches her that Ciatta wants
// data entry, and the rest of the product then has to undo that.
//
// Every step can be passed over. A skip is recorded rather than silently
// treated as an empty answer, because the reflection has to tell a question
// she declined apart from one Ciatta never asked, and only one of those is a
// gap it can offer to fill.

// A free text list she builds by typing and adding. Used for conditions,
// medications and anything else where a fixed list would be a guess about her:
// nobody's medication list is a multiple choice question.
function AddList({
  label,
  hint,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    // Case insensitive, because "Magnesium" and "magnesium" are one thing and
    // showing both back to her would look like Ciatta was not listening.
    if (!items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft('');
  };
  return (
    <View style={s.block}>
      <Text style={[font('headline'), { color: C.text }]}>{label}</Text>
      {hint ? <Text style={[font('footnote'), s.hint]}>{hint}</Text> : null}
      <View style={s.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          returnKeyType="done"
          style={[font('body'), s.input]}
          accessibilityLabel={label}
        />
        <TextButton label="Add" onPress={add} />
      </View>
      {items.length ? <RemovableChips items={items} onRemove={(i) => onChange(items.filter((x) => x !== i))} /> : null}
    </View>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const repo = useRepo();
  const { userId } = useSession();
  const insets = useSafeAreaInsets();
  const [a, setA] = useState<Answers>(emptyAnswers());
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [sourceNote, setSourceNote] = useState('');
  const [sourceConnected, setSourceConnected] = useState(false);

  // Dictation appends to whatever she has already typed, rather than
  // replacing it, so speaking and typing can be mixed in one answer.
  const dictation = useDictation((text) => {
    setA((prev) => ({
      ...prev,
      opening: prev.opening.trim() ? `${prev.opening.trim()} ${text}` : text,
      openingMode: 'spoken',
    }));
  });

  const onConnectHealth = async () => {
    if (connecting || !userId) return;
    setConnecting(true);
    try {
      const result = await connectAppleHealth({
        userId,
        saveStatus: (kind, status, lastSyncedAt) => repo.saveSourceStatus(kind, status, lastSyncedAt),
        onNote: setSourceNote,
      });
      // Only a real sync sets this. The reflection may then say data was read;
      // without it, it may not, and a refused or unsupported connection must
      // not read as a successful one.
      setSourceConnected(result.connected);
    } catch {
      setSourceNote('Apple Health did not connect. You can try again from Profile.');
      setSourceConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  // Recomputed from her answers, so choosing menopause at the life stage step
  // removes the cycle step that would have followed it.
  const steps = useMemo(() => stepsFor(a), [a]);
  const step: StepId = steps[Math.min(i, steps.length - 1)];
  const reflection = useMemo(() => buildReflection(a), [a]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1));
  const back = () => setI((n) => Math.max(n - 1, 0));
  const skip = () => {
    setA((prev) => (prev.skipped.includes(step) ? prev : { ...prev, skipped: [...prev.skipped, step] }));
    next();
  };

  const toggle = <T extends string>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await repo?.completeOnboarding(a);
      onDone();
    } catch {
      // Her answers stay on screen. A failed save must not look like a
      // finished session, and it must not throw away what she just typed.
      setError('That did not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={[s.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'welcome' ? null : <StepProgress index={i - 1} total={steps.length - 1} />}

        {step === 'welcome' ? (
          <View style={s.welcome}>
            <Text style={[font('title1'), { color: C.text }]} accessibilityRole="header">
              Let&rsquo;s put the pieces of your health together.
            </Text>
            <Text style={[font('body'), s.lede]}>
              Ciatta connects what you log, what your devices measure, and what your records hold, then shows you what
              it can and cannot yet say. You can start with one sentence.
            </Text>
            <Text style={[font('footnote'), s.quiet]}>
              Nothing here is required. Skip anything, and add it whenever you like.
            </Text>
          </View>
        ) : null}

        {step === 'tell' ? (
          <View>
            <StepHeader
              title="What&rsquo;s been changing with your health, or what would you like to understand better?"
              hint="In your own words. Ciatta keeps this exactly as you write it."
            />
            <TextInput
              value={a.opening}
              onChangeText={(t) => set({ opening: t, openingMode: 'typed' })}
              placeholder="However you would say it to someone who knows you"
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
              style={[font('body'), s.textarea]}
              accessibilityLabel="What has been changing with your health"
            />
            {/*
              Shown while she speaks and not yet part of her answer. Greyed
              because it can still change: the recogniser revises a word
              several times before settling, and showing a guess in the same
              weight as her committed text would be claiming she said it.
            */}
            {dictation.listening ? (
              <Text style={[font('body'), s.partial]}>{dictation.partial || 'Listening'}</Text>
            ) : null}
            <View style={s.dictateRow}>
              <SecondaryButton
                label={dictation.listening ? 'Stop' : 'Speak instead'}
                onPress={dictation.listening ? dictation.stop : dictation.start}
              />
            </View>
            {dictation.error ? (
              <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
                {displayCopy(dictation.error)}
              </Text>
            ) : (
              <Text style={[font('caption1'), s.quiet]}>
                Dictation stays on your phone. The words are turned into text here, not sent anywhere to be
                transcribed.
              </Text>
            )}
          </View>
        ) : null}

        {step === 'intent' ? (
          <View>
            <StepHeader title="What brought you here?" hint="Choose as many as fit. Most women have more than one." />
            <ChoiceChips
              options={INTENTS.map((o) => o.label)}
              selected={a.intents.map((id) => INTENTS.find((o) => o.id === id)?.label ?? '')}
              onToggle={(label) => {
                const id = INTENTS.find((o) => o.label === label)?.id;
                if (id) set({ intents: toggle(a.intents, id as Intent) });
              }}
            />
          </View>
        ) : null}

        {step === 'about' ? (
          <View>
            <StepHeader title="A little about you" hint="Only what changes how Ciatta reads the rest." />
            <Text style={[font('headline'), s.block, { color: C.text }]}>Age range</Text>
            <ChoiceChips
              single
              options={AGE_RANGES.map((o) => o.label)}
              selected={a.ageRange ? [AGE_RANGES.find((o) => o.id === a.ageRange)?.label ?? ''] : []}
              onToggle={(label) => {
                const id = AGE_RANGES.find((o) => o.label === label)?.id;
                set({ ageRange: (a.ageRange === id ? null : id) as AgeRange | null });
              }}
            />
            <Text style={[font('headline'), s.block, { color: C.text }]}>Where you are right now</Text>
            <ChoiceChips
              single
              options={LIFE_STAGES.map((o) => o.label)}
              selected={a.lifeStage ? [LIFE_STAGES.find((o) => o.id === a.lifeStage)?.label ?? ''] : []}
              onToggle={(label) => {
                const id = LIFE_STAGES.find((o) => o.label === label)?.id;
                set({ lifeStage: (a.lifeStage === id ? null : id) as LifeStage | null });
              }}
            />
          </View>
        ) : null}

        {step === 'cycle' ? (
          <View>
            <StepHeader
              title="Your cycle"
              hint="A rough answer is useful. Without a typical length there is nothing to call a short cycle short."
            />
            <Text style={[font('headline'), s.block, { color: C.text }]}>Typical length</Text>
            <ChoiceChips
              single
              options={['Under 24 days', '24 to 27 days', '28 to 31 days', '32 days or more', 'Too irregular to say']}
              selected={cycleChoice(a.cycleLength, a.cycleRegular)}
              onToggle={(label) => set(cycleFromChoice(label, a))}
            />
          </View>
        ) : null}

        {step === 'conditions' ? (
          <View>
            <StepHeader
              title="Anything already diagnosed?"
              hint="Conditions or surgeries. Ciatta reads later findings differently when it knows these."
            />
            <AddList
              label="Conditions"
              placeholder="Endometriosis, PCOS, thyroid"
              items={a.conditions}
              onChange={(conditions) => set({ conditions })}
            />
            <AddList
              label="Surgeries"
              hint="The year is enough if you remember it. It is fine if you do not."
              placeholder="Laparoscopy"
              items={a.surgeries}
              onChange={(surgeries) => set({ surgeries })}
            />
          </View>
        ) : null}

        {step === 'medications' ? (
          <View>
            <StepHeader
              title="Anything you take regularly?"
              hint="Medications and supplements both change how a measurement should be read."
            />
            <AddList
              label="Medications"
              placeholder="Levothyroxine"
              items={a.medications}
              onChange={(medications) => set({ medications })}
            />
            <AddList
              label="Supplements"
              placeholder="Magnesium"
              items={a.supplements}
              onChange={(supplements) => set({ supplements })}
            />
          </View>
        ) : null}

        {step === 'symptoms' ? (
          <View>
            <StepHeader
              title="What have you been noticing?"
              hint="These become the things Ciatta watches for next time."
            />
            <ChoiceChips
              options={[
                'Fatigue',
                'Bloating',
                'Sleep disruption',
                'Nausea',
                'Headache',
                'Mood changes',
                'Breast tenderness',
                'Digestive changes',
                'Bowel changes',
                'Abdominal discomfort',
                'Dizziness',
              ]}
              selected={a.symptoms}
              onToggle={(v) => set({ symptoms: toggle(a.symptoms, v) })}
            />
          </View>
        ) : null}

        {step === 'connect' ? (
          <View>
            <StepHeader
              title="Bring in what already exists"
              hint="Optional, and Ciatta works without any of it. You can connect later from Profile."
            />
            <Card style={s.card}>
              <Text style={[font('headline'), { color: C.text }]}>Apple Health</Text>
              <Text style={[font('footnote'), s.hint]}>
                Sleep, steps, heart rate and temperature, measured rather than remembered. This is what lets Ciatta
                compare a week to your own usual instead of to an average woman.
              </Text>
              <View style={s.block}>
                <SecondaryButton
                  label={connecting ? 'Connecting' : sourceConnected ? 'Connected' : 'Connect Apple Health'}
                  onPress={onConnectHealth}
                />
              </View>
              {/*
                Whatever actually happened, including unsupported and refused.
                The status behind this line is written to health_sources at
                each step, so the screen and the record cannot disagree.
              */}
              {sourceNote ? (
                <Text style={[font('footnote'), s.hint]} accessibilityLiveRegion="polite">
                  {displayCopy(sourceNote)}
                </Text>
              ) : null}
            </Card>
            <Card style={s.card}>
              <Text style={[font('headline'), { color: C.text }]}>Records and results</Text>
              <Text style={[font('footnote'), s.hint]}>
                Lab results and documents carry dates and reference ranges, which is what turns a number into something
                Ciatta can place in time.
              </Text>
            </Card>
            <Text style={[font('footnote'), s.quiet]}>
              Connecting is done from Profile, where you can also disconnect a source or delete what it brought in.
            </Text>
          </View>
        ) : null}

        {step === 'reflect' ? (
          <View>
            <StepHeader
              title="Here&rsquo;s what Ciatta has so far"
              hint="Everything below is what you told it today. Nothing here is measured, and nothing is a conclusion."
            />

            {reflection.known.length ? (
              <Card style={s.card}>
                {reflection.known.map((k) => (
                  <Pressable
                    key={k.label}
                    onPress={() => setI(steps.indexOf(correctionTarget(a, k.label)))}
                    accessibilityRole="button"
                    // The label carries the value, not just the action. An
                    // accessibilityLabel replaces the children for a screen
                    // reader, so "Change Conditions" would have made the one
                    // screen whose job is showing her what Ciatta recorded
                    // the one screen a blind user cannot hear it from.
                    accessibilityLabel={`${k.label}, ${k.value}`}
                    accessibilityHint="Opens this question so you can change your answer"
                    style={({ pressed }) => [s.knownRow, pressed && s.pressed]}
                  >
                    <Text style={[font('caption1'), s.quiet]}>{k.label}</Text>
                    <Text style={[font('body'), { color: C.text }]}>{displayCopy(k.value)}</Text>
                    <Text style={[font('caption2'), { color: C.tint }]}>Change</Text>
                  </Pressable>
                ))}
                <Text style={[font('caption2'), s.stamp]}>You told Ciatta this</Text>
              </Card>
            ) : (
              <Card style={s.card}>
                <Text style={[font('body'), { color: C.text }]}>
                  You skipped the questions, which is allowed. Ciatta knows nothing about you yet, and will say so
                  rather than guess.
                </Text>
              </Card>
            )}

            <Text style={[font('headline'), s.block, { color: C.text }]}>What Ciatta cannot say yet</Text>
            {reflection.gaps.map((g) => (
              <Card key={g.label} style={s.card}>
                <Text style={[font('subhead', 'semibold'), { color: C.text }]}>{g.label}</Text>
                <Text style={[font('footnote'), s.hint]}>{g.why}</Text>
              </Card>
            ))}

            {reflection.nextStep ? (
              <Card style={s.card}>
                <Text style={[font('caption2'), s.stamp]}>Worth doing next</Text>
                <Text style={[font('body'), { color: C.text, marginTop: 4 }]}>{reflection.nextStep}</Text>
              </Card>
            ) : null}

            <View style={s.block}>
              <TextButton label="Start the questions again" onPress={() => setI(1)} />
            </View>

            {error ? (
              <Text style={[font('footnote'), s.error]} accessibilityLiveRegion="polite">
                {displayCopy(error)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={s.actions}>
          {step === 'welcome' ? (
            <PrimaryButton label="Start" onPress={next} />
          ) : step === 'reflect' ? (
            <PrimaryButton label={saving ? 'Saving' : 'Go to Today'} onPress={finish} />
          ) : (
            <>
              <PrimaryButton label="Continue" onPress={next} />
              <SecondaryButton label="Skip this" onPress={skip} />
            </>
          )}
          {step === 'welcome' ? null : <TextButton label="Back" onPress={back} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// The cycle step offers ranges rather than a number field, because a woman who
// is asked for an exact length either counts back through a calendar or
// invents one, and an invented number is worse than a range.
function cycleChoice(length: number | null, regular: boolean | null): string[] {
  if (regular === false) return ['Too irregular to say'];
  if (length == null) return [];
  if (length < 24) return ['Under 24 days'];
  if (length <= 27) return ['24 to 27 days'];
  if (length <= 31) return ['28 to 31 days'];
  return ['32 days or more'];
}

function cycleFromChoice(label: string, a: Answers): Partial<Answers> {
  const same = cycleChoice(a.cycleLength, a.cycleRegular)[0] === label;
  if (same) return { cycleLength: null, cycleRegular: null };
  switch (label) {
    // The midpoint of the range she chose, and the range is what she actually
    // said. Nothing downstream may treat this as a measured cycle length.
    case 'Under 24 days':
      return { cycleLength: 22, cycleRegular: true };
    case '24 to 27 days':
      return { cycleLength: 26, cycleRegular: true };
    case '28 to 31 days':
      return { cycleLength: 29, cycleRegular: true };
    case '32 days or more':
      return { cycleLength: 33, cycleRegular: true };
    case 'Too irregular to say':
      return { cycleLength: null, cycleRegular: false };
    default:
      return {};
  }
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: GUTTER, flexGrow: 1 },
  welcome: { paddingTop: 48 },
  lede: { color: C.secondary, marginTop: 14, lineHeight: 25 },
  quiet: { color: C.muted, marginTop: 14 },
  hint: { color: C.secondary, marginTop: 4, lineHeight: 19 },
  block: { marginTop: 22 },
  card: { marginTop: 12 },
  knownRow: { marginBottom: 12, minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  stamp: { color: C.muted, marginTop: 4 },
  textarea: {
    color: C.text,
    backgroundColor: C.card,
    borderRadius: RADIUS,
    padding: 14,
    minHeight: 132,
    marginTop: 16,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  input: { flex: 1, color: C.text, backgroundColor: C.card, borderRadius: RADIUS, paddingHorizontal: 12, height: 44 },
  error: { color: C.tint, marginTop: 12 },
  partial: { color: C.muted, marginTop: 10, fontStyle: 'italic' },
  dictateRow: { marginTop: 12 },
  actions: { marginTop: 32, gap: 12, alignItems: 'stretch' },
});
